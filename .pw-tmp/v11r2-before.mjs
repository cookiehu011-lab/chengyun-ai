import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = "https://cookiehu011-lab.github.io/chengyun-ai/"
const outDir = "screens-v1.1-r2/before"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  localStorage.setItem("app-identity-v1.1", JSON.stringify({ personaId: "p-wq", cid: "c-dc", roleKey: "r-jt" }))
})
const page = await ctx.newPage()
await page.goto(base, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2200)

async function shot(name) {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${outDir}/${name}.png` })
  console.log("saved", name)
}
async function clickVisibleButton(text, timeout = 4000) {
  await page.locator("button:visible").filter({ hasText: text }).first().click({ timeout })
}
async function back() {
  try { await clickVisibleButton("返回", 2000); await page.waitForTimeout(500) } catch { await page.keyboard.press("Escape") }
}

await clickVisibleButton("AI实时治理")
await page.waitForTimeout(1400)

// b21/b22: 处理池 · 等待作废审核（旧：3 条冲突场景 + 立案审核岗流转）
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await page.locator('[aria-label*="等待作废审核"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await shot("b21-处理池等待作废审核列表-旧")
  // 打开第一条详情（流转记录含 立案审核岗发起作废申请）
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("span")].find((s) => s.textContent?.trim() === "暴露垃圾")
    row?.click()
  })
  await page.waitForTimeout(800)
  const trail = await page.evaluate(() => document.body.innerText.includes("立案审核岗"))
  console.log("b22-详情含立案审核岗:", trail)
  await shot("b22-处理池作废详情-旧")
  await back()
} catch (e) { console.log("b21/b22 miss", e.message.slice(0, 100)) }

// b23: 处理池 · 持续监控（旧：无道路遗撒复发候选）
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await page.locator('[aria-label*="持续监控"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  const has = await page.evaluate(() => document.body.innerText.includes("道路遗撒"))
  console.log("b23-持续监控含道路遗撒(应false):", has)
  await shot("b23-处理池持续监控-旧")
  await back()
} catch (e) { console.log("b23 miss", e.message.slice(0, 100)) }

// b24/b25: 待作废审核队列（旧 agentStatus 文案）+ 20565 详情（网格员申请卡）
await clickVisibleButton("待作废审核")
await page.waitForTimeout(900)
await shot("b24-待作废审核列表-旧")
try {
  await clickVisibleButton("办理")
  await page.waitForTimeout(800)
  const t = await page.evaluate(() => {
    const s = document.body.innerText
    return { raw: s.includes("外场责任人申请作废"), hasZF: s.includes("ZF-0") }
  })
  console.log("b25-详情旧文案:", JSON.stringify(t))
  await shot("b25-待作废审核详情-旧")
} catch (e) { console.log("b25 miss", e.message.slice(0, 100)) }

await browser.close()
console.log("DONE")
