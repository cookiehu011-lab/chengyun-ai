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
if ((await wbTab.count()) > 0) {
  await wbTab.first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/workbench_default.png` })
  console.log("saved workbench_default.png")
}

// 1. 新建对话两档选择器
const newBtn = page.locator("button").filter({ hasText: "新建对话" })
if ((await newBtn.count()) > 0) {
  await newBtn.first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${outDir}/workbench_new_entry.png` })
  console.log("saved workbench_new_entry.png")
  // 取消
  await page.locator("button").filter({ hasText: "取消" }).first().click()
  await page.waitForTimeout(400)
}

// 2. 问答对话发送 → 状态行
const qaDialog = page.locator("div").filter({ hasText: "高发街道分布咨询" })
if ((await qaDialog.count()) > 0) {
  await qaDialog.first().click()
  await page.waitForTimeout(600)
  const ta = page.locator("textarea")
  if ((await ta.count()) > 0) {
    await ta.first().fill("暴露垃圾按街道下钻看分布")
    await ta.first().press("Enter")
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${outDir}/workbench_qa_status.png` })
    console.log("saved workbench_qa_status.png")
    await page.waitForTimeout(1500)
  }
}

// 3. 整理为报告确认页
const exportBtn = page.locator("button").filter({ hasText: "整理为报告" })
if ((await exportBtn.count()) > 0) {
  await exportBtn.first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${outDir}/workbench_export_confirm.png` })
  console.log("saved workbench_export_confirm.png")
  await page.locator("button").filter({ hasText: "取消" }).first().click()
  await page.waitForTimeout(300)
}

// 4. 新建成稿对话并触发生成进度
if ((await newBtn.count()) > 0) {
  await newBtn.first().click()
  await page.waitForTimeout(400)
  // 选择分析成稿
  const reportCard = page
    .locator("div")
    .filter({ hasText: "一份可预览、可改、可下载的文件" })
    .last()
  await reportCard.click()
  await page.waitForTimeout(300)
  await page.locator("button").filter({ hasText: "开始对话" }).click()
  await page.waitForTimeout(600)
  const ta2 = page.locator("textarea")
  if ((await ta2.count()) > 0) {
    await ta2.first().fill("生成上周东城治理周报")
    await ta2.first().press("Enter")
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${outDir}/workbench_generating.png` })
    console.log("saved workbench_generating.png")
    await page.waitForTimeout(4500)
    await page.screenshot({ path: `${outDir}/workbench_file_done.png` })
    console.log("saved workbench_file_done.png")
  }
}

await browser.close()
