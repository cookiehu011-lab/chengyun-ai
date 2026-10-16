import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = process.argv[2] || "https://cookiehu011-lab.github.io/chengyun-ai/"
const outDir = process.argv[3] || "/Users/cookieqi/Downloads/Untitled/screens-round2/after"
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
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false })
  console.log("saved", name)
}

await page.locator("button:visible").filter({ hasText: "AI实时治理" }).first().click()
await page.waitForTimeout(1400)
await page.locator('button[title*="Agent 处理池"]').first().click()
await page.waitForTimeout(1200)
// 点击第二个状态卡（等待处置反馈）的 查看明细
await page.locator("text=查看明细").nth(1).click({ timeout: 5000 })
await shot("rt-Agent处理池-详情")

await browser.close()
console.log("DONE")
