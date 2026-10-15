import { Fragment, useMemo, useState } from "react"
import EchartsBar from "../components/EchartsBar"
import EchartsPie from "../components/EchartsPie"
import EchartsRank from "../components/EchartsRank"
import KpiIcon from "../components/KpiIcon"
import { RuleChip, RuleChips } from "../data/dashboardRules"
import { STATS2_ALGO_RULES, STATS2_USER_RULES } from "../data/statsV2Rules"

// AI 统计 2.0 · 四类收敛版（2026-10-12 prompt 为本期真源）
// 2026-10-14 修订（时间 / 积压口径显性化）：
//   时间 = 只作用于「这段时间发生/办完」的流水指标（发现、闭环、类型/空间结构、按区间计的质量与 AI 指标）；
//   积压 = 「截止此刻」的库存，不随时间变，只随空间/类型变；积压类独立分区，区标题写死
//   「当前积压（截止此刻，不随时间变）」；「流程运行」Tab 进入时时间筛灰掉不可用。
// 定位：在给定筛选下看结构与成效。不办理、不在这里结案。
// 导航只保留 4 类：综合态势 / 事件发生 / 流程运行 / 治理质量与 AI 成效（同页两分区）。
// 每卡每图标题旁 ? （用户口径）+「算法」（公式）双悬停；切片：实算且 ≥1 才能点开。
// 页面上的全部数字均为示例。

type Cat = "overview" | "events" | "process" | "quality"
type TimeWin = "today" | "7d" | "30d"
// 事件发生 · 空间分布分组粒度
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
  { id: "overview", label: "综合态势", hint: "这套筛选下这段时间的整体结构与存量" },
  { id: "events", label: "事件发生", hint: "发现了什么、在哪里、什么时候" },
  { id: "process", label: "流程运行", hint: "现在各环节压着多少（截止此刻）" },
  { id: "quality", label: "治理质量与 AI 成效", hint: "办得怎么样 + AI 带来了什么" },
]

const WINS: { id: TimeWin; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "7d", label: "近7日" },
  { id: "30d", label: "近30日" },
]

// 区间闭环标题随筛选：禁止在近7日下仍写「今日闭环」
const CLOSED_LABEL: Record<TimeWin, string> = {
  today: "今日闭环",
  "7d": "近7日闭环",
  "30d": "近30日闭环",
}

const TYPES = [
  { label: "共享单车占道", color: C.primary },
  { label: "施工占道", color: C.cyan },
  { label: "占道经营", color: C.warning },
  { label: "暴露垃圾", color: C.success },
  { label: "疑似堆物", color: C.danger },
]

const STREETS = [
  "北新桥街道", "朝阳门街道", "东华门街道", "东四街道",
  "安定门街道", "东直门街道", "和平里街道", "建国门街道",
]

// ─── 示例数据 ────────────────────────────────────────────────────────────────
// 时间窗相关（发现 / 闭环类）
const winBase: Record<TimeWin, {
  total: number
  closedCase: number
  closedNonCase: number
  typeStruct: number[]
  hourly: number[]
  cameras: { name: string; value: number }[]
}> = {
  today: {
    total: 5,
    closedCase: 2,
    closedNonCase: 1,
    typeStruct: [2, 1, 1, 1, 0],
    hourly: [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    cameras: [
      { name: "C-A11-03", value: 2 },
      { name: "C-C07-11", value: 1 },
      { name: "C-B03-02", value: 1 },
    ],
  },
  "7d": {
    total: 18,
    closedCase: 4,
    closedNonCase: 2,
    typeStruct: [5, 5, 4, 2, 2],
    hourly: [0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    cameras: [
      { name: "C-A11-03", value: 3 },
      { name: "C-C07-11", value: 3 },
      { name: "C-B03-02", value: 2 },
      { name: "C-E01-02", value: 2 },
      { name: "C-A02-08", value: 1 },
      { name: "C-A07-04", value: 1 },
    ],
  },
  "30d": {
    total: 62,
    closedCase: 17,
    closedNonCase: 7,
    typeStruct: [17, 15, 12, 10, 8],
    hourly: [0, 0, 0, 0, 0, 0, 0, 1, 9, 11, 7, 5, 3, 2, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0],
    cameras: [
      { name: "C-A11-03", value: 11 },
      { name: "C-C07-11", value: 9 },
      { name: "C-B03-02", value: 7 },
      { name: "C-E01-02", value: 6 },
      { name: "C-A02-08", value: 5 },
      { name: "C-A07-04", value: 4 },
      { name: "C-D04-01", value: 3 },
    ],
  },
}

// 街道占比（示例）：空间筛选的缩放系数 + 街道榜
const streetFrac: Record<string, number> = {
  "北新桥街道": 0.22, "朝阳门街道": 0.22, "东华门街道": 0.22, "东四街道": 0.11,
  "安定门街道": 0.06, "东直门街道": 0.06, "和平里街道": 0.06, "建国门街道": 0.06,
}
const streetDist: Record<TimeWin, { name: string; value: number }[]> = {
  today: [
    { name: "朝阳门街道", value: 2 }, { name: "北新桥街道", value: 1 },
    { name: "东华门街道", value: 1 }, { name: "东四街道", value: 1 },
  ],
  "7d": [
    { name: "北新桥街道", value: 4 }, { name: "朝阳门街道", value: 4 },
    { name: "东华门街道", value: 4 }, { name: "东四街道", value: 2 },
    { name: "安定门街道", value: 1 }, { name: "东直门街道", value: 1 },
    { name: "和平里街道", value: 1 }, { name: "建国门街道", value: 1 },
  ],
  "30d": [
    { name: "北新桥街道", value: 14 }, { name: "朝阳门街道", value: 13 },
    { name: "东华门街道", value: 12 }, { name: "东四街道", value: 8 },
    { name: "安定门街道", value: 5 }, { name: "东直门街道", value: 4 },
    { name: "和平里街道", value: 3 }, { name: "建国门街道", value: 3 },
  ],
}

// 截止此刻（不随时间窗变，只随空间/类型变）：存续 / 环节 / 网格在办
const nowBase = {
  stages: [
    { label: "待立案", value: 7 },
    { label: "待处置", value: 1 },
    { label: "待核查", value: 5 },
    { label: "待作废审核", value: 2 },
  ],
  severeByStreet: [
    { name: "朝阳门街道", value: 2 }, { name: "安定门街道", value: 1 },
    { name: "北新桥街道", value: 1 }, { name: "东四街道", value: 1 },
    { name: "和平里街道", value: 1 }, { name: "建国门街道", value: 1 },
  ],
  sustainedTypes: [4, 4, 4, 2, 1],
  gridOnDuty: [
    { name: "A11 责任人", value: 3 }, { name: "C07 责任人", value: 2 },
    { name: "E01 责任人", value: 2 }, { name: "A07 责任人", value: 1 },
    { name: "B03 责任人", value: 1 }, { name: "B05 责任人", value: 1 },
  ],
}

// 按时间区间计（流水类，改时间必须变；空间/类型仍可筛）：治理质量 + AI 成效
const winQuality: Record<TimeWin, {
  valid: number
  invalid: number
  dissipated: number
  returned: number
  inspected: number
  discoveryValid: number
  discoveryCandidates: number
  prefillMatch: number
  prefillTotal: number
  suggestMatch: number
  suggestTotal: number
  spaceFail: number
}> = {
  today: {
    valid: 2, invalid: 1, dissipated: 0, returned: 0, inspected: 3,
    discoveryValid: 5, discoveryCandidates: 6,
    prefillMatch: 5, prefillTotal: 6, suggestMatch: 5, suggestTotal: 6,
    spaceFail: 2,
  },
  "7d": {
    valid: 15, invalid: 2, dissipated: 1, returned: 2, inspected: 27,
    discoveryValid: 20, discoveryCandidates: 23,
    prefillMatch: 21, prefillTotal: 23, suggestMatch: 18, suggestTotal: 22,
    spaceFail: 18,
  },
  "30d": {
    valid: 52, invalid: 7, dissipated: 3, returned: 8, inspected: 96,
    discoveryValid: 71, discoveryCandidates: 82,
    prefillMatch: 75, prefillTotal: 82, suggestMatch: 66, suggestTotal: 80,
    spaceFail: 43,
  },
}

// 选街道后的网格粒度示例（负荷 / 严重 / 分布共用形）
function gridDistFor(street: string): { name: string; value: number }[] {
  return [
    { name: `${street.slice(0, 3)}-01网格`, value: 2 },
    { name: `${street.slice(0, 3)}-02网格`, value: 1 },
    { name: `${street.slice(0, 3)}-03网格`, value: 1 },
  ]
}

const HOURLY_LABELS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))

