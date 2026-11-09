import { Fragment, useMemo, useRef, useState } from "react"
import EchartsBar from "../components/EchartsBar"
import EchartsPie from "../components/EchartsPie"
import EchartsRank from "../components/EchartsRank"
import KpiIcon from "../components/KpiIcon"
import { RuleChips } from "../data/dashboardRules"
import { STATS2_ALGO_RULES, STATS2_USER_RULES } from "../data/statsV2Rules"

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
  { id: "process", label: "流程运行", hint: "现在各环节压着多少（截止此刻）" },
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

const CAMERA_DEFS = [
  { id: "C-A11-03", point: "雍和宫大街·国子监街口", place: "北新桥街道 · 北新桥-04网格", weight: 0.16 },
  { id: "C-C07-11", point: "王府井步行街北口", place: "东华门街道 · 东华门-02网格", weight: 0.14 },
  { id: "C-B03-02", point: "东四北大街·钱粮胡同口", place: "东四街道 · 东四-01网格", weight: 0.12 },
  { id: "C-E01-02", point: "朝阳门南小街·竹竿胡同口", place: "朝阳门街道 · 朝阳门-01网格", weight: 0.1 },
  { id: "C-A02-08", point: "安定门内大街·车辇店胡同口", place: "安定门街道 · 安定门-02网格", weight: 0.08 },
  { id: "C-A07-04", point: "交道口南大街·府学胡同口", place: "安定门街道 · 安定门-01网格", weight: 0.07 },
  { id: "C-D04-01", point: "和平里中街·街心公园东门", place: "和平里街道 · 和平里-01网格", weight: 0.05 },
]

// 区间流水：闭环（按时间窗变）
const WIN_CLOSED: Record<TimeWin, { closedCase: number; closedNonCase: number }> = {
  today: { closedCase: 2, closedNonCase: 1 },
  "7d": { closedCase: 13, closedNonCase: 4 },
  "30d": { closedCase: 44, closedNonCase: 12 },
}

// 链路吞吐：各阶按本环节完成时间计，件数不必逐阶变少
const WIN_FUNNEL: Record<TimeWin, { reviewed: number; filed: number; disposed: number; inspected: number }> = {
  today: { reviewed: 3, filed: 2, disposed: 2, inspected: 2 },
  "7d": { reviewed: 17, filed: 15, disposed: 9, inspected: 6 },
  "30d": { reviewed: 59, filed: 55, disposed: 33, inspected: 22 },
}

const FUNNEL_STAGES: { key: "found" | "reviewed" | "filed" | "disposed" | "inspected"; label: string; sub: string; ruleId: string }[] = [
  { key: "found", label: "识别", sub: "区间新发现", ruleId: "funnel_found" },
  { key: "reviewed", label: "审核", sub: "区间审完（有效+无效）", ruleId: "funnel_reviewed" },
  { key: "filed", label: "立案", sub: "区间立案派发成功", ruleId: "funnel_filed" },
  { key: "disposed", label: "处置", sub: "区间处置完成", ruleId: "funnel_disposed" },
  { key: "inspected", label: "核查", sub: "区间核查结案", ruleId: "funnel_inspected" },
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
    discoveryValid: 4, discoveryCandidates: 5,
    prefillMatch: 4, prefillTotal: 5, suggestMatch: 4, suggestTotal: 5,
    spaceFail: 1,
  },
  "7d": {
    valid: 15, invalid: 2, dissipated: 1, returned: 2, inspected: 27,
    discoveryValid: 14, discoveryCandidates: 18,
    prefillMatch: 15, prefillTotal: 18, suggestMatch: 13, suggestTotal: 16,
    spaceFail: 3,
  },
  "30d": {
    valid: 52, invalid: 7, dissipated: 3, returned: 8, inspected: 96,
    discoveryValid: 47, discoveryCandidates: 62,
    prefillMatch: 49, prefillTotal: 62, suggestMatch: 44, suggestTotal: 57,
    spaceFail: 9,
  },
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
    const s = street.slice(0, 3)
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

