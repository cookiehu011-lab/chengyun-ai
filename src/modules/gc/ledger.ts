// 治理基础 · 责任台账共享规则（PRD 2026-09-22 第 5 章）
// 步骤冻结清单、互斥校验、账号步骤推导、网格状态与候选人约束。
// 真源是 store.ledger（角色/账号）与 rows（组织/网格/事件标准细类）。
import type { GcRow, LedgerAccount, LedgerRole } from "./store"
import { MODULES } from "./meta"

// ─── 冻结步骤清单（不能自造步骤） ────────────────────────────────────────────

export const STEPS = [
  "事件有效审核",
  "立案派发",
  "处置",
  "核查审核",
  "作废深化",
  "外场核查回传",
  "改配置",
  "只看",
] as const
export type Step = (typeof STEPS)[number]

export const STEP_CAPTIONS: Record<Step, string> = {
  事件有效审核: "判有效或无效",
  立案派发: "确认网格与主责并派发",
  处置: "处置回传、申请作废深化、退回「不属本辖区」",
  核查审核: "结案、退回处置、派外场",
  作废深化: "批准或驳回作废申请",
  外场核查回传: "提交外场结果",
  改配置: "改本配置，看全区",
  只看: "只看，不办理",
}

// 现场步骤：不能给自己结案或批准作废
export const FIELD_STEPS: Step[] = ["处置", "外场核查回传"]
// PC 办理步骤 + 管理步骤（与现场步骤互斥的另一侧）
export const OFFICE_STEPS: Step[] = ["事件有效审核", "立案派发", "核查审核", "作废深化", "改配置", "只看"]
// 纯管理/查看步骤
export const VIEW_STEPS: Step[] = ["改配置", "只看"]
// 审核类步骤（账号范围按 全区/街道 配置的一侧）
export const AUDIT_STEPS: Step[] = ["事件有效审核", "立案派发", "核查审核", "作废深化"]
// 全部办理步骤（与 改配置/只看 互斥）
export const HANDLE_STEPS: Step[] = [...AUDIT_STEPS, ...FIELD_STEPS]

// ─── 互斥校验（角色与账号步骤并集共用） ──────────────────────────────────────

/** 返回 null 表示通过；否则返回拒绝保存的原因文案 */
export function validateStepSet(steps: string[]): string | null {
  const set = new Set(steps)
  const field = FIELD_STEPS.filter((s) => set.has(s))
  const office = OFFICE_STEPS.filter((s) => set.has(s))
  const view = VIEW_STEPS.filter((s) => set.has(s))
  const handle = HANDLE_STEPS.filter((s) => set.has(s))
  if (field.length > 0 && office.length > 0) {
    return `现场角色（${field.join(" / ")}）不能与 ${office.join("、")} 同配在一个角色或账号：现场角色不能给自己结案或批准作废。`
  }
  if (view.length > 0 && handle.length > 0) {
    return `「${view.join("」「")}」不能与任何办理步骤（${handle.join("、")}）同配：改配置和只看账号不参与事件办理。`
  }
  return null
}

// ─── 账号步骤推导（启用角色才贡献步骤） ──────────────────────────────────────

export function roleById(ledger: { roles: LedgerRole[] }, id: string): LedgerRole | undefined {
  return ledger.roles.find((r) => r.id === id)
}

export function stepsOf(ledger: { roles: LedgerRole[] }, account: LedgerAccount): string[] {
  const out: string[] = []
  for (const rid of account.roles) {
    const r = roleById(ledger, rid)
    if (r && r.status === "启用") {
      for (const s of r.steps) if (!out.includes(s)) out.push(s)
    }
  }
  return out
}

/** 账号步骤画像：audit=审核类 / field=现场 / view=管理查看 / none=无有效步骤 */
export function accountProfile(steps: string[]): "audit" | "field" | "view" | "none" {
  const set = new Set(steps)
  if (FIELD_STEPS.some((s) => set.has(s))) return "field"
  if (AUDIT_STEPS.some((s) => set.has(s))) return "audit"
  if (VIEW_STEPS.some((s) => set.has(s))) return "view"
  return "none"
}

// ─── 数据源助手 ──────────────────────────────────────────────────────────────

/** 事件标准「字典摘录」里启用中的细类（账号负责事件类型的数据源） */
export function enabledEventTypes(rows: Record<string, GcRow[]>): string[] {
  return (rows["dict"] || []).filter((r) => r.status === "启用").map((r) => r.values[0])
}

/** 启用中的街道（组织架构行：层级=街道） */
export function enabledStreets(rows: Record<string, GcRow[]>): string[] {
  return (rows["org"] || []).filter((r) => r.status === "启用" && r.values[1] === "街道").map((r) => r.values[0])
}

export interface GridRowView {
  index: number
  code: string
  street: string
  community: string
  owner: string
  sup: string
  effDate: string
  stored: GcRow["status"]
}

