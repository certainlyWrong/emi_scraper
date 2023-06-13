import puppeteer, { Browser } from 'puppeteer'

const runPage = async (browser: Browser) => {
  const page = await browser.newPage()

  await page.goto('https://mangalivre.net', { waitUntil: 'domcontentloaded' })

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 })

  page.evaluate(() => {
    return document.querySelectorAll('.item')
  })
}

const run = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  })

  runPage(browser)
  runPage(browser)
}

run()
