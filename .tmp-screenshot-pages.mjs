import { chromium } from "playwright"

const baseUrl = process.argv[2] || "http://localhost:8443"
const outDir =
  process.argv[3] || "/Users/cookieqi/Downloads/Untitled/validation_screenshots"

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

await page.goto(baseUrl, { waitUntil: "networkidle" })
await page.waitForTimeout(1000)

// AI 实时治理
const realtimeTab = page.locator("button").filter({ hasText: "AI实时治理" })
if ((await realtimeTab.count()) > 0) {
  await realtimeTab.first().click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outDir}/realtime_governance.png`, fullPage: false })
  console.log(`saved ${outDir}/realtime_governance.png`)
}

// 事件档案
const archiveTab = page.locator("button").filter({ hasText: "事件档案" })
if ((await archiveTab.count()) > 0) {
  await archiveTab.first().click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outDir}/event_archive.png`, fullPage: false })
  console.log(`saved ${outDir}/event_archive.png`)
}

await browser.close()