export function gridRows(rows: Record<string, GcRow[]>): GridRowView[] {
  return (rows["space.grid"] || []).map((r, index) => ({
    index,
    code: r.values[0],
    street: r.values[1],
    community: r.values[2],
    owner: r.values[3],
    sup: r.values[4],
    effDate: r.values[5],
    stored: r.status,
  }))
}

export function ownerNameIsSet(owner: string): boolean {
  const v = owner.trim()
  return !!v && v !== "—" && v !== "—（空）" && v !== "(空)"
}

/** 网格生效状态：停用优先；无主责或主责账号已停用 → 待定责 */
export function gridEffectiveStatus(
  g: GridRowView,
  ledger: { roles: LedgerRole[]; accounts: LedgerAccount[] }
): "启用" | "停用" | "待定责" {
  if (g.stored === "停用") return "停用"
  if (!ownerNameIsSet(g.owner)) return "待定责"
  const acc = ledger.accounts.find((a) => a.name === g.owner)
  if (!acc || acc.status !== "启用") return "待定责" // 主责已停用（或台账中不存在）
  return "启用"
}

/** 主责候选人：启用账号 + 步骤含处置 + 账号范围包含该网格 */
export function ownerCandidates(
  code: string,
  ledger: { roles: LedgerRole[]; accounts: LedgerAccount[] }
): LedgerAccount[] {
  return ledger.accounts.filter(
    (a) => a.status === "启用" && stepsOf(ledger, a).includes("处置") && a.scopeKind === "grids" && a.grids.includes(code)
  )
}

/** 协同监督候选人：启用账号 + 步骤含外场核查回传 + 账号范围包含该网格 */
export function supCandidates(
  code: string,
  ledger: { roles: LedgerRole[]; accounts: LedgerAccount[] }
): LedgerAccount[] {
  return ledger.accounts.filter(
    (a) =>
      a.status === "启用" &&
      stepsOf(ledger, a).includes("外场核查回传") &&
      a.scopeKind === "grids" &&
      a.grids.includes(code)
  )
}

/** 账号负责范围的展示文案 */
export function scopeText(a: LedgerAccount): string {
  if (a.scopeKind === "district") return "全区"
  if (a.scopeKind === "streets") return a.streets.length ? `街道：${a.streets.join("、")}` : "街道：—"
  return a.grids.length ? `网格：${a.grids.join("、")}` : "网格：—"
}

// ─── 功能菜单权限（角色分配，账号推导） ──────────────────────────────────────
// 菜单权限决定成员能看到哪些系统菜单；步骤权限决定能做什么，两者独立生效。

export const MENUS = [
  { id: "dashboard", name: "治理大屏" },
  { id: "live", name: "AI实时治理" },
  { id: "archive", name: "事件档案" },
  { id: "stats", name: "AI统计" },
  { id: "workbench", name: "AI工作台" },
  { id: "config", name: "治理配置" },
] as const

/** 菜单的二级结构：AI实时治理 → 办理页签；治理配置 → 子模块（不含平台模块）；其余为一级叶子 */
export const MENU_CHILDREN: Record<string, { id: string; name: string }[]> = {
  live: [
    { id: "recognition", name: "全量识别" },
    { id: "case", name: "待立案" },
    { id: "inspect", name: "待核查" },
    { id: "void", name: "待作废审核" },
  ],
  config: MODULES.filter((m) => !m.platform).map((m) => ({ id: m.id, name: m.name })),
}

/** 角色表「功能菜单」列的展示：带二级数量的菜单摘要 */
export function menuSummary(
  menus: string[] | undefined,
  configModules: string[] | undefined,
  liveTabs: string[] | undefined
): string[] {
  const out: string[] = []
  for (const m of MENUS) {
    if (!(menus ?? []).includes(m.id)) continue
    if (m.id === "live") out.push(`AI实时治理 ${(liveTabs ?? []).length}/${MENU_CHILDREN.live.length}`)
    else if (m.id === "config") out.push(`治理配置 ${(configModules ?? []).length}/${MENU_CHILDREN.config.length}`)
    else out.push(m.name)
  }
  return out
}

export function menuName(id: string): string {
  return MENUS.find((m) => m.id === id)?.name ?? id
}

/** 账号可见菜单：启用角色的菜单并集 */
export function menusOf(ledger: { roles: LedgerRole[] }, account: LedgerAccount): string[] {
  const out: string[] = []
  for (const rid of account.roles) {
    const r = roleById(ledger, rid)
    if (r && r.status === "启用") {
      for (const m of r.menus ?? []) if (!out.includes(m)) out.push(m)
    }
  }
  return out
}

/** 账号可见的治理配置子模块：须同时拥有「治理配置」菜单 */
export function configModulesOf(
  ledger: { roles: LedgerRole[] },
  account: LedgerAccount
): string[] {
  const menus = menusOf(ledger, account)
  if (!menus.includes("config")) return []
  const out: string[] = []
  for (const rid of account.roles) {
    const r = roleById(ledger, rid)
    if (r && r.status === "启用") {
      for (const m of r.configModules ?? []) if (!out.includes(m)) out.push(m)
    }
  }
  return out
}