// ─── 事件发生 Tab：相机点位（可读名）与按粒度的发现分布 ────────────────────
// 相机编号 → 可读点位名（主）+ 街道·网格（次要）；无编号的不进榜
const CAMERA_PLACE: Record<string, { point: string; place: string }> = {
  "C-A11-03": { point: "雍和宫大街·国子监街口", place: "北新桥街道 · 北新桥-04网格" },
  "C-C07-11": { point: "王府井步行街北口", place: "东华门街道 · 东华门-02网格" },
  "C-B03-02": { point: "东四北大街·钱粮胡同口", place: "东四街道 · 东四-01网格" },
  "C-E01-02": { point: "朝阳门南小街·竹竿胡同口", place: "朝阳门街道 · 朝阳门-01网格" },
  "C-A02-08": { point: "安定门内大街·车辇店胡同口", place: "安定门街道 · 安定门-02网格" },
  "C-A07-04": { point: "交道口南大街·府学胡同口", place: "安定门街道 · 安定门-01网格" },
  "C-D04-01": { point: "和平里中街·街心公园东门", place: "和平里街道 · 和平里-01网格" },
}

// 流水类时间缩放（事件发生 Tab 的发现分布随时间窗变）
const WIN_FLOW: Record<TimeWin, number> = { today: 0.35, "7d": 1, "30d": 3 }

// 已选街道：网格 / 街巷粒度（随时间窗变）
function gridFlowFor(street: string, win: TimeWin): { name: string; value: number }[] {
  const s = street.slice(0, 3)
  return [
    { name: `${s}-01网格`, value: 2 },
    { name: `${s}-02网格`, value: 1 },
    { name: `${s}-03网格`, value: 1 },
  ]
    .map((d) => ({ name: d.name, value: scale(d.value, WIN_FLOW[win]) }))
    .filter((d) => d.value > 0)
}

function laneFlowFor(street: string, win: TimeWin): { name: string; value: number }[] {
  const s = street.slice(0, 3)
  return [
    { name: `${s}大街东段`, value: 3 },
    { name: `${s}大街西段`, value: 2 },
    { name: `${s}胡同片区`, value: 1 },
  ]
    .map((d) => ({ name: d.name, value: scale(d.value, WIN_FLOW[win]) }))
    .filter((d) => d.value > 0)
}

// 全区：网格 / 街巷粒度（随时间窗变）
const gridDistAll: Record<TimeWin, { name: string; value: number }[]> = {
  today: [
    { name: "北新桥-04网格", value: 2 }, { name: "朝阳门-01网格", value: 1 },
    { name: "东华门-02网格", value: 1 }, { name: "东四-01网格", value: 1 },
  ],
  "7d": [
    { name: "北新桥-04网格", value: 3 }, { name: "朝阳门-01网格", value: 3 },
    { name: "东华门-02网格", value: 3 }, { name: "东四-01网格", value: 2 },
    { name: "北新桥-01网格", value: 2 }, { name: "朝阳门-03网格", value: 2 },
    { name: "安定门-02网格", value: 2 }, { name: "东直门-01网格", value: 1 },
  ],
  "30d": [
    { name: "北新桥-04网格", value: 9 }, { name: "朝阳门-01网格", value: 8 },
    { name: "东华门-02网格", value: 8 }, { name: "东四-01网格", value: 7 },
    { name: "北新桥-01网格", value: 6 }, { name: "朝阳门-03网格", value: 6 },
    { name: "安定门-02网格", value: 6 }, { name: "东直门-01网格", value: 6 },
    { name: "和平里-01网格", value: 6 },
  ],
}

const laneDistAll: Record<TimeWin, { name: string; value: number }[]> = {
  today: [
    { name: "雍和宫大街", value: 1 }, { name: "王府井步行街", value: 1 },
    { name: "东四北大街", value: 1 }, { name: "朝阳门南小街", value: 1 },
    { name: "金鱼胡同", value: 1 },
  ],
  "7d": [
    { name: "东四北大街", value: 3 }, { name: "簋街", value: 3 },
    { name: "王府井步行街", value: 2 }, { name: "雍和宫大街", value: 2 },
    { name: "朝阳门南小街", value: 2 }, { name: "金鱼胡同", value: 2 },
    { name: "车辇店胡同", value: 2 }, { name: "交道口南大街", value: 2 },
  ],
  "30d": [
    { name: "东四北大街", value: 10 }, { name: "簋街", value: 9 },
    { name: "王府井步行街", value: 8 }, { name: "雍和宫大街", value: 7 },
    { name: "朝阳门南小街", value: 7 }, { name: "金鱼胡同", value: 6 },
    { name: "车辇店胡同", value: 5 }, { name: "交道口南大街", value: 5 },
    { name: "东直门内大街", value: 5 },
  ],
}

