import { chromium } from "playwright"

const browser = await chromium.launch({
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

page.on("console", (msg) => {
  if (msg.type() === "error") {
    console.log("CONSOLE ERROR:", msg.text())
  }
})

await page.goto("http://localhost:4179?nocache=1", {
  waitUntil: "load",
  timeout: 60000,
})
await page.waitForTimeout(1500)

const aiTab = page.locator("button").filter({ hasText: "AI工作台" })
if ((await aiTab.count()) > 0) {
  await aiTab.first().click()
  await page.waitForTimeout(1500)
  await page.screenshot({
    path: "/Users/cookieqi/Downloads/Untitled/validation_screenshots/tab-workbench.png",
    fullPage: false,
  })
  console.log("saved workbench screenshot")
} else {
  console.log("AI工作台 tab not found")
}

await browser.close()
