import { Page } from 'puppeteer'
import {
  Chapter,
  ChapterExtractorCallback,
  DocumentCallback,
  Manga,
  MangasExtractorCallback
} from './types'
import { JSDOM } from 'jsdom'

const azOrderLoadPage: DocumentCallback = async (
  page
): Promise<DocumentFragment> => {
  const documentString = await page.evaluate(() => {
    return window.document.body.innerHTML
  })

  const parser = JSDOM.fragment(documentString)

  return parser
}

const mangasExtractor: MangasExtractorCallback = async (
  document: DocumentFragment
): Promise<Array<Manga>> => {
  const mangas: Array<Manga> = []

  const mangasLI = document.querySelector('ul.seriesList')?.children ?? []

  for (const mangaLI of mangasLI) {
    const manga: Manga = {
      title: '',
      url: '',
      image_url: '',
      description: '',
      genres: [],
      chapters: []
    }

    manga.title =
      mangaLI.querySelector('span.series-title')?.firstChild?.textContent ?? ''
    manga.url = mangaLI.querySelector('a')?.getAttribute('href') ?? ''
    const imgLink =
      mangaLI.querySelector('.cover-image')?.getAttribute('style') ?? ''
    manga.image_url = imgLink
      .replace("background-image: url('", '')
      .replace("');", '')

    mangaLI.querySelector('span.series-chapters')?.firstChild?.remove()
    mangaLI.querySelector('span.series-chapters')?.firstChild?.remove()

    const chapsCount =
      mangaLI
        .querySelector('span.series-chapters')
        ?.textContent?.replaceAll('\n', '')
        .replaceAll('  ', '') ?? ''

    try {
      manga.count_chapters = parseInt(chapsCount) ?? 0
    } catch (error) {
      manga.count_chapters = 0
    }

    manga.description =
      mangaLI
        .querySelector('.series-desc')
        ?.textContent?.replaceAll('\n', '')
        .replaceAll('  ', '') ?? ''

    if (mangaLI.querySelector('i.complete-series') !== null) {
      manga.status = 'complete'
      mangaLI.querySelector('span.series-author')?.firstChild?.remove()
      mangaLI.querySelector('span.series-author')?.firstChild?.remove()
      manga.author = mangaLI
        .querySelector('span.series-author')
        ?.textContent?.replaceAll('\n', '')
        .replaceAll('  ', '')
    } else {
      manga.status = 'ongoing'
      manga.author = mangaLI
        .querySelector('span.series-author')
        ?.textContent?.replaceAll('\n', '')
        .replaceAll('  ', '')
    }

    manga.raiting =
      mangaLI.querySelector('ul .rating span.nota')?.textContent ?? ''

    mangaLI.querySelector('ul')?.firstChild?.remove()
    mangaLI.querySelector('ul')?.firstChild?.remove()

    const genres = mangaLI.querySelector('ul')?.children ?? []

    for (const genre of genres) {
      manga.genres.push(
        genre.textContent?.replaceAll('\n', '').replaceAll('  ', '') ?? ''
      )
    }

    mangas.push(manga)
  }

  return mangas
}

const isVerticalScrollable = async (page: Page): Promise<boolean> => {
  const isScrollable = await page.evaluate(() => {
    const display =
      document
        .querySelector('i.vertical-icon-wrapper')
        ?.getAttribute('style') ?? ''

    return display.includes('inline')
  })

  return isScrollable
}

const chapterExtractor: ChapterExtractorCallback = async (
  page,
  manga
): Promise<void> => {
  await page.goto(`https://mangalivre.net${manga.url}`, {
    waitUntil: 'networkidle2'
  })
  const documentString = await page.evaluate(async () => {
    let shouldScroll = true

    while (shouldScroll) {
      const innerHeight = window.innerHeight

      window.scrollTo(0, innerHeight)

      await new Promise(resolve => setTimeout(resolve, 1000))

      if (innerHeight >= window.innerHeight) {
        shouldScroll = false
      }
    }

    return window.document.body.innerHTML
  })

  const documentLoaded = JSDOM.fragment(documentString)
  const children = documentLoaded.querySelector(
    'ul.full-chapters-list.list-of-chapters'
  )?.children

  if (children !== undefined) {
    for (const child of children) {
      let loaded = false
      while (!loaded) {
        try {
          const chapter: Chapter = {
            pages: []
          }

          chapter.url =
            child.querySelector('a')?.getAttribute('href') ?? undefined
          chapter.title =
            child.querySelector('a')?.getAttribute('title') ?? undefined
          chapter.date =
            child.querySelector('span.chapter-date')?.textContent ?? undefined

          if (chapter.url !== undefined) {
            await page.goto(`https://mangalivre.net${chapter.url}`, {
              waitUntil: 'networkidle2'
            })

            if (await isVerticalScrollable(page)) {
              await page.click('a.orientation')
            }

            const fullDocumentString = await page.evaluate(async () => {
              await new Promise(resolve => setTimeout(resolve, 1000))

              document.body.setAttribute('style', 'overflow: scroll;')

              let shouldScroll = true

              while (shouldScroll) {
                const innerHeight = document.body.scrollHeight

                document.body.scrollTo(0, 500000)

                await new Promise(resolve => setTimeout(resolve, 2000))

                if (innerHeight >= document.body.scrollHeight) {
                  shouldScroll = false
                }
              }

              return window.document.body.innerHTML
            })

            const fullDocument = JSDOM.fragment(fullDocumentString)

            const firstImg =
              fullDocument
                .querySelector('div.manga-image picture img')
                ?.getAttribute('src') ?? undefined

            if (firstImg !== undefined) {
              chapter.pages?.push(firstImg)
            }

            const picturesChildren =
              fullDocument.querySelector('div.manga-continue')?.children

            if (picturesChildren !== undefined) {
              for (const picture of picturesChildren) {
                const imgSrc = picture.querySelector('img')?.src

                if (imgSrc !== undefined) {
                  chapter.pages?.push(imgSrc)
                }
              }
            }

            console.log(
              `Capitulo carregado com sucesso: ${manga.title} - ${chapter.title}`
            )
          }
          manga.chapters?.push(chapter)
          loaded = true
        } catch (error) {
          console.log(error)
          console.log(`Erro ao carregar capitulo de${manga.title}`)
        }
      }
    }

    console.log(manga.chapters)
  }
}

export { azOrderLoadPage, mangasExtractor, chapterExtractor }
