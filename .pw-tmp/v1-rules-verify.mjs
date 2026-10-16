import { chromium } from "playwright"
const BASE = "https://cookiehu011-lab.github.io/chengyun-ai/v1/"
const OUT = "screens-v1patch1"

const RULE_DIALOGS = "同一份列表。业务问答和分析成稿都在这里，用类型区分。每条显示主题、类型、最近时间。已经生成文件的成稿标出有文件，点开仍是这条对话。\n打开时显示当时的问题、已完成答案、已确认条件和数据时点，不重新查询，也不改写旧答案。\n沉淀这些：问题、已完成回答、已确认条件、数据引用、每条回答的查询范围和数据时点。生成过报告的，再带上报告和版本。发送失败的不记成已完成回答。\n保留多久沿用平台已有规则。"
const RULE_NEW = "这是唯一的新建入口。一条新对话里可以即时问答，可以直接生成报告，也可以先问答再整理成报告。\n不带上一条对话的区域、事件、报告和查询条件。\n还没有完成的业务答案时，不出现「整理成报告」。\n不创建定时任务，不修改事件状态、责任人或派发。"
const RULE_FILES = "只收生成成功的报告。取消、生成失败、只有问答还没有成稿的，不进这里。\n一条记录是一份报告。首次成功是 V1。同一版本同时有 PDF 和 DOCX，内容一致。换格式不新增版本，也不另开一条记录。\n列表显示报告名称、版本、格式、数据时点，并能回到来源对话。\n只打开、下载、换格式或追问，不产生新版本。预览只读，不在系统内改正文。"
const RULE_HEADER = "本期要有：五类即时问答（摘要 + 结构化结果）+ 报告确认。本期不做：对话改状态 / 转交 / 派发 / 重新激活、任务中心真实调度、上传模板与改正文。"

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

const matchRule = (l, w) => {
  const outer = l.parentElement
  const btn = outer.closest("button")
  if (w === "tab-dialogs") return !!btn && btn.textContent.includes("对话记录")
  if (w === "tab-files") return !!btn && btn.textContent.includes("文件记录")
  const isNew = !btn && outer.previousElementSibling?.textContent?.includes("新建对话")
  if (w === "new") return isNew
  return !btn && !isNew
}

// 点击指定位置的规则标，等渲染后返回气泡全文
async function openRule(where, shot) {
  await page.evaluate((w) => {
    const labels = [...document.querySelectorAll("span")].filter(
      (s) => s.childElementCount === 0 && s.textContent === "规则"
    )
    const hit = labels.find((l) => {
      const outer = l.parentElement
      const btn = outer.closest("button")
      let hit = false
      if (w === "tab-dialogs") hit = !!btn && btn.textContent.includes("对话记录")
      else if (w === "tab-files") hit = !!btn && btn.textContent.includes("文件记录")
      else if (w === "new") hit = !btn && outer.previousElementSibling?.textContent?.includes("新建对话")
      else hit = !btn && !outer.previousElementSibling?.textContent?.includes("新建对话")
      return hit
    })
    hit?.click()
  }, where)
  await page.waitForTimeout(500)
  const text = await page.evaluate((w) => {
    const labels = [...document.querySelectorAll("span")].filter(
      (s) => s.childElementCount === 0 && s.textContent === "规则"
    )
    const hit = labels.find((l) => {
      const outer = l.parentElement
      const btn = outer.closest("button")
      let hit = false
      if (w === "tab-dialogs") hit = !!btn && btn.textContent.includes("对话记录")
      else if (w === "tab-files") hit = !!btn && btn.textContent.includes("文件记录")
      else if (w === "new") hit = !btn && outer.previousElementSibling?.textContent?.includes("新建对话")
      else hit = !btn && !outer.previousElementSibling?.textContent?.includes("新建对话")
      return hit
    })
    if (!hit) return ""
    const outer = hit.parentElement
    const bubble = [...outer.children].find((c) => c !== hit)
    return bubble ? bubble.textContent : ""
  }, where)
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png` })
  return text
}

// 1. 对话记录旁
let t = await openRule("tab-dialogs", "r1-对话记录旁规则")
console.log("1. 对话记录旁规则全文一致:", t === RULE_DIALOGS, t ? `(取到${t.length}字)` : "(气泡未取到)")

// 2. 新建对话旁
t = await openRule("new", "r2-新建对话旁规则")
console.log("2. 新建对话旁规则全文一致:", t === RULE_NEW, t ? `(取到${t.length}字)` : "(气泡未取到)")

// 3. 文件记录旁（不切页签，验证点击规则不误切页签）
t = await openRule("tab-files", "r3-文件记录旁规则")
let body = await page.evaluate(() => document.body.innerText)
console.log("3. 文件记录旁规则全文一致:", t === RULE_FILES, t ? `(取到${t.length}字)` : "(气泡未取到)", "| 未误切页签:", body.includes("+ 新建对话"))

// 4. 页头原有规则还在且可点开
t = await openRule("header", "r4-页头原有规则")
console.log("4. 页头规则全文一致:", t === RULE_HEADER, t ? `(取到${t.length}字)` : "(气泡未取到)", "| 页头「?」在:", await page.evaluate(() => [...document.querySelectorAll("span")].some((s) => s.childElementCount === 0 && s.textContent === "?")))

// 5. 左栏页签顺序 + 任务中心在（页签 textContent 含内嵌「规则」标，用 includes）
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .filter((b) => ["对话记录", "文件记录", "任务中心"].some((x) => b.textContent.includes(x)))
    .map((b) => b.textContent)
)
console.log("5. 页签:", JSON.stringify(tabs), "| 顺序含三页签:", tabs.length === 3 && tabs[0].includes("对话记录") && tabs[1].includes("文件记录") && tabs[2].includes("任务中心"))

// 6. 对话内容原样 + 检索框仍在
body = await page.evaluate(() => document.body.innerText)
console.log("6. 默认对话内容在:", body.includes("DC-2026-07216"), "| 新建对话在:", body.includes("+ 新建对话"), "| 检索框在:", (await page.getByPlaceholder("检索对话记录").count()) === 1)

// 7. 切到文件记录页签，列表仍正常
await page.locator("button:visible").filter({ hasText: "文件记录" }).first().click()
await page.waitForTimeout(700)
body = await page.evaluate(() => document.body.innerText)
await page.screenshot({ path: `${OUT}/r5-文件记录页签.png` })
console.log("7. 文件记录页签列表正常:", body.includes("治理周报") || body.includes(".pdf") || body.includes("PDF"))

await browser.close()
