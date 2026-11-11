import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import EchartsBar from "../components/EchartsBar"
import EchartsDiscoverClose from "../components/EchartsDiscoverClose"
import EchartsPie from "../components/EchartsPie"
import EchartsRank from "../components/EchartsRank"
import KpiIcon from "../components/KpiIcon"
import { RuleChips } from "../data/dashboardRules"
import { STATS2_ALGO_RULES, STATS2_USER_RULES } from "../data/statsV2Rules"
import {
  answerFromEvents, buildSuggestions, fieldsPhrase, fill, seeded, shuffleIdx,
  type AskEv, type AskReply, type AskSpec, type AskViz, type FieldKey, type VizEvent, type VizRow,
} from "./statsAskEngine"

// AI 统计 · V1.3 四类收敛版
// 本版只改 AI 统计：打开即四类，不再保留 ?v=2 入口与七类切换。
// 综合态势 = 区间流水 + 当前积压；事件发生 = 发现结构；流程运行 = 截止此刻库存；
// 治理质量与 AI 成效 = 区间口径质量 + AI 成效。所有数字均为示例，且同一筛选下互相勾稽。

type Cat = "overview" | "events" | "process" | "quality"
type TimeWin = "today" | "7d" | "30d"
type SpaceGran = "street" | "grid" | "lane"

const GRAN_LABEL: Record<SpaceGran, string> = { street: "街道", grid: "网格", lane: "街巷" }

const C = {
  primary: "var(--primary)",
  primaryLight: "var(--primary-light)",
  success: "var(--green)",
  warning: "var(--amber)",
  danger: "var(--red)",
  purple: "var(--purple)",
  cyan: "var(--accent)",
  text: "var(--foreground)",
  muted: "var(--muted-foreground)",
  border: "var(--border)",
  borderLight: "var(--glass-border)",
  card: "var(--card)",
}

const CATS: { id: Cat; label: string; hint: string }[] = [
  { id: "overview", label: "综合态势", hint: "这套筛选下这段时间的总量，加上现在还没办完的存量" },
  { id: "events", label: "事件发生", hint: "发现了什么、在哪里、什么时候、哪路相机报得多" },
  { id: "process", label: "流程运行", hint: "上半段是这段时间办完的用时，下半段是现在压着的（截止此刻）" },
  { id: "quality", label: "治理质量与 AI 成效", hint: "办得怎么样 + 相机发现和人工判断是否一致" },
]

const WINS: { id: TimeWin; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "7d", label: "近7日" },
  { id: "30d", label: "近30日" },
]

const WIN_LABEL: Record<TimeWin, string> = { today: "今日", "7d": "近7日", "30d": "近30日" }

// ─── 示例数据：类型 / 街道 / 网格 / 街巷权重 ───────────────────────────────
const TYPE_DEFS = [
  { label: "共享单车占道", color: C.primary, weight: 0.28 },
  { label: "施工占道", color: C.cyan, weight: 0.24 },
  { label: "占道经营", color: C.warning, weight: 0.2 },
  { label: "暴露垃圾", color: C.success, weight: 0.16 },
  { label: "疑似堆物", color: C.danger, weight: 0.12 },
]

const STREETS = [
  "北新桥街道", "朝阳门街道", "东华门街道", "东四街道",
  "安定门街道", "东直门街道", "和平里街道", "建国门街道",
]
const STREET_WEIGHTS = [0.2, 0.18, 0.15, 0.13, 0.1, 0.09, 0.08, 0.07]

const ALL_GRIDS = [
  "北新桥-04网格", "朝阳门-01网格", "东华门-02网格", "东四-01网格",
  "北新桥-01网格", "朝阳门-03网格", "安定门-02网格", "东直门-01网格", "和平里-01网格",
]
const ALL_GRID_WEIGHTS = [0.16, 0.14, 0.13, 0.12, 0.11, 0.1, 0.09, 0.08, 0.07]

const ALL_LANES = [
  "东四北大街", "簋街", "王府井步行街", "雍和宫大街", "朝阳门南小街",
  "金鱼胡同", "车辇店胡同", "交道口南大街", "东直门内大街",
]
const ALL_LANE_WEIGHTS = [0.15, 0.14, 0.13, 0.12, 0.11, 0.1, 0.09, 0.08, 0.08]

const STREET_GRID_WEIGHTS = [0.42, 0.35, 0.23]
const STREET_LANE_WEIGHTS = [0.4, 0.35, 0.25]

const WIN_TOTAL: Record<TimeWin, number> = { today: 5, "7d": 18, "30d": 62 }

// 24 小时权重：真实高度由 alloc 按事件总数分配，保证 24 柱之和 = 事件总数
const HOUR_WEIGHTS = [
  0, 0, 0, 0, 0, 0, 1.2, 2.4, 4.6, 5.2, 4.2, 3.2,
  2.2, 2, 2.4, 2.6, 1.8, 1.4, 1, 0.6, 0.3, 0, 0, 0,
]

// 发现 / 闭环按日权重：由 alloc 按窗口总数分配，保证日合计精确等于两张卡
const FOUND_7_WEIGHTS = [0.18, 0.16, 0.15, 0.14, 0.13, 0.12, 0.12]
const CLOSED_7_WEIGHTS = [0.06, 0.08, 0.12, 0.16, 0.18, 0.2, 0.2]
const DAILY_PATTERN = [0.8, 1.0, 1.2, 0.9, 1.1, 1.3, 1.0]

function dailyWeights(n: number, kind: "found" | "closed"): number[] {
  if (n <= 1) return [1]
  if (n === 7) return kind === "found" ? FOUND_7_WEIGHTS : CLOSED_7_WEIGHTS
  return Array.from({ length: n }, (_, i) =>
    kind === "found"
      ? DAILY_PATTERN[i % 7] * (0.85 + i * 0.008)
      : DAILY_PATTERN[(i + 5) % 7] * (0.7 + i * 0.012),
  )
}

function buildDays(n: number): { label: string; date: string }[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i))
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, date: `${d.getFullYear()}-${mm}-${dd}` }
  })
}

const CAMERA_DEFS = [
  { id: "C-A11-03", point: "雍和宫大街·国子监街口", place: "北新桥街道 · 北新桥-04网格", weight: 0.16 },
  { id: "C-C07-11", point: "王府井步行街北口", place: "东华门街道 · 东华门-02网格", weight: 0.14 },
  { id: "C-B03-02", point: "东四北大街·钱粮胡同口", place: "东四街道 · 东四-01网格", weight: 0.12 },
  { id: "C-E01-02", point: "朝阳门南小街·竹竿胡同口", place: "朝阳门街道 · 朝阳门-01网格", weight: 0.1 },
  { id: "C-A02-08", point: "安定门内大街·车辇店胡同口", place: "安定门街道 · 安定门-02网格", weight: 0.08 },
  { id: "C-A07-04", point: "交道口南大街·府学胡同口", place: "安定门街道 · 安定门-01网格", weight: 0.07 },
  { id: "C-D04-01", point: "和平里中街·街心公园东门", place: "和平里街道 · 和平里-01网格", weight: 0.05 },
]

// 区间流水：闭环里的「作废或判无效」（按时间窗变）；结案件数 = 链路「核查」阶
const WIN_CLOSED_NON_CASE: Record<TimeWin, number> = { today: 1, "7d": 4, "30d": 12 }

// 链路吞吐：各阶按本环节完成时间计，件数不必逐阶变少；审核 = 有效 + 无效，处置、核查两阶由办完样本得出
const WIN_FUNNEL: Record<TimeWin, { filed: number }> = {
  today: { filed: 2 },
  "7d": { filed: 15 },
  "30d": { filed: 55 },
}

const FUNNEL_STAGES: { key: "found" | "reviewed" | "filed" | "disposed" | "inspected"; label: string; sub: string; ruleId: string }[] = [
  { key: "found", label: "识别", sub: "区间新发现", ruleId: "funnel_found" },
  { key: "reviewed", label: "审核", sub: "区间审完（有效+无效）", ruleId: "funnel_reviewed" },
  { key: "filed", label: "立案", sub: "区间立案派发成功", ruleId: "funnel_filed" },
  { key: "disposed", label: "处置", sub: "区间处置完成", ruleId: "funnel_disposed" },
  { key: "inspected", label: "核查", sub: "核查通过并结案", ruleId: "funnel_inspected" },
]

const FUNNEL_SLICE_STAGES: Record<string, string[]> = {
  found: ["待立案", "待处置", "待核查", "已结案", "已作废", "无效"],
  reviewed: ["待处置", "待核查", "已结案", "已作废", "无效"],
  filed: ["待处置", "待核查", "已结案"],
  disposed: ["待核查", "已结案"],
  inspected: ["已结案"],
}

// 当前积压：截止此刻快照，不随时间变，随空间 / 类型变
const BACKLOG_STAGE_WEIGHTS = [7, 10, 5, 2]
const BACKLOG_SEVERE = 7
const BACKLOG_GRID_WEIGHTS = [0.28, 0.2, 0.16, 0.14, 0.12, 0.1]
const BACKLOG_GRID_NAMES = ["A11 责任人", "C07 责任人", "E01 责任人", "A07 责任人", "B03 责任人", "B05 责任人"]

const STAGE_META = [
  { key: "pending", label: "待立案", color: C.primary, icon: "filePlus", ruleId: "pr_pending" },
  { key: "dispose", label: "待处置", color: C.warning, icon: "layers", ruleId: "pr_dispose" },
  { key: "inspect", label: "待核查", color: C.purple, icon: "search", ruleId: "pr_inspect" },
  { key: "void", label: "待作废审核", color: C.danger, icon: "xCircle", ruleId: "pr_void" },
]

// 治理质量与 AI 成效：按所选时间区间计
const WIN_QUALITY: Record<TimeWin, {
  valid: number
  invalid: number
  dissipated: number
  returned: number
  prefillMatch: number
  prefillTotal: number
  suggestMatch: number
  suggestTotal: number
  spaceFail: number
}> = {
  today: {
    valid: 2, invalid: 1, dissipated: 0, returned: 0,
    prefillMatch: 4, prefillTotal: 5, suggestMatch: 4, suggestTotal: 5,
    spaceFail: 1,
  },
  "7d": {
    valid: 15, invalid: 2, dissipated: 1, returned: 1,
    prefillMatch: 15, prefillTotal: 18, suggestMatch: 13, suggestTotal: 16,
    spaceFail: 3,
  },
  "30d": {
    valid: 52, invalid: 7, dissipated: 3, returned: 3,
    prefillMatch: 49, prefillTotal: 62, suggestMatch: 44, suggestTotal: 57,
    spaceFail: 9,
  },
}

// ─── 处置时长样本：所选时间内「处置完成」的事件（单位：小时） ────
// 件数 = 链路「处置」阶；其中已核查结案的才有 check，件数 = 链路「核查」阶 = 区间闭环里的结案
interface DoneEv { grid: string; type: string; wait: number; doIt: number; check?: number }
const DONE_GRIDS = [
  "北新桥-04网格", "朝阳门-01网格", "东华门-02网格", "东四-01网格",
  "安定门-02网格", "东直门-01网格", "和平里-01网格",
]
function genDone(n: number, checked: number): DoneEv[] {
  return Array.from({ length: n }, (_, i) => ({
    grid: DONE_GRIDS[(i * 3 + 1) % DONE_GRIDS.length],
    type: TYPE_DEFS[(i * 2 + 1) % TYPE_DEFS.length].label,
    wait: Math.round((1.2 + ((i * 7) % 11) * 0.35) * 10) / 10,
    doIt: Math.round((2.5 + ((i * 5) % 13) * 0.55) * 10) / 10,
    check: i < checked ? Math.round((1.0 + ((i * 3) % 9) * 0.4) * 10) / 10 : undefined,
  }))
}
const WIN_DONE: Record<TimeWin, DoneEv[]> = {
  today: genDone(2, 2),
  "7d": genDone(9, 6),
  "30d": genDone(33, 22),
}

// ─── 切片示例事件池 ──────────────────────────────────────────────────────────
interface EvRow { type: string; place: string; stage: string; time: string; status: string }
const EVENT_POOL: EvRow[] = [
  { type: "共享单车占道", place: "北新桥街道 · 北新桥-04网格", stage: "待立案", time: "2026-11-09 08:41", status: "相机识别，待人工立案" },
  { type: "施工占道", place: "朝阳门街道 · 朝阳门-01网格", stage: "待立案", time: "2026-11-09 09:05", status: "相机识别，待人工立案" },
  { type: "占道经营", place: "东华门街道 · 东华门-02网格", stage: "待立案", time: "2026-11-09 09:37", status: "相机识别，待人工立案" },
  { type: "共享单车占道", place: "朝阳门街道 · 朝阳门-01网格", stage: "待处置", time: "2026-11-08 15:20", status: "已派发 C07 责任人" },
  { type: "暴露垃圾", place: "东四街道 · 东四-01网格", stage: "待核查", time: "2026-11-08 10:12", status: "处置完成，待核查" },
  { type: "施工占道", place: "北新桥街道 · 北新桥-01网格", stage: "待核查", time: "2026-11-07 16:48", status: "处置完成，待核查" },
  { type: "疑似堆物", place: "朝阳门街道 · 朝阳门-03网格", stage: "待核查", time: "2026-11-07 11:30", status: "处置完成，待核查" },
  { type: "占道经营", place: "东华门街道 · 东华门-01网格", stage: "待作废审核", time: "2026-11-07 09:22", status: "现场已不存在，待裁定作废" },
  { type: "共享单车占道", place: "北新桥街道 · 北新桥-04网格", stage: "已结案", time: "2026-11-09 07:55", status: "核查通过，已结案" },
  { type: "施工占道", place: "朝阳门街道 · 朝阳门-01网格", stage: "已结案", time: "2026-11-08 14:03", status: "核查通过，已结案" },
  { type: "暴露垃圾", place: "东四街道 · 东四-01网格", stage: "已结案", time: "2026-11-08 08:47", status: "核查通过，已结案" },
  { type: "疑似堆物", place: "安定门街道 · 安定门-02网格", stage: "已作废", time: "2026-11-07 17:10", status: "现场已消散，作废归档" },
  { type: "施工占道", place: "建国门街道 · 建国门-01网格", stage: "无效", time: "2026-11-06 10:24", status: "判无效，不属于事件范围" },
  { type: "暴露垃圾", place: "和平里街道 · 和平里-01网格", stage: "已结案", time: "2026-11-06 09:12", status: "核查通过，已结案" },
]

