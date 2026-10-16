import { chromium } from "playwright"
const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  localStorage.setItem("app-identity-v1", JSON.stringify({ personaId: "p-wq", cid: "c-dc", roleKey: "r-jt" }))
})
const page = await ctx.newPage()
await page.goto("https://cookiehu011-lab.github.io/chengyun-ai/", { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2200)
await page.locator("button:visible").filter({ hasText: "AI实时治理" }).first().click()
await page.waitForTimeout(1400)
await page.locator("button:visible").filter({ hasText: "领取待办" }).first().click()
await page.waitForTimeout(600)
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].filter(b => b.textContent?.includes("领取所选事件"))
  return btns.map(b => {
    const cs = getComputedStyle(b)
    return { text: b.textContent, bg: cs.background.slice(0, 120), color: cs.color, w: b.offsetWidth, h: b.offsetHeight }
  })
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
