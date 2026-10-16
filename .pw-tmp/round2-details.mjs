import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = process.argv[2] || "http://localhost:8443"
const outDir = process.argv[3] || "/Users/cookieqi/Downloads/Untitled/screens-round2/before"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => localStorage.setItem("app-identity-v1", JSON.stringify({ personaId: "p-sys", cid: "c-dc", roleKey: "super" })))
const page = await ctx.newPage()
await page.goto(base, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2200)

async function shot(name) {
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false })
  console.log("saved", name)
}

await page.locator('button:has-text("AI实时治理"):visible').first().click({ timeout: 5000 })
await page.waitForTimeout(1200)

for (const tab of ["待立案", "待核查", "待作废审核"]) {
  try {
    await page.locator(`button:has-text("${tab}"):visible`).first().click({ timeout: 4000 })
    await page.waitForTimeout(900)
  } catch { console.log("tab miss:", tab); continue }
  const rows = page.locator(`text=/DC-\\d{4}-\\d+/`)
  const n = await rows.count()
  let ok = false
  for (let i = 0; i < Math.min(n, 15); i++) {
    const el = rows.nth(i)
    if (await el.isVisible()) {
      try { await el.click({ timeout: 2500 }); ok = true; break } catch {}
    }
  }
  if (!ok) { console.log("row miss:", tab); continue }
  await shot(`rt-${tab}-详情`)
  try {
    await page.locator('button:has-text("返回"):visible').first().click({ timeout: 2000 })
    await page.waitForTimeout(500)
  } catch { await page.keyboard.press("Escape") }
}
await browser.close()
console.log("DONE")