// ─── 工具 ────────────────────────────────────────────────────────────────────
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

/** 按权重把整数总量精确分配，保证分配结果之和 = total。 */
function alloc(total: number, weights: number[]): number[] {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0)
  const wsum = weights.reduce((a, b) => a + b, 0)
  if (wsum <= 0) return weights.map(() => 0)
  const raw = weights.map((w) => (w / wsum) * total)
  const out = raw.map((n) => Math.floor(n))
  const remain = total - out.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - out[i] }))
    .sort((a, b) => b.frac - a.frac || b.i - a.i)
  for (let k = 0; k < remain; k += 1) out[order[k % order.length].i] += 1
  return out
}

const pct = (n: number, d: number) =>
  d === 0 ? "—" : `${(Math.round((n / d) * 1000) / 10).toFixed(1)}%`

const mean1 = (nums: number[]): number | null =>
  nums.length === 0 ? null : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10

function topWithRest(data: { name: string; value: number }[], n = 8) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  return {
    visible: sorted.slice(0, n),
    restCount: Math.max(0, sorted.length - n),
    restSum: sum(sorted.slice(n).map((d) => d.value)),
  }
}

function filterPool(f: { stages?: string[]; type?: string | null; street?: string | null; severe?: boolean }): EvRow[] {
  let rows = EVENT_POOL
  if (f.stages) rows = rows.filter((r) => f.stages!.includes(r.stage))
  if (f.type) rows = rows.filter((r) => r.type === f.type)
  if (f.street) rows = rows.filter((r) => r.place.startsWith(f.street!))
  if (f.severe) rows = rows.filter((r) => r.type === "疑似堆物" || r.type === "施工占道")
  return rows
}

function downloadCsv(name: string, rows: EvRow[]) {
  const head = "类型,位置,环节/终态,发生时间,当前情况"
  const body = rows
    .map((r) => [r.type, r.place, r.stage, r.time, r.status].map((v) => `"${v}"`).join(","))
    .join("\n")
  const blob = new Blob(["\uFEFF" + head + "\n" + body], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface Filter {
  win: TimeWin
  street: string | null
  type: string | null
}

// 空间分组：只用于「严重问题空间」与「空间分布」两张图
function spaceBuckets(street: string | null, gran: SpaceGran): { name: string; weight: number }[] {
  if (street) {
    const s = street.replace(/街道$/, "")
    if (gran === "lane") {
      return ["大街东段", "大街西段", "胡同片区"].map((t, i) => ({
        name: `${s}${t}`,
        weight: STREET_LANE_WEIGHTS[i],
      }))
    }
    return [1, 2, 3].map((i) => ({ name: `${s}-0${i}网格`, weight: STREET_GRID_WEIGHTS[i - 1] }))
  }
  if (gran === "grid") return ALL_GRIDS.map((name, i) => ({ name, weight: ALL_GRID_WEIGHTS[i] }))
  if (gran === "lane") return ALL_LANES.map((name, i) => ({ name, weight: ALL_LANE_WEIGHTS[i] }))
  return STREETS.map((name, i) => ({ name, weight: STREET_WEIGHTS[i] }))
}

// ─── 切片抽屉 ────────────────────────────────────────────────────────────────
interface SliceState {
  title: string
  caliber: string
  rows: EvRow[]
}

function SliceDrawer({ slice, onClose }: { slice: SliceState | null; onClose: () => void }) {
  if (!slice) return null
  const rows = slice.rows
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        display: "flex", alignItems: "stretch", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(22,45,77,0.32)" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${slice.title}切片`}
        style={{
          position: "relative", width: 480, maxWidth: "92vw",
          background: "var(--panel-solid, #fff)", borderLeft: "1px solid var(--border)",
          boxShadow: "-16px 0 48px rgba(22,45,77,0.18)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
            切片 · {slice.title}
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginLeft: 8 }}>示例数据</span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border)", background: "transparent", borderRadius: 8,
              width: 28, height: 28, cursor: "pointer", color: C.muted, fontSize: 13,
            }}
            aria-label="关闭切片"
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          <div
            style={{
              fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 12,
              padding: "8px 12px", background: "var(--card-2, rgba(50,109,255,0.04))", borderRadius: 8,
            }}
          >
            {slice.caliber}
          </div>
          {rows.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, padding: "24px 0", textAlign: "center" }}>
              当前范围暂无明细
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r, i) => {
                const terminal = r.stage === "已结案" || r.stage === "已作废" || r.stage === "无效"
                return (
                  <div
                    key={i}
                    style={{
                      border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px",
                      display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{r.type}</span>
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 999,
                          background: terminal ? "rgba(46,155,104,0.12)" : "rgba(50,109,255,0.10)",
                          color: terminal ? "var(--green)" : "var(--primary)",
                        }}
                      >
                        {r.stage}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{r.place} · {r.time}</div>
                    <div style={{ fontSize: 11.5, color: C.text }}>{r.status}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => downloadCsv(`${slice.title}切片`, rows)}
            style={{
              border: "1px solid var(--border)", background: "transparent", borderRadius: 8,
              padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.text,
            }}
          >
            ⬇ 下载本切片
          </button>
        </div>
      </aside>
    </div>
  )
}

// ─── 问 AI ───────────────────────────────────────────────────────────────────
// 只有白名单里的统计给入口。每项统计背后挂一批示例事件（件数与图上一致），
// 建议问题和回答都只从这批事件里算，不接外部模型。
interface AskDesc {
  id: string
  title: string
  scope: string
  sig?: string
  filterText?: string
  empty: boolean
  scopeLine: string
  askFields: string[]
  suggestions: string[]
  sampleHint: string
  rest?: { count: number; sum: number } | null
  spec: AskSpec
}

const ASK_OTHER_TITLES = [
  "事件总数", "区间闭环", "存续事件", "严重事件", "发现与闭环", "链路吞吐",
  "各阶段待处理", "严重问题空间", "当前存续类型", "类型结构", "空间分布",
  "发生时段", "高发相机", "平均处置时长", "各环节停了多久", "哪个网格办完更久", "哪类事件办完更久",
  "环节存量", "责任网格在办", "有效 / 无效 / 消散", "事件有效率", "退回率", "一次核查通过率",
  "发现有效率", "预填少改", "建议一致率", "空间匹配失败",
]

type AskAnswer = AskReply

function answerAsk(desc: AskDesc, q: string): AskAnswer {
  if (/为什么|原因|怎么回事|预测|以后会|将来|明天会|会不会再|派人|谁去办|安排谁|追责|问责|处分|其他城市|别的区|和.*区比/.test(q)) {
    return { ok: false, text: "这里只有这批事件的记录，看不出原因，也不能预测。" }
  }
  if (desc.rest && desc.rest.count > 0 && /其余|没画出|没显示|后面那些/.test(q)) {
    return { ok: false, text: `只知道其余 ${desc.rest.count} 个合计 ${desc.rest.sum} 件，没有名单。` }
  }
  const own = new Set<string>([desc.title, desc.spec.setLabel])
  for (const e of desc.spec.events) for (const val of Object.values(e)) if (typeof val === "string") own.add(val)
  for (const i of desc.spec.items ?? []) own.add(i.name)
  const other = ASK_OTHER_TITLES.find((t) => !own.has(t) && t !== desc.title && q.includes(t))
  if (other) return { ok: false, text: `这里只看${desc.title}。要看那一项，请打开那一项的问 AI。` }
  return answerFromEvents(desc.spec, q)
}

const ASK_STORAGE_KEY = "stats-ask-ai-v1.3"

function persistAsk(desc: AskDesc, q: string, ans: AskAnswer) {
  try {
    const arr = JSON.parse(localStorage.getItem(ASK_STORAGE_KEY) ?? "[]") as unknown[]
    arr.push({
      stat: desc.title,
      scope: desc.scope,
      question: q,
      answer: ans.text,
      answered: ans.ok,
      at: new Date().toISOString(),
    })
    localStorage.setItem(ASK_STORAGE_KEY, JSON.stringify(arr))
  } catch { /* 存储不可用时静默 */ }
}

interface AskMsg { role: "q" | "a" | "divider"; text: string; used?: string[]; ok?: boolean; viz?: AskViz }

const VIZ_COLORS = ["var(--primary)", "var(--accent)", "var(--amber)", "var(--green)", "var(--purple)", "var(--red)"]

function VizBars({ rows, unit, rest }: { rows: VizRow[]; unit: string; rest?: { count: number; sum: number } }) {
  const max = Math.max(1, ...rows.map((r) => r.value), rest?.sum ?? 0)
  const anyHi = rows.some((r) => r.highlight)
  const line = (name: string, value: number, color: string, bold: boolean, key: string) => (
    <div key={key} style={{ display: "grid", gridTemplateColumns: "112px 1fr auto", alignItems: "center", gap: 8 }}>
      <span title={name} style={{ fontSize: 11.5, color: C.text, fontWeight: bold ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <div style={{ height: 8, borderRadius: 999, background: "var(--card-2)", overflow: "hidden" }}>
        <div style={{ width: `${(value / max) * 100}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: bold ? C.primary : C.muted, fontFamily: "JetBrains Mono, monospace", minWidth: 44, textAlign: "right" }}>{value} {unit}</span>
    </div>
  )
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {rows.map((r, i) => line(r.name, r.value, !anyHi || r.highlight ? `linear-gradient(90deg, ${C.primary}, ${C.cyan})` : "#C3CAD5", !anyHi ? i === 0 : !!r.highlight, r.name))}
      {rest && line(`其余 ${rest.count} 个`, rest.sum, "#C3CAD5", false, "__rest")}
    </div>
  )
}

function VizPie({ rows, unit }: { rows: VizRow[]; unit: string }) {
  const total = sum(rows.map((r) => r.value)) || 1
  const R = 30
  const L = 2 * Math.PI * R
  let acc = 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={84} height={84} viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
        <circle cx={42} cy={42} r={R} fill="none" stroke="var(--card-2)" strokeWidth={12} />
        {rows.map((r, i) => {
          const len = (r.value / total) * L
          const el = (
            <circle key={r.name} cx={42} cy={42} r={R} fill="none" stroke={VIZ_COLORS[i % VIZ_COLORS.length]} strokeWidth={12}
              strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-acc} transform="rotate(-90 42 42)" />
          )
          acc += len
          return el
        })}
        <text x={42} y={46} textAnchor="middle" style={{ fontSize: 14, fontWeight: 800, fill: "var(--foreground)" }}>{total}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
        {rows.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: VIZ_COLORS[i % VIZ_COLORS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text }}>{r.name}</span>
            <span style={{ fontWeight: 700, color: C.text, fontFamily: "JetBrains Mono, monospace" }}>{r.value} {unit}</span>
            <span style={{ color: C.muted, width: 34, textAlign: "right" }}>{Math.round((r.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VizLine({ labels, series }: { labels: string[]; series: { name: string; values: number[] }[] }) {
  const W = 380
  const H = 120
  const padL = 22
  const padB = 18
  const peak = Math.max(1, ...series.flatMap((s) => s.values))
  const max = peak <= 1 ? 2 : Math.ceil(peak / 2) * 2
  const n = labels.length
  const x = (i: number) => padL + (n <= 1 ? (W - padL) / 2 : (i / (n - 1)) * (W - padL - 16))
  const y = (val: number) => 6 + (1 - val / max) * (H - padB - 10)
  const step = Math.max(1, Math.ceil(n / 7))
  const colors = ["var(--primary)", "var(--green)"]
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={padL - 4} y={y(max * t) + 3} textAnchor="end" style={{ fontSize: 9, fill: "var(--muted-foreground)" }}>{Math.round(max * t)}</text>
          </g>
        ))}
        {series.map((s, si) => (
          <g key={s.name}>
            <polyline fill="none" stroke={colors[si % 2]} strokeWidth={2} points={s.values.map((val, i) => `${x(i)},${y(val)}`).join(" ")} />
            {n <= 31 && s.values.map((val, i) => <circle key={i} cx={x(i)} cy={y(val)} r={2.4} fill={colors[si % 2]} />)}
          </g>
        ))}
        {labels.map((l, i) => (i % step === 0 || i === n - 1) && (
          <text key={l + i} x={x(i)} y={H - 4} textAnchor={i === n - 1 && n > 1 ? "end" : "middle"} style={{ fontSize: 9, fill: "var(--muted-foreground)" }}>{l}</text>
        ))}
      </svg>
      {series.length > 1 && (
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.muted, marginTop: 2 }}>
          {series.map((s, si) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 2, background: colors[si % 2] }} />{s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function VizEvents({ rows, total }: { rows: VizEvent[]; total: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", background: "var(--card)", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{r.title}</span>
              {r.tag && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 999, background: r.tag === "严重" ? "rgba(229,72,77,0.12)" : "var(--card-2)", color: r.tag === "严重" ? "var(--red)" : C.muted }}>{r.tag}</span>
              )}
              {r.stage && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 999, background: "rgba(50,109,255,0.10)", color: "var(--primary)" }}>{r.stage}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.place}</div>
          </div>
          {r.metric && <span style={{ fontSize: 12.5, fontWeight: 800, color: C.primary, fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>{r.metric}</span>}
        </div>
      ))}
      {total > rows.length && <div style={{ fontSize: 11, color: C.muted }}>共 {total} 件，这里列 {rows.length} 件；全部在这项统计的切片里。</div>}
    </div>
  )
}

function AskVizBlock({ viz }: { viz: AskViz }) {
  switch (viz.kind) {
    case "value":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>{viz.caption}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="gradient-text" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, fontFamily: "JetBrains Mono, monospace" }}>{viz.value}</span>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{viz.unit}</span>
          </div>
          {viz.note && <span style={{ fontSize: 11.5, color: C.muted }}>{viz.note}</span>}
        </div>
      )
    case "pie":
      return <VizPie rows={viz.rows} unit={viz.unit} />
    case "bars":
      return <VizBars rows={viz.rows} unit={viz.unit} rest={viz.rest} />
    case "line":
      return <VizLine labels={viz.labels} series={viz.series} />
    case "events":
      return <VizEvents rows={viz.rows} total={viz.total} />
    case "pairs":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {viz.rows.map((r) => (
            <div key={`${r.from}-${r.to}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ padding: "2px 8px", borderRadius: 6, background: "var(--card-2)", color: C.muted, textDecoration: "line-through" }}>{r.from}</span>
              <span style={{ color: C.muted }}>→</span>
              <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(50,109,255,0.10)", color: "var(--primary)", fontWeight: 700 }}>{r.to}</span>
              <span style={{ marginLeft: "auto", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: C.text }}>{r.value} 件</span>
            </div>
          ))}
        </div>
      )
  }
}

