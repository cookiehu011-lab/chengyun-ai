import { chromium } from "playwright"

const browser = await chromium.launch({
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

await page.goto("http://localhost:3000/?nocache=1", {
  waitUntil: "load",
  timeout: 60000,
})
await page.waitForTimeout(1500)

const aiTab = page.locator("button").filter({ hasText: "AI统计" })
if ((await aiTab.count()) > 0) {
  await aiTab.first().click()
  await page.waitForTimeout(800)
}

const info = await page.evaluate(() => {
  const allDivs = Array.from(document.querySelectorAll("div"))
  const header = allDivs.find(
    (el) =>
      el.children.length === 0 && el.textContent?.trim() === "当前存续类型",
  )
  if (!header) return { headerFound: false }
  let card = header.parentElement
  while (card && !card.querySelector("canvas")) {
    card = card.parentElement
  }
  const canvas = card?.querySelector("canvas")
  const chartDiv = canvas?.parentElement
  return {
    headerFound: true,
    cardRect: card?.getBoundingClientRect(),
    chartDivRect: chartDiv?.getBoundingClientRect(),
    canvasRect: canvas?.getBoundingClientRect(),
    canvasComputed: canvas ? window.getComputedStyle(canvas) : null,
    chartDivComputed: chartDiv ? window.getComputedStyle(chartDiv) : null,
  }
})

console.log(JSON.stringify(info, null, 2))
await browser.close()
