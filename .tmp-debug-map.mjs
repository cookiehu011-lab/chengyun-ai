import { chromium } from "playwright"

const baseUrl = process.argv[2] || "http://localhost:4179"

const browser = await chromium.launch({
  headless: true,
  args: ["--no-proxy-server"],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

page.on("console", (msg) => console.log("CONSOLE", msg.type(), msg.text()))

await page.goto(`${baseUrl}?nocache=1`, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(3000)

const dashTab = page.locator("button").filter({ hasText: /治理态势/ })
if ((await dashTab.count()) > 0) await dashTab.first().click()
await page.waitForTimeout(3000)

const mapContainers = await page
  .locator('[style*="background: rgb(243, 250, 255)"]')
  .count()
const canvasCount = await page.locator("canvas").count()
const html = await page.content()
console.log("map containers:", mapContainers, "canvas:", canvasCount)
console.log("has DongchengHeatmapMap?", html.includes("DongchengHeatmapMap"))

await browser.close()
