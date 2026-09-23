import { chromium } from "playwright"

const browser = await chromium.launch({
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

page.on("console", (msg) => console.log(`[${msg.type()}]`, msg.text()))
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message))

await page.goto("http://localhost:4179?nocache=1", {
  waitUntil: "load",
  timeout: 60000,
})
await page.waitForTimeout(1000)

const before = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button")).map(
    (b) => b.textContent,
  )
  return { buttons }
})
console.log("buttons before:", before.buttons.slice(0, 20))

const wbBtn = page.locator("button").filter({ hasText: "AI工作台" })
console.log("workbench button count:", await wbBtn.count())
await wbBtn.first().click()
await page.waitForTimeout(1500)

const after = await page.evaluate(() => {
  const main = document.querySelector("main")
  return {
    mainHtml: main?.innerHTML?.slice(0, 1000),
    mainText: main?.textContent?.slice(0, 200),
    mainChildren: main?.children.length,
    firstChildTag: main?.children[0]?.tagName,
    firstChildStyle: main?.children[0]?.getAttribute("style")?.slice(0, 200),
  }
})
console.log("after click:", JSON.stringify(after, null, 2))

await page.screenshot({
  path: "/Users/cookieqi/Downloads/Untitled/validation_screenshots/debug-workbench.png",
  fullPage: true,
})
console.log("saved debug screenshot")

await browser.close()
