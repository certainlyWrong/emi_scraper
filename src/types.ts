import { Page } from 'puppeteer'

type DocumentCallback = (page: Page) => Promise<DocumentFragment>

type Chapter = {
  title?: string
  url?: string
  date?: string
  pages?: string[]
}

type Manga = {
  title: string
  url: string
  image_url: string
  description: string
  status?: string
  author?: string
  raiting?: string
  genres: string[]
  chapters: Chapter[]
  count_chapters?: number
}

type MangasExtractorCallback = (
  document: DocumentFragment
) => Promise<Array<Manga>>

type ChapterExtractorCallback = (page: Page, manga: Manga) => Promise<void>

type SaveCallback = (manga: Manga) => Promise<void>

export {
  DocumentCallback,
  Chapter,
  Manga,
  MangasExtractorCallback,
  ChapterExtractorCallback,
  SaveCallback
}
