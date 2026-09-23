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

const card = await page
  .locator("div")
  .filter({ hasText: /^当前存续类型$/ })
  .first()
await card.scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await card.screenshot({
  path: "/Users/cookieqi/Downloads/Untitled/validation_screenshots/pie-current.png",
})
console.log("saved pie-current.png")

await browser.close()
