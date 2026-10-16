import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = process.argv[2] || "http://localhost:8443"
const outDir = process.argv[3] || "/Users/cookieqi/Downloads/Untitled/screens-round2/before"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto(base, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2200)

async function shot(name) {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false })
  console.log("saved", name)
}
async function clickText(text, timeout = 4000) {
  await page.locator(`button:has-text("${text}")`).first().click({ timeout })
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

// ── AI实时治理 ─────────────────────────────────────────────
await clickText("AI实时治理")
await page.waitForTimeout(1200)
for (const [tab, key] of [["待立案", "case"], ["待核查", "inspect"], ["待作废审核", "void"]]) {
  try { await clickText(tab, 3500); await page.waitForTimeout(800) } catch { console.log("tab miss:", tab); continue }
  const ok = await clickVisibleRow("/DC-\\d{4}-\\d+/", `rt-${tab}-详情`)
  if (ok) {
    try { await clickText("返回", 2000); await page.waitForTimeout(500) } catch { await page.keyboard.press("Escape") }
  }
}
try { await clickText("全量识别", 3500); await page.waitForTimeout(800) } catch { console.log("recognition miss") }
// 全量识别详情：点第一行
await clickVisibleRow("/DC-\\d{4}-\\d+/", "rt-全量识别-详情")
try { await clickText("返回", 2000); await page.waitForTimeout(500) } catch {}
// Agent 处理池
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await shot("rt-Agent处理池")
  await clickVisibleRow("/DC-\\d{4}-\\d+/", "rt-Agent处理池-详情")
  try { await clickText("返回", 2000) } catch {}
} catch { console.log("pool miss") }

// ── 治理配置（切到 王倩 / 全局协调） ─────────────────────────
await clickText("治理配置")
await page.waitForTimeout(1200)
try {
  await page.locator('button[title="切换账号"]').first().click({ timeout: 3000 })
  await page.waitForTimeout(400)
  await page.locator('div[role="listbox"] button:has-text("王倩")').first().click({ timeout: 3000 })
  await page.waitForTimeout(900)
  console.log("account -> 王倩")
} catch { console.log("account switch miss") }
try {
  await page.locator('button[title*="切换当前角色"]').first().click({ timeout: 3000 })
  await page.waitForTimeout(400)
  await page.locator('div[role="listbox"] button:has-text("全局协调")').first().click({ timeout: 3000 })
  await page.waitForTimeout(900)
  console.log("role -> 全局协调")
} catch { console.log("role switch miss") }

for (const m of ["事件标准", "生命周期与处置规则", "时限与异常监控", "Agent 派工与认领", "发布与审计"]) {
  try { await clickText(m, 3500) } catch { console.log("nav miss:", m) }
  await shot(`gc-${m}`)
}

await browser.close()
console.log("DONE")
