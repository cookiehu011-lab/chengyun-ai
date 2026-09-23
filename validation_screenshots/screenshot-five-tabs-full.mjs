import { chromium } from "playwright"

const baseUrl = process.argv[2] || "http://localhost:8443"
const outDir =
  process.argv[3] || "/Users/cookieqi/Downloads/Untitled/validation_screenshots"
const tabs = [
  { label: "综合态势", file: "tab-overview.png" },
  { label: "事件发生", file: "tab-events.png" },
  { label: "流程运行", file: "tab-process.png" },
  { label: "作业效能", file: "tab-efficiency.png" },
  { label: "AI作用成效", file: "tab-ai.png" },
]

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

await page.goto(`${baseUrl}?nocache=1`, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(1500)

const aiTab = page.locator("button").filter({ hasText: "AI统计" })
if ((await aiTab.count()) > 0) {
  await aiTab.first().click()
  await page.waitForTimeout(800)
}

for (const tab of tabs) {
  const btn = page.locator("button").filter({ hasText: tab.label })
  await btn.first().click()
  await page.waitForTimeout(2000)

  // Expand the AIStatistics root so fullPage screenshot captures all content
  await page.evaluate(() => {
    const scrollables = document.querySelectorAll("div")
    let target = null
    for (const el of scrollables) {
      const s = window.getComputedStyle(el)
      if (s.overflowY === "auto" && s.flex === "1 1 0%") {
        target = el
        break
      }
    }
    if (target) {
      let el = target.parentElement
      while (el && el !== document.body) {
        el.style.height = "auto"
        el.style.overflow = "visible"
        el.style.maxHeight = "none"
        el = el.parentElement
      }
      target.style.overflow = "visible"
      target.style.height = "auto"
    }
  })

  await page.screenshot({ path: `${outDir}/${tab.file}`, fullPage: true })
  console.log(`saved ${outDir}/${tab.file}`)
}

await browser.close()
