import { chromium } from "playwright"

const baseUrl = process.argv[2] || "http://localhost:4179"
const outDir =
  process.argv[3] || "/Users/cookieqi/Downloads/Untitled/validation_screenshots"

const browser = await chromium.launch({
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

const errors = []
page.on("console", (msg) => {
  const text = msg.text()
  console.log("CONSOLE", msg.type(), text)
  if (msg.type() === "error") errors.push(text)
})
page.on("pageerror", (err) => {
  errors.push(err.message)
  console.log("PAGE ERROR:", err.message)
})

await page.goto(`${baseUrl}?nocache=1`, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(4000)

// Ensure Governance Dashboard tab (default likely)
const dashTab = page.locator("button").filter({ hasText: /治理态势/ })
if ((await dashTab.count()) > 0) {
  await dashTab.first().click()
  await page.waitForTimeout(2000)
}

await page.screenshot({ path: `${outDir}/dashboard-map.png`, fullPage: false })
console.log(`saved ${outDir}/dashboard-map.png`)
console.log("Errors:", errors.length)

await browser.close()
