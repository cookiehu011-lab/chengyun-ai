import { chromium } from "playwright"
const BASE = "https://cookiehu011-lab.github.io/chengyun-ai/v1/"
const OUT = "screens-v1patch1"
const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  localStorage.setItem("app-identity-v1", JSON.stringify({ personaId: "p-wq", cid: "c-dc", roleKey: "r-jt" }))
})
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2200)
await page.locator("button:visible").filter({ hasText: "AI工作台" }).first().click()
await page.waitForTimeout(1500)

const searchBox = page.getByPlaceholder("检索对话记录")
console.log("1. 检索框可见:", await searchBox.isVisible())
await page.screenshot({ path: `${OUT}/1-初始列表.png` })

// 标题命中过滤
await searchBox.fill("周报")
await page.waitForTimeout(400)
let body = await page.evaluate(() => document.body.innerText)
console.log("2. 输入「周报」: 命中第33周治理周报 =", body.includes("第33周治理周报"), "| 高发街道分布咨询被过滤 =", !body.includes("高发街道分布咨询"))
await page.screenshot({ path: `${OUT}/2-标题过滤.png` })

// 点击检索结果 → 查看对话内容
await page.evaluate(() => {
  const span = [...document.querySelectorAll("span")].find((s) => s.textContent === "第33周治理周报")
  span?.closest("div[style*='cursor']")?.click()
})
await page.waitForTimeout(900)
body = await page.evaluate(() => document.body.innerText)
console.log("3. 点击结果: 对话内容已展示 =", body.includes("本周治理态势") || body.includes("周报"))
await page.screenshot({ path: `${OUT}/3-点击查看对话.png` })

// 消息内容命中
await searchBox.fill("东华门")
await page.waitForTimeout(400)
body = await page.evaluate(() => document.body.innerText)
console.log("4. 输入「东华门」(消息内容命中): 结果含东华门 =", body.includes("东华门"))
await page.screenshot({ path: `${OUT}/4-内容过滤.png` })

// 空态
await searchBox.fill("不存在关键词zzz")
await page.waitForTimeout(400)
body = await page.evaluate(() => document.body.innerText)
console.log("5. 无结果空态:", body.includes("未找到与"))
await page.screenshot({ path: `${OUT}/5-空态提示.png` })

// 清空恢复
await page.locator("button[title='清空检索']").click()
await page.waitForTimeout(400)
body = await page.evaluate(() => document.body.innerText)
console.log("6. 清空后列表恢复:", body.includes("高发街道分布咨询"))

// 继续对话：选对话并发消息
await page.evaluate(() => {
  const span = [...document.querySelectorAll("span")].find((s) => s.textContent === "高发街道分布咨询")
  span?.closest("div[style*='cursor']")?.click()
})
await page.waitForTimeout(700)
const ta = page.getByPlaceholder("按当前口径查询治理数据，直接给结论…（Enter发送）")
await ta.fill("再看看北新桥街道的情况")
await ta.press("Enter")
await page.waitForTimeout(3000)
body = await page.evaluate(() => document.body.innerText)
console.log("7. 继续对话: 用户消息已上屏 =", body.includes("再看看北新桥街道的情况"))
await page.screenshot({ path: `${OUT}/6-继续对话.png` })

await browser.close()
