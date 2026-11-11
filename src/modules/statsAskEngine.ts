// AI 统计 · 问 AI 前端模拟引擎
// 每项统计背后挂一批示例事件（件数与图上一致），建议问题从这批事件里算信号，
// 回答也只从这批事件里筛选、计数、取最久。不接外部模型。

export interface AskEv {
  kind?: "found" | "closed"
  type?: string
  street?: string
  grid?: string
  lane?: string
  stage?: string
  severe?: boolean
  waitH?: number
  respGrid?: string
  camPoint?: string
  hour?: string
  foundDay?: string
  closedDay?: string
  reach?: string
  conclusion?: string
  note?: string
  durWait?: number
  durDo?: number
  durCheck?: number
  returns?: number
  aiType?: string
  humanType?: string
  sysSuggest?: string
  humanJudge?: string
  final?: string
}

export type FieldKey =
  | "type" | "street" | "grid" | "lane" | "stage" | "respGrid" | "camPoint" | "hour"
  | "foundDay" | "closedDay" | "reach" | "conclusion" | "note" | "returns"
  | "aiType" | "humanType" | "sysSuggest" | "humanJudge" | "final"

export type TimeKey = "waitH" | "durWait" | "durDo" | "durCheck"

export const FIELD_WORD: Record<FieldKey, string> = {
  type: "类型", street: "街道", grid: "网格", lane: "街巷", stage: "环节", respGrid: "责任网格",
  camPoint: "点位", hour: "时段", foundDay: "发现日", closedDay: "闭环日", reach: "阶段",
  conclusion: "结论", note: "说明", returns: "退回次数", aiType: "AI 预填类型",
  humanType: "人工最终类型", sysSuggest: "系统建议", humanJudge: "人工判断", final: "最终是否要办",
}

const TIME_WORD: Record<TimeKey, string> = {
  waitH: "已等待", durWait: "发现到派给网格用时", durDo: "派给网格到处置完用时", durCheck: "处置完到核查完用时",
}

// 问句里出现的字段词 → 字段。先长后短，避免「责任网格」被「网格」吃掉。
const FIELD_PATTERNS: [RegExp, FieldKey][] = [
  [/责任网格|派给了?哪个网格|哪个网格在办/, "respGrid"],
  [/人工.*(怎么判|判断)/, "humanJudge"],
  [/系统建议/, "sysSuggest"],
  [/退回.*几次|退回次数/, "returns"],
  [/说明|判.*理由/, "note"],
  [/结论/, "conclusion"],
  [/点位|相机|路口/, "camPoint"],
  [/街巷|胡同|哪条街/, "lane"],
  [/网格/, "grid"],
  [/街道/, "street"],
  [/类型|哪类|什么事件|哪种/, "type"],
  [/小时|几点|时段|什么时候/, "hour"],
  [/环节|哪一步|办到|在哪一阶|卡在/, "stage"],
  [/走到/, "reach"],
  [/要不要办|最终要办|是否要办/, "final"],
]

// 这些在示例事件里本来就没有记录
const UNRECORDED = ["责任人姓名", "姓名", "电话", "照片", "车牌", "费用", "罚款", "投诉", "天气", "处置人", "上报人"]

export interface NamedSubset { re: RegExp; label: string; events: AskEv[]; field?: FieldKey }

export interface AskSpec {
  events: AskEv[]
  setLabel: string
  fields: FieldKey[]
  itemField?: FieldKey
  items?: { name: string; value: number }[]
  itemUnit?: "件" | "小时"
  concFields?: FieldKey[]
  timeKey?: TimeKey
  timeByWord?: [RegExp, TimeKey][]
  subsets?: NamedSubset[]
  defaultField?: FieldKey
  severeSignal?: boolean
  progressSignal?: boolean
  extraSuggestions?: string[]
}

export interface AskReply { ok: boolean; text: string; used?: string[] }

