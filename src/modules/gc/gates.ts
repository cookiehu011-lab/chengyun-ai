// 治理配置 · 发布门控注册表
// 文案 1:1 取自静态原型页脚（rev13–rev24 的产品规则），真源是行数据本身
// 注：治理基础两页（组织、账号与角色 / 空间与责任关系）按 PRD 2026-09-22 为责任台账，
// 保存即生效、不走草稿发布，因此不注册发布门控。
import { CARDS } from "./cards.generated"
import { useGc } from "./store"
import type { GcRow } from "./store"
import { slaGate } from "./pages/SlaPage"

export interface GateResult {
  blocked: boolean
  note: string
  tip: string
}

const READY_GENERIC = "本页只写入草稿；「确认发布」在「规则版本」页，须经「发布前预览」做冲突校验后确认。"
const TIP_GENERIC = "带着本草稿进入发布前预览"

function colIdx(cols: string[], label: string): number {
  const list = cols.filter((c) => c !== "状态" && c !== "操作")
  return list.indexOf(label)
}

// ─── eventstd：启用细类同时开 候选+核查 → 阻断 ───────────────────────────────

function gateEventstd(dictRows: GcRow[]): GateResult {
  const def = CARDS.eventstd.find((c) => c.id === "dict")!
  const candIdx = colIdx(def.cols, "自动结案候选")
  const checkIdx = colIdx(def.cols, "必须人工核查")
  const conflicts = dictRows
    .filter((r) => r.status === "启用" && r.values[candIdx] === "开" && r.values[checkIdx] === "开")
    .map((r) => r.values[0])
  if (conflicts.length > 0) {
    return {
      blocked: true,
      note: `不能进入发布前预览：先解除「${conflicts.join("」「")}」的互斥（启用中的细类不能同时开启「允许自动结案候选」与「必须人工核查」）。`,
      tip: `「${conflicts.join("」「")}」存在互斥冲突，不能进入发布前预览`,
    }
  }
  return { blocked: false, note: READY_GENERIC, tip: TIP_GENERIC }
}

// ─── lifecycle：自动结案 与 必须人工核查 互斥 → 阻断 ─────────────────────────

function gateLifecycle(autocloseRows: GcRow[]): GateResult {
  const def = CARDS.lifecycle.find((c) => c.id === "lc-autoclose")!
  const candIdx = colIdx(def.cols, "允许自动结案候选")
  const checkIdx = colIdx(def.cols, "必须人工核查")
  const conflicts = autocloseRows
    .filter((r) => r.status === "启用" && r.values[candIdx] === "开" && r.values[checkIdx] === "是")
    .map((r) => r.values[0])
  if (conflicts.length > 0) {
    return {
      blocked: true,
      note: `不能进入发布前预览：先解除自动结案与「必须人工核查」的互斥（${conflicts.join("、")}）。`,
      tip: "自动结案与必须核查存在互斥，不能进入发布前预览",
    }
  }
  return {
    blocked: false,
    note: "本页只保存草稿；发布前预览会做冲突校验，业务模块页不提供发布入口。",
    tip: TIP_GENERIC,
  }
}

// ─── dispatch：领取批次全部停用 → 阻断 ───────────────────────────────────────

function gateDispatch(batchRows: GcRow[]): GateResult {
  const on = batchRows.filter((r) => r.status === "启用").length
  if (on === 0) {
    return {
      blocked: true,
      note: "不能进入发布前预览：领取批次列表里没有任何启用行，办理页没有领取入口，事件会堆在「待立案 / 待核查」无法派发。",
      tip: "领取批次全部停用，派发闭环没有入口，不能进入发布前预览",
    }
  }
  return { blocked: false, note: READY_GENERIC, tip: TIP_GENERIC }
}

// ─── dedup：没有启用中的「空间条件」行 → 阻断 ────────────────────────────────

function gateDedup(dupRows: GcRow[]): GateResult {
  const def = CARDS.dedup.find((c) => c.id === "dr-dup")!
  const typeIdx = colIdx(def.cols, "条件类型")
  const spaceOn = dupRows.filter((r) => r.status === "启用" && r.values[typeIdx] === "空间条件").length
  if (spaceOn === 0) {
    return {
      blocked: true,
      note: "不能进入发布前预览：判重必须有空间条件，列表里必须至少保留一条「条件类型 = 空间条件」且状态为「启用」的行，否则会把不同类型全区事件误判为重复。",
      tip: "当前判重条件里没有启用中的空间条件，不能进入发布前预览",
    }
  }
  return { blocked: false, note: READY_GENERIC, tip: TIP_GENERIC }
}

// ─── metric：平均处置时长参与比较 且 难度校正关闭 → 阻断 ─────────────────────

function gateMetric(rows: Record<string, GcRow[]>, switches: Record<string, boolean>): GateResult {
  const metricDef = CARDS.metric.find((c) => c.id === "metric")!
  const mIdx = colIdx(metricDef.cols, "指标")
  const pIdx = colIdx(metricDef.cols, "参与比较")
  const durationRow = (rows["metric"] || []).find((r) => r.values[mIdx] === "平均处置时长")
  const participating = !!durationRow && !["—", "关", ""].includes((durationRow.values[pIdx] || "").trim())
  const adjustOn = switches.metricAdjust !== false
  if (participating && !adjustOn) {
    return {
      blocked: true,
      note: "不能进入发布前预览：平均处置时长参与了人员 / 网格比较，难度校正却关闭，会变成只按平均时长排名。",
      tip: "难度校正关闭时，参与比较的平均处置时长会误导排名，不能进入发布前预览",
    }
  }
  return { blocked: false, note: READY_GENERIC, tip: TIP_GENERIC }
}

// ─── 注册表 ─────────────────────────────────────────────────────────────────

export type GateFn = (rows: Record<string, GcRow[]>, switches: Record<string, boolean>) => GateResult

export const GATES: Record<string, GateFn> = {
  eventstd: (rows) => gateEventstd(rows["dict"] || []),
  lifecycle: (rows) => gateLifecycle(rows["lc-autoclose"] || []),
  sla: (rows) => slaGate(rows["sla.matrix"] || []),
  dispatch: (rows) => gateDispatch(rows["dc-batch"] || []),
  dedup: (rows) => gateDedup(rows["dr-dup"] || []),
  metric: (rows, sw) => gateMetric(rows, sw),
  publish: () => ({ blocked: false, note: "发布与审计不参与草稿发布。", tip: "" }),
}

export function useGate(moduleId: string): GateResult {
  const { state } = useGc()
  const fn = GATES[moduleId]
  return fn ? fn(state.rows, state.switches) : { blocked: false, note: READY_GENERIC, tip: TIP_GENERIC }
}