function AskAiDrawer({ desc, onClose }: { desc: AskDesc; onClose: () => void }) {
  const [msgs, setMsgs] = useState<AskMsg[]>([])
  const [input, setInput] = useState("")
  const lastScope = useRef(desc.sig ?? desc.scope)

  useEffect(() => {
    const sig = desc.sig ?? desc.scope
    if (sig === lastScope.current) return
    lastScope.current = sig
    setMsgs((m) => (m.length > 0 && m[m.length - 1].role !== "divider"
      ? [...m, { role: "divider", text: `已切换为 ${desc.filterText ?? desc.scope}` }]
      : m.length > 0
        ? [...m.slice(0, -1), { role: "divider", text: `已切换为 ${desc.filterText ?? desc.scope}` }]
        : m))
  }, [desc.sig, desc.scope, desc.filterText])

  const send = (raw: string) => {
    const q = raw.trim()
    if (!q) return
    const ans = answerAsk(desc, q)
    setMsgs((m) => [...m, { role: "q", text: q }, { role: "a", text: ans.text, used: ans.used, ok: ans.ok, viz: ans.viz }])
    persistAsk(desc, q, ans)
    setInput("")
  }

  const suggestions = desc.suggestions
  const fieldLine = `可以按${desc.askFields.join("、")}来问。`

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "stretch", justifyContent: "flex-end", pointerEvents: "none" }}>
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={`问 AI · ${desc.title}`}
        className="ask-ai-drawer"
        style={{
          position: "relative", width: 480, maxWidth: "92vw", pointerEvents: "auto",
          background: "var(--panel-solid, #fff)", borderLeft: "1px solid var(--border)",
          boxShadow: "-16px 0 48px rgba(22,45,77,0.18)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>问 AI · {desc.title}</div>
          <button
            onClick={onClose}
            style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: C.muted, fontSize: 13 }}
            aria-label="关闭问 AI"
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* §3 可问范围提示卡，三行 */}
          <div
            style={{
              fontSize: 12, color: C.text, lineHeight: 1.8,
              padding: "10px 12px", background: "var(--card-2, rgba(50,109,255,0.04))", borderRadius: 8,
            }}
          >
            <div>我能帮你看：{desc.scopeLine}</div>
            <div>{fieldLine}</div>
            <div style={{ color: C.muted, fontSize: 11 }}>原因判断、预测、改筛选和去办理，这里帮不上。</div>
          </div>

          {/* 建议问题（§4） */}
          {suggestions.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    border: "1px solid var(--border)", background: "transparent", borderRadius: 999,
                    padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.primary,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* 对话区 */}
          {msgs.map((m, i) => {
            if (m.role === "divider") {
              return (
                <div key={i} style={{ textAlign: "center", fontSize: 11, color: C.muted, fontWeight: 600, padding: "4px 0" }}>
                  —— {m.text} ——
                </div>
              )
            }
            if (m.role === "q") {
              return (
                <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--primary)", color: "#fff", borderRadius: "12px 12px 4px 12px", padding: "8px 12px", fontSize: 12.5, lineHeight: 1.6 }}>
                  {m.text}
                </div>
              )
            }
            return (
              <div key={i} style={{ alignSelf: "flex-start", maxWidth: "92%", width: m.ok && m.viz ? "92%" : undefined, background: "var(--card-2, rgba(50,109,255,0.05))", borderRadius: "12px 12px 12px 4px", padding: "10px 12px", fontSize: 12.5, lineHeight: 1.7, color: C.text }}>
                {!(m.ok && m.viz?.kind === "value") && <div style={{ fontWeight: m.ok && m.viz ? 600 : undefined }}>{m.text}</div>}
                {m.ok && m.viz && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--panel-solid, #fff)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <AskVizBlock viz={m.viz} />
                  </div>
                )}
                {m.ok && m.used && m.used.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10.5, color: C.muted, lineHeight: 1.6 }}>
                    依据：{m.used.join("、")}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(input) }}
            placeholder={desc.sampleHint ?? "就这项统计提问…"}
            style={{
              flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px",
              fontSize: 12.5, color: C.text, background: "var(--card)", outline: "none",
            }}
          />
          <button
            onClick={() => send(input)}
            className="tech-btn-primary"
            style={{ padding: "8px 16px", fontSize: 12.5, borderRadius: 8 }}
          >
            发送
          </button>
        </div>
      </aside>
    </div>
  )
}

/** 排行图图下固定说明：最多 8 条 + 其余合计行 */
function RankNote({ by, restCount, restSum }: { by: "件数" | "时长"; restCount: number; restSum: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div>{by === "件数" ? "按件数从高到低" : "按时长从长到短"}，最多显示 8 条</div>
      {restCount > 0 && <div>其余 {restCount} 个合计 {restSum} 件</div>}
    </div>
  )
}

