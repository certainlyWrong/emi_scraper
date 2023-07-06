import puppeteer, { Browser } from 'puppeteer'
import { azOrder } from './constants'
import {
  ChapterExtractorCallback,
  DocumentCallback,
  MangasExtractorCallback
} from './types'
import { Collection } from 'mongodb'

export class ScraperDispatch {
  private stack: number
  private azOrder = azOrder
  private azOrderLoadDocument: DocumentCallback | null
  private chapterExtractor: ChapterExtractorCallback | null
  private pagesLoadDocument: DocumentCallback | null
  private mangasExtractor: MangasExtractorCallback | null
  private mangaCollection: Collection | null

  constructor(
    stack: number,
    {
      azOrderLoadDocument = null,
      pagesLoadDocument = null,
      mangasExtractor = null,
      chapterExtractor = null,
      mangaCollection = null
    }: {
      azOrderLoadDocument?: DocumentCallback | null
      chapterLoadDocument?: DocumentCallback | null
      pagesLoadDocument?: DocumentCallback | null
      mangasExtractor?: MangasExtractorCallback | null
      chapterExtractor?: ChapterExtractorCallback | null
      mangaCollection?: Collection | null
    }
  ) {
    this.stack = stack
    this.azOrderLoadDocument = azOrderLoadDocument
    this.chapterExtractor = chapterExtractor
    this.pagesLoadDocument = pagesLoadDocument
    this.mangasExtractor = mangasExtractor
    this.mangaCollection = mangaCollection
  }

  async run(): Promise<void> {
    let stackCount = 0
    let promisesForLetter: Promise<void>[] = []

    for (const letter of this.azOrder) {
      console.log(`Running letter: ${letter}`)

      const browser = await puppeteer.launch({
        // headless: 'new',
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
      })

      promisesForLetter.push(
        this.runLetterPage(browser, letter)
          .then(() => {
            browser.close()
          })
          .catch(() => {
            browser.close()
          })
      )
      stackCount++

      if (stackCount === this.stack) {
        console.log('Waiting for stack to finish')
        await Promise.all(promisesForLetter)
        promisesForLetter = []
        stackCount = 0
      }
    }

    await Promise.all(promisesForLetter)
    console.log('Done')
  }

  private async runLetterPage(browser: Browser, letter: string): Promise<void> {
    const page = await browser.newPage()

    let pagesCount = 1
    let hasNextPage = true

    while (hasNextPage) {
      let mangasDocumentLoaded: DocumentFragment | null = null
      try {
        const response = await page.goto(
          `https://mangalivre.net/lista-de-mangas/ordenar-por-nome/${letter}?page=${pagesCount}`,
          {
            waitUntil: 'networkidle2',
            timeout: 0
          }
        )

        if (response !== null && response.status() === 200) {
          console.log(`Running letter: ${letter} page: ${pagesCount}`)
          mangasDocumentLoaded =
            (await this.azOrderLoadDocument?.call(this, page)) ?? null

          pagesCount++
        } else {
          hasNextPage = false
        }
      } catch (error) {
        console.log('Erro ao carregar página')
      }

      if (mangasDocumentLoaded !== null) {
        const mangas =
          (await this.mangasExtractor?.call(this, mangasDocumentLoaded)) ?? []

        for (const manga of mangas) {
          try {
            if (manga.raiting !== undefined && parseInt(manga.raiting) < 7.5) {
              console.log(`Manga don't save: ${manga.title} Raiting`)
              continue
            }
          } catch (error) {
            console.log(error)
          }

          let loaded = false
          while (!loaded) {
            try {
              await this.chapterExtractor?.call(this, page, manga)

              await this.mangaCollection?.insertOne(manga)

              console.log(`Manga loaded: ${manga.title}`)
              console.log(manga)

              // limpar os capítulos para não ocupar memória
              manga.chapters = []
              loaded = true
            } catch (error) {
              console.log(
                `Erro ao carregar manga, tentando novamente... Manga:${manga.title}`
              )

              manga.chapters = []
            }
          }
        }
      }

      const mangasLoaded = await this.mangaCollection?.countDocuments()

      console.log(`Mangas loaded: ${mangasLoaded}`)
    }

    await page.close()
  }
}
