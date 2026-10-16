import { chromium } from "playwright"
import { mkdirSync } from "fs"

const base = "https://cookiehu011-lab.github.io/chengyun-ai/"
const outDir = "screens-v1.1-rev/after"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ["--no-proxy-server"] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
// V1.1 身份键已带版本号
await ctx.addInitScript(() => {
  localStorage.setItem("app-identity-v1.1", JSON.stringify({ personaId: "p-wq", cid: "c-dc", roleKey: "r-jt" }))
})
const page = await ctx.newPage()
await page.goto(base, { waitUntil: "load", timeout: 60000 })
await page.waitForTimeout(2200)

async function shot(name) {
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${outDir}/${name}.png` })
  console.log("saved", name)
}
async function clickVisibleButton(text, timeout = 4000) {
  await page.locator("button:visible").filter({ hasText: text }).first().click({ timeout })
}
async function back() {
  try { await clickVisibleButton("返回", 2000); await page.waitForTimeout(500) } catch { await page.keyboard.press("Escape") }
}
// 行定位用纯 DOM（Playwright hasText 正则按文本节点匹配会命中外层容器）
async function clickRowButton(id, label) {
  const ok = await page.evaluate(({ id, label }) => {
    const row = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim().startsWith(id))
    const grid = row?.closest('div[style*="grid-template-columns"]')
    const btn = [...(grid?.querySelectorAll("button") ?? [])].find((b) => (b.textContent ?? "").includes(label))
    if (btn) { btn.click(); return true }
    return false
  }, { id, label })
  if (!ok) throw new Error(`row button not found: ${id} ${label}`)
  await page.waitForTimeout(700)
}

// a1: 存储隔离断言（无视觉差异，用 console 断言）
const keys1 = await page.evaluate(() => Object.keys(localStorage))
console.log("a1-加载后keys:", JSON.stringify(keys1))
console.log("a1-身份键v1.1:", keys1.includes("app-identity-v1.1"), "旧键absent:", !keys1.includes("app-identity-v1"))

await clickVisibleButton("AI实时治理")
await page.waitForTimeout(1400)
const keys2 = await page.evaluate(() => Object.keys(localStorage))
console.log("a1-进模块后keys:", JSON.stringify(keys2))
console.log(
  "a1-gc-native-v1.1写入:",
  keys2.includes("gc-native-v1.1"),
  "gc-native-v1不存在:",
  !keys2.includes("gc-native-v1"),
)

// a3: 待立案列表（无「自然消散不计入待办数」提示；无 20561；20559 为消散行且按钮=办理）
await shot("a3-待立案列表-新")
const caseChecks = await page.evaluate(() => {
  const t = document.body.innerText
  const row20559 = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim().startsWith("DC-2026-20559"))
  const gridRow = row20559?.closest('div[style*="grid-template-columns"]')
  const btn = gridRow ? [...gridRow.querySelectorAll("button")].map((b) => b.textContent?.trim()) : []
  return {
    noHint: !t.includes("自然消散不计入待办数"),
    no20561: !t.includes("DC-2026-20561"),
    has20559: t.includes("DC-2026-20559"),
    row20559Buttons: btn,
  }
})
console.log("a3断言:", JSON.stringify(caseChecks))

// a3b: 自然消散详情（建议按自然消散结案）
try {
  await clickRowButton("DC-2026-20559", "办理")
  const ok = await page.evaluate(() => document.body.innerText.includes("建议按自然消散结案"))
  console.log("a3b-建议按自然消散结案:", ok)
  await shot("a3b-自然消散详情-新")
  await back()
} catch (e) { console.log("a3b miss", e.message.slice(0, 80)) }

// a2/a6: 待核查列表 + 各结论详情 + 退回原因 TC 字典
await clickVisibleButton("待核查")
await page.waitForTimeout(900)
await shot("a2-待核查列表-新")
const inspectMap = [
  ["DC-2026-20562", "a2b-待核查详情-建议结案", "建议结案"],
  ["DC-2026-20563", "a2c-待核查详情-建议退回", "建议退回"],
  ["DC-2026-20564", "a2d-待核查详情-无法判断", "无法判断"],
  ["DC-2026-20568", "a2e-待核查详情-外场核查", "证据不足，建议外场核查"],
]
for (const [id, name, expect] of inspectMap) {
  try {
    await clickRowButton(id, "办理")
    if (id === "DC-2026-20562") {
      const opts = await page.evaluate(() => {
        const sel = [...document.querySelectorAll("select")].find((s) =>
          [...s.options].some((o) => o.text.includes("退回原因")),
        )
        return sel ? [...sel.options].map((o) => o.text) : []
      })
      console.log("a6-退回原因新选项:", JSON.stringify(opts))
      console.log(
        "a6-TC字典:",
        opts.some((o) => o.includes("TC-01")) && opts.some((o) => o.includes("TC-03")),
      )
    }
    const ok = await page.evaluate((exp) => document.body.innerText.includes(exp), expect)
    console.log(`${name}-含「${expect}」:`, ok)
    await shot(name)
    await back()
  } catch (e) { console.log(name, "miss", e.message.slice(0, 80)) }
}

// a7 + a4: 全量识别（已审核行只留详情；20561 在此且审核抽屉用 NL 字典）
await clickVisibleButton("全量识别")
await page.waitForTimeout(900)
await shot("a7-全量识别-已审核行只留详情")
const recChecks = await page.evaluate(() => {
  const btnsOf = (id) => {
    const row = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim().startsWith(id))
    const gridRow = row?.closest('div[style*="grid-template-columns"]')
    return gridRow ? [...gridRow.querySelectorAll("button")].map((b) => b.textContent?.trim()) : []
  }
  return {
    row20403: btnsOf("DC-2026-20403"),
    row20405: btnsOf("DC-2026-20405"),
    row20410: btnsOf("DC-2026-20410"),
    row20561: btnsOf("DC-2026-20561"),
  }
})
console.log("a7断言(已审核行应无审核):", JSON.stringify(recChecks))
try {
  await clickRowButton("DC-2026-20561", "审核")
  await clickVisibleButton("无效")
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("重复上报"))
    btn?.click()
  })
  await page.waitForTimeout(300)
  await page.getByPlaceholder(/关联主事件编号/).fill("DC-2026-20555")
  await page.waitForTimeout(400)
  await shot("a4-审核抽屉-NL02字典与主事件编号")
  await page.evaluate(() => {
    const overlay = [...document.querySelectorAll("div")].find((d) => {
      const s = getComputedStyle(d)
      return s.position === "fixed" && parseInt(s.zIndex) >= 90 && s.backgroundColor.replace(/\s/g, "").startsWith("rgba(10,22,40,0.45)")
    })
    overlay?.click()
  })
  await page.waitForTimeout(600)
} catch (e) { console.log("a4 miss", e.message.slice(0, 120)) }

// a11: 待作废审核 20565 新标签
await clickVisibleButton("待作废审核")
await page.waitForTimeout(900)
const voidCheck = await page.evaluate(() => {
  const row = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim().startsWith("DC-2026-20565"))
  return row?.textContent?.includes("正常作废审核") ?? false
})
console.log("a11-20565正常作废审核:", voidCheck)
await shot("a11-待作废审核-20565新标签")

// a5/a10: Agent 处理池
try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await page.locator('[aria-label*="等待立案"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  const poolChecks = await page.evaluate(() => {
    const t = document.body.innerText
    return { noRiskBtn: !t.includes("仅看时限风险"), noOvertimeChip: !t.includes("已超时 / 临近超时") }
  })
  console.log("a5断言:", JSON.stringify(poolChecks))
  await shot("a5-处理池等待立案-新")
  await back()
} catch (e) { console.log("a5 miss", e.message.slice(0, 80)) }

try {
  await page.locator('button[title*="Agent 处理池"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  await page.locator('[aria-label*="持续监控"]').first().click({ timeout: 3500 })
  await page.waitForTimeout(900)
  const watching = await page.evaluate(() => {
    const t = document.body.innerText
    return {
      agentCol: t.includes("识别疑似复发，生成复发候选并回到全量识别审核"),
      humanCol: t.includes("复发候选是否成立，由全量识别审核决定"),
    }
  })
  console.log("a10断言:", JSON.stringify(watching))
  await shot("a10-处理池持续监控-新")
  await back()
} catch (e) { console.log("a10 miss", e.message.slice(0, 80)) }

// a8/a9: 治理配置
await clickVisibleButton("治理配置")
await page.waitForTimeout(1400)
try {
  await clickVisibleButton("生命周期与处置规则")
  await page.waitForTimeout(800)
  const noHint = await page.evaluate(() => !document.body.innerText.includes("修改保存后立即生效"))
  console.log("a8-生命周期页无提示:", noHint)
  await shot("a8-生命周期页-新")
} catch (e) { console.log("a8 miss", e.message.slice(0, 80)) }
try {
  await clickVisibleButton("待办领取")
  await page.waitForTimeout(800)
  const quota = await page.evaluate(() => document.body.innerText.includes("不设上限"))
  console.log("a9-空上限显示不设上限:", quota)
  await shot("a9-待办领取-新")
} catch (e) { console.log("a9 miss", e.message.slice(0, 80)) }

await browser.close()
console.log("DONE")