// ─── 卡片 / 图壳 ─────────────────────────────────────────────────────────────
function KpiCard2({
  label, value, unit, sub, color, icon, ruleId, onClick, onAsk,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color: string
  icon?: string
  ruleId: string
  onClick?: () => void
  onAsk?: () => void
}) {
  const clickable = !!onClick
  const isDash = value === "—"
  return (
    <div
      onClick={onClick}
      className={clickable ? "tech-card" : undefined}
      style={{
        padding: "16px 18px",
        background: `linear-gradient(180deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 16,
        boxShadow: "var(--glass-shadow)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        cursor: clickable ? "pointer" : "default",
        transition: "border-color .15s ease, box-shadow .15s ease",
      }}
      title={clickable ? "点击查看切片" : undefined}
    >
      {icon && (
        <div
          style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <KpiIcon label={label} color={color} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.02em" }}>{label}</span>
          <RuleChips id={ruleId} userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
          {onAsk && (
            <button
              onClick={(e) => { e.stopPropagation(); onAsk() }}
              style={{
                border: "1px solid var(--border)", background: "transparent", borderRadius: 999,
                padding: "1px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", color: C.primary,
                marginLeft: "auto", flexShrink: 0,
              }}
            >
              问 AI
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span
            className={isDash ? undefined : "gradient-text"}
            style={{
              fontSize: isDash ? 24 : 32,
              fontWeight: 800,
              fontFamily: isDash ? undefined : "JetBrains Mono, monospace",
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: isDash ? C.muted : undefined,
            }}
          >
            {value}
          </span>
          {unit && <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{unit}</span>}
        </div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontWeight: 600 }}>{sub}</div>}
        {clickable && (
          <div style={{ fontSize: 10, color: C.primary, marginTop: 6, fontWeight: 700, opacity: 0.75 }}>
            查看切片 →
          </div>
        )}
      </div>
    </div>
  )
}

function ChartCard2({
  title, children, ruleId, onSlice, sliceEnabled, note, extra, onAsk,
}: {
  title: string
  children: React.ReactNode
  ruleId: string
  onSlice?: () => void
  sliceEnabled?: boolean
  note?: React.ReactNode
  extra?: React.ReactNode
  onAsk?: () => void
}) {
  return (
    <div
      className="tech-card"
      style={{
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
        border: `1px solid ${C.borderLight}`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              width: 5, height: 16, borderRadius: 4, flexShrink: 0,
              background: `linear-gradient(180deg, ${C.primary}, ${C.cyan})`,
              boxShadow: "0 2px 8px rgba(91,141,255,0.30)",
            }}
          />
          <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{title}</div>
          <RuleChips id={ruleId} userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {extra}
          {onAsk && (
            <button
              onClick={onAsk}
              className="tech-btn-ghost"
              style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 8, whiteSpace: "nowrap" }}
            >
              问 AI
            </button>
          )}
          {onSlice && sliceEnabled && (
            <button
              onClick={onSlice}
              className="tech-btn-ghost"
              style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 8, whiteSpace: "nowrap" }}
            >
              查看切片
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: 14, flex: 1 }}>{children}</div>
      {note && <div style={{ padding: "0 18px 12px", fontSize: 11, color: C.muted, fontWeight: 600 }}>{note}</div>}
    </div>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ padding: "26px 12px", textAlign: "center", fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
      {text}
    </div>
  )
}

function SectionHead({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 2px" }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

function GranToggle({
  street, value, onChange,
}: {
  street: string | null
  value: SpaceGran
  onChange: (g: SpaceGran) => void
}) {
  const options: SpaceGran[] = street ? ["grid", "lane"] : ["street", "grid", "lane"]
  return (
    <div style={{ display: "flex", gap: 2, background: "var(--card-2)", borderRadius: 8, padding: 2 }}>
      {options.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          style={{
            border: "none", cursor: "pointer", padding: "3px 10px", borderRadius: 6,
            fontSize: 11, fontWeight: value === g ? 800 : 600,
            background: value === g ? "var(--primary)" : "transparent",
            color: value === g ? "#fff" : C.muted,
            transition: "all .15s ease",
          }}
        >
          {GRAN_LABEL[g]}
        </button>
      ))}
    </div>
  )
}

function StageBar({
  values, skin, onItemClick,
}: {
  values: number[]
  skin: "light" | "tech"
  onItemClick?: (name: string, value: number) => void
}) {
  return (
    <EchartsBar
      data={values}
      xAxis={STAGE_META.map((s) => s.label)}
      itemColors={STAGE_META.map((s) => s.color)}
      skin={skin}
      showLabel
      valueSuffix=" 件"
      height={210}
      onItemClick={onItemClick}
    />
  )
}

function CameraRank({
  cameras, restSum, onItemClick,
}: {
  cameras: { id: string; point: string; value: number }[]
  restSum?: { count: number; sum: number }
  onItemClick?: (point: string, value: number) => void
}) {
  const max = Math.max(1, ...cameras.map((c) => c.value))
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 210, justifyContent: "center" }}>
      {cameras.slice(0, 8).map((c) => (
        <button
          key={c.id}
          onClick={() => onItemClick?.(c.point, c.value)}
          title={`${c.point} · ${c.id} · ${c.value} 件`}
          style={{
            border: "none", background: "transparent", padding: 0, margin: 0,
            display: "flex", flexDirection: "column", gap: 5,
            cursor: c.value >= 1 ? "pointer" : "default", textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, width: "100%" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.point}
            </span>
            <span style={{ fontSize: 10, color: C.muted, fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>
              {c.id}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.primary, fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>
              {c.value} 件
            </span>
          </div>
          <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--card-2)", overflow: "hidden" }}>
            <div
              style={{
                width: `${(c.value / max) * 100}%`, height: "100%", borderRadius: 999,
                background: `linear-gradient(90deg, ${C.primary}, ${C.cyan})`,
              }}
            />
          </div>
        </button>
      ))}
      {restSum && restSum.count > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, width: "100%" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, flex: 1, minWidth: 0 }}>
              其余 {restSum.count} 个
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, fontFamily: "JetBrains Mono, monospace", flexShrink: 0 }}>
              {restSum.sum} 件
            </span>
          </div>
          <div style={{ width: "100%", height: 6, borderRadius: 999, background: "var(--card-2)", overflow: "hidden" }}>
            <div style={{ width: `${(restSum.sum / max) * 100}%`, height: "100%", borderRadius: 999, background: "#9AA4B2" }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
// §1 问 AI 入口白名单：只有这些 id 在 §1 表格里标了「给入口」
// 未进名单的（事件总数、区间闭环、存续事件、严重事件、平均处置时长、
// 四张环节卡、事件有效率、一次核查通过率）一律不给入口。
const ASK_ALLOWED_IDS = new Set<string>([
  "ov_daily", "funnel", "ov_stages", "ov_severe_space", "ov_sustained_types",
  "ev_type_struct", "ev_space_dist", "ev_hourly", "ev_top_cameras",
  "pr_dwell", "pr_grid_dur", "pr_type_dur", "pr_stages", "pr_grid",
  "ql_composition", "ql_return_rate", "ai_discovery_rate", "ai_prefill_type",
  "ai_suggest_match", "ai_space_fail",
])

export default function AIStatisticsV2({ skin }: { skin: "light" | "tech" }) {
  const [cat, setCat] = useState<Cat>("overview")
  const [win, setWin] = useState<TimeWin>("today")
  const [street, setStreet] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [spaceGran, setSpaceGran] = useState<SpaceGran>("street")
  const [slice, setSlice] = useState<SliceState | null>(null)
  const [askId, setAskId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const filterMeta = `${WIN_LABEL[win]} · ${street ?? "东城全区"} · ${type ?? "全部类型"}`
  const backlogMeta = `截止此刻 · ${street ?? "东城全区"} · ${type ?? "全部类型"}`

  // 切片与问 AI 都在右侧，后打开的换掉先打开的
  const openAsk = (id: string) => { setSlice(null); setAskId(id) }
  // §1 入口可见性：必须在白名单里，且当前范围下不是 0/—/空图
  const showAsk = (id: string, empty: boolean) => ASK_ALLOWED_IDS.has(id) && !empty

  const v = useMemo(() => {
    const typeIdx = type ? TYPE_DEFS.findIndex((t) => t.label === type) : -1
    const typeShare = type && typeIdx >= 0 ? TYPE_DEFS[typeIdx].weight : 1
    const streetIdx = street ? STREETS.indexOf(street) : -1
    const streetShare = street && streetIdx >= 0 ? STREET_WEIGHTS[streetIdx] : 1
    const ff = streetShare * typeShare

    const total = Math.round(WIN_TOTAL[win] * ff)

    // 类型结构 / 存续类型
    const typeAlloc = alloc(total, TYPE_DEFS.map((t) => t.weight))
    const typeStruct = type
      ? [{ label: type, value: total, color: TYPE_DEFS[typeIdx]?.color ?? C.primary }]
      : TYPE_DEFS.map((t, i) => ({ label: t.label, value: typeAlloc[i], color: t.color })).filter((d) => d.value > 0)

    // 发生时段：24 根柱，0 的小时保留
    const hourly = alloc(total, HOUR_WEIGHTS)
    const peakHour = hourly.indexOf(Math.max(...hourly, 0))

    // 空间分布：只随空间粒度分组，不改其他卡
    const effectiveGran: SpaceGran = street ? (spaceGran === "street" ? "grid" : spaceGran) : spaceGran
    const buckets = spaceBuckets(street, effectiveGran)
    const spaceValues = alloc(total, buckets.map((b) => b.weight))
    const spaceDist = buckets.map((b, i) => ({ name: b.name, value: spaceValues[i] })).filter((d) => d.value > 0)
    const spaceTop = topWithRest(spaceDist, 8)

    // 高发相机：没有相机编号的不进榜，剩余件数单独说明
    const camDefs = street ? CAMERA_DEFS.filter((c) => c.place.startsWith(street)) : CAMERA_DEFS
    const missingWeight = Math.max(0, 1 - sum(camDefs.map((c) => c.weight)))
    const camAlloc = alloc(total, [...camDefs.map((c) => c.weight), missingWeight])
    const cameras = camDefs
      .map((c, i) => ({ id: c.id, point: c.point, place: c.place, value: camAlloc[i] }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
    const camerasWithoutId = camAlloc[camDefs.length] ?? 0

    // 处置时长样本（流程运行上半段，随时间、空间、类型变）：同一套办完样本算所有时长，也给出链路处置、核查两阶
    const doneRows = WIN_DONE[win].filter((e) =>
      (!street || e.grid.startsWith(`${street.replace(/街道$/, "")}-`)) && (!type || e.type === type))
    const doneN = doneRows.length
    const checkedN = doneRows.filter((e) => e.check !== undefined).length

    // 链路吞吐（流水）
    const closedCase = checkedN
    const closedNonCase = Math.round(WIN_CLOSED_NON_CASE[win] * ff)
    const closedAll = closedCase + closedNonCase

    // 发现与闭环：同一窗口按日汇总，日合计分别等于两张卡
    const dayCount = win === "today" ? 1 : win === "7d" ? 7 : 30
    const days = buildDays(dayCount)
    const foundDaily = alloc(total, dailyWeights(dayCount, "found"))
    const closedDaily = alloc(closedAll, dailyWeights(dayCount, "closed"))
    const dayMode: "bar" | "line" = dayCount === 1 ? "bar" : "line"

    const fb = WIN_FUNNEL[win]
    const funnel = {
      found: total,
      reviewed: Math.round(WIN_QUALITY[win].valid * ff) + Math.round(WIN_QUALITY[win].invalid * ff),
      filed: Math.round(fb.filed * ff),
      disposed: doneN,
      inspected: checkedN,
    }

    // 当前积压：截止此刻，不随时间变；只随空间 / 类型变
    const sustained = Math.round(sum(BACKLOG_STAGE_WEIGHTS) * ff)
    const stageValues = alloc(sustained, BACKLOG_STAGE_WEIGHTS)
    const stages = STAGE_META.map((s, i) => ({ ...s, value: stageValues[i] }))
    const severe = Math.min(sustained, Math.round(BACKLOG_SEVERE * ff))

    const severeValues = alloc(severe, buckets.map((b) => b.weight))
    const severeSpace = buckets.map((b, i) => ({ name: b.name, value: severeValues[i] })).filter((d) => d.value > 0)
    const severeTop = topWithRest(severeSpace, 8)

    const sustainedTypeValues = alloc(sustained, TYPE_DEFS.map((t) => t.weight))
    const sustainedTypes = type
      ? (sustained > 0 ? [{ label: type, value: sustained, color: TYPE_DEFS[typeIdx]?.color ?? C.primary }] : [])
      : TYPE_DEFS.map((t, i) => ({ label: t.label, value: sustainedTypeValues[i], color: t.color })).filter((d) => d.value > 0)

    const pendingDispose = stages[1].value
    const gridNames = street
      ? [1, 2, 3].map((i) => `${street.replace(/街道$/, "")}-0${i}网格`)
      : BACKLOG_GRID_NAMES
    const gridWeights = street ? STREET_GRID_WEIGHTS : BACKLOG_GRID_WEIGHTS
    const gridValues = alloc(pendingDispose, gridWeights)
    const gridOnDutyAll = gridNames
      .map((name, i) => ({ name, value: gridValues[i] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
    const gridOnDutyTop = topWithRest(gridOnDutyAll, 8)

    const doneAvg = mean1(doneRows.map((e) => e.doIt))
    const dwellVals = [
      mean1(doneRows.map((e) => e.wait)),
      mean1(doneRows.map((e) => e.doIt)),
      mean1(doneRows.flatMap((e) => (e.check === undefined ? [] : [e.check]))),
    ]
    const dwellMaxIdx = dwellVals.reduce(
      (best, val, i) => (val !== null && (dwellVals[best] === null || val > (dwellVals[best] as number)) ? i : best),
      0,
    )
    const durRank = (key: "grid" | "type") => {
      const map = new Map<string, { n: number; sum: number }>()
      for (const e of doneRows) {
        const k = key === "grid" ? e.grid : e.type
        const cur = map.get(k) ?? { n: 0, sum: 0 }
        cur.n += 1
        cur.sum += e.doIt
        map.set(k, cur)
      }
      const all = [...map.entries()]
        .map(([name, s]) => ({ name, n: s.n, avg: Math.round((s.sum / s.n) * 10) / 10 }))
        .sort((a, b) => b.avg - a.avg)
      const visible = all.slice(0, 8)
      const rest = all.slice(8)
      return {
        visible: visible.map((d) => ({
          name: d.name,
          value: d.avg,
          n: d.n,
          color: doneAvg !== null && d.avg > doneAvg ? "var(--primary)" : "#9AA4B2",
        })),
        restCount: rest.length,
        restSum: sum(rest.map((d) => d.n)),
      }
    }
    const gridDur = durRank("grid")
    const typeDur = durRank("type")

    // 治理质量与 AI 成效：按所选时间区间计
    const q = WIN_QUALITY[win]
    const valid = Math.round(q.valid * ff)
    const invalid = Math.round(q.invalid * ff)
    const dissipated = Math.round(q.dissipated * ff)
    const returned = Math.round(q.returned * ff)
    const inspected = checkedN + returned
    const discoveryCandidates = total
    const discoveryValid = Math.min(discoveryCandidates, valid)
    const prefillTotal = Math.round(q.prefillTotal * ff)
    const prefillMatch = Math.min(prefillTotal, Math.round(q.prefillMatch * ff))
    const suggestTotal = Math.round(q.suggestTotal * ff)
    const suggestMatch = Math.min(suggestTotal, Math.round(q.suggestMatch * ff))
    const spaceFail = Math.round(q.spaceFail * ff)

    const quality = {
      valid,
      invalid,
      dissipated,
      composition: valid + invalid + dissipated,
      effectiveRate: pct(valid, valid + invalid),
      effectiveDenom: valid + invalid,
      returnRate: pct(returned, inspected),
      returned,
      inspected,
    }
    const aiRates = {
      discoveryRate: pct(discoveryValid, discoveryCandidates),
      discoveryValid,
      discoveryCandidates,
      prefillType: pct(prefillMatch, prefillTotal),
      prefillMatch,
      prefillTotal,
      suggestMatch: pct(suggestMatch, suggestTotal),
      suggestMatchCount: suggestMatch,
      suggestTotal,
      spaceFail,
    }

    // ── 问 AI 背后的示例事件：每批件数与对应的图一致，字段从同一批里出 ──
    const rf = seeded(`flow|${win}|${street ?? ""}|${type ?? ""}|${effectiveGran}`)
    const rb = seeded(`backlog|${street ?? ""}|${type ?? ""}|${effectiveGran}`)
    const typeNames = type ? [type] : TYPE_DEFS.map((t) => t.label)
    const typeWeights = type ? [1] : TYPE_DEFS.map((t) => t.weight)
    const byWeight = (n: number, names: string[], weights: number[], rnd: () => number) => {
      const a = alloc(n, weights)
      return fill(names.map((name, i) => ({ name, value: a[i] })), n, rnd)
    }
    const spaceOf = (n: number, rnd: () => number, chart?: { name: string; value: number }[]) => {
      const out: Record<SpaceGran, string[]> = { street: [], grid: [], lane: [] }
      for (const g of ["street", "grid", "lane"] as SpaceGran[]) {
        if (g === "street" && street) out[g] = Array.from({ length: n }, () => street)
        else if (g === effectiveGran && chart) out[g] = fill(chart, n, rnd)
        else {
          const b = spaceBuckets(street, g)
          out[g] = byWeight(n, b.map((x) => x.name), b.map((x) => x.weight), rnd)
        }
      }
      return out
    }
    const camRows = camDefs.map((c) => ({ point: c.point, weight: c.weight }))
    const camOf = (n: number, rnd: () => number) =>
      byWeight(n, camRows.map((c) => c.point), camRows.map((c) => c.weight), rnd)
    const r1 = (x: number) => Math.round(x * 10) / 10

    // 窗口内发现的事件：发现日、类型、空间、发现小时、相机、走到哪一阶
    const fDays = fill(days.map((d, i) => ({ name: d.label, value: foundDaily[i] })), total, rf, true)
    const fTypes = fill(typeStruct.map((t) => ({ name: t.label, value: t.value })), total, rf)
    const fSpace = spaceOf(total, rf, spaceDist)
    const fHours = fill(hourly.map((n, i) => ({ name: `${String(i).padStart(2, "0")}时`, value: n })), total, rf)
    const fCams = fill([...cameras.map((c) => ({ name: c.point, value: c.value })), { name: "", value: camerasWithoutId }], total, rf)
    const rvN = Math.min(total, funnel.reviewed)
    const flN = Math.min(rvN, funnel.filed)
    const dpN = Math.min(flN, funnel.disposed)
    const inN = Math.min(dpN, funnel.inspected)
    const fReach = fill([
      { name: "核查", value: inN }, { name: "处置", value: dpN - inN }, { name: "立案", value: flN - dpN },
      { name: "审核", value: rvN - flN }, { name: "识别", value: total - rvN },
    ], total, rf)
    const REACH_STAGE: Record<string, string> = { 核查: "已结案", 处置: "待核查", 立案: "待处置", 审核: "无效", 识别: "待立案" }
    const foundEv: AskEv[] = Array.from({ length: total }, (_, i) => {
      const stage = REACH_STAGE[fReach[i]]
      return {
        kind: "found", foundDay: fDays[i], type: fTypes[i],
        street: fSpace.street[i], grid: fSpace.grid[i], lane: fSpace.lane[i],
        hour: fHours[i], camPoint: fCams[i] || undefined, reach: fReach[i], stage,
        respGrid: ["已结案", "待核查", "待处置"].includes(stage) ? fSpace.grid[i] : undefined,
        conclusion: stage === "已结案" ? "结案" : stage === "无效" ? "无效" : undefined,
      }
    })
    const cDays = fill(days.map((d, i) => ({ name: d.label, value: closedDaily[i] })), closedAll, rf, true)
    const cConc = fill([{ name: "结案", value: closedCase }, { name: "作废或无效", value: closedNonCase }], closedAll, rf)
    const cTypes = byWeight(closedAll, typeNames, typeWeights, rf)
    const cSpace = spaceOf(closedAll, rf)
    const closedEv: AskEv[] = Array.from({ length: closedAll }, (_, i) => ({
      kind: "closed", closedDay: cDays[i], conclusion: cConc[i], type: cTypes[i],
      street: cSpace.street[i], grid: cSpace.grid[i], stage: cConc[i] === "结案" ? "已结案" : "已作废或无效",
    }))

    // 截止此刻的存续事件：环节、类型、等级、空间、责任网格、已等待
    const bStages = fill(stages.map((s) => ({ name: s.label, value: s.value })), sustained, rb, true)
    const bTypes = fill(sustainedTypes.map((t) => ({ name: t.label, value: t.value })), sustained, rb)
    const severeIdx = new Set(shuffleIdx(sustained, rb).slice(0, severe))
    const bSpace = spaceOf(sustained, rb)
    const sevGran = fill(severeSpace, severe, rb)
    const nonGranBuckets = buckets
    const nonGran = byWeight(sustained - severe, nonGranBuckets.map((b) => b.name), nonGranBuckets.map((b) => b.weight), rb)
    const respDispose = fill(gridOnDutyAll, stages[1].value, rb)
    let si = 0
    let ni = 0
    let di = 0
    const backlogEv: AskEv[] = Array.from({ length: sustained }, (_, i) => {
      const stage = bStages[i]
      const sev = severeIdx.has(i)
      const sp = { street: bSpace.street[i], grid: bSpace.grid[i], lane: bSpace.lane[i] }
      sp[effectiveGran] = sev ? sevGran[si++] : nonGran[ni++]
      const u = rb()
      const waitH = stage === "待立案" ? r1(0.5 + u * 18)
        : stage === "待处置" ? r1(2 + u * u * 96)
          : stage === "待核查" ? r1(1 + u * 30)
            : r1(4 + u * 44)
      const respGrid = stage === "待处置" ? respDispose[di++]
        : stage === "待立案" ? undefined
          : gridNames[Math.floor(rb() * gridNames.length)]
      return { stage, type: bTypes[i], severe: sev, ...sp, respGrid, waitH }
    })

    // 这段时间办完的事件：三步用时
    const doneEv: AskEv[] = doneRows.map((e) => ({
      grid: e.grid, street: `${e.grid.split("-")[0]}街道`, type: e.type,
      durWait: e.wait, durDo: e.doIt, durCheck: e.check,
    }))

    // 治理质量与 AI 成效
    const compN = valid + invalid + dissipated
    const compConc = fill([
      { name: "立案有效", value: valid }, { name: "无效", value: invalid }, { name: "自然消散", value: dissipated },
    ], compN, rf, true)
    const INVALID_NOTES = ["不属于事件范围", "识别错误，正常停放被当成占道", "重复发现，已并入前一件"]
    const compTypes = byWeight(compN, typeNames, typeWeights, rf)
    const compSpace = spaceOf(compN, rf)
    const compCams = camOf(compN, rf)
    const compEv: AskEv[] = Array.from({ length: compN }, (_, i) => ({
      conclusion: compConc[i], type: compTypes[i], street: compSpace.street[i], camPoint: compCams[i],
      note: compConc[i] === "立案有效" ? "现场核实属实" : compConc[i] === "自然消散" ? "复看时现场已不存在" : INVALID_NOTES[i % INVALID_NOTES.length],
    }))

    const retGridsAll = street ? spaceBuckets(street, "grid") : ALL_GRIDS.map((name, i) => ({ name, weight: ALL_GRID_WEIGHTS[i] }))
    const retGrids = byWeight(inspected, retGridsAll.map((g) => g.name), retGridsAll.map((g) => g.weight), rf)
    const retTypes = byWeight(inspected, typeNames, typeWeights, rf)
    const retIdx = new Set(shuffleIdx(inspected, rf).slice(0, returned))
    let rk = 0
    const retEv: AskEv[] = Array.from({ length: inspected }, (_, i) => ({
      grid: retGrids[i], type: retTypes[i], returns: retIdx.has(i) ? (rk++ % 3 === 2 ? 2 : 1) : 0,
    }))

    const discFinal = fill([{ name: "要办", value: discoveryValid }, { name: "不用办", value: discoveryCandidates - discoveryValid }], discoveryCandidates, rf)
    const discTypes = byWeight(discoveryCandidates, typeNames, typeWeights, rf)
    const discCams = camOf(discoveryCandidates, rf)
    const discEv: AskEv[] = Array.from({ length: discoveryCandidates }, (_, i) => ({
      final: discFinal[i], type: discTypes[i], camPoint: discCams[i],
    }))

    const ALL_TYPES = TYPE_DEFS.map((t) => t.label)
    const prefAi = byWeight(prefillTotal, ALL_TYPES, TYPE_DEFS.map((t) => t.weight), rf)
    const prefChanged = new Set(shuffleIdx(prefillTotal, rf).slice(0, prefillTotal - prefillMatch))
    const prefGrids = byWeight(prefillTotal, retGridsAll.map((g) => g.name), retGridsAll.map((g) => g.weight), rf)
    const NEAR_TYPE: Record<string, string> = {
      共享单车占道: "占道经营", 施工占道: "疑似堆物", 占道经营: "共享单车占道", 暴露垃圾: "疑似堆物", 疑似堆物: "暴露垃圾",
    }
    const prefEv: AskEv[] = Array.from({ length: prefillTotal }, (_, i) => {
      const human = type ?? prefAi[i]
      const ai = prefChanged.has(i) ? NEAR_TYPE[human] : human
      return { aiType: ai, humanType: human, grid: prefGrids[i], type: human }
    })

    const sugSys = byWeight(suggestTotal, ["有效", "无效", "作废"], [0.7, 0.2, 0.1], rf)
    const sugMiss = new Set(shuffleIdx(suggestTotal, rf).slice(0, suggestTotal - suggestMatch))
    const FLIP: Record<string, string> = { 有效: "无效", 无效: "有效", 作废: "有效" }
    const sugTypes = byWeight(suggestTotal, typeNames, typeWeights, rf)
    const sugEv: AskEv[] = Array.from({ length: suggestTotal }, (_, i) => ({
      sysSuggest: sugSys[i], humanJudge: sugMiss.has(i) ? FLIP[sugSys[i]] : sugSys[i], type: sugTypes[i],
    }))

    const sfSpace = spaceOf(spaceFail, rf)
    const sfCams = camOf(spaceFail, rf)
    const sfTypes = byWeight(spaceFail, typeNames, typeWeights, rf)
    const sfEv: AskEv[] = Array.from({ length: spaceFail }, (_, i) => ({
      camPoint: sfCams[i], street: sfSpace.street[i], type: sfTypes[i], stage: i % 3 === 2 ? "待处置" : "待立案",
    }))

    const askEv = { foundEv, closedEv, backlogEv, doneEv, compEv, retEv, discEv, prefEv, sugEv, sfEv }

    return {
      askEv,
      total, typeStruct, hourly, peakHour, spaceDist, spaceTop, effectiveGran,
      cameras, camerasWithoutId, closedCase, closedNonCase, closedAll, funnel,
      days, foundDaily, closedDaily, dayMode,
      stages, sustained, severe, severeSpace, severeTop, sustainedTypes,
      gridOnDuty: gridOnDutyAll, gridOnDutyTop,
      doneRows, doneN, checkedN, doneAvg, dwellVals, dwellMaxIdx, gridDur, typeDur,
      quality, aiRates,
    }
  }, [win, street, type, spaceGran])

  function openSlice(title: string, count: number, kind: "flow" | "backlog", rows: EvRow[]) {
    if (count < 1) return
    const caliber = `${kind === "flow" ? filterMeta : backlogMeta} · ${title} · ${count} 件`
    setAskId(null)
    setSlice({
      title,
      caliber,
      rows: rows.length > 0 ? rows : EVENT_POOL.slice(0, 3),
    })
  }

  const sliceRows = (opts: { stages?: string[]; severe?: boolean }) =>
    filterPool({ street, type, ...opts })

  const openDaySlice = (label: string, series: "发现" | "闭环", value: number) => {
    if (value < 1) return
    const idx = v.days.findIndex((d) => d.label === label)
    const date = idx >= 0 ? v.days[idx].date : ""
    const stages = series === "闭环"
      ? ["已结案", "已作废", "无效"]
      : EVENT_POOL.map((e) => e.stage)
    const base = sliceRows({ stages })
    const sameDay = date ? base.filter((r) => r.time.startsWith(date)) : []
    openSlice(`发现与闭环 · ${label} ${series}`, value, "flow", sameDay.length > 0 ? sameDay : base)
  }

  // ── AI 解读：只引用当前 tab、当前筛选下已经显示出来的数 ──
  const insight = useMemo(() => {
    if (cat === "overview") {
      if (v.total === 0 && v.sustained === 0) return `${filterMeta}：当前范围没有可展示的事件。`
      const parts: string[] = [
        `${filterMeta}：新发现 ${v.total} 件、区间闭环 ${v.closedAll} 件（结案 ${v.closedCase}、作废/无效 ${v.closedNonCase}）。`,
      ]
      if (v.dayMode === "line" && (v.total > 0 || v.closedAll > 0)) {
        const gapIdx = v.foundDaily.reduce(
          (best, n, i) => (n - v.closedDaily[i] > v.foundDaily[best] - v.closedDaily[best] ? i : best),
          0,
        )
        const gap = v.foundDaily[gapIdx] - v.closedDaily[gapIdx]
        parts.push(
          gap > 0
            ? `${v.days[gapIdx].label} 发现 ${v.foundDaily[gapIdx]} 件、闭环 ${v.closedDaily[gapIdx]} 件，差 ${gap} 件。`
            : "窗口内每天闭环都不少于发现。",
        )
      }
      if (v.sustained > 0) {
        const maxStage = v.stages.reduce((a, b) => (b.value > a.value ? b : a))
        parts.push(
          `此刻存续 ${v.sustained} 件${maxStage.value > 0 ? `，${maxStage.label} ${maxStage.value} 件最多` : ""}${v.severe > 0 ? `，其中严重 ${v.severe} 件` : ""}。`,
        )
      }
      return parts.join("")
    }

    if (cat === "events") {
      if (v.total === 0) return `${filterMeta}：当前范围没有可展示的事件。`
      const lead = (rows: { name: string; value: number }[], word: string) => {
        const pos = rows.filter((r) => r.value > 0)
        if (pos.length < 2) return ""
        const max = Math.max(...pos.map((r) => r.value))
        const ties = pos.filter((r) => r.value === max)
        if (ties.length === pos.length) return ""
        return ties.length === 1
          ? `${ties[0].name} ${max} 件${word}；`
          : `${ties.map((t) => t.name).join("、")} 各 ${max} 件，并列${word}；`
      }
      const peak = Math.max(0, ...v.hourly)
      const peakHours = v.hourly.filter((n) => n === peak).length
      const topCams = v.cameras.filter((c) => c.value === v.cameras[0]?.value)
      return [
        `${filterMeta}：新发现 ${v.total} 件。`,
        lead(v.typeStruct.map((t) => ({ name: `「${t.label}」`, value: t.value })), "最多"),
        lead(v.spaceDist, "最集中"),
        peak > 0 && peakHours === 1 && v.total > 1 ? `${String(v.peakHour).padStart(2, "0")} 时前后为高发时段；` : "",
        topCams.length === 1 && v.cameras.length > 1 ? `高发点位 ${topCams[0].point}（${topCams[0].id}）${topCams[0].value} 件。` : "",
      ].join("").replace(/；$/, "。")
    }

    if (cat === "process") {
      const flowPart = v.doneAvg !== null
        ? `${filterMeta}：办完 ${v.doneN} 件，平均处置时长 ${v.doneAvg} 小时。`
        : `${filterMeta}：这段时间没有办完的事件。`
      if (v.sustained === 0) return `${flowPart}${backlogMeta}：截止此刻没有存续事件。`
      const topGrid = v.gridOnDuty[0]
      return `${flowPart}${backlogMeta}：待立案 ${v.stages[0].value}、待处置 ${v.stages[1].value}、待核查 ${v.stages[2].value}、待作废审核 ${v.stages[3].value}，合计存续 ${v.sustained} 件。${topGrid ? `${topGrid.name} 在办 ${topGrid.value} 件最多。` : ""}`
    }

    const bits: string[] = []
    if (v.quality.composition > 0) {
      bits.push(`有效 ${v.quality.valid}、无效 ${v.quality.invalid}、自然消散 ${v.quality.dissipated} 件`)
    }
    if (v.quality.effectiveRate !== "—") {
      bits.push(`事件有效率 ${v.quality.effectiveRate}（${v.quality.valid}/${v.quality.effectiveDenom}）`)
    }
    if (v.quality.returnRate !== "—") {
      bits.push(`退回率 ${v.quality.returnRate}（${v.quality.returned}/${v.quality.inspected}）`)
    }
    if (v.aiRates.discoveryRate !== "—") {
      bits.push(`发现有效率 ${v.aiRates.discoveryRate}（${v.aiRates.discoveryValid}/${v.aiRates.discoveryCandidates}）`)
    }
    if (v.aiRates.prefillType !== "—") {
      bits.push(`预填类型一致 ${v.aiRates.prefillType}（${v.aiRates.prefillMatch}/${v.aiRates.prefillTotal}）`)
    }
    if (v.aiRates.suggestMatch !== "—") {
      bits.push(`建议一致率 ${v.aiRates.suggestMatch}（${v.aiRates.suggestMatchCount}/${v.aiRates.suggestTotal}）`)
    }
    if (v.aiRates.spaceFail > 0) bits.push(`空间匹配失败 ${v.aiRates.spaceFail} 件`)
    if (bits.length === 0) return `${filterMeta}：当前范围暂无可计算的治理质量与 AI 成效样本。`
    return `${filterMeta}：${bits.join("；")}。`
  }, [cat, v, filterMeta, backlogMeta])

  const stageTop = (stageIndex: number) => {
    const stage = v.stages[stageIndex]
    if (!stage || stage.value < 1) return
    openSlice(stage.label, stage.value, "backlog", sliceRows({ stages: [stage.label] }))
  }

  const typeSlice = (label: string, value: number) => {
    if (value < 1) return
    openSlice(label, value, "flow", filterPool({ street, type: label, stages: EVENT_POOL.map((e) => e.stage) }))
  }

  // ── 问 AI：每项统计 = 背后那批事件 + 可问字段 + 信号，随筛选实时重算 ──
  function buildAsk(id: string): AskDesc | null {
    const E = v.askEv
    const granField = v.effectiveGran as FieldKey
    const spaceConc: FieldKey[] = street ? ["grid", "lane"] : ["street", "grid"]
    const stageItems = v.stages.map((s) => ({ name: s.label, value: s.value }))
    const mk = (o: {
      title: string
      scope: string
      empty: boolean
      phrase: string
      count: number
      spec: AskSpec
      hint: string
      rest?: { count: number; sum: number } | null
      extraFields?: string[]
    }): AskDesc => ({
      id, title: o.title, scope: o.scope, empty: o.empty,
      scopeLine: `${o.scope} 里，${o.phrase}共 ${o.count} 件。`,
      askFields: [
        ...fieldsPhrase(o.spec.fields, o.spec.timeKey, o.spec.events.some((e) => e.severe) && !o.spec.events.every((e) => e.severe)),
        ...(o.extraFields ?? []),
      ],
      suggestions: o.empty ? [] : buildSuggestions(o.spec),
      sampleHint: o.hint,
      rest: o.rest ?? null,
      spec: { days: v.days.map((d) => d.label), ...o.spec },
    })
    const backlogSpec = (events: AskEv[], over: Partial<AskSpec>): AskSpec => ({
      events, setLabel: "存续事件",
      fields: ["stage", "type", "street", "grid", "lane", "respGrid"],
      timeKey: "waitH", severeSignal: true, defaultField: "respGrid",
      ...over,
    })
    const foundFields: FieldKey[] = ["type", "street", "grid", "lane", "hour", "camPoint", "stage", "conclusion"]
    const doneSpec = (over: Partial<AskSpec>): AskSpec => ({
      events: E.doneEv, setLabel: "办完的事件", fields: ["grid", "type", "street"],
      timeKey: "durDo", itemUnit: "小时",
      timeByWord: [[/到派给网格|派单/, "durWait"], [/到核查完|核查/, "durCheck"], [/到处置完|处置/, "durDo"]],
      ...over,
    })

    switch (id) {
      // ═══ 综合态势 ═══
      case "ov_daily": {
        const gaps = v.days.map((d, i) => ({ day: d.label, found: v.foundDaily[i], gap: v.foundDaily[i] - v.closedDaily[i] }))
        const worst = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap)[0]
        const days = v.days.length > 1
        return mk({
          title: "发现与闭环", scope: filterMeta, empty: v.total === 0 && v.closedAll === 0,
          phrase: `新发现的 ${v.total} 件和办结的 ${v.closedAll} 件，`, count: v.total + v.closedAll,
          hint: days ? `例如：${v.days[v.days.length - 1].label}办结的是哪些类型？` : "例如：今天办结的是哪些类型？",
          spec: {
            events: [...E.foundEv, ...E.closedEv], setLabel: "发现和办结的事件",
            fields: ["foundDay", "closedDay", "stage", "conclusion", "type", "street", "grid"],
            defaultField: "stage",
            extraSuggestions: worst ? [`${worst.day}发现的${worst.found}件，现在办到哪一步了？`] : [],
          },
        })
      }
      case "funnel": {
        const st = FUNNEL_STAGES.map((s) => ({ name: s.label, value: v.funnel[s.key] }))
        let gapAt = -1
        for (let i = 0; i < st.length - 1; i += 1) {
          if (st[i].value - st[i + 1].value > 0 && (gapAt < 0 || st[i].value - st[i + 1].value > st[gapAt].value - st[gapAt + 1].value)) gapAt = i
        }
        const gap = gapAt >= 0 ? { a: st[gapAt], b: st[gapAt + 1] } : null
        const gapEvents = gap ? E.foundEv.filter((e) => e.reach === gap.a.name) : []
        return mk({
          title: "链路吞吐", scope: filterMeta, empty: v.total === 0,
          phrase: "新发现的事件，", count: v.total,
          hint: "例如：立案了还没处置完的在哪个网格？",
          spec: {
            events: E.foundEv, setLabel: "新发现的事件",
            fields: ["reach", "stage", "type", "street", "grid", "conclusion"],
            defaultField: "stage",
            subsets: [
              ...(gap ? [{ re: /差的\s*\d+\s*件/, label: `走到${gap.a.name}、没到${gap.b.name}`, events: gapEvents, field: "stage" as FieldKey }] : []),
              { re: /立案了?还?没处置|没处置完/, label: "立案了还没处置完", events: E.foundEv.filter((e) => e.reach === "立案") },
            ],
            extraSuggestions: gap ? [`${gap.a.name}${gap.a.value}件、${gap.b.name}${gap.b.value}件，差的${gap.a.value - gap.b.value}件在哪？`] : [],
          },
        })
      }
      case "ov_stages":
      case "pr_stages":
        return mk({
          title: id === "ov_stages" ? "各阶段待处理" : "环节存量", scope: backlogMeta, empty: v.sustained === 0,
          phrase: "还压在各环节的事件", count: v.sustained,
          hint: "例如：待核查的几件分别在哪个网格？",
          spec: backlogSpec(E.backlogEv, { itemField: "stage", items: stageItems, concFields: ["respGrid", "type", "grid"] }),
        })
      case "ov_severe_space":
        return mk({
          title: "严重问题空间", scope: `${backlogMeta} · 按${GRAN_LABEL[v.effectiveGran]}`, empty: v.severe === 0,
          phrase: "还没办完的严重事件", count: v.severe,
          rest: { count: v.severeTop.restCount, sum: v.severeTop.restSum },
          hint: "例如：严重的这几件卡在哪个环节？",
          spec: backlogSpec(E.backlogEv.filter((e) => e.severe), {
            setLabel: "严重事件", severeSignal: false, defaultField: "stage",
            itemField: granField, items: v.severeSpace, concFields: ["stage", "type"],
          }),
        })
      case "ov_sustained_types":
        return mk({
          title: "当前存续类型", scope: backlogMeta, empty: v.sustained === 0,
          phrase: "还没办完的事件", count: v.sustained,
          hint: "例如：施工占道的几件卡在哪个环节？",
          spec: backlogSpec(E.backlogEv, {
            defaultField: "stage", itemField: "type",
            items: v.sustainedTypes.map((t) => ({ name: t.label, value: t.value })), concFields: ["stage", ...spaceConc],
          }),
        })
      // ═══ 事件发生 ═══
      case "ev_type_struct":
        return mk({
          title: "类型结构", scope: filterMeta, empty: v.total === 0,
          phrase: "新发现的事件", count: v.total,
          hint: "例如：占道经营多在几点发现？",
          spec: {
            events: E.foundEv, setLabel: "新发现的事件", fields: foundFields, progressSignal: true, defaultField: street ? "grid" : "street",
            itemField: "type", items: v.typeStruct.map((t) => ({ name: t.label, value: t.value })),
            concFields: [...spaceConc, "camPoint", "hour"],
          },
        })
      case "ev_space_dist":
        return mk({
          title: "空间分布", scope: `${filterMeta} · 按${GRAN_LABEL[v.effectiveGran]}`, empty: v.total === 0,
          phrase: "新发现的事件", count: v.total,
          rest: { count: v.spaceTop.restCount, sum: v.spaceTop.restSum },
          hint: "例如：排第一的地方主要是什么类型？",
          spec: {
            events: E.foundEv, setLabel: "新发现的事件", fields: foundFields, progressSignal: true, defaultField: "type",
            itemField: granField, items: v.spaceDist, concFields: ["type", "camPoint", "hour"],
          },
        })
      case "ev_hourly":
        return mk({
          title: "发生时段", scope: filterMeta, empty: v.total === 0,
          phrase: "新发现的事件", count: v.total,
          hint: "例如：08时发现的都是什么类型？",
          spec: {
            events: E.foundEv, setLabel: "新发现的事件", fields: foundFields, progressSignal: true, defaultField: "type",
            itemField: "hour",
            items: v.hourly.map((n, i) => ({ name: `${String(i).padStart(2, "0")}时`, value: n })).filter((h) => h.value > 0),
            concFields: ["type", "camPoint", ...spaceConc],
          },
        })
      case "ev_top_cameras": {
        const restRows = v.cameras.slice(8)
        return mk({
          title: "高发相机", scope: filterMeta, empty: v.cameras.length === 0,
          phrase: "有相机编号的新发现事件", count: sum(v.cameras.map((c) => c.value)),
          rest: { count: restRows.length, sum: sum(restRows.map((c) => c.value)) },
          hint: "例如：排第一的点位报的多是什么类型？",
          spec: {
            events: E.foundEv.filter((e) => e.camPoint), setLabel: "有相机编号的事件",
            fields: ["camPoint", "type", "hour", "conclusion", "stage"], defaultField: "type", progressSignal: true,
            itemField: "camPoint", items: v.cameras.map((c) => ({ name: c.point, value: c.value })),
            concFields: ["type", "hour"],
          },
        })
      }
      // ═══ 流程运行上半段 ═══
      case "pr_dwell": {
        const steps = ["发现 → 派给网格", "派给网格 → 处置完", "处置完 → 核查完"]
        const keys = ["durWait", "durDo", "durCheck"] as const
        const items = steps.map((n, i) => ({ name: n, value: v.dwellVals[i] ?? 0 }))
        const maxI = v.dwellMaxIdx
        const key = keys[maxI]
        const avg = v.dwellVals[maxI] ?? 0
        const slow = E.doneEv.filter((e) => (e[key] ?? 0) > avg)
        const stepWord = steps[maxI].replace(" → ", "到")
        const slowConc = (() => {
          if (slow.length < 2) return null
          for (const f of ["grid", "type"] as FieldKey[]) {
            const m = new Map<string, number>()
            for (const e of slow) { const k = e[f] as string; m.set(k, (m.get(k) ?? 0) + 1) }
            const top = [...m.values()].sort((a, b) => b - a)
            if (top[0] * 2 >= slow.length && (top.length === 1 || top[0] > top[1])) return f
          }
          return null
        })()
        return mk({
          title: "各环节停了多久", scope: filterMeta, empty: v.doneN === 0,
          phrase: "办完的事件", count: v.doneN,
          hint: "例如：处置完到核查完最慢的是哪几件？",
          extraFields: ["三步各自用时"],
          spec: doneSpec({
            setLabel: stepWord, timeKey: key, items, itemUnit: "小时",
            subsets: [{ re: /比平均慢/, label: `${stepWord}比平均慢`, events: slow }],
            extraSuggestions: slowConc ? [`比平均慢的${slow.length}件，集中在哪个${slowConc === "grid" ? "网格" : "类型"}？`] : [],
          }),
        })
      }
      case "pr_grid_dur":
      case "pr_type_dur": {
        const isGrid = id === "pr_grid_dur"
        const d = isGrid ? v.gridDur : v.typeDur
        return mk({
          title: isGrid ? "哪个网格办完更久" : "哪类事件办完更久", scope: filterMeta, empty: v.doneN === 0,
          phrase: "从派给网格到处置完的事件", count: v.doneN,
          rest: { count: d.restCount, sum: d.restSum },
          hint: isGrid ? "例如：最慢的网格办的是什么类型？" : "例如：最慢的那类事件在哪个网格？",
          spec: doneSpec({
            setLabel: "办完的事件", itemField: isGrid ? "grid" : "type",
            items: d.visible.map((r) => ({ name: r.name, value: r.value })),
            concFields: isGrid ? ["type"] : ["grid"], defaultField: isGrid ? "type" : "grid",
          }),
        })
      }
      // ═══ 流程运行下半段 ═══
      case "pr_grid":
        return mk({
          title: "责任网格在办", scope: backlogMeta, empty: v.gridOnDutyTop.visible.length === 0,
          phrase: "派给网格、还没处置完的事件", count: v.stages[1].value,
          rest: { count: v.gridOnDutyTop.restCount, sum: v.gridOnDutyTop.restSum },
          hint: "例如：派过去最久的是哪几件？",
          spec: backlogSpec(E.backlogEv.filter((e) => e.stage === "待处置"), {
            setLabel: "待处置事件", fields: ["respGrid", "type", "street", "grid"], defaultField: "type",
            itemField: "respGrid", items: v.gridOnDuty, concFields: ["type"],
          }),
        })
      // ═══ 治理质量与 AI 成效 ═══
      case "ql_composition":
        return mk({
          title: "有效 / 无效 / 消散", scope: filterMeta, empty: v.quality.composition === 0,
          phrase: "已有结论的候选事件", count: v.quality.composition,
          hint: "例如：无效的几件是什么类型？",
          spec: {
            events: E.compEv, setLabel: "已有结论的候选", fields: ["conclusion", "note", "type", "street", "camPoint"],
            defaultField: "type", itemField: "conclusion",
            items: [
              { name: "立案有效", value: v.quality.valid }, { name: "无效", value: v.quality.invalid },
              { name: "自然消散", value: v.quality.dissipated },
            ],
            concFields: ["type", "camPoint", "street"],
            extraSuggestions: v.quality.invalid > 0 ? [`判无效的${v.quality.invalid}件，说明是什么？`] : [],
          },
        })
      case "ql_return_rate": {
        const r = v.quality.returned
        const returnedEv = E.retEv.filter((e) => (e.returns ?? 0) > 0)
        return mk({
          title: "退回率", scope: filterMeta, empty: v.quality.inspected === 0,
          phrase: "有核查结果的事件", count: v.quality.inspected,
          hint: "例如：被退回的在哪个网格？",
          spec: {
            events: E.retEv, setLabel: "有核查结果的事件", fields: ["returns", "grid", "type"], defaultField: "grid",
            subsets: [{ re: /退回的|被退回/, label: "被退回", events: returnedEv, field: "grid" }],
            extraSuggestions: r > 0 ? [`被退回的${r}件，退回了几次？`, `被退回的${r}件，在哪个网格？`] : [],
          },
        })
      }
      case "ai_discovery_rate": {
        const no = v.aiRates.discoveryCandidates - v.aiRates.discoveryValid
        return mk({
          title: "发现有效率", scope: filterMeta, empty: v.aiRates.discoveryCandidates === 0,
          phrase: "相机识别出的候选", count: v.aiRates.discoveryCandidates,
          hint: "例如：最后不用办的是什么类型？",
          spec: {
            events: E.discEv, setLabel: "相机识别出的候选", fields: ["final", "type", "camPoint"], defaultField: "type",
            subsets: [{ re: /没办|不用办/, label: "最后不用办", events: E.discEv.filter((e) => e.final === "不用办"), field: "camPoint" }],
            extraSuggestions: no > 0 ? [`最后不用办的${no}件，是哪些点位报的？`] : [],
          },
        })
      }
      case "ai_prefill_type": {
        const k = v.aiRates.prefillTotal - v.aiRates.prefillMatch
        return mk({
          title: "预填少改", scope: filterMeta, empty: v.aiRates.prefillTotal === 0,
          phrase: "有 AI 预填类型的事件", count: v.aiRates.prefillTotal,
          hint: "例如：被改掉的在哪个网格？",
          spec: {
            events: E.prefEv, setLabel: "有 AI 预填类型的事件", fields: ["aiType", "humanType", "grid"], defaultField: "grid",
            subsets: [{ re: /被改|改掉|改过/, label: "类型被改掉", events: E.prefEv.filter((e) => e.aiType !== e.humanType) }],
            extraSuggestions: k > 0 ? [`被改掉的${k}件，从什么改成了什么？`] : [],
          },
        })
      }
      case "ai_suggest_match": {
        const k = v.aiRates.suggestTotal - v.aiRates.suggestMatchCount
        return mk({
          title: "建议一致率", scope: filterMeta, empty: v.aiRates.suggestTotal === 0,
          phrase: "系统给了建议的事件", count: v.aiRates.suggestTotal,
          hint: "例如：不一致的是什么类型？",
          spec: {
            events: E.sugEv, setLabel: "系统给了建议的事件", fields: ["sysSuggest", "humanJudge", "type"], defaultField: "humanJudge",
            subsets: [{ re: /不一致/, label: "和系统建议不一致", events: E.sugEv.filter((e) => e.sysSuggest !== e.humanJudge), field: "humanJudge" }],
            extraSuggestions: k > 0 ? [`不一致的${k}件，人工最后怎么判的？`] : [],
          },
        })
      }
      case "ai_space_fail": {
        const n = v.aiRates.spaceFail
        return mk({
          title: "空间匹配失败", scope: filterMeta, empty: n === 0,
          phrase: "落不到网格的事件", count: n,
          hint: "例如：落不到网格的是哪些点位报的？",
          spec: {
            events: E.sfEv, setLabel: "落不到网格的事件", fields: ["camPoint", "street", "type", "stage"], defaultField: "camPoint",
            extraSuggestions: n >= 2 ? [`落不到网格的${n}件，是哪些点位报的？`, `这${n}件现在卡在哪个环节？`] : [],
          },
        })
      }
      default:
        return null
    }
  }

  const askBuilt = askId ? buildAsk(askId) : null
  const askDesc = askBuilt && !askBuilt.empty ? askBuilt : null
  if (askDesc) {
    // 切换签名跟「筛选器状态 + tab」走：积压类统计的范围行写「截止此刻」，
    // 但改时间仍是筛选变化，也要插「已切换为 …」。
    askDesc.sig = `${cat}|${win}|${street ?? ""}|${type ?? ""}|${spaceGran}`
    askDesc.filterText = `${WIN_LABEL[win]} · ${street ?? "东城全区"} · ${type ?? "全部类型"}`
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 22px 28px" }}>
      {/* 筛选条 + 四类导航：两行一起粘在顶部；切 tab / 切筛选时保持可用 */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20,
          background: "var(--panel-solid, #fff)",
          border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "10px 14px", marginBottom: 12,
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        {/* 第一行：时间 / 空间 / 类型三项 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--card-2)", borderRadius: 10, padding: 3 }}>
            {WINS.map((w) => (
              <button
                key={w.id}
                onClick={() => setWin(w.id)}
                style={{
                  border: "none", cursor: "pointer",
                  padding: "5px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: win === w.id ? 800 : 600,
                  background: win === w.id ? "var(--primary)" : "transparent",
                  color: win === w.id ? "#fff" : C.muted,
                  transition: "all .15s ease",
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
          <select
            value={street ?? ""}
            onChange={(e) => {
              const next = e.target.value || null
              setStreet(next)
              setSpaceGran(next ? "grid" : "street")
            }}
            className="tech-select"
            style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: C.text, cursor: "pointer" }}
            aria-label="空间筛选（到街道）"
          >
            <option value="">东城全区</option>
            {STREETS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={type ?? ""}
            onChange={(e) => setType(e.target.value || null)}
            className="tech-select"
            style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: C.text, cursor: "pointer" }}
            aria-label="类型筛选"
          >
            <option value="">全部类型</option>
            {TYPE_DEFS.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
          </select>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginLeft: "auto" }}>
            {filterMeta}
          </span>
        </div>

        {/* 第二行：四类 tab，下划线标明当前类；切 tab 时关闭问 AI 抽屉并回到顶部 */}
        <div style={{ display: "flex", gap: 22, borderBottom: `1px solid ${C.border}` }}>
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setAskId(null)
                setSlice(null)
                setCat(c.id)
                scrollRef.current?.scrollTo({ top: 0 })
              }}
              title={c.hint}
              style={{
                cursor: "pointer", padding: "8px 2px 10px", marginBottom: -1,
                border: "none", background: "transparent",
                borderBottom: `2px solid ${cat === c.id ? C.primary : "transparent"}`,
                color: cat === c.id ? C.text : C.muted,
                fontSize: 13, fontWeight: cat === c.id ? 800 : 600,
                transition: "color .15s ease",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 当前类的一句话解读：普通正文，不做卡片 */}
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75, fontWeight: 500, marginBottom: 16 }}>
        {insight}
      </div>

      {/* ── 1 综合态势 ── */}
      {cat === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionHead label="区间流水（随时间、空间、类型变）" />
          <div className="stats-kpi-grid cols-2">
            <KpiCard2
              label="事件总数" value={v.total} unit="件" color={C.primary} icon="archive" ruleId="ov_total"
              sub={`${filterMeta} · 按发现时间归日`}
              onClick={v.total >= 1 ? () => openSlice("事件总数", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
            />
            <KpiCard2
              label="区间闭环" value={v.closedAll} unit="件" color={C.success} icon="checkCircle" ruleId="ov_closed"
              sub={`结案 ${v.closedCase} 件 · 作废或判无效 ${v.closedNonCase} 件（不只核查结案）`}
              onClick={v.closedAll >= 1 ? () => openSlice("区间闭环", v.closedAll, "flow", sliceRows({ stages: ["已结案", "已作废", "无效"] })) : undefined}
            />
          </div>

          <ChartCard2
            title="发现与闭环"
            ruleId="ov_daily"
            onAsk={showAsk("ov_daily", v.total === 0 && v.closedAll === 0) ? () => openAsk("ov_daily") : undefined}
            note="每天新发现几件、办结几件"
          >
            <EchartsDiscoverClose
              labels={v.days.map((d) => d.label)}
              found={v.foundDaily}
              closed={v.closedDaily}
              mode={v.dayMode}
              axisLabelInterval={v.dayMode === "line" && v.days.length > 7 ? 4 : 0}
              skin={skin}
              height={210}
              onItemClick={openDaySlice}
            />
          </ChartCard2>

          {/* 链路吞吐：横向五阶，不是漏斗 */}
          <div className="glass-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text, letterSpacing: "0.02em" }}>链路吞吐</span>
              <RuleChips id="funnel" userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
              <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>识别 → 审核 → 立案 → 处置 → 核查</span>
              {showAsk("funnel", v.total === 0) && (
                <button
                  onClick={() => openAsk("funnel")}
                  style={{
                    border: "1px solid var(--border)", background: "transparent", borderRadius: 999,
                    padding: "2px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", color: C.primary,
                    marginLeft: "auto",
                  }}
                >
                  问 AI
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
              {FUNNEL_STAGES.map((s, i) => {
                const val = v.funnel[s.key]
                const prev = i > 0 ? v.funnel[FUNNEL_STAGES[i - 1].key] : null
                return (
                  <Fragment key={s.key}>
                    {i > 0 && (
                      <div
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 2, minWidth: 66,
                        }}
                      >
                        <span style={{ fontSize: 15, color: C.primary, fontWeight: 800, lineHeight: 1 }}>→</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>
                          {pct(val, prev ?? 0)}
                        </span>
                      </div>
                    )}
                    <div
                      onClick={val >= 1 ? () => openSlice(`链路吞吐 · ${s.label}`, val, "flow", sliceRows({ stages: FUNNEL_SLICE_STAGES[s.key] })) : undefined}
                      title={val >= 1 ? "点击查看切片" : undefined}
                      style={{
                        flex: 1, minWidth: 140,
                        padding: "4px 6px",
                        display: "flex", flexDirection: "column", gap: 5,
                        cursor: val >= 1 ? "pointer" : "default",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{s.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span
                          className={val > 0 ? "gradient-text" : undefined}
                          style={{
                            fontSize: 24, fontWeight: 800, lineHeight: 1,
                            fontFamily: "JetBrains Mono, monospace", letterSpacing: "-0.03em",
                            color: val > 0 ? undefined : C.muted,
                          }}
                        >
                          {val}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>件</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600, lineHeight: 1.5 }}>{s.sub}</div>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </div>

          {/* 当前积压：浅底细边框整段包住 */}
          <div className="stats-backlog">
            <SectionHead label="当前积压（截止此刻，不随时间变，随空间、类型变）" />
            <div className="stats-kpi-grid cols-2">
              <KpiCard2
                label="存续事件" value={v.sustained} unit="件" color={C.warning} icon="layers" ruleId="ov_sustained"
                sub="截止此刻 · 四环节之和"
                onClick={v.sustained >= 1 ? () => openSlice("存续事件", v.sustained, "backlog", sliceRows({})) : undefined}
              />
              <KpiCard2
                label="严重事件" value={v.severe} unit="件" color={C.danger} icon="alertTriangle" ruleId="ov_severe"
                sub="存续中等级为严重 · 截止此刻"
                onClick={v.severe >= 1 ? () => openSlice("严重事件", v.severe, "backlog", sliceRows({ severe: true })) : undefined}
              />
            </div>
            <div className="stats-chart-grid stats-chart-grid-3">
              <ChartCard2
                title="各阶段待处理" ruleId="ov_stages"
                note="截止此刻，还压在各环节的件数"
                sliceEnabled={v.sustained >= 1}
                onSlice={() => openSlice("各阶段待处理", v.sustained, "backlog", sliceRows({}))}
                onAsk={showAsk("ov_stages", v.sustained === 0) ? () => openAsk("ov_stages") : undefined}
              >
                <StageBar values={v.stages.map((s) => s.value)} skin={skin} onItemClick={(name) => {
                  const idx = STAGE_META.findIndex((s) => s.label === name)
                  if (idx >= 0) stageTop(idx)
                }} />
              </ChartCard2>
              <ChartCard2
                title="严重问题空间" ruleId="ov_severe_space"
                extra={<GranToggle street={street} value={v.effectiveGran} onChange={setSpaceGran} />}
                note={
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div>按存续严重计 · 截止此刻</div>
                    <RankNote by="件数" restCount={v.severeTop.restCount} restSum={v.severeTop.restSum} />
                  </div>
                }
                sliceEnabled={v.severe >= 1}
                onSlice={() => openSlice("严重问题空间", v.severe, "backlog", sliceRows({ severe: true }))}
                onAsk={showAsk("ov_severe_space", v.severe === 0) ? () => openAsk("ov_severe_space") : undefined}
              >
                {v.severe === 0 || v.severeTop.visible.length === 0 ? (
                  <EmptyBox text="当前范围没有可计算该口径的样本" />
                ) : (
                  <EchartsRank
                    data={[...v.severeTop.visible, ...(v.severeTop.restCount > 0 ? [{ name: `其余 ${v.severeTop.restCount} 个`, value: v.severeTop.restSum, color: "#9AA4B2" }] : [])]}
                    skin={skin}
                    height={210}
                    valueSuffix=" 件"
                    onItemClick={(name, value) => { if (!name.startsWith("其余")) openSlice(`严重问题空间 · ${name}`, value, "backlog", sliceRows({ severe: true })) }}
                  />
                )}
              </ChartCard2>
              <ChartCard2
                title="当前存续类型" ruleId="ov_sustained_types"
                note="按存续计 · 截止此刻"
                sliceEnabled={v.sustained >= 1}
                onSlice={() => openSlice("当前存续类型", v.sustained, "backlog", sliceRows({}))}
                onAsk={showAsk("ov_sustained_types", v.sustained === 0) ? () => openAsk("ov_sustained_types") : undefined}
              >
                {v.sustained === 0 ? (
                  <EmptyBox text="当前范围没有可计算该口径的样本" />
                ) : (
                  <EchartsPie
                    data={v.sustainedTypes}
                    skin={skin}
                    height={210}
                    centerText={String(v.sustained)}
                    centerSub="存续合计"
                    showValueInLegend
                    onItemClick={(name, value) => openSlice(`当前存续类型 · ${name}`, value, "backlog", sliceRows({}))}
                  />
                )}
              </ChartCard2>
            </div>
          </div>
        </div>
      )}

      {/* ── 2 事件发生 ── */}
      {cat === "events" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="stats-kpi-grid cols-1">
            <KpiCard2
              label="事件总数" value={v.total} unit="件" color={C.primary} icon="archive" ruleId="ev_total"
              sub={`${filterMeta} · 按发现时间归日 · 本版发现均来自相机`}
              onClick={v.total >= 1 ? () => openSlice("事件总数", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
            />
          </div>
          <div className="stats-chart-grid">
            <ChartCard2
              title="类型结构" ruleId="ev_type_struct"
              sliceEnabled={v.total >= 1}
              onSlice={() => openSlice("类型结构", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
              onAsk={showAsk("ev_type_struct", v.total === 0) ? () => openAsk("ev_type_struct") : undefined}
            >
              {v.total === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsPie
                  data={v.typeStruct}
                  skin={skin}
                  height={210}
                  centerText={String(v.total)}
                  centerSub="事件总数"
                  showValueInLegend
                  onItemClick={(name, value) => typeSlice(name, value)}
                />
              )}
            </ChartCard2>
            <ChartCard2
              title="空间分布" ruleId="ev_space_dist"
              extra={<GranToggle street={street} value={v.effectiveGran} onChange={setSpaceGran} />}
              note={
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>按发现时间计</div>
                  <RankNote by="件数" restCount={v.spaceTop.restCount} restSum={v.spaceTop.restSum} />
                </div>
              }
              sliceEnabled={v.total >= 1}
              onSlice={() => openSlice("空间分布", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
              onAsk={showAsk("ev_space_dist", v.total === 0) ? () => openAsk("ev_space_dist") : undefined}
            >
              {v.spaceTop.visible.length === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsRank
                  data={[...v.spaceTop.visible, ...(v.spaceTop.restCount > 0 ? [{ name: `其余 ${v.spaceTop.restCount} 个`, value: v.spaceTop.restSum, color: "#9AA4B2" }] : [])]}
                  skin={skin}
                  height={210}
                  valueSuffix=" 件"
                  onItemClick={(name, value) => { if (!name.startsWith("其余")) openSlice(`空间分布 · ${name}`, value, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) }}
                />
              )}
            </ChartCard2>
          </div>

          <ChartCard2
            title="发生时段" ruleId="ev_hourly"
            note="一天里各个小时发现了几件"
            sliceEnabled={v.total >= 1}
            onSlice={() => openSlice("发生时段", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
            onAsk={showAsk("ev_hourly", v.total === 0) ? () => openAsk("ev_hourly") : undefined}
          >
            <EchartsBar
              data={v.hourly}
              xAxis={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))}
              itemColors={v.hourly.map((n, i) => (n > 0 && i === v.peakHour ? C.primary : C.primaryLight))}
              axisLabelInterval={2}
              skin={skin}
              height={210}
              valueSuffix=" 件"
              onItemClick={(name, value) => {
                if (value >= 1) openSlice(`发生时段 · ${name} 时`, value, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))
              }}
            />
          </ChartCard2>

          <ChartCard2
            title="高发相机" ruleId="ev_top_cameras"
            note={
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div>点位名为主、相机编号为次{v.camerasWithoutId > 0 ? ` · 另有 ${v.camerasWithoutId} 件没有相机编号，未进榜` : ""}</div>
                <RankNote
                  by="件数"
                  restCount={Math.max(0, v.cameras.length - 8)}
                  restSum={sum(v.cameras.slice(8).map((c) => c.value))}
                />
              </div>
            }
            sliceEnabled={v.cameras.length >= 1}
            onSlice={() => openSlice("高发相机", sum(v.cameras.map((c) => c.value)), "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
            onAsk={showAsk("ev_top_cameras", v.cameras.length === 0) ? () => openAsk("ev_top_cameras") : undefined}
          >
            {v.cameras.length === 0 ? (
              <EmptyBox text="当前范围没有可计算该口径的样本" />
            ) : (
              <CameraRank
                cameras={v.cameras}
                restSum={{ count: Math.max(0, v.cameras.length - 8), sum: sum(v.cameras.slice(8).map((c) => c.value)) }}
                onItemClick={(point, value) => openSlice(`高发相机 · ${point}`, value, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
              />
            )}
          </ChartCard2>
        </div>
      )}

      {/* ── 3 流程运行 ── */}
      {cat === "process" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, padding: "0 2px" }}>
            上半段按所选时间统计；下半段是截止此刻的积压，改时间不变
          </div>

          {/* 上半段：这段时间办完的用时（随时间、空间、类型变） */}
          <SectionHead label="这段时间办完的用时（随时间、空间、类型变）" />
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, padding: "0 2px", marginTop: -8 }}>
            改时间，这段会变 · 没有办理时限，只标长于当前范围的平均
          </div>
          <div className="stats-kpi-grid cols-1">
            <KpiCard2
              label="从派给网格到处置完，平均要多久"
              value={v.doneAvg === null ? "—" : v.doneAvg}
              unit={v.doneAvg === null ? undefined : "小时"}
              color={C.primary} icon="clock" ruleId="pr_avg"
              sub={v.doneN === 0 ? "当前范围无可计算样本" : `办完 ${v.doneN} 件 · 从派给网格到处置完`}
            />
          </div>
          <div className="stats-chart-grid stats-chart-grid-3">
            <ChartCard2
              title="各环节停了多久" ruleId="pr_dwell"
              note={
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>前两步按这段时间处置完的 {v.doneN} 件平均，最后一步只算其中已核查完的 {v.checkedN} 件；柱高是平均小时，最长的一步用深色。</div>
                </div>
              }
              onAsk={showAsk("pr_dwell", v.doneN === 0) ? () => openAsk("pr_dwell") : undefined}
            >
              {v.doneN === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsBar
                  data={v.dwellVals.map((val) => val ?? 0)}
                  xAxis={["发现 → 派给网格", "派给网格 → 处置完", "处置完 → 核查完"]}
                  itemColors={v.dwellVals.map((_, i) => (i === v.dwellMaxIdx ? C.primary : "#9AA4B2"))}
                  skin={skin}
                  height={210}
                  valueSuffix=" 小时"
                />
              )}
            </ChartCard2>
            <ChartCard2
              title="哪个网格办完更久" ruleId="pr_grid_dur"
              note={
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>深色表示长于当前平均 {v.doneAvg === null ? "—" : `${v.doneAvg} 小时`} · 办完 {v.doneN} 件</div>
                  <RankNote by="时长" restCount={v.gridDur.restCount} restSum={v.gridDur.restSum} />
                </div>
              }
              onAsk={showAsk("pr_grid_dur", v.doneN === 0) ? () => openAsk("pr_grid_dur") : undefined}
            >
              {v.doneN === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsRank
                  data={v.gridDur.visible}
                  skin={skin}
                  height={210}
                  valueSuffix=" 小时"
                  onItemClick={(name, value) => {
                    const gridRows = v.doneRows.filter((e) => e.grid === name)
                    if (gridRows.length > 0) {
                      openSlice(
                        `哪个网格办完更久 · ${name}`,
                        gridRows.length,
                        "flow",
                        gridRows.map<EvRow>((r) => ({
                          type: r.type,
                          place: name,
                          stage: r.check === undefined ? "待核查" : "已结案",
                          time: `${WIN_LABEL[win]}处置完`,
                          status: `派给网格 ${r.wait}h · 处置 ${r.doIt}h · ${r.check === undefined ? "还没核查完" : `核查 ${r.check}h`}`,
                        })),
                      )
                    }
                  }}
                />
              )}
            </ChartCard2>
            <ChartCard2
              title="哪类事件办完更久" ruleId="pr_type_dur"
              note={
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>深色表示长于当前平均 {v.doneAvg === null ? "—" : `${v.doneAvg} 小时`} · 办完 {v.doneN} 件</div>
                  <RankNote by="时长" restCount={v.typeDur.restCount} restSum={v.typeDur.restSum} />
                </div>
              }
              onAsk={showAsk("pr_type_dur", v.doneN === 0) ? () => openAsk("pr_type_dur") : undefined}
            >
              {v.doneN === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsRank
                  data={v.typeDur.visible}
                  skin={skin}
                  height={210}
                  valueSuffix=" 小时"
                  onItemClick={(name, value) => {
                    const typeRows = v.doneRows.filter((e) => e.type === name)
                    if (typeRows.length > 0) {
                      openSlice(
                        `哪类事件办完更久 · ${name}`,
                        typeRows.length,
                        "flow",
                        typeRows.map<EvRow>((r) => ({
                          type: name,
                          place: r.grid,
                          stage: r.check === undefined ? "待核查" : "已结案",
                          time: `${WIN_LABEL[win]}处置完`,
                          status: `派给网格 ${r.wait}h · 处置 ${r.doIt}h · ${r.check === undefined ? "还没核查完" : `核查 ${r.check}h`}`,
                        })),
                      )
                    }
                  }}
                />
              )}
            </ChartCard2>
          </div>

          {/* 下半段：现在还压着（截止此刻） */}
          <SectionHead label="现在还压着（截止此刻，不随时间变，随空间、类型变）" />
          <div className="stats-kpi-grid cols-4">
            {v.stages.map((s, i) => (
              <KpiCard2
                key={s.key}
                label={s.label}
                value={s.value}
                unit="件"
                color={s.color}
                icon={s.icon}
                ruleId={s.ruleId}
                onClick={s.value >= 1 ? () => stageTop(i) : undefined}
              />
            ))}
          </div>
          <ChartCard2
            title="环节存量" ruleId="pr_stages"
            note="截止此刻，还压在各环节的件数。现场已消失的不算待立案"
            sliceEnabled={v.sustained >= 1}
            onSlice={() => openSlice("环节存量", v.sustained, "backlog", sliceRows({}))}
            onAsk={showAsk("pr_stages", v.sustained === 0) ? () => openAsk("pr_stages") : undefined}
          >
            <StageBar values={v.stages.map((s) => s.value)} skin={skin} onItemClick={(name) => {
              const idx = STAGE_META.findIndex((s) => s.label === name)
              if (idx >= 0) stageTop(idx)
            }} />
          </ChartCard2>
          <ChartCard2
            title="责任网格在办" ruleId="pr_grid"
            note={
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div>截止此刻，各网格手里还没处置完的件数</div>
                <RankNote by="件数" restCount={v.gridOnDutyTop.restCount} restSum={v.gridOnDutyTop.restSum} />
              </div>
            }
            sliceEnabled={v.gridOnDuty.some((d) => d.value >= 1)}
            onSlice={() => openSlice("责任网格在办", v.stages[1].value, "backlog", sliceRows({ stages: ["待处置"] }))}
            onAsk={showAsk("pr_grid", v.gridOnDuty.length === 0) ? () => openAsk("pr_grid") : undefined}
          >
            {v.gridOnDuty.length === 0 ? (
              <EmptyBox text="当前范围没有可计算该口径的样本" />
            ) : (
              <EchartsRank
                data={[...v.gridOnDutyTop.visible, ...(v.gridOnDutyTop.restCount > 0 ? [{ name: `其余 ${v.gridOnDutyTop.restCount} 个`, value: v.gridOnDutyTop.restSum, color: "#9AA4B2" }] : [])]}
                skin={skin}
                height={210}
                valueSuffix=" 件"
                onItemClick={(name, value) => { if (!name.startsWith("其余")) openSlice(`责任网格在办 · ${name}`, value, "backlog", sliceRows({ stages: ["待处置"] })) }}
              />
            )}
          </ChartCard2>
        </div>
      )}

      {/* ── 4 治理质量与 AI 成效 ── */}
      {cat === "quality" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, padding: "0 2px" }}>
            本页按所选时间区间统计
          </div>
          <SectionHead label="治理质量" />
          <div className="stats-chart-grid">
            <ChartCard2
              title="有效 / 无效 / 消散" ruleId="ql_composition"
              sliceEnabled={v.quality.composition >= 1}
              onSlice={() => openSlice("有效 / 无效 / 消散", v.quality.composition, "flow", sliceRows({ stages: ["已结案", "已作废", "无效", "待立案"] }))}
              onAsk={showAsk("ql_composition", v.quality.composition === 0) ? () => openAsk("ql_composition") : undefined}
            >
              {v.quality.composition === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsPie
                  data={[
                    { label: "立案有效", value: v.quality.valid, color: C.primary },
                    { label: "无效", value: v.quality.invalid, color: C.danger },
                    { label: "自然消散", value: v.quality.dissipated, color: C.muted },
                  ]}
                  skin={skin}
                  height={210}
                  centerText={String(v.quality.composition)}
                  centerSub="构成合计"
                  showValueInLegend
                  onItemClick={(name, value) => openSlice(`有效 / 无效 / 消散 · ${name}`, value, "flow", sliceRows({ stages: ["已结案", "已作废", "无效", "待立案"] }))}
                />
              )}
            </ChartCard2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, alignContent: "start" }}>
              <KpiCard2
                label="事件有效率" value={v.quality.effectiveRate} color={C.success} icon="target" ruleId="ql_effective_rate"
                sub={v.quality.effectiveDenom === 0 ? "当前范围无可计算样本" : `审完 ${v.quality.effectiveDenom} 件，确认有效 ${v.quality.valid} 件`}
                onClick={v.quality.valid >= 1 ? () => openSlice("事件有效率", v.quality.valid, "flow", sliceRows({ stages: ["已结案", "已作废", "待立案"] })) : undefined}
              />
              <KpiCard2
                label="退回率" value={v.quality.returnRate} color={C.warning} icon="refreshCw" ruleId="ql_return_rate"
                sub={v.quality.inspected === 0 ? "当前范围无可计算样本" : `有核查结果 ${v.quality.inspected} 件，被退回 ${v.quality.returned} 件`}
                onClick={v.quality.inspected >= 1 ? () => openSlice("退回率", v.quality.inspected, "flow", sliceRows({ stages: ["待核查", "已结案"] })) : undefined}
                onAsk={showAsk("ql_return_rate", v.quality.inspected === 0) ? () => openAsk("ql_return_rate") : undefined}
              />
              <KpiCard2
                label="一次核查通过率" value="—" color={C.purple} icon="checkSquare" ruleId="ql_first_pass"
                sub="本版暂不计算"
              />
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <SectionHead label="AI 成效" />
          </div>
          <div className="stats-kpi-grid cols-4">
            <KpiCard2
              label="发现有效率" value={v.aiRates.discoveryRate} color={C.primary} icon="target" ruleId="ai_discovery_rate"
              sub={v.aiRates.discoveryCandidates === 0 ? "当前范围无可计算样本" : `相机发现 ${v.aiRates.discoveryCandidates} 件，最后要办 ${v.aiRates.discoveryValid} 件`}
              onClick={v.aiRates.discoveryValid >= 1 ? () => openSlice("发现有效率", v.aiRates.discoveryValid, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
              onAsk={showAsk("ai_discovery_rate", v.aiRates.discoveryCandidates === 0) ? () => openAsk("ai_discovery_rate") : undefined}
            />
            <KpiCard2
              label="预填少改" value={v.aiRates.prefillType} color={C.cyan} icon="checkSquare" ruleId="ai_prefill_type"
              sub={v.aiRates.prefillTotal === 0 ? "当前范围无可计算样本" : `AI 预填 ${v.aiRates.prefillTotal} 件，类型没被人工改 ${v.aiRates.prefillMatch} 件`}
              onClick={v.aiRates.prefillMatch >= 1 ? () => openSlice("预填少改", v.aiRates.prefillMatch, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
              onAsk={showAsk("ai_prefill_type", v.aiRates.prefillTotal === 0) ? () => openAsk("ai_prefill_type") : undefined}
            />
            <KpiCard2
              label="建议一致率" value={v.aiRates.suggestMatch} color={C.purple} icon="thumbsUp" ruleId="ai_suggest_match"
              sub={v.aiRates.suggestTotal === 0 ? "当前范围无可计算样本" : `系统给建议 ${v.aiRates.suggestTotal} 件，人工判断一致 ${v.aiRates.suggestMatchCount} 件`}
              onClick={v.aiRates.suggestMatchCount >= 1 ? () => openSlice("建议一致率", v.aiRates.suggestMatchCount, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
              onAsk={showAsk("ai_suggest_match", v.aiRates.suggestTotal === 0) ? () => openAsk("ai_suggest_match") : undefined}
            />
            <KpiCard2
              label="空间匹配失败" value={v.aiRates.spaceFail} unit="件" color={C.warning} icon="mapPin" ruleId="ai_space_fail"
              sub="落不到网格、还要人定点"
              onClick={v.aiRates.spaceFail >= 1 ? () => openSlice("空间匹配失败", v.aiRates.spaceFail, "flow", sliceRows({ stages: ["待立案"] })) : undefined}
              onAsk={showAsk("ai_space_fail", v.aiRates.spaceFail === 0) ? () => openAsk("ai_space_fail") : undefined}
            />
          </div>
        </div>
      )}

      <SliceDrawer slice={slice} onClose={() => setSlice(null)} />
      {askDesc && <AskAiDrawer key={askDesc.id} desc={askDesc} onClose={() => setAskId(null)} />}
    </div>
  )
}
