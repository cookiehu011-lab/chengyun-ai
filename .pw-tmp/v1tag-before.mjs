import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = "https://cookiehu011-lab.github.io/chengyun-ai/v1/"
const outDir = "screens-v1.1-r2/v1-before"
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

await clickVisible("AI工作台")
async function clickVisible(text) {
  await page.locator("button:visible").filter({ hasText: text }).first().click({ timeout: 4000 })
}

await page.waitForTimeout(1200)
const checks = await page.evaluate(() => {
  const t = document.body.innerText
  return { hasSearch: t.includes("检索对话记录"), hasRule: t.includes("规则") }
})
console.log("v1-前-含检索框与规则标:", JSON.stringify(checks))
await shot("v1b1-工作台-含检索框与规则标-旧")

await browser.close()
console.log("DONE")
