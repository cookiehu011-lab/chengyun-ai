import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = process.argv[2] || "http://localhost:8443"
const outDir = process.argv[3] || "/Users/cookieqi/Downloads/Untitled/screens-round2/after"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
// 王倩 / 东城区 / 全局协调
await ctx.addInitScript(() => {
  localStorage.setItem("app-identity-v1", JSON.stringify({ personaId: "p-wq", cid: "c-dc", roleKey: "r-jt" }))
})
const page = await ctx.newPage()
await page.goto(base, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2200)

async function shot(name) {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false })
  console.log("saved", name)
}
async function clickVisibleButton(text, timeout = 4000) {
  await page.locator("button:visible").filter({ hasText: text }).first().click({ timeout })
}
async function clickAction(names, timeout = 2500) {
  for (const n of names) {
    try {
      await page.locator("button:visible").filter({ hasText: n }).first().click({ timeout })
      return true
    } catch {}
  }
  return false
}
async function back() {
  try { await clickVisibleButton("返回", 2000); await page.waitForTimeout(500) } catch { await page.keyboard.press("Escape") }
}

// ── AI实时治理 ─────────────────────────────────────────────
await clickVisibleButton("AI实时治理")
await page.waitForTimeout(1400)

// 待立案：列表 → 领取对话框 → 办理详情 → 自然消散详情
{
  await shot("rt-待立案")
  try {
    await clickVisibleButton("领取待办", 3000)
    await shot("rt-待立案-领取对话框")
    await clickVisibleButton("取消", 2000)
    await page.waitForTimeout(400)
  } catch { console.log("claim dialog miss") }
  if (await clickAction(["办理"])) { await shot("rt-待立案-详情"); await back() }
  else console.log("detail miss: 待立案")
  // 自然消散行（查看按钮）
  try {
    await page.locator("button:visible").filter({ hasText: "查看" }).last().click({ timeout: 3000 })
    await shot("rt-待立案-自然消散详情")
    await back()
  } catch { console.log("dissipate detail miss") }
}

for (const tab of ["待核查", "待作废审核"]) {
  try {
    await clickVisibleButton(tab, 3500)
    await page.waitForTimeout(900)
    await shot(`rt-${tab}`)
    if (await clickAction(["办理", "审核", "查看"])) { await shot(`rt-${tab}-详情`); await back() }
    else console.log("detail miss:", tab)
  } catch { console.log("tab miss:", tab) }
}

// 全量识别 + 详情
try { await clickVisibleButton("全量识别", 3500); await page.waitForTimeout(900) } catch { console.log("recognition miss") }
await shot("rt-全量识别")
if (await clickAction(["办理", "审核", "查看"])) { await shot("rt-全量识别-详情"); await back() }
else console.log("detail miss: 全量识别")

// Agent 处理池
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await shot("rt-Agent处理池")
  if (await clickAction(["查看", "去办理"])) { await shot("rt-Agent处理池-详情"); await back() }
  else console.log("detail miss: pool")
} catch { console.log("pool miss") }

// ── 治理配置 ───────────────────────────────────────────────
await clickVisibleButton("治理配置")
await page.waitForTimeout(1400)

for (const m of ["事件标准", "生命周期与处置规则", "办理时限与提醒", "待办领取", "变更记录"]) {
  try { await clickVisibleButton(m, 3500) } catch { console.log("nav miss:", m) }
  await shot(`gc-${m}`)
}

await browser.close()
console.log("DONE")
