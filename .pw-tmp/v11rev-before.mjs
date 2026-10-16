import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = "https://cookiehu011-lab.github.io/chengyun-ai/"
const outDir = "screens-v1.1-rev/before"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  localStorage.setItem("app-identity-v1", JSON.stringify({ personaId: "p-wq", cid: "c-dc", roleKey: "r-jt" }))
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

// b3: 待立案列表（旧：自然消散不计入待办数提示 + 20561 重复上报行 + 自然消散「查看」按钮）
await shot("b3-待立案列表-旧")

// b4: 20561 重复上报详情（旧：记到已有事件按钮）
try {
  const row = page.locator("div").filter({ hasText: /^DC-2026-20561/ }).locator("xpath=ancestor::div[contains(@style,'grid-template-columns')][1]")
  await row.locator("button").filter({ hasText: "办理" }).first().click({ timeout: 4000 })
  await shot("b4-重复上报详情-旧")
  await back()
} catch (e) { console.log("b4 miss", e.message.slice(0, 80)) }

// b3b: 自然消散详情（旧：Agent 建议误用立案文案）
try {
  await page.locator("button:visible").filter({ hasText: "查看" }).last().click({ timeout: 3000 })
  await shot("b3b-自然消散详情-旧")
  await back()
} catch (e) { console.log("b3b miss") }

// b2: 待核查详情（旧：Agent 核查建议误用「建议立案并派发」）+ 读取退回原因旧选项
await clickVisibleButton("待核查")
await page.waitForTimeout(900)
await shot("b2-待核查列表-旧")
try {
  await clickVisibleButton("办理")
  await page.waitForTimeout(900)
  const opts = await page.evaluate(() => {
    const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.text.includes("退回原因")))
    return sel ? [...sel.options].map((o) => o.text) : []
  })
  console.log("b6-退回原因旧选项:", JSON.stringify(opts))
  await shot("b2b-待核查详情-旧建议")
  await back()
} catch (e) { console.log("b2b miss", e.message.slice(0, 80)) }

// b11: 待作废审核 20565 旧标签
await clickVisibleButton("待作废审核")
await page.waitForTimeout(900)
await shot("b11-待作废审核-20565旧标签")

// b7: 全量识别（旧：已审核行仍有审核按钮）
await clickVisibleButton("全量识别")
await page.waitForTimeout(900)
await shot("b7-全量识别-旧按钮")

// b5: Agent 处理池 · 等待立案（旧：仅看时限风险 + 已超时/临近超时）
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await page.locator('[aria-label*="等待立案"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await shot("b5-处理池等待立案-旧")
  await back()
} catch (e) { console.log("b5 miss", e.message.slice(0, 80)) }

// b10: Agent 处理池 · 持续监控（旧两栏文案）
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await page.locator('[aria-label*="持续监控"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await shot("b10-处理池持续监控-旧")
  await back()
} catch (e) { console.log("b10 miss", e.message.slice(0, 80)) }

// b8/b9: 治理配置
await clickVisibleButton("治理配置")
await page.waitForTimeout(1400)
try { await clickVisibleButton("生命周期与处置规则"); await shot("b8-生命周期页-旧提示") } catch { console.log("b8 miss") }
try { await clickVisibleButton("待办领取"); await shot("b9-待办领取-旧") } catch { console.log("b9 miss") }

await browser.close()
console.log("DONE")