// ─── 示例事件生成工具 ────────────────────────────────────────────────────────
export function seeded(key: string): () => number {
  let h = 2166136261
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  let s = h >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function expand(rows: { name: string; value: number }[]): string[] {
  return rows.flatMap((r) => Array.from({ length: Math.max(0, r.value) }, () => r.name))
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function shuffleIdx(n: number, rnd: () => number): number[] {
  return shuffle(Array.from({ length: Math.max(0, n) }, (_, i) => i), rnd)
}

/** 把一组名字按件数填满 n 个位置；不足用最后一个补。 */
export function fill(rows: { name: string; value: number }[], n: number, rnd: () => number, keepOrder = false): string[] {
  const base = expand(rows)
  while (base.length < n && rows.length > 0) base.push(rows[rows.length - 1].name)
  const cut = base.slice(0, n)
  return keepOrder ? cut : shuffle(cut, rnd)
}

// ─── 统计 ────────────────────────────────────────────────────────────────────
function groupBy(events: AskEv[], f: FieldKey): { name: string; value: number }[] {
  const m = new Map<string, number>()
  for (const e of events) {
    const raw = e[f]
    if (raw === undefined || raw === null || raw === "") continue
    const k = f === "returns" ? `${raw} 次` : String(raw)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

function trueTop(items: { name: string; value: number }[]) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  if (sorted.length === 0) return { top: null, ties: [] as { name: string; value: number }[] }
  const ties = sorted.filter((i) => i.value === sorted[0].value)
  return { top: sorted[0], ties }
}

const norm = (s: string) => s.replace(/\s+/g, "").replace(/→/g, "到")
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const hasName = (q: string, name: string) => new RegExp(`${esc(norm(name))}(?!\\d)`).test(norm(q))
const fmtH = (h: number) => `${Math.round(h * 10) / 10} 小时`

function concentrated(events: AskEv[], fields: FieldKey[]): { field: FieldKey; name: string; value: number } | null {
  if (events.length < 2) return null
  for (const f of fields) {
    const g = groupBy(events, f)
    if (g.length >= 1 && g[0].value * 2 >= events.length && (g.length === 1 || g[0].value > g[1].value)) {
      return { field: f, ...g[0] }
    }
  }
  return null
}

// ─── 建议问题：先算信号，再按句式填 ──────────────────────────────────────────
export function buildSuggestions(spec: AskSpec): string[] {
  const out: string[] = []
  const conc = spec.concFields ?? []
  const counted = spec.itemUnit !== "小时"
  const pos = (spec.items ?? []).filter((i) => i.value > 0)
  if (spec.itemField && pos.length >= 2 && conc.length > 0) {
    const { top, ties } = trueTop(pos)
    if (top && ties.length >= 2) {
      if (counted && top.value >= 2 && ties.length < pos.length) out.push(`前${ties.length}项各${top.value}件，分别集中在哪？`)
    } else if (top) {
      const sub = spec.events.filter((e) => e[spec.itemField!] === top.name)
      const c = concentrated(sub, conc)
      if (c) out.push(`${top.name}的${sub.length}件，集中在哪个${FIELD_WORD[c.field]}？`)
      else if (spec.progressSignal && new Set(sub.map((e) => e.stage)).size > 1) out.push(`${top.name}的${sub.length}件，现在办到哪一步了？`)
    }
  }
  for (const s of spec.extraSuggestions ?? []) out.push(s)

  const focus = (() => {
    const whole = { label: spec.setLabel, events: spec.events }
    if (!spec.itemField || !spec.items) return whole
    const { top, ties } = trueTop(spec.items)
    if (!top || ties.length >= 2) return whole
    const sub = spec.events.filter((e) => e[spec.itemField!] === top.name)
    return sub.length >= 2 ? { label: top.name, events: sub } : whole
  })()
  if (spec.severeSignal && focus.events !== spec.events && focus.events.some((e) => e.severe)) {
    out.push(`${focus.label}的${focus.events.length}件里有几件是严重的？`)
  }
  if (spec.timeKey) {
    const ts = focus.events.map((e) => e[spec.timeKey!]).filter((x): x is number => typeof x === "number")
    if (ts.length >= 2) {
      const avg = ts.reduce((a, b) => a + b, 0) / ts.length
      if (Math.max(...ts) >= avg * 1.5) {
        out.push(spec.timeKey === "waitH" ? `${focus.label}里等得最久的是哪几件？` : `${focus.label}里最慢的是哪几件？`)
      }
    }
  }
  return [...new Set(out)].filter((t) => t.length <= 25).slice(0, 3)
}

// ─── 回答 ────────────────────────────────────────────────────────────────────
export function answerFromEvents(spec: AskSpec, q: string): AskReply {
  const fieldsAll: FieldKey[] = ["stage", "type", "respGrid", "grid", "street", "lane", "camPoint", "hour", "conclusion", "final", "humanJudge", "foundDay", "closedDay"]

  // 1) 没记录的字段
  const unrec = UNRECORDED.find((w) => q.includes(w))
  if (unrec) return { ok: false, text: `这批事件没有记录${unrec}。` }

  // 2) 圈出子集
  let events = spec.events
  const labels: string[] = []
  let field: FieldKey | undefined
  let qRest = q
  for (const s of spec.subsets ?? []) {
    if (s.re.test(q)) { events = s.events; labels.push(s.label); field = s.field; qRest = qRest.replace(s.re, ""); break }
  }
  if (labels.length === 0) {
    const closedAsk = /办结|闭环/.test(q)
    for (const f of fieldsAll) {
      if (f === "foundDay" && closedAsk) continue
      if (f === "closedDay" && !closedAsk) continue
      const values = [...new Set(events.map((e) => e[f]).filter((x): x is string => typeof x === "string"))]
        .sort((a, b) => b.length - a.length)
      const hit = values.find((val) => hasName(q, val))
      if (hit) {
        qRest = qRest.split(hit).join("")
        events = events.filter((e) => e[f] === hit)
        if (f === "foundDay") events = events.filter((e) => e.kind !== "closed")
        labels.push(f === "foundDay" ? `${hit}发现` : f === "closedDay" ? `${hit}办结` : hit)
      }
    }
  }
  const askSevereCount = /几件.*严重|多少.*严重|严重的有几/.test(q)
  if (!askSevereCount && /严重的/.test(q) && events.some((e) => e.severe)) {
    events = events.filter((e) => e.severe)
    labels.push("严重")
  }
  const label = labels.length > 0 ? `${labels.join("、")}的 ${events.length} 件` : `${spec.setLabel} ${events.length} 件`
  const basis = (extra?: string) => [label, ...(extra ? [extra] : [])]

  if (events.length === 0) return { ok: true, text: `这批事件里没有${labels.join("、")}。`, used: basis() }

  // 3) 是不是最多 / 最久
  if (/是不是.*(最多|最久|最慢|最长|停得最)/.test(q) && spec.items && spec.items.length > 0) {
    const target = spec.items.find((i) => hasName(q, i.name))
    const { top, ties } = trueTop(spec.items)
    const unit = spec.itemUnit === "小时" ? " 小时" : " 件"
    if (target && top) {
      if (target.value === top.value && ties.length >= 2) {
        return { ok: true, text: `并列。${ties.map((t) => t.name).join("、")} 都是 ${top.value}${unit}。`, used: spec.items.map((i) => `${i.name} ${i.value}${unit}`) }
      }
      if (target.value === top.value) {
        const second = [...spec.items].sort((a, b) => b.value - a.value)[1]
        return { ok: true, text: `是。${target.name} ${target.value}${unit}${second ? `，第二是 ${second.name} ${second.value}${unit}` : ""}。`, used: spec.items.map((i) => `${i.name} ${i.value}${unit}`) }
      }
      return { ok: true, text: `不是。${top.name} ${top.value}${unit} 更${spec.itemUnit === "小时" ? "久" : "多"}，${target.name} 是 ${target.value}${unit}。`, used: spec.items.map((i) => `${i.name} ${i.value}${unit}`) }
    }
  }

  // 4) 几件是严重的
  if (askSevereCount) {
    const k = events.filter((e) => e.severe).length
    if (!spec.events.some((e) => e.severe !== undefined)) return { ok: false, text: "这批事件没有记录等级。" }
    const byStage = groupBy(events.filter((e) => e.severe), "stage")
    const tail = k > 0 && byStage.length > 1 ? `，${byStage.map((g) => `${g.name} ${g.value} 件`).join("、")}` : ""
    return { ok: true, text: `${k} 件是严重的${tail}。`, used: basis("按等级统计") }
  }

  // 5) 从什么改成了什么 / 人工怎么判
  if (/改成|从什么/.test(q) && events.some((e) => e.aiType)) {
    const pairs = new Map<string, number>()
    for (const e of events) if (e.aiType && e.humanType && e.aiType !== e.humanType) {
      const k = `${e.aiType} 改成 ${e.humanType}`
      pairs.set(k, (pairs.get(k) ?? 0) + 1)
    }
    const list = [...pairs.entries()].sort((a, b) => b[1] - a[1])
    if (list.length === 0) return { ok: true, text: "这批事件里没有被改掉类型的。", used: basis() }
    return { ok: true, text: `${list.map(([k, n]) => `${k} ${n} 件`).join("；")}。`, used: basis("按 AI 预填类型和人工最终类型对比") }
  }

  // 6) 最久 / 最慢
  const timeKey = (spec.timeByWord ?? []).find(([re]) => re.test(q))?.[1] ?? spec.timeKey
  if (timeKey && /最久|最慢|最长|等得最|拖得最/.test(q)) {
    const rows = events.filter((e) => typeof e[timeKey] === "number").sort((a, b) => (b[timeKey] as number) - (a[timeKey] as number)).slice(0, 3)
    if (rows.length === 0) return { ok: true, text: "这批事件没有可算的用时。", used: basis() }
    const showStage = new Set(events.map((e) => e.stage)).size > 1
    const desc = rows.map((e) => {
      const where = e.respGrid ?? e.grid ?? e.street ?? ""
      const bits = [where, showStage ? e.stage : ""].filter(Boolean).join(" · ")
      return `${e.type ?? "事件"}${bits ? `（${bits}）` : ""} ${fmtH(e[timeKey] as number)}`
    })
    return { ok: true, text: `${TIME_WORD[timeKey]}最长的 ${rows.length} 件：${desc.join("；")}。名单在这项统计的切片里。`, used: basis(`按${TIME_WORD[timeKey]}排序`) }
  }

  // 7) 分别集中在哪（并列）
  if (/分别集中/.test(q) && spec.itemField && spec.items) {
    const { ties } = trueTop(spec.items)
    const parts = ties.map((t) => {
      const sub = spec.events.filter((e) => e[spec.itemField!] === t.name)
      const c = concentrated(sub, spec.concFields ?? []) ?? (() => {
        const f = (spec.concFields ?? [])[0]
        const g = f ? groupBy(sub, f)[0] : undefined
        return f && g ? { field: f, ...g } : null
      })()
      return c ? `${t.name}：${c.name} ${c.value} 件` : `${t.name}：比较分散`
    })
    return { ok: true, text: `${parts.join("；")}。`, used: ties.map((t) => `${t.name} ${t.value} 件`) }
  }

  // 8) 按字段分组
  let gf: FieldKey | undefined = FIELD_PATTERNS.find(([re]) => re.test(qRest))?.[1]
  if (!gf && /在哪|分布|集中/.test(qRest)) gf = field ?? spec.defaultField
  if (gf) {
    if (!spec.fields.includes(gf)) return { ok: false, text: `这批事件没有记录${FIELD_WORD[gf]}。` }
    const g = groupBy(events, gf)
    if (g.length === 0) return { ok: true, text: `这批事件还没有${FIELD_WORD[gf]}。`, used: basis() }
    const list = (rows: { name: string; value: number }[]) => rows.map((x) => `${x.name} ${x.value} 件`).join("、")
    let text: string
    if (g.length === 1) {
      text = gf === "returns" ? `${events.length} 件都退回了 ${g[0].name}。` : `${events.length} 件都是 ${g[0].name}。`
    } else if (g[0].value === g[1].value) {
      const tied = g.filter((x) => x.value === g[0].value)
      const rest = g.filter((x) => x.value !== g[0].value)
      text = `${tied.map((x) => x.name).join("、")} 各 ${g[0].value} 件，并列最多${rest.length > 0 ? `；其余 ${list(rest)}` : ""}。`
    } else {
      const half = g[0].value * 2 >= events.length ? "，占一半以上" : ""
      text = `${g[0].name} ${g[0].value} 件最多${half}；其余 ${list(g.slice(1))}。`
    }
    return { ok: true, text, used: basis(`按${FIELD_WORD[gf]}统计`) }
  }

  // 9) 几件
  if (/几件|多少件|多少|有几/.test(q)) {
    return { ok: true, text: `${labels.length > 0 ? labels.join("、") : spec.setLabel}共 ${events.length} 件。`, used: basis() }
  }

  return { ok: false, text: "这里只有这批事件的记录，看不出原因，也不能预测。" }
}

export function fieldsPhrase(fields: FieldKey[], timeKey?: TimeKey, hasSevere?: boolean): string[] {
  const out = fields.map((f) => (f === "stage" ? "卡在哪个环节" : f === "hour" ? "发现时段" : FIELD_WORD[f]))
  if (hasSevere) out.push("是否严重")
  if (timeKey) out.push(timeKey === "waitH" ? "已经等了多久" : TIME_WORD[timeKey])
  return out
}
