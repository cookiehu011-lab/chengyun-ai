import { chromium } from "playwright"
import { mkdirSync } from "fs"

const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })

async function makeCtx(base, identityKey) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript((k) => {
    localStorage.setItem(k, JSON.stringify({ personaId: "p-wq", cid: "c-dc", roleKey: "r-jt" }))
  }, identityKey)
  return ctx
}
async function shot(page, outDir, name) {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${outDir}/${name}.png` })
  console.log("saved", name)
}
async function clickVisibleButton(page, text, timeout = 4000) {
  await page.locator("button:visible").filter({ hasText: text }).first().click({ timeout })
}
async function back(page) {
  try { await clickVisibleButton(page, "返回", 2000); await page.waitForTimeout(500) } catch { await page.keyboard.press("Escape") }
}

// ── V1.1 主站 after ──
{
  const outDir = "screens-v1.1-r2/after"
  mkdirSync(outDir, { recursive: true })
  const ctx = await makeCtx("https://cookiehu011-lab.github.io/chengyun-ai/", "app-identity-v1.1")
  const page = await ctx.newPage()
  await page.goto("https://cookiehu011-lab.github.io/chengyun-ai/", { waitUntil: "load", timeout: 60000 })
  await page.waitForTimeout(2200)
  await clickVisibleButton(page, "AI实时治理")
  await page.waitForTimeout(1400)

  // a21/a22: 处理池 · 等待作废审核（新：ZF-01/ZF-02 真实作废场景）
  try {
    await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
    await page.waitForTimeout(900)
    await page.locator('[aria-label*="等待作废审核"]').first().click({ timeout: 3500 })
    await page.waitForTimeout(900)
    const checks = await page.evaluate(() => {
      const t = document.body.innerText
      return {
        hasZF01: t.includes("ZF-01"),
        hasZF02: t.includes("ZF-02"),
        no20588: !t.includes("DC-2026-20588"),
        noOld: !t.includes("误报") && !t.includes("复发规则"),
        owner: t.includes("网格责任人 · 已提交作废申请"),
      }
    })
    console.log("a21断言:", JSON.stringify(checks))
    await shot(page, outDir, "a21-处理池等待作废审核列表-新")
    await back(page)
  } catch (e) { console.log("a21 miss", e.message.slice(0, 100)) }

  // a22: 处理池 · 持续监控（新：含道路遗撒复发候选）
  try {
    await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
    await page.waitForTimeout(900)
    await page.locator('[aria-label*="持续监控"]').first().click({ timeout: 3500 })
    await page.waitForTimeout(900)
    const checks = await page.evaluate(() => {
      const t = document.body.innerText
      return {
        hasDaolu: t.includes("道路遗撒"),
        hasBlocker: t.includes("疑似复发，已生成候选，等待全量识别重新审核"),
        hasOwner: t.includes("承接人：全量识别审核"),
      }
    })
    console.log("a22断言:", JSON.stringify(checks))
    await shot(page, outDir, "a22-处理池持续监控-新")
    await back(page)
  } catch (e) { console.log("a22 miss", e.message.slice(0, 100)) }

  // a24/a25/a26: 待作废审核队列（新 agentStatus：网格员申请 + ZF 编码）
  await clickVisibleButton(page, "待作废审核")
  await page.waitForTimeout(900)
  await shot(page, outDir, "a24-待作废审核列表-新")
  const detailChecks = await page.evaluate(() => {
    const t = document.body.innerText
    return { noOld: !t.includes("外场责任人申请作废") && !t.includes("监督员提交复核建议作废") && !t.includes("处置方申请重复事件作废"), hasZF: t.includes("ZF-0") }
  })
  console.log("a24断言(列表页):", JSON.stringify(detailChecks))
  const ids = ["DC-2026-20565", "DC-2026-20566"]
  for (const id of ids) {
    try {
      const ok = await page.evaluate((eid) => {
        const row = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim().startsWith(eid))
        const grid = row?.closest('div[style*="grid-template-columns"]')
        const btn = [...(grid?.querySelectorAll("button") ?? [])].find((b) => (b.textContent ?? "").includes("办理"))
        if (btn) { btn.click(); return true }
        return false
      }, id)
      if (!ok) throw new Error("row not found: " + id)
      await page.waitForTimeout(800)
      const t = await page.evaluate(() => {
        const s = document.body.innerText
        return { hasZF: s.includes("ZF-0"), byGridWorker: s.includes("网格员申请作废") || s.includes("李建国") }
      })
      console.log(`${id}-详情:`, JSON.stringify(t))
      await shot(page, outDir, `a25-${id}-详情-新`)
      await back(page)
    } catch (e) { console.log(id, "miss", e.message.slice(0, 80)) }
  }
  await ctx.close()
}

// ── /v1/ after（v1.0-src 标签重建：无检索框、无规则标）──
{
  const outDir = "screens-v1.1-r2/v1-after"
  mkdirSync(outDir, { recursive: true })
  const ctx = await makeCtx("https://cookiehu011-lab.github.io/chengyun-ai/v1/", "app-identity-v1")
  const page = await ctx.newPage()
  await page.goto("https://cookiehu011-lab.github.io/chengyun-ai/v1/", { waitUntil: "load", timeout: 60000 })
  await page.waitForTimeout(2200)
  await clickVisibleButton(page, "AI工作台")
  await page.waitForTimeout(1200)
  const checks = await page.evaluate(() => {
    const t = document.body.innerText
    const hasSearchInput = !!document.querySelector('input[placeholder*="检索"]')
    return { noSearchText: !t.includes("检索对话记录"), noSearchInput: !hasSearchInput, ruleCount: (t.match(/规则/g) ?? []).length }
  })
  console.log("v1-after断言(应无检索、页头规则1处):", JSON.stringify(checks))
  await shot(page, outDir, "v1a1-工作台-标签原样构建-新")
  await ctx.close()
}

await browser.close()
console.log("DONE")