// ─── 综合态势 · 链路吞吐（流水漏斗，随时间窗变） ────────────────────────────
// 各阶按本环节完成时间归日；跨日可能不同期，件数不必严格递减
type FunnelKey = "found" | "reviewed" | "filed" | "disposed" | "inspected"

const winFunnel: Record<TimeWin, Record<FunnelKey, number>> = {
  today: { found: 5, reviewed: 3, filed: 2, disposed: 2, inspected: 2 },
  "7d": { found: 18, reviewed: 17, filed: 15, disposed: 9, inspected: 6 },
  "30d": { found: 62, reviewed: 59, filed: 55, disposed: 33, inspected: 22 },
}

const FUNNEL_STAGES: { key: FunnelKey; label: string; sub: string; ruleId: string }[] = [
  { key: "found", label: "识别", sub: "区间新发现", ruleId: "funnel_found" },
  { key: "reviewed", label: "审核", sub: "区间审完（有效+无效）", ruleId: "funnel_reviewed" },
  { key: "filed", label: "立案", sub: "区间立案派发成功", ruleId: "funnel_filed" },
  { key: "disposed", label: "处置", sub: "区间处置完成", ruleId: "funnel_disposed" },
  { key: "inspected", label: "核查", sub: "区间核查结案", ruleId: "funnel_inspected" },
]

// 各阶切片的事件池过滤（按本环节完成后所在阶段取行）
const FUNNEL_SLICE_STAGES: Record<FunnelKey, string[]> = {
  found: ["待立案", "待处置", "待核查", "已结案", "已作废", "已无效"],
  reviewed: ["待处置", "待核查", "已结案", "已作废", "已无效"],
  filed: ["待处置", "待核查", "已结案"],
  disposed: ["待核查", "已结案"],
  inspected: ["已结案"],
}

// ─── 切片示例事件池（短列表用；数字均为示例） ───────────────────────────────
interface EvRow { type: string; place: string; stage: string; time: string; status: string }
const EVENT_POOL: EvRow[] = [
  { type: "共享单车占道", place: "北新桥街道 · 北新桥-04网格", stage: "待立案", time: "2026-10-12 08:41", status: "相机识别，待人工立案" },
  { type: "施工占道", place: "朝阳门街道 · 朝阳门-01网格", stage: "待立案", time: "2026-10-12 09:05", status: "相机识别，待人工立案" },
  { type: "占道经营", place: "东华门街道 · 东华门-02网格", stage: "待立案", time: "2026-10-12 09:37", status: "相机识别，待人工立案" },
  { type: "共享单车占道", place: "朝阳门街道 · 朝阳门-01网格", stage: "待处置", time: "2026-10-11 15:20", status: "已派发 A11 责任人" },
  { type: "暴露垃圾", place: "东四街道 · 东四-01网格", stage: "待核查", time: "2026-10-11 10:12", status: "处置完成，待核查" },
  { type: "施工占道", place: "北新桥街道 · 北新桥-01网格", stage: "待核查", time: "2026-10-10 16:48", status: "处置完成，待核查" },
  { type: "疑似堆物", place: "朝阳门街道 · 朝阳门-03网格", stage: "待核查", time: "2026-10-10 11:30", status: "处置完成，待核查" },
  { type: "占道经营", place: "东华门街道 · 东华门-01网格", stage: "待作废审核", time: "2026-10-10 09:22", status: "现场已不存在，待裁定作废" },
  { type: "共享单车占道", place: "北新桥街道 · 北新桥-04网格", stage: "已结案", time: "2026-10-12 07:55", status: "核查通过，已结案" },
  { type: "施工占道", place: "朝阳门街道 · 朝阳门-01网格", stage: "已结案", time: "2026-10-11 14:03", status: "核查通过，已结案" },
  { type: "暴露垃圾", place: "东四街道 · 东四-01网格", stage: "已结案", time: "2026-10-11 08:47", status: "核查通过，已结案" },
  { type: "疑似堆物", place: "安定门街道 · 安定门-02网格", stage: "已作废", time: "2026-10-10 17:10", status: "现场已消散，作废归档" },
]

function filterPool(f: {
  stages?: string[]
  type?: string | null
  street?: string | null
  severe?: boolean
}): EvRow[] {
  let rows = EVENT_POOL
  if (f.stages) rows = rows.filter((r) => f.stages!.includes(r.stage))
  if (f.type) rows = rows.filter((r) => r.type === f.type)
  if (f.street) rows = rows.filter((r) => r.place.startsWith(f.street!))
  if (f.severe) rows = rows.filter((r) => r.type === "疑似堆物" || r.type === "施工占道")
  return rows
}

// ─── 工具 ────────────────────────────────────────────────────────────────────
const scale = (n: number, f: number) => Math.max(0, Math.round(n * f))
const fmtPct = (n: number) => `${n}%`
const pct = (n: number, d: number) =>
  d === 0 ? "—" : `${(Math.round((n / d) * 1000) / 10).toFixed(1)}%`

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

// ─── 切片抽屉 ────────────────────────────────────────────────────────────────
interface SliceState {
  title: string
  userLine: string
  rows: EvRow[]
  kind: "存续" | "终态"
}

