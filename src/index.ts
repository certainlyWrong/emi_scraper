import { ScraperDispatch } from './scraper_dispatch'
import { azOrderLoadPage, chapterExtractor, mangasExtractor } from './callbacks'
import { MongoClient } from 'mongodb'
import { PrismaClient } from '@prisma/client'

const main = async (): Promise<void> => {
  const client = new MongoClient('mongodb://localhost:27017', {
    auth: {
      username: 'root',
      password: '1234'
    }
  })

  await client.connect()
  console.log('Connected successfully to server')

  const mangaCollection = client.db('scraper').collection('manga')

  const scraper = new ScraperDispatch(4, {
    azOrderLoadDocument: azOrderLoadPage,
    mangasExtractor: mangasExtractor,
    chapterExtractor: chapterExtractor,
    mangaCollection: mangaCollection
  })

  await scraper.run()

  // show mangas in database

  const mangas = await mangaCollection.find({}).toArray()

  // save in sqlite with prisma

  const prismaClient = new PrismaClient()

  for (const manga of mangas) {
    console.log('Salvando manga: ', manga.title)

    for (const genre of manga.genres) {
      if (
        (await prismaClient.genre.findUnique({ where: { name: genre } })) ===
        null
      ) {
        await prismaClient.genre.create({ data: { name: genre } })
      }
    }

    for (const chapter of manga.chapters) {
      await prismaClient.chapter.create({
        data: {
          title: chapter.title,
          manga: {
            connectOrCreate: {
              where: { title: manga.title },
              create: {
                title: manga.title,
                manga_url: manga.url,
                image_url: manga.image_url,
                description: manga.description,
                MangaGenre: {
                  create: manga.genres.map((genre: string) => {
                    return {
                      genre: {
                        connectOrCreate: {
                          where: { name: genre },
                          create: { name: genre }
                        }
                      }
                    }
                  })
                },
                author: manga.author,
                raiting: manga.raiting,
                status: manga.status
              }
            }
          },
          pages: {
            create: chapter.pages.map((page: string) => {
              return { url: page }
            })
          }
        }
      })
    }
  }

  await client.close()
  await prismaClient.$disconnect()
}

main()
