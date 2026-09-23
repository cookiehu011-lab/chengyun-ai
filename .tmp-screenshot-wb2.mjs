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
await page.waitForTimeout(1200)

// 进入 AI 工作台
const wbTab = page.locator("button").filter({ hasText: "AI工作台" })
await wbTab.first().click()
await page.waitForTimeout(1000)

// 精确点击对话标题切换到问答对话
await page.getByText("高发街道分布咨询", { exact: true }).click()
await page.waitForTimeout(800)

// 1. 问答发送 → 状态行「正在按当前口径查询」
const ta = page.locator("textarea")
await ta.first().fill("按街道下钻暴露垃圾分布")
await ta.first().press("Enter")
await page.waitForTimeout(400)
await page.screenshot({ path: `${outDir}/workbench_qa_status.png` })
console.log("saved workbench_qa_status.png")
await page.waitForTimeout(1600)

// 2. 整理为报告确认页
const exportBtn = page.locator("button").filter({ hasText: "整理为报告" })
if ((await exportBtn.count()) > 0) {
  await exportBtn.first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${outDir}/workbench_export_confirm.png` })
  console.log("saved workbench_export_confirm.png")
  // 3. 确认生成 → 新成稿对话 + 进度
  await page.locator("button").filter({ hasText: "生成（新开分析成稿）" }).click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${outDir}/workbench_export_generating.png` })
  console.log("saved workbench_export_generating.png")
  await page.waitForTimeout(4500)
  await page.screenshot({ path: `${outDir}/workbench_export_done.png` })
  console.log("saved workbench_export_done.png")
} else {
  console.log("WARN: 整理为报告 button not found")
}

await browser.close()