function SliceDrawer({
  slice,
  onClose,
  onGoArchive,
  onGoRealtime,
}: {
  slice: SliceState | null
  onClose: () => void
  onGoArchive: () => void
  onGoRealtime: () => void
}) {
  if (!slice) return null
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
            {slice.userLine}
          </div>
          {slice.rows.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, padding: "24px 0", textAlign: "center" }}>
              当前范围暂无数据
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {slice.rows.map((r, i) => (
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
                        background: r.stage === "已结案" || r.stage === "已作废" || r.stage === "已无效"
                          ? "rgba(46,155,104,0.12)"
                          : "rgba(50,109,255,0.10)",
                        color: r.stage === "已结案" || r.stage === "已作废" || r.stage === "已无效"
                          ? "var(--green)"
                          : "var(--primary)",
                      }}
                    >
                      {r.stage}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{r.place} · {r.time}</div>
                  <div style={{ fontSize: 11.5, color: C.text }}>{r.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "12px 20px", borderTop: "1px solid var(--border)",
            display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center",
          }}
        >
          <button
            onClick={() => downloadCsv(`${slice.title}切片`, slice.rows)}
            style={{
              border: "1px solid var(--border)", background: "transparent", borderRadius: 8,
              padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.text,
            }}
          >
            ⬇ 下载本切片
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {slice.kind === "终态" ? (
              <button
                onClick={onGoArchive}
                className="tech-btn-primary"
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer" }}
              >
                去事件档案
              </button>
            ) : (
              <button
                onClick={onGoRealtime}
                className="tech-btn-primary"
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer" }}
              >
                按当前条件去 AI实时治理
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

// ─── 卡片 ────────────────────────────────────────────────────────────────────
function KpiCard2({
  label, value, unit, sub, color, icon, ruleId, onClick,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color: string
  icon?: string
  ruleId: string
  onClick?: () => void
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
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.02em" }}>
            {label}
          </span>
          <RuleChips id={ruleId} userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
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
        {sub && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontWeight: 600 }}>{sub}</div>
        )}
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
  title, children, ruleId, onSlice, sliceEnabled, note,
}: {
  title: string
  children: React.ReactNode
  ruleId: string
  onSlice?: () => void
  sliceEnabled?: boolean
  note?: string
}) {
  return (
    <div
      className="tech-card"
      style={{
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
        border: `1px solid ${C.borderLight}`,
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
        {onSlice && sliceEnabled && (
          <button
            onClick={onSlice}
            className="tech-btn-ghost"
            style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            查看切片
          </button>
        )}
      </div>
      <div style={{ padding: 14, flex: 1 }}>{children}</div>
      {note && (
        <div style={{ padding: "0 18px 12px", fontSize: 11, color: C.muted, fontWeight: 600 }}>{note}</div>
      )}
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

// 高发相机榜：可读点位名（主）+ 相机编号（次要）+ 件数；无点位名退回编号
function CameraRank({ data }: { data: { id: string; point: string; place: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px" }}>
      {data.map((d, i) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 20, height: 20, borderRadius: i < 3 ? "50%" : 6, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10.5, fontWeight: 800, fontFamily: "JetBrains Mono, monospace",
              color: i < 3 ? "#fff" : C.muted,
              background: i < 3
                ? `linear-gradient(135deg, ${C.primary}, ${C.cyan})`
                : "var(--card-2)",
              boxShadow: i < 3 ? "0 3px 8px rgba(50,109,255,0.30)" : "none",
            }}
          >
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span
                style={{
                  fontSize: 12.5, fontWeight: 700, color: C.text,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {d.point || d.id}
              </span>
              <span
                style={{
                  fontSize: 13, fontWeight: 800, color: C.text, flexShrink: 0,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {d.value}
                <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}> 件</span>
              </span>
            </div>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, marginTop: 3,
                fontSize: 10.5, color: C.muted, fontWeight: 600,
              }}
            >
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.point ? `${d.place} · ` : ""}{d.point ? d.id : d.place}
              </span>
              <span style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--card-2)", overflow: "hidden" }}>
                <span
                  style={{
                    display: "block", width: `${Math.round((d.value / max) * 100)}%`, height: "100%",
                    borderRadius: 2, background: `linear-gradient(90deg, ${C.primary}, ${C.cyan})`,
                  }}
                />
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionHead({ label, tone = "primary" }: { label: string; tone?: "primary" | "amber" }) {
  const color = tone === "amber" ? "var(--amber)" : C.primary
  const bg = tone === "amber" ? "rgba(230,159,47,0.10)" : "rgba(50,109,255,0.08)"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 12px" }}>
      <span
        style={{
          fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color,
          padding: "4px 12px", borderRadius: 999, background: bg,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function AIStatisticsV2({
  skin,
  onGoArchive,
  onGoRealtime,
}: {
  skin: "light" | "tech"
  onGoArchive: () => void
  onGoRealtime: () => void
}) {
  const [cat, setCat] = useState<Cat>("overview")
  const [win, setWin] = useState<TimeWin>("today")
  const [street, setStreet] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [slice, setSlice] = useState<SliceState | null>(null)
  // 事件发生 · 空间分布分组粒度；已选街道时不提供「街道」分组，默认按网格
  const [spaceGran, setSpaceGran] = useState<SpaceGran>("street")

  const f = useMemo(() => {
    const sf = street ? streetFrac[street] ?? 0.1 : 1
    const base = winBase[win]
    const tf = type ? (base.typeStruct[TYPES.findIndex((t) => t.label === type)] || 0) / base.total : 1
    const ff = sf * tf
    return { sf, tf, ff, base }
  }, [win, street, type])

  const v = useMemo(() => {
    const { sf, tf, ff, base } = f
    const typeStruct = base.typeStruct.map((n, i) => ({
      label: TYPES[i].label,
      value: type ? (TYPES[i].label === type ? scale(base.total, ff) : 0) : scale(n, sf),
      color: TYPES[i].color,
    })).filter((d) => d.value > 0)
    const total = scale(base.total, ff)
    const closedAll = scale(base.closedCase + base.closedNonCase, ff)
    const hourly = base.hourly.map((n) => scale(n, ff))
    const cameras = base.cameras
      .map((c) => ({
        id: c.name,
        point: CAMERA_PLACE[c.name]?.point ?? "",
        place: CAMERA_PLACE[c.name]?.place ?? "",
        value: scale(c.value, ff),
      }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
    // 空间分布（发现，流水类）：随顶部空间 / 类型 / 时间变；已选街道时无「街道」粒度
    const gran: SpaceGran = street && spaceGran === "street" ? "grid" : spaceGran
    const distBase =
      street
        ? gran === "lane"
          ? laneFlowFor(street, win)
          : gridFlowFor(street, win)
        : gran === "street"
          ? streetDist[win]
          : gran === "grid"
            ? gridDistAll[win]
            : laneDistAll[win]
    const spaceDist = distBase
      .map((d) => ({ name: d.name, value: scale(d.value, tf) }))
      .filter((d) => d.value > 0)
    const severeSpace = street
      ? gridDistFor(street).map((d) => ({ name: d.name, value: Math.max(0, d.value - 1) }))
      : nowBase.severeByStreet.map((d) => ({ ...d, value: scale(d.value, sf) }))
    const stages = nowBase.stages.map((s) => ({ ...s, value: scale(s.value, sf) }))
    const sustained = stages.reduce((a, b) => a + b.value, 0)
    const severe = scale(nowBase.severeByStreet.reduce((a, b) => a + b.value, 0), sf)
    const sustainedTypes = nowBase.sustainedTypes.map((n, i) => ({
      label: TYPES[i].label,
      value: scale(n, sf),
      color: TYPES[i].color,
    }))
    const gridOnDuty = nowBase.gridOnDuty.map((g) => ({ name: g.name, value: scale(g.value, sf) }))
    // 治理质量 + AI 成效：按时间区间计（流水类），随 win / 空间 / 类型变
    const q = winQuality[win]
    const quality = {
      valid: scale(q.valid, ff),
      invalid: scale(q.invalid, ff),
      dissipated: scale(q.dissipated, ff),
      effectiveRate: pct(scale(q.valid, ff), scale(q.valid + q.invalid, ff)),
      returnRate: pct(scale(q.returned, ff), scale(q.inspected, ff)),
    }
    const aiRates = {
      discoveryRate: pct(scale(q.discoveryValid, ff), scale(q.discoveryCandidates, ff)),
      prefillType: pct(scale(q.prefillMatch, ff), scale(q.prefillTotal, ff)),
      suggestMatch: pct(scale(q.suggestMatch, ff), scale(q.suggestTotal, ff)),
      spaceFail: scale(q.spaceFail, ff),
    }
    const fb = winFunnel[win]
    const funnel: Record<FunnelKey, number> = {
      found: scale(fb.found, ff),
      reviewed: scale(fb.reviewed, ff),
      filed: scale(fb.filed, ff),
      disposed: scale(fb.disposed, ff),
      inspected: scale(fb.inspected, ff),
    }
    return {
      total, closedAll, typeStruct, hourly, cameras, spaceDist, severeSpace,
      stages, sustained, severe, sustainedTypes, gridOnDuty, quality, aiRates, funnel,
      closedCase: scale(base.closedCase, ff), closedNonCase: scale(base.closedNonCase, ff),
    }
  }, [f, win, street, type, spaceGran])

  const filterMeta = `${WINS.find((w) => w.id === win)!.label} · ${street ?? "全区"} · ${type ?? "全部类型"}`

  // 「流程运行」整页都是积压（截止此刻），时间筛在本页不可用
  const timeLocked = cat === "process"

  function openSlice(s: Omit<SliceState, "rows"> & { rows?: EvRow[] }) {
    setSlice({ ...s, rows: s.rows ?? [] })
  }

  // ── 解读（只引用已展示实算数；— 或未画的不写） ──
  const insight = useMemo(() => {
    if (cat === "overview") {
      return `${filterMeta}：新发现 ${v.total} 件、闭环 ${v.closedAll} 件（结案 ${v.closedCase}、作废/无效 ${v.closedNonCase}）。此刻存续 ${v.sustained} 件、其中严重 ${v.severe} 件；待立案 ${v.stages[0].value} 件是当前最大环节${street ? "" : "，严重件以朝阳门街道（2 件）居首"}。`
    }
    if (cat === "events") {
      const topType = v.typeStruct.length
        ? v.typeStruct.reduce((a, b) => (b.value > a.value ? b : a))
        : null
      const topSpace = v.spaceDist[0]
      const peakHour = v.hourly.indexOf(Math.max(...v.hourly))
      const topCam = v.cameras[0]
      return [
        `${filterMeta}：新发现 ${v.total} 件。`,
        topType ? `「${topType.label}」${topType.value} 件最多；` : "",
        topSpace ? `${topSpace.name} ${topSpace.value} 件最集中；` : "",
        v.hourly.some((n) => n > 0) ? `${String(peakHour).padStart(2, "0")} 时前后为高发时段；` : "",
        topCam ? `高发点位 ${topCam.point || topCam.id}（${topCam.id}）${topCam.value} 件。` : "",
      ].join("")
    }
    if (cat === "process") {
      return `截止此刻（不随时间筛选）：待立案 ${v.stages[0].value}、待处置 ${v.stages[1].value}、待核查 ${v.stages[2].value}、待作废审核 ${v.stages[3].value}，合计存续 ${v.sustained} 件。网格侧 ${v.gridOnDuty[0]?.name ?? "—"} 在办 ${v.gridOnDuty[0]?.value ?? 0} 件最多。`
    }
    return `${filterMeta}：区间内立案有效 ${v.quality.valid} 件、已无效 ${v.quality.invalid} 件、自然消散 ${v.quality.dissipated} 件；事件有效率 ${v.quality.effectiveRate}、退回率 ${v.quality.returnRate}。AI 成效（按区间计）：发现有效率 ${v.aiRates.discoveryRate}、预填类型一致率 ${v.aiRates.prefillType}、建议一致率 ${v.aiRates.suggestMatch}；空间匹配失败 ${v.aiRates.spaceFail} 件，待收敛。`
  }, [cat, v, filterMeta, street])

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 28px" }}>
      {/* 页头 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", margin: 0 }}>
              AI 统计
            </h1>
            <span
              style={{
                fontSize: 10, fontWeight: 800, color: "#fff", background: `linear-gradient(135deg, ${C.primary}, ${C.cyan})`,
                padding: "2px 8px", borderRadius: 999, letterSpacing: "0.04em",
              }}
            >
              2.0
            </span>
            <RuleChips id="page" userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 5, fontWeight: 500 }}>
            在给定筛选下看结构与成效 · 不办理、不在这里结案 · 数字均为示例
          </div>
        </div>
      </div>

      {/* 筛选条 */}
      <div
        className="glass-card"
        style={{
          padding: "10px 14px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div
            aria-disabled={timeLocked}
            style={{
              display: "flex", gap: 4, background: "var(--card-2)", borderRadius: 10, padding: 3,
              opacity: timeLocked ? 0.4 : 1,
            }}
          >
            {WINS.map((w) => (
              <button
                key={w.id}
                disabled={timeLocked}
                onClick={() => setWin(w.id)}
                title={timeLocked ? "本页看当前积压，不按时间段统计" : undefined}
                style={{
                  border: "none", cursor: timeLocked ? "not-allowed" : "pointer",
                  padding: "5px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: win === w.id ? 800 : 600,
                  background: win === w.id ? (timeLocked ? "var(--muted-foreground)" : "var(--primary)") : "transparent",
                  color: win === w.id ? "#fff" : C.muted,
                  transition: "all .15s ease",
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
          {timeLocked ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 700 }}>
                时间筛选在本页不可用 · 本页看当前积压，不按时间段统计
              </span>
              <RuleChip id="filter_time_locked" label="?" round rules={STATS2_USER_RULES} headerLabel="用户口径" />
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                作用于发现、闭环、类型/空间结构
              </span>
              <RuleChip id="filter_time" label="?" round rules={STATS2_USER_RULES} headerLabel="用户口径" />
            </span>
          )}
        </div>
        <select
          value={street ?? ""}
          onChange={(e) => setStreet(e.target.value || null)}
          className="tech-select"
          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: C.text, cursor: "pointer" }}
          aria-label="空间筛选（到街道）"
        >
          <option value="">空间：全区</option>
          {STREETS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={type ?? ""}
          onChange={(e) => setType(e.target.value || null)}
          className="tech-select"
          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: C.text, cursor: "pointer" }}
          aria-label="类型筛选"
        >
          <option value="">类型：全部</option>
          {TYPES.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginLeft: "auto" }}>
          东城区 · 全区范围 · 相机识别
        </span>
      </div>

      {/* 四类导航 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            title={c.hint}
            style={{
              cursor: "pointer", padding: "8px 18px", borderRadius: 999,
              border: `1px solid ${cat === c.id ? "transparent" : C.border}`,
              background: cat === c.id ? `linear-gradient(135deg, ${C.primary}, ${C.cyan})` : "var(--card)",
              color: cat === c.id ? "#fff" : C.muted,
              fontSize: 13, fontWeight: cat === c.id ? 800 : 600,
              boxShadow: cat === c.id ? "0 6px 18px rgba(50,109,255,0.30)" : "none",
              transition: "all .15s ease",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* AI 解读 */}
      <div
        className="glass-card"
        style={{
          padding: "14px 18px", marginBottom: 18,
          display: "flex", alignItems: "flex-start", gap: 14,
          background: `linear-gradient(105deg, rgba(91,141,255,0.10) 0%, var(--card) 55%, rgba(46,230,224,0.06) 100%)`,
          borderLeft: `3px solid ${C.primary}`,
        }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.primary} 0%, ${C.cyan} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 11.5, fontWeight: 800,
          }}
        >
          AI
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.primary, fontWeight: 800, marginBottom: 4, letterSpacing: "0.03em" }}>
            AI 解读 · 只引用本页已展示的实算数
          </div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75, fontWeight: 500 }}>{insight}</div>
        </div>
      </div>

      {/* ── 1 综合态势 ── */}
      {cat === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 流水区：随时间筛选变 */}
          <SectionHead label="区间流水（随时间筛选变）" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <KpiCard2
              label="事件总数" value={v.total} unit="件" color={C.primary} icon="archive" ruleId="ov_total"
              sub={`${filterMeta} · 按发现时间归日`}
              onClick={v.total >= 1 ? () => openSlice({
                title: "事件总数", userLine: STATS2_USER_RULES.ov_total.lines[0], kind: "终态",
                rows: filterPool({ street, type, stages: EVENT_POOL.map((e) => e.stage) }),
              }) : undefined}
            />
            <KpiCard2
              label={CLOSED_LABEL[win]} value={v.closedAll} unit="件" color={C.success} icon="checkCircle" ruleId="ov_closed"
              sub={`结案 ${v.closedCase} 件 · 作废/无效 ${v.closedNonCase} 件`}
              onClick={v.closedAll >= 1 ? () => openSlice({
                title: CLOSED_LABEL[win], userLine: STATS2_USER_RULES.ov_closed.lines[0], kind: "终态",
                rows: filterPool({ street, type, stages: ["已结案", "已作废", "已无效"] }),
              }) : undefined}
            />
          </div>

          {/* 链路吞吐（流水漏斗）：区间各环节过了多少件；与下方积压区严格区分 */}
          <div
            className="glass-card"
            style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text, letterSpacing: "0.02em" }}>
                链路吞吐
              </span>
              <RuleChips id="funnel" userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
              <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>
                识别 → 审核 → 立案 → 处置 → 核查 · 按所选时间区间计，改时间会变 · 这是吞吐，不是现在压着多少
              </span>
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
                        <span
                          style={{
                            fontSize: 10.5, fontWeight: 700, color: C.muted,
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {pct(val, prev ?? 0)}
                        </span>
                      </div>
                    )}
                    <div
                      onClick={val >= 1 ? () => openSlice({
                        title: `链路吞吐 · ${s.label}`,
                        userLine: STATS2_USER_RULES[s.ruleId].lines[0],
                        kind: "终态",
                        rows: filterPool({ street, type, stages: FUNNEL_SLICE_STAGES[s.key] }),
                      }) : undefined}
                      title={val >= 1 ? "点击查看切片" : undefined}
                      style={{
                        flex: 1, minWidth: 150,
                        padding: "12px 14px",
                        background: "var(--card-2)",
                        border: `1px solid ${C.borderLight}`,
                        borderRadius: 12,
                        display: "flex", flexDirection: "column", gap: 7,
                        cursor: val >= 1 ? "pointer" : "default",
                        transition: "border-color .15s ease, box-shadow .15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, color: "#fff",
                            background: `linear-gradient(135deg, ${C.primary}, ${C.cyan})`,
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {i + 1}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{s.label}</span>
                        <RuleChips id={s.ruleId} userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        {val > 0 ? (
                          <span
                            className="gradient-text"
                            style={{
                              fontSize: 24, fontWeight: 800, lineHeight: 1,
                              fontFamily: "JetBrains Mono, monospace", letterSpacing: "-0.03em",
                            }}
                          >
                            {val}
                          </span>
                        ) : (
                          <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>
                            0
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>件</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600, lineHeight: 1.5 }}>
                        {s.sub}
                      </div>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </div>

          {/* 积压区：截止此刻，不随时间变，只随空间/类型变 */}
          <SectionHead label="当前积压（截止此刻，不随时间变）" tone="amber" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <KpiCard2
              label="存续事件" value={v.sustained} unit="件" color={C.warning} icon="layers" ruleId="ov_sustained"
              sub="截止此刻，不随时间变 · 四态之和"
              onClick={v.sustained >= 1 ? () => openSlice({
                title: "存续事件", userLine: STATS2_USER_RULES.ov_sustained.lines[0], kind: "存续",
                rows: filterPool({ street, type }),
              }) : undefined}
            />
            <KpiCard2
              label="严重事件" value={v.severe} unit="件" color={C.danger} icon="alertTriangle" ruleId="ov_severe"
              sub="存续中等级为严重 · 截止此刻"
              onClick={v.severe >= 1 ? () => openSlice({
                title: "严重事件", userLine: STATS2_USER_RULES.ov_severe.lines[0], kind: "存续",
                rows: filterPool({ street, severe: true }),
              }) : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            <ChartCard2
              title="各阶段待处理" ruleId="ov_stages"
              note="截止此刻 · 改时间不变，改空间/类型变"
              sliceEnabled={v.sustained >= 1}
              onSlice={() => openSlice({
                title: "各阶段待处理", userLine: STATS2_USER_RULES.ov_stages.lines[0], kind: "存续",
                rows: filterPool({ street, type }),
              })}
            >
              <EchartsBar
                data={v.stages.map((s) => s.value)}
                xAxis={v.stages.map((s) => s.label)}
                color={[C.primary, C.cyan]}
                skin={skin}
                showLabel
                height={200}
              />
            </ChartCard2>
            <ChartCard2
              title="严重问题空间" ruleId="ov_severe_space"
              note="按存续严重计 · 截止此刻"
              sliceEnabled={v.severe >= 1}
              onSlice={() => openSlice({
                title: "严重问题空间", userLine: STATS2_USER_RULES.ov_severe_space.lines[0], kind: "存续",
                rows: filterPool({ street, severe: true }),
              })}
            >
              {v.severeSpace.every((d) => d.value === 0) || v.severeSpace.length === 0 ? (
                <EmptyBox text="当前范围暂无严重事件" />
              ) : (
                <EchartsRank data={v.severeSpace} skin={skin} height={200} valueSuffix=" 件" />
              )}
            </ChartCard2>
          </div>
          <ChartCard2
            title="当前存续类型" ruleId="ov_sustained_types"
            note="按存续计 · 截止此刻"
            sliceEnabled={v.sustained >= 1}
            onSlice={() => openSlice({
              title: "当前存续类型", userLine: STATS2_USER_RULES.ov_sustained_types.lines[0], kind: "存续",
              rows: filterPool({ street }),
            })}
          >
            {v.sustained === 0 ? (
              <EmptyBox text="存续为 0，不画环" />
            ) : (
              <EchartsPie data={v.sustainedTypes} skin={skin} height={200} centerText={String(v.sustained)} centerSub="存续合计" />
            )}
          </ChartCard2>
        </div>
      )}

      {/* ── 2 事件发生 ── */}
      {cat === "events" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <KpiCard2
              label="事件总数" value={v.total} unit="件" color={C.primary} icon="archive" ruleId="ev_total"
              sub={`${filterMeta} · 按发现时间归日 · 本版均为相机识别`}
              onClick={v.total >= 1 ? () => openSlice({
                title: "事件总数", userLine: STATS2_USER_RULES.ev_total.lines[0], kind: "终态",
                rows: filterPool({ street, type, stages: EVENT_POOL.map((e) => e.stage) }),
              }) : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            <ChartCard2
              title="类型结构" ruleId="ev_type_struct"
              sliceEnabled={v.total >= 1}
              onSlice={() => openSlice({
                title: "类型结构", userLine: STATS2_USER_RULES.ev_type_struct.lines[0], kind: "终态",
                rows: filterPool({ street, type, stages: EVENT_POOL.map((e) => e.stage) }),
              })}
            >
              {v.total === 0 ? (
                <EmptyBox text="事件总数为 0，不画环" />
              ) : (
                <EchartsPie data={v.typeStruct} skin={skin} height={200} centerText={String(v.total)} centerSub="事件总数" />
              )}
            </ChartCard2>
            <ChartCard2
              title="空间分布" ruleId="ev_space_dist"
              note={street
                ? `已选 ${street}：按网格 / 街巷分组 · 随上方类型、时间变`
                : "全区：按街道 / 网格 / 街巷分组 · 随上方类型、时间变"}
              sliceEnabled={v.total >= 1}
              onSlice={() => openSlice({
                title: "空间分布", userLine: STATS2_USER_RULES.ev_space_dist.lines[0], kind: "终态",
                rows: filterPool({ street, type, stages: EVENT_POOL.map((e) => e.stage) }),
              })}
            >
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 2, background: "var(--card-2)", borderRadius: 8, padding: 2 }}>
                  {(street ? (["grid", "lane"] as SpaceGran[]) : (["street", "grid", "lane"] as SpaceGran[])).map((g) => (
                    <button
                      key={g}
                      onClick={() => setSpaceGran(g)}
                      style={{
                        border: "none", cursor: "pointer", padding: "3px 12px", borderRadius: 6,
                        fontSize: 11, fontWeight: (street && spaceGran === "street" ? "grid" : spaceGran) === g ? 800 : 600,
                        background: (street && spaceGran === "street" ? "grid" : spaceGran) === g ? "var(--primary)" : "transparent",
                        color: (street && spaceGran === "street" ? "grid" : spaceGran) === g ? "#fff" : C.muted,
                        transition: "all .15s ease",
                      }}
                    >
                      {GRAN_LABEL[g]}
                    </button>
                  ))}
                </div>
              </div>
              {v.spaceDist.length === 0 ? (
                <EmptyBox text="当前范围暂无事件" />
              ) : (
                <EchartsRank data={v.spaceDist} skin={skin} height={200} valueSuffix=" 件" />
              )}
            </ChartCard2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            <ChartCard2
              title="发生时段" ruleId="ev_hourly"
              note="按发现小时 0–23；24 柱可全 0"
              sliceEnabled={v.hourly.some((n) => n >= 1)}
              onSlice={() => openSlice({
                title: "发生时段", userLine: STATS2_USER_RULES.ev_hourly.lines[0], kind: "终态",
                rows: filterPool({ street, type, stages: EVENT_POOL.map((e) => e.stage) }),
              })}
            >
              <EchartsBar data={v.hourly} xAxis={HOURLY_LABELS} color={[C.cyan, C.primary]} skin={skin} height={200} />
            </ChartCard2>
            <ChartCard2
              title="高发相机" ruleId="ev_top_cameras"
              note="行内为可读点位名，相机编号作次要；无相机 ID 的不进榜"
              sliceEnabled={v.cameras.length >= 1}
              onSlice={() => openSlice({
                title: "高发相机", userLine: STATS2_USER_RULES.ev_top_cameras.lines[0], kind: "终态",
                rows: filterPool({ street, type, stages: EVENT_POOL.map((e) => e.stage) }),
              })}
            >
              {v.cameras.length === 0 ? (
                <EmptyBox text="当前范围暂无带相机 ID 的事件" />
              ) : (
                <CameraRank data={v.cameras} />
              )}
            </ChartCard2>
          </div>
        </div>
      )}

      {/* ── 3 流程运行 ── */}
      {cat === "process" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionHead label="当前积压（截止此刻，不随时间变）" tone="amber" />
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, padding: "0 2px" }}>
            本页看当前积压，不按时间段统计：下面的数字是现在压着多少，不是这段时间新进了多少；改时间不变，改空间 / 类型会变。
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <KpiCard2
              label="待立案" value={v.stages[0].value} unit="件" color={C.primary} icon="filePlus" ruleId="pr_pending"
              onClick={v.stages[0].value >= 1 ? () => openSlice({
                title: "待立案", userLine: STATS2_USER_RULES.pr_pending.lines[0], kind: "存续",
                rows: filterPool({ street, type, stages: ["待立案"] }),
              }) : undefined}
            />
            <KpiCard2
              label="待处置" value={v.stages[1].value} unit="件" color={C.warning} icon="layers" ruleId="pr_dispose"
              onClick={v.stages[1].value >= 1 ? () => openSlice({
                title: "待处置", userLine: STATS2_USER_RULES.pr_dispose.lines[0], kind: "存续",
                rows: filterPool({ street, type, stages: ["待处置"] }),
              }) : undefined}
            />
            <KpiCard2
              label="待核查" value={v.stages[2].value} unit="件" color={C.purple} icon="search" ruleId="pr_inspect"
              onClick={v.stages[2].value >= 1 ? () => openSlice({
                title: "待核查", userLine: STATS2_USER_RULES.pr_inspect.lines[0], kind: "存续",
                rows: filterPool({ street, type, stages: ["待核查"] }),
              }) : undefined}
            />
            <KpiCard2
              label="待作废审核" value={v.stages[3].value} unit="件" color={C.danger} icon="xCircle" ruleId="pr_void"
              onClick={v.stages[3].value >= 1 ? () => openSlice({
                title: "待作废审核", userLine: STATS2_USER_RULES.pr_void.lines[0], kind: "存续",
                rows: filterPool({ street, type, stages: ["待作废审核"] }),
              }) : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            <ChartCard2
              title="环节存量" ruleId="pr_stages"
              note="截止此刻 · 四柱之和 = 存续事件；待立案不含自然消散；0 柱保留、不可点开切片"
              sliceEnabled={v.sustained >= 1}
              onSlice={() => openSlice({
                title: "环节存量", userLine: STATS2_USER_RULES.pr_stages.lines[0], kind: "存续",
                rows: filterPool({ street, type }),
              })}
            >
              <EchartsBar
                data={v.stages.map((s) => s.value)}
                xAxis={v.stages.map((s) => s.label)}
                color={[C.warning, C.primary]}
                skin={skin}
                showLabel
                height={200}
              />
            </ChartCard2>
            <ChartCard2
              title="责任网格在办" ruleId="pr_grid"
              note="截止此刻 · 待处置按派发网格计数（负荷，不是快慢）"
              sliceEnabled={v.gridOnDuty.some((d) => d.value >= 1)}
              onSlice={() => openSlice({
                title: "责任网格在办", userLine: STATS2_USER_RULES.pr_grid.lines[0], kind: "存续",
                rows: filterPool({ street, type, stages: ["待处置"] }),
              })}
            >
              {v.gridOnDuty.every((d) => d.value === 0) || v.gridOnDuty.length === 0 ? (
                <EmptyBox text="当前范围暂无网格在办事件" />
              ) : (
                <EchartsRank data={v.gridOnDuty} skin={skin} height={200} valueSuffix=" 件" />
              )}
            </ChartCard2>
          </div>
        </div>
      )}

      {/* ── 4 治理质量与 AI 成效 ── */}
      {cat === "quality" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, padding: "0 2px" }}>
            本区均为流水口径：按所选时间区间统计，改时间会变；空间 / 类型仍可筛。
          </div>
          <SectionHead label="治理质量" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            <ChartCard2
              title="有效 / 无效 / 消散" ruleId="ql_composition"
              sliceEnabled={v.quality.valid + v.quality.invalid + v.quality.dissipated >= 1}
              onSlice={() => openSlice({
                title: "有效 / 无效 / 消散", userLine: STATS2_USER_RULES.ql_composition.lines[0], kind: "终态",
                rows: filterPool({ street, stages: ["已结案", "已作废", "已无效", "待立案"] }),
              })}
            >
              {v.quality.valid + v.quality.invalid + v.quality.dissipated === 0 ? (
                <EmptyBox text="之和为 0，不画环" />
              ) : (
                <EchartsPie
                  data={[
                    { label: "立案有效", value: v.quality.valid, color: C.primary },
                    { label: "已无效", value: v.quality.invalid, color: C.danger },
                    { label: "自然消散", value: v.quality.dissipated, color: C.muted },
                  ]}
                  skin={skin}
                  height={200}
                  centerText={String(v.quality.valid + v.quality.invalid + v.quality.dissipated)}
                  centerSub="构成合计"
                />
              )}
            </ChartCard2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, alignContent: "start" }}>
              <KpiCard2
                label="事件有效率" value={v.quality.effectiveRate} color={C.success} icon="target" ruleId="ql_effective_rate"
                sub={`立案有效 ${v.quality.valid} 件 · 候选不含自然消散`}
                onClick={() => openSlice({
                  title: "事件有效率", userLine: STATS2_USER_RULES.ql_effective_rate.lines[0], kind: "终态",
                  rows: filterPool({ street, stages: ["已结案", "已作废", "已无效", "待立案"] }),
                })}
              />
              <KpiCard2
                label="退回率" value={v.quality.returnRate} color={C.warning} icon="refreshCw" ruleId="ql_return_rate"
                sub="曾核查退回 · 一件多次计 1"
                onClick={() => openSlice({
                  title: "退回率", userLine: STATS2_USER_RULES.ql_return_rate.lines[0], kind: "终态",
                  rows: filterPool({ street, stages: ["待核查", "已结案"] }),
                })}
              />
              <KpiCard2
                label="一次核查通过率" value="—" color={C.purple} icon="checkSquare" ruleId="ql_first_pass"
                sub="本版字段未齐，暂不计算"
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <SectionHead label="AI 成效" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <KpiCard2
              label="发现有效率" value={v.aiRates.discoveryRate} color={C.primary} icon="target" ruleId="ai_discovery_rate"
              sub="区间内 · 相机识别候选中最终要办的占比"
              onClick={() => openSlice({
                title: "发现有效率", userLine: STATS2_USER_RULES.ai_discovery_rate.lines[0], kind: "终态",
                rows: filterPool({ street, stages: EVENT_POOL.map((e) => e.stage) }),
              })}
            />
            <KpiCard2
              label="预填少改" value={v.aiRates.prefillType} color={C.cyan} icon="checkSquare" ruleId="ai_prefill_type"
              sub="区间内 · 类型预填与人工最终一致"
              onClick={() => openSlice({
                title: "预填少改", userLine: STATS2_USER_RULES.ai_prefill_type.lines[0], kind: "终态",
                rows: filterPool({ street, stages: EVENT_POOL.map((e) => e.stage) }),
              })}
            />
            <KpiCard2
              label="建议一致率" value={v.aiRates.suggestMatch} color={C.purple} icon="thumbsUp" ruleId="ai_suggest_match"
              sub="区间内 · Agent 建议与人工最终判断一致"
              onClick={() => openSlice({
                title: "建议一致率", userLine: STATS2_USER_RULES.ai_suggest_match.lines[0], kind: "终态",
                rows: filterPool({ street, stages: EVENT_POOL.map((e) => e.stage) }),
              })}
            />
            <KpiCard2
              label="空间匹配失败" value={v.aiRates.spaceFail} unit="件" color={C.warning} icon="mapPin" ruleId="ai_space_fail"
              sub="按区间计 · 曾为空间匹配失败 · 次要"
              onClick={v.aiRates.spaceFail >= 1 ? () => openSlice({
                title: "空间匹配失败", userLine: STATS2_USER_RULES.ai_space_fail.lines[0], kind: "存续",
                rows: filterPool({ street, type, stages: ["待立案"] }),
              }) : undefined}
            />
          </div>
          <div
            style={{
              fontSize: 12, color: C.muted, fontWeight: 600, lineHeight: 1.8,
              padding: "10px 14px", background: "var(--card-2)", borderRadius: 10,
            }}
          >
            本版不展示：AI 整体覆盖率、减负省时、群众满意度、返工原因；分类 / 位置 / 网格三张准确率不并排，收敛为「预填少改」一张。
          </div>
        </div>
      )}

      <SliceDrawer
        slice={slice}
        onClose={() => setSlice(null)}
        onGoArchive={onGoArchive}
        onGoRealtime={onGoRealtime}
      />
    </div>
  )
}
