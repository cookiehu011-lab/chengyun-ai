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
async function clickVisibleRow(re, name) {
  const rows = page.locator(`text=${re}`)
  const n = await rows.count()
  for (let i = 0; i < Math.min(n, 12); i++) {
    const el = rows.nth(i)
    if (await el.isVisible()) {
      try { await el.click({ timeout: 2500 }); await shot(name); return true } catch {}
    }
  }
  console.log("row miss:", name)
  return false
}
async function back() {
  try { await clickVisibleButton("返回", 2000); await page.waitForTimeout(500) } catch { await page.keyboard.press("Escape") }
}

// ── AI实时治理 ─────────────────────────────────────────────
await clickVisibleButton("AI实时治理")
await page.waitForTimeout(1400)

// 默认页签（待立案）+ 领取待办对话框
{
  await shot("rt-待立案")
  const ok = await clickVisibleRow("/DC-\\d{4}-\\d+/", "rt-待立案-详情")
  if (ok) await back()
  try {
    await clickVisibleButton("领取待办", 3000)
    await shot("rt-待立案-领取对话框")
    await clickVisibleButton("取消", 2000)
    await page.waitForTimeout(400)
  } catch { console.log("claim dialog miss") }
}

for (const tab of ["待核查", "待作废审核"]) {
  try {
    await clickVisibleButton(tab, 3500)
    await page.waitForTimeout(900)
    await shot(`rt-${tab}`)
    const ok = await clickVisibleRow("/DC-\\d{4}-\\d+/", `rt-${tab}-详情`)
    if (ok) await back()
  } catch { console.log("tab miss:", tab) }
}

// 全量识别 + 详情
try { await clickVisibleButton("全量识别", 3500); await page.waitForTimeout(900) } catch { console.log("recognition miss") }
await shot("rt-全量识别")
await clickVisibleRow("/DC-\\d{4}-\\d+/", "rt-全量识别-详情")
await back()

// Agent 处理池
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await shot("rt-Agent处理池")
  await clickVisibleRow("/DC-\\d{4}-\\d+/", "rt-Agent处理池-详情")
  await back()
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
