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

await page.waitForTimeout(15000)

const info = await page.evaluate(() => {
  const map = window.__heatmapMap
  if (!map) return { error: "no map" }
  return {
    mapLoaded: map.loaded(),
    styleLoaded: map.isStyleLoaded(),
    streetFeatures: map.queryRenderedFeatures(undefined, {
      layers: ["street-fills"],
    }).length,
    dotFeatures: map.queryRenderedFeatures(undefined, {
      layers: ["event-dots"],
    }).length,
  }
})
console.log(JSON.stringify(info, null, 2))

await browser.close()