// ─── 卡片 / 图壳 ─────────────────────────────────────────────────────────────
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
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.02em" }}>{label}</span>
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
  title, children, ruleId, onSlice, sliceEnabled, note, extra,
}: {
  title: string
  children: React.ReactNode
  ruleId: string
  onSlice?: () => void
  sliceEnabled?: boolean
  note?: string
  extra?: React.ReactNode
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
  cameras, onItemClick,
}: {
  cameras: { id: string; point: string; value: number }[]
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
    </div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function AIStatisticsV2({ skin }: { skin: "light" | "tech" }) {
  const [cat, setCat] = useState<Cat>("overview")
  // 切 tab 不重置筛选；进入流程运行只置灰时间，不改写这里的选择
  const [win, setWin] = useState<TimeWin>("today")
  const [street, setStreet] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [spaceGran, setSpaceGran] = useState<SpaceGran>("street")
  const [slice, setSlice] = useState<SliceState | null>(null)
  // 进入流程运行时记住时间；切回其他 tab 时恢复，不偷偷改成「今日」
  const winBeforeProcess = useRef<TimeWin | null>(null)

  const filterMeta = `${WIN_LABEL[win]} · ${street ?? "东城全区"} · ${type ?? "全部类型"}`
  const backlogMeta = `截止此刻 · ${street ?? "东城全区"} · ${type ?? "全部类型"}`

  const handleCatChange = (next: Cat) => {
    if (next === "process" && cat !== "process") {
      winBeforeProcess.current = win
    } else if (cat === "process" && next !== "process" && winBeforeProcess.current !== null) {
      setWin(winBeforeProcess.current)
      winBeforeProcess.current = null
    }
    setCat(next)
  }

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

    // 链路吞吐（流水）
    const closedCase = Math.round(WIN_CLOSED[win].closedCase * ff)
    const closedNonCase = Math.round(WIN_CLOSED[win].closedNonCase * ff)
    const closedAll = closedCase + closedNonCase
    const fb = WIN_FUNNEL[win]
    const funnel = {
      found: total,
      reviewed: Math.round(fb.reviewed * ff),
      filed: Math.round(fb.filed * ff),
      disposed: Math.round(fb.disposed * ff),
      inspected: Math.round(fb.inspected * ff),
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
      ? [1, 2, 3].map((i) => `${street.slice(0, 3)}-0${i}网格`)
      : BACKLOG_GRID_NAMES
    const gridWeights = street ? STREET_GRID_WEIGHTS : BACKLOG_GRID_WEIGHTS
    const gridValues = alloc(pendingDispose, gridWeights)
    const gridOnDuty = gridNames
      .map((name, i) => ({ name, value: gridValues[i] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)

    // 治理质量与 AI 成效：按所选时间区间计
    const q = WIN_QUALITY[win]
    const valid = Math.round(q.valid * ff)
    const invalid = Math.round(q.invalid * ff)
    const dissipated = Math.round(q.dissipated * ff)
    const returned = Math.round(q.returned * ff)
    const inspected = Math.round(q.inspected * ff)
    const discoveryCandidates = Math.round(q.discoveryCandidates * ff)
    const discoveryValid = Math.min(discoveryCandidates, Math.round(q.discoveryValid * ff))
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

    return {
      total, typeStruct, hourly, peakHour, spaceDist, spaceTop, effectiveGran,
      cameras, camerasWithoutId, closedCase, closedNonCase, closedAll, funnel,
      stages, sustained, severe, severeSpace, severeTop, sustainedTypes, gridOnDuty,
      quality, aiRates,
    }
  }, [win, street, type, spaceGran])

  function openSlice(title: string, count: number, kind: "flow" | "backlog", rows: EvRow[]) {
    if (count < 1) return
    const caliber = `${kind === "flow" ? filterMeta : backlogMeta} · ${title} · ${count} 件`
    setSlice({
      title,
      caliber,
      rows: rows.length > 0 ? rows : EVENT_POOL.slice(0, 3),
    })
  }

  const sliceRows = (opts: { stages?: string[]; severe?: boolean }) =>
    filterPool({ street, type, ...opts })

  // ── AI 解读：只引用当前 tab、当前筛选下已经显示出来的数 ──
  const insight = useMemo(() => {
    if (cat === "overview") {
      if (v.total === 0 && v.sustained === 0) return `${filterMeta}：当前范围没有可展示的事件。`
      const parts: string[] = [
        `${filterMeta}：新发现 ${v.total} 件、区间闭环 ${v.closedAll} 件（结案 ${v.closedCase}、作废/无效 ${v.closedNonCase}）。`,
      ]
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
      const topType = v.typeStruct.reduce<{ label: string; value: number } | null>(
        (a, b) => (!a || b.value > a.value ? b : a),
        null,
      )
      const topSpace = v.spaceTop.visible[0]
      const peakHasValue = v.hourly.some((n) => n > 0)
      const topCam = v.cameras[0]
      return [
        `${filterMeta}：新发现 ${v.total} 件。`,
        topType ? `「${topType.label}」${topType.value} 件最多；` : "",
        topSpace ? `${topSpace.name} ${topSpace.value} 件最集中；` : "",
        peakHasValue ? `${String(v.peakHour).padStart(2, "0")} 时前后为高发时段；` : "",
        topCam ? `高发点位 ${topCam.point}（${topCam.id}）${topCam.value} 件。` : "",
      ].join("")
    }

    if (cat === "process") {
      if (v.sustained === 0) return `${backlogMeta}：截止此刻没有存续事件。`
      const topGrid = v.gridOnDuty[0]
      return `${backlogMeta}：待立案 ${v.stages[0].value}、待处置 ${v.stages[1].value}、待核查 ${v.stages[2].value}、待作废审核 ${v.stages[3].value}，合计存续 ${v.sustained} 件。${topGrid ? `${topGrid.name} 在办 ${topGrid.value} 件最多。` : ""}`
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

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 28px" }}>
      {/* 筛选条：本页第一屏，滚动时保持可见；只有时间 / 空间 / 类型三项 */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20,
          padding: "10px 14px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          background: "var(--panel-solid, #fff)",
          border: `1px solid ${C.border}`, borderRadius: 12,
        }}
      >
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

      {/* 四类导航：下划线标明当前类 */}
      <div style={{ display: "flex", gap: 22, marginBottom: 10, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => handleCatChange(c.id)}
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

      {/* 当前类的一句话解读：普通正文，不做卡片 */}
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75, fontWeight: 500, marginBottom: 16 }}>
        {insight}
      </div>

      {/* ── 1 综合态势 ── */}
      {cat === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionHead label="区间流水（随时间、空间、类型变）" />
          <div className="stats-kpi-grid">
            <KpiCard2
              label="事件总数" value={v.total} unit="件" color={C.primary} icon="archive" ruleId="ov_total"
              sub={`${filterMeta} · 按发现时间归日`}
              onClick={v.total >= 1 ? () => openSlice("事件总数", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
            />
            <KpiCard2
              label="区间闭环" value={v.closedAll} unit="件" color={C.success} icon="checkCircle" ruleId="ov_closed"
              sub={`结案 ${v.closedCase} 件 · 作废/无效 ${v.closedNonCase} 件`}
              onClick={v.closedAll >= 1 ? () => openSlice("区间闭环", v.closedAll, "flow", sliceRows({ stages: ["已结案", "已作废", "无效"] })) : undefined}
            />
          </div>

          {/* 链路吞吐：横向五阶，不是漏斗 */}
          <div className="glass-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text, letterSpacing: "0.02em" }}>链路吞吐</span>
              <RuleChips id="funnel" userRules={STATS2_USER_RULES} algoRules={STATS2_ALGO_RULES} />
              <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>
                识别 → 审核 → 立案 → 处置 → 核查 · 各阶按本环节完成时间计
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
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>各阶按本环节完成时间计</div>
          </div>

          {/* 当前积压：浅底细边框整段包住 */}
          <div className="stats-backlog">
            <SectionHead label="当前积压（截止此刻，不随时间变，随空间、类型变）" />
            <div className="stats-kpi-grid">
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
            <div className="stats-chart-grid">
              <ChartCard2
                title="各阶段待处理" ruleId="ov_stages"
                note="截止此刻 · 改时间不变，改空间/类型变 · 与流程运行「环节存量」同口径"
                sliceEnabled={v.sustained >= 1}
                onSlice={() => openSlice("各阶段待处理", v.sustained, "backlog", sliceRows({}))}
              >
                <StageBar values={v.stages.map((s) => s.value)} skin={skin} onItemClick={(name) => {
                  const idx = STAGE_META.findIndex((s) => s.label === name)
                  if (idx >= 0) stageTop(idx)
                }} />
              </ChartCard2>
              <ChartCard2
                title="严重问题空间" ruleId="ov_severe_space"
                extra={<GranToggle street={street} value={v.effectiveGran} onChange={setSpaceGran} />}
                note={`按存续严重计 · 截止此刻${v.severeTop.restCount > 0 ? ` · 其余 ${v.severeTop.restCount} 个合计 ${v.severeTop.restSum} 件` : ""}`}
                sliceEnabled={v.severe >= 1}
                onSlice={() => openSlice("严重问题空间", v.severe, "backlog", sliceRows({ severe: true }))}
              >
                {v.severe === 0 || v.severeTop.visible.length === 0 ? (
                  <EmptyBox text="当前范围没有可计算该口径的样本" />
                ) : (
                  <EchartsRank
                    data={v.severeTop.visible}
                    skin={skin}
                    height={210}
                    valueSuffix=" 件"
                    onItemClick={(name, value) => openSlice(`严重问题空间 · ${name}`, value, "backlog", sliceRows({ severe: true }))}
                  />
                )}
              </ChartCard2>
            </div>
            <div className="stats-chart-grid">
              <ChartCard2
                title="当前存续类型" ruleId="ov_sustained_types"
                note="按存续计 · 截止此刻"
                sliceEnabled={v.sustained >= 1}
                onSlice={() => openSlice("当前存续类型", v.sustained, "backlog", sliceRows({}))}
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
          <div className="stats-kpi-grid">
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
              note={`按发现时间计${v.spaceTop.restCount > 0 ? ` · 其余 ${v.spaceTop.restCount} 个合计 ${v.spaceTop.restSum} 件` : ""}`}
              sliceEnabled={v.total >= 1}
              onSlice={() => openSlice("空间分布", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
            >
              {v.spaceTop.visible.length === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsRank
                  data={v.spaceTop.visible}
                  skin={skin}
                  height={210}
                  valueSuffix=" 件"
                  onItemClick={(name, value) => openSlice(`空间分布 · ${name}`, value, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
                />
              )}
            </ChartCard2>
          </div>

          <ChartCard2
            title="发生时段" ruleId="ev_hourly"
            note="按发现小时 0–23；没有发生的小时保留为 0；最高的一根用主色"
            sliceEnabled={v.total >= 1}
            onSlice={() => openSlice("发生时段", v.total, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
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

          <div className="stats-chart-grid">
            <ChartCard2
              title="高发相机" ruleId="ev_top_cameras"
              note={`点位名为主、相机编号为次${v.camerasWithoutId > 0 ? ` · 另有 ${v.camerasWithoutId} 件没有相机编号，未进榜` : ""}`}
              sliceEnabled={v.cameras.length >= 1}
              onSlice={() => openSlice("高发相机", sum(v.cameras.map((c) => c.value)), "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
            >
              {v.cameras.length === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <CameraRank
                  cameras={v.cameras}
                  onItemClick={(point, value) => openSlice(`高发相机 · ${point}`, value, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) }))}
                />
              )}
            </ChartCard2>
          </div>
        </div>
      )}

      {/* ── 3 流程运行 ── */}
      {cat === "process" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, padding: "0 2px" }}>
            这一页不按时间统计，改时间这些数不变
          </div>
          <SectionHead label="当前积压（截止此刻，不随时间变，随空间、类型变）" />
          <div className="stats-kpi-grid">
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
            note="截止此刻 · 四柱之和 = 存续事件；待立案不含自然消散；0 柱保留、不可点开切片"
            sliceEnabled={v.sustained >= 1}
            onSlice={() => openSlice("环节存量", v.sustained, "backlog", sliceRows({}))}
          >
            <StageBar values={v.stages.map((s) => s.value)} skin={skin} onItemClick={(name) => {
              const idx = STAGE_META.findIndex((s) => s.label === name)
              if (idx >= 0) stageTop(idx)
            }} />
          </ChartCard2>
          <div className="stats-chart-grid">
            <ChartCard2
              title="责任网格在办" ruleId="pr_grid"
              note="截止此刻 · 各网格当前在办件数之和 = 待处置"
              sliceEnabled={v.gridOnDuty.some((d) => d.value >= 1)}
              onSlice={() => openSlice("责任网格在办", v.stages[1].value, "backlog", sliceRows({ stages: ["待处置"] }))}
            >
              {v.gridOnDuty.length === 0 ? (
                <EmptyBox text="当前范围没有可计算该口径的样本" />
              ) : (
                <EchartsRank
                  data={v.gridOnDuty}
                  skin={skin}
                  height={210}
                  valueSuffix=" 件"
                  onItemClick={(name, value) => openSlice(`责任网格在办 · ${name}`, value, "backlog", sliceRows({ stages: ["待处置"] }))}
                />
              )}
            </ChartCard2>
          </div>
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
                sub={v.quality.effectiveDenom === 0 ? "当前范围无可计算样本" : `分子 ${v.quality.valid} 件 · 分母 ${v.quality.effectiveDenom} 件`}
                onClick={v.quality.valid >= 1 ? () => openSlice("事件有效率", v.quality.valid, "flow", sliceRows({ stages: ["已结案", "已作废", "待立案"] })) : undefined}
              />
              <KpiCard2
                label="退回率" value={v.quality.returnRate} color={C.warning} icon="refreshCw" ruleId="ql_return_rate"
                sub={v.quality.inspected === 0 ? "当前范围无可计算样本" : `分子 ${v.quality.returned} 件 · 分母 ${v.quality.inspected} 件（一件多次计 1）`}
                onClick={v.quality.returned >= 1 ? () => openSlice("退回率", v.quality.returned, "flow", sliceRows({ stages: ["待核查", "已结案"] })) : undefined}
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
          <div className="stats-kpi-grid">
            <KpiCard2
              label="发现有效率" value={v.aiRates.discoveryRate} color={C.primary} icon="target" ruleId="ai_discovery_rate"
              sub={v.aiRates.discoveryCandidates === 0 ? "当前范围无可计算样本" : `分子 ${v.aiRates.discoveryValid} 件 · 分母 ${v.aiRates.discoveryCandidates} 件`}
              onClick={v.aiRates.discoveryValid >= 1 ? () => openSlice("发现有效率", v.aiRates.discoveryValid, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
            />
            <KpiCard2
              label="预填少改" value={v.aiRates.prefillType} color={C.cyan} icon="checkSquare" ruleId="ai_prefill_type"
              sub={v.aiRates.prefillTotal === 0 ? "当前范围无可计算样本" : `分子 ${v.aiRates.prefillMatch} 件 · 分母 ${v.aiRates.prefillTotal} 件`}
              onClick={v.aiRates.prefillMatch >= 1 ? () => openSlice("预填少改", v.aiRates.prefillMatch, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
            />
            <KpiCard2
              label="建议一致率" value={v.aiRates.suggestMatch} color={C.purple} icon="thumbsUp" ruleId="ai_suggest_match"
              sub={v.aiRates.suggestTotal === 0 ? "当前范围无可计算样本" : `分子 ${v.aiRates.suggestMatchCount} 件 · 分母 ${v.aiRates.suggestTotal} 件`}
              onClick={v.aiRates.suggestMatchCount >= 1 ? () => openSlice("建议一致率", v.aiRates.suggestMatchCount, "flow", sliceRows({ stages: EVENT_POOL.map((e) => e.stage) })) : undefined}
            />
            <KpiCard2
              label="空间匹配失败" value={v.aiRates.spaceFail} unit="件" color={C.warning} icon="mapPin" ruleId="ai_space_fail"
              sub="落不到网格、还要人定点"
              onClick={v.aiRates.spaceFail >= 1 ? () => openSlice("空间匹配失败", v.aiRates.spaceFail, "flow", sliceRows({ stages: ["待立案"] })) : undefined}
            />
          </div>
          <div
            style={{
              fontSize: 12, color: C.muted, fontWeight: 600, lineHeight: 1.8,
              paddingTop: 10, borderTop: `1px solid ${C.border}`,
            }}
          >
            本版不展示 AI 整体覆盖率、减负省时、群众满意度、返工原因；分类 / 位置 / 网格准确率不并排。
          </div>
        </div>
      )}

      <SliceDrawer slice={slice} onClose={() => setSlice(null)} />
    </div>
  )
}
