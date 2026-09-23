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

const info = await page.evaluate(() => {
  const map = window.__heatmapMap
  if (!map) return { error: "no map" }
  return {
    styleLoaded: map.isStyleLoaded(),
    layerIds: map.getStyle().layers.map((l) => l.id),
    sourceIds: Object.keys(map.getStyle().sources),
    eventsFeatureCount: map.getSource("events")?._data?.features?.length,
    streetsFeatureCount: map.getSource("streets")?._data?.features?.length,
    heatmapLayer: map.getLayer("heatmap") ? "yes" : "no",
    eventDotsLayer: map.getLayer("event-dots") ? "yes" : "no",
    streetFillsLayer: map.getLayer("street-fills") ? "yes" : "no",
    zoom: map.getZoom(),
    center: map.getCenter(),
  }
})
console.log(JSON.stringify(info, null, 2))

await browser.close()
