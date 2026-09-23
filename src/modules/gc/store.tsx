// 治理配置 · 原生版状态层
// 职责：全部卡片行数据 + 模块发布状态 + 审计记录 + localStorage 持久化
// 规则锚点（与静态原型一致）：
// - 业务模块页只写草稿；「确认发布」只在「发布与审计」页，且必须经「发布前预览」冲突校验
// - 各模块发布门控（gate）由模块定义提供，真源是行数据本身
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { CARDS, type GeneratedCard } from "./cards.generated"

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export type RowStatus = "启用" | "停用" | "待定责"
export interface GcRow {
  values: string[] // 与 valueCols（cols 去掉 状态/操作）按位对齐
  status: RowStatus
}
export type ModulePubStatus = "已发布" | "草稿"
export interface AuditEntry {
  version: string
  date: string
  author: string
  modules: string[]
  note: string
  rollbackOf?: string
  /** 责任台账的即时生效留痕（不走版本发布，无回滚入口） */
  immediate?: boolean
}

// ─── 责任台账（PRD 2026-09-22）：角色 / 账号结构化数据 ────────────────────────
// 治理基础两页不走草稿发布：保存即生效；已派发事件与已派出外场任务不改人。

export interface LedgerRole {
  id: string
  name: string
  steps: string[] // 冻结步骤清单的多选，见 ledger.ts STEPS
  /** 可用的功能菜单（menu id，见 ledger.ts MENUS）；决定成员能看到哪些系统菜单 */
  menus?: string[]
  /** 治理配置子模块（gc module id）；仅在菜单含「治理配置」时生效 */
  configModules?: string[]
  /** AI实时治理二级页签（recognition/case/inspect/void）；仅在菜单含「AI实时治理」时生效 */
  liveTabs?: string[]
  source: "平台预置" | "自定义"
  status: "启用" | "停用"
}
export interface LedgerAccount {
  id: string
  name: string
  login: string
  org: string
  roles: string[] // role id 列表（必填 ≥1）
  scopeKind: "district" | "streets" | "grids"
  streets: string[] // scopeKind = streets
  grids: string[] // scopeKind = grids，存网格编码
  eventTypes: string[] // 事件标准里启用中的细类；仅改配置/只看账号为空
  lastLogin: string
  status: "启用" | "停用"
}
export interface LedgerState {
  roles: LedgerRole[]
  accounts: LedgerAccount[]
}

// ─── 平台与部署（PRD 2026-09-22 M-平台与部署） ────────────────────────────────
// 安装时确定 SaaS / 私有化，运行中不能改（演示环境提供切换仅作演示）。
// SaaS：多家客户 + SeeTime 用户；私有化：只有唯一客户，无 SeeTime 用户。

export type DeployMode = "saas" | "private"

export interface Customer {
  id: string
  name: string
  status: "启用" | "停用"
  /** 当前客户管理员（客户账号，步骤=改配置）；全部停用后由含超管的 SeeTime 账号补一名 */
  adminName: string
  adminLogin: string
  /** 组织同步位：false = 新开客户，组织 / 网格等待平台同步 */
  orgSynced: boolean
  createdAt: string
}

/** SeeTime 功能权限只有两项，可多选，至少选 1 项；不能自造第三项 */
export type SeeTimePerm = "super" | "display"

export interface SeeTimeAccount {
  id: string
  name: string
  login: string
  perms: SeeTimePerm[]
  /** 客户展示：被勾选的客户（至少 1 个）；超管自动可见全部客户 */
  displayCustomers: string[]
  lastLogin: string
  status: "启用" | "停用"
}

export interface PlatformState {
  mode: DeployMode
  /** 当前客户上下文；null = SeeTime 身份（不进入治理基础编辑） */
  currentCustomerId: string
  customers: Customer[]
  seeTime: SeeTimeAccount[]
}

export interface GcState {
  rows: Record<string, GcRow[]>
  modules: Record<string, ModulePubStatus>
  versions: Record<string, string>
  baseline: { version: string; date: string }
  audit: AuditEntry[]
  switches: Record<string, boolean> // 页面级开关（如 metric 难度校正）
  /** 每个客户一份责任台账（角色 / 账号）；客户是隔离边界 */
  ledgers: Record<string, LedgerState>
  platform: PlatformState
}

// ─── 种子数据 ────────────────────────────────────────────────────────────────

// 空间与责任 · 网格责任表（rev24 口径：启用/停用/待定责 三态，停用豁免派发）
export const SPACE_COLS = ["网格编码", "所属街道", "社区", "网格主责", "协同监督", "生效日期"]
const SPACE_SEED: GcRow[] = [
  { values: ["G-0418", "朝阳门街道", "某社区", "刘洋", "陈督", "2026-08-01"], status: "启用" },
  { values: ["G-0417", "朝阳门街道", "某社区", "张强", "—", "2026-08-01"], status: "启用" },
  { values: ["G-0419", "朝阳门街道", "东花市社区", "周琳", "陈督", "2026-08-01"], status: "启用" },
  { values: ["G-0421", "东华门街道", "金宝街社区", "—（空）", "—", "—"], status: "待定责" },
]

// 时限与异常监控 · 时限矩阵（同一细类+等级+区域只能启用一条）
export const SLA_MATRIX_COLS = [
  "事件类型", "细类", "等级", "区域", "处置时限", "核查时限", "到期前提醒", "超时后打升级标记",
]
const SLA_MATRIX_SEED: GcRow[] = [
  { values: ["道路秩序", "共享单车乱停放", "一般", "全区", "90 分", "30 分", "提前 5 分钟 · 当前网格责任人", "打升级标记"], status: "启用" },
  { values: ["道路秩序", "机动车违停", "一般", "全区", "60 分", "30 分", "提前 5 分钟 · 当前网格责任人", "打升级标记"], status: "启用" },
  { values: ["道路秩序", "占道经营", "较重", "全区", "45 分", "20 分", "提前 10 分钟 · 街道值守", "打升级标记并短信"], status: "启用" },
  { values: ["环境卫生", "乱堆垃圾", "一般", "全区", "4 小时", "1 小时", "提前 30 分钟 · 处置员", "打升级标记"], status: "启用" },
  { values: ["环境卫生", "暴露垃圾", "较重", "全区", "2 小时", "40 分", "提前 15 分钟 · 处置员", "打升级标记并短信"], status: "启用" },
  { values: ["宣传广告", "无证户外广告", "一般", "全区", "6 小时", "2 小时", "提前 30 分钟 · 处置员", "打升级标记"], status: "停用" },
]

// 责任台账 · 角色预置（PRD：预置不是冻结名单，管理员可改名或另建）
const LEDGER_SEED: LedgerState = {
  roles: [
    { id: "r-jt", name: "全局协调", steps: ["改配置"], menus: ["dashboard", "live", "archive", "stats", "workbench", "config"], configModules: ["org", "space", "eventstd", "lifecycle", "sla", "dispatch", "dedup", "metric", "publish"], liveTabs: ["recognition", "case", "inspect", "void"], source: "平台预置", status: "启用" },
    { id: "r-ld", name: "领导", steps: ["只看"], menus: ["dashboard", "archive", "stats"], configModules: [], source: "平台预置", status: "启用" },
    { id: "r-sh", name: "事件有效审核", steps: ["事件有效审核"], menus: ["live", "archive", "workbench", "stats", "config"], configModules: ["publish"], liveTabs: ["recognition", "case", "inspect", "void"], source: "平台预置", status: "启用" },
    { id: "r-pf", name: "立案派发", steps: ["立案派发"], menus: ["live", "archive", "workbench", "stats", "config"], configModules: ["publish"], liveTabs: ["recognition", "case", "inspect", "void"], source: "平台预置", status: "启用" },
    { id: "r-zr", name: "网格责任人", steps: ["处置"], menus: ["workbench", "archive"], configModules: [], source: "平台预置", status: "启用" },
    { id: "r-hc", name: "核查审核", steps: ["核查审核"], menus: ["live", "archive", "workbench", "stats", "config"], configModules: ["publish"], liveTabs: ["recognition", "case", "inspect", "void"], source: "平台预置", status: "启用" },
    { id: "r-zf", name: "作废深化", steps: ["作废深化"], menus: ["archive", "workbench"], configModules: [], source: "平台预置", status: "启用" },
    { id: "r-jd", name: "监督员", steps: ["外场核查回传"], menus: ["workbench", "archive"], configModules: [], source: "平台预置", status: "启用" },
  ],
  accounts: [
    { id: "a-wq", name: "王倩", login: "wangqian@seetime", org: "东城区", roles: ["r-jt"], scopeKind: "district", streets: [], grids: [], eventTypes: [], lastLogin: "2026-09-05", status: "启用" },
    { id: "a-lm", name: "李明", login: "liming@seetime", org: "东城区", roles: ["r-ld"], scopeKind: "district", streets: [], grids: [], eventTypes: [], lastLogin: "2026-09-04", status: "启用" },
    { id: "a-zm", name: "赵敏", login: "zhaomin@seetime", org: "东城区", roles: ["r-sh", "r-pf"], scopeKind: "district", streets: [], grids: [], eventTypes: ["机动车违停", "共享单车乱停放", "占道经营", "施工占道", "暴露垃圾", "杂物堆放"], lastLogin: "2026-09-05", status: "启用" },
    { id: "a-wy", name: "吴忧", login: "wuyou@seetime", org: "东城区", roles: ["r-hc", "r-zf"], scopeKind: "district", streets: [], grids: [], eventTypes: ["机动车违停", "占道经营", "暴露垃圾", "杂物堆放"], lastLogin: "2026-09-03", status: "启用" },
    { id: "a-ly", name: "刘洋", login: "liuyang@seetime", org: "朝阳门街道", roles: ["r-zr"], scopeKind: "grids", streets: [], grids: ["G-0418"], eventTypes: ["机动车违停", "共享单车乱停放", "暴露垃圾", "杂物堆放"], lastLogin: "2026-09-05", status: "启用" },
    { id: "a-zq", name: "张强", login: "zhangqiang@seetime", org: "朝阳门街道", roles: ["r-zr"], scopeKind: "grids", streets: [], grids: ["G-0417"], eventTypes: ["占道经营", "施工占道", "非法倾倒", "建材乱堆"], lastLogin: "2026-09-04", status: "启用" },
    { id: "a-zl", name: "周琳", login: "zhoulin@seetime", org: "朝阳门街道", roles: ["r-zr"], scopeKind: "grids", streets: [], grids: ["G-0419"], eventTypes: ["暴露垃圾", "杂物堆放", "超规格招牌", "违规灯箱"], lastLogin: "2026-09-05", status: "启用" },
    { id: "a-cd", name: "陈督", login: "chendu@seetime", org: "朝阳门街道", roles: ["r-jd"], scopeKind: "grids", streets: [], grids: ["G-0418", "G-0419"], eventTypes: ["机动车违停", "占道经营", "暴露垃圾", "超规格招牌"], lastLogin: "2026-09-01", status: "启用" },
  ],
}

// 责任台账 · 客户管理员骨架（PRD：开客户必填第一名管理员，步骤仅为改配置；
// 新客户生成空的组织同步位，不复制别的客户的角色、账号、网格和事件）
export function adminLedgerSkeleton(adminName: string, adminLogin: string): LedgerState {
  const roleId = "r-cadm-" + Date.now().toString(36)
  const accId = "a-cadm-" + Date.now().toString(36)
  return {
    roles: [
      {
        id: roleId,
        name: "客户管理员",
        steps: ["改配置"],
        menus: ["config"],
        configModules: ["org", "space"],
        liveTabs: [],
        source: "平台预置",
        status: "启用",
      },
    ],
    accounts: [
      {
        id: accId,
        name: adminName,
        login: adminLogin,
        org: "（待同步）",
        roles: [roleId],
        scopeKind: "district",
        streets: [],
        grids: [],
        eventTypes: [],
        lastLogin: "—",
        status: "启用",
      },
    ],
  }
}

// 西城区：预置第二家客户，演示客户隔离（组织同步位为空，台账只有管理员自己）
const LEDGER_SEED_XC: LedgerState = adminLedgerSkeleton("高建", "gaojian@seetime")

const CUSTOMERS_SEED: Customer[] = [
  { id: "c-dc", name: "东城区", status: "启用", adminName: "王倩", adminLogin: "wangqian@seetime", orgSynced: true, createdAt: "2026-07-01" },
  { id: "c-xc", name: "西城区", status: "启用", adminName: "高建", adminLogin: "gaojian@seetime", orgSynced: false, createdAt: "2026-09-20" },
]

const SEETIME_SEED: SeeTimeAccount[] = [
  { id: "st-sys", name: "系统运营", login: "sysadmin@seetime", perms: ["super"], displayCustomers: [], lastLogin: "2026-09-23", status: "启用" },
  { id: "st-ly", name: "陆遥", login: "luyao@seetime", perms: ["display"], displayCustomers: ["c-dc"], lastLogin: "2026-09-22", status: "启用" },
]

const PLATFORM_SEED: PlatformState = {
  mode: "saas",
  currentCustomerId: "c-dc",
  customers: CUSTOMERS_SEED.map((c) => ({ ...c })),
  seeTime: SEETIME_SEED.map((s) => ({ ...s, perms: [...s.perms], displayCustomers: [...s.displayCustomers] })),
}

// 模块初始发布状态（与原型侧栏一致）
const MODULE_SEED: Record<string, ModulePubStatus> = {
  org: "已发布",
  space: "已发布",
  eventstd: "已发布",
  lifecycle: "草稿",
  sla: "草稿",
  dispatch: "草稿",
  dedup: "已发布",
  metric: "已发布",
  publish: "已发布",
}

const AUDIT_SEED: AuditEntry[] = [
  { version: "V2.3.2", date: "2026-08-15", author: "李明", modules: ["事件标准"], note: "新增「乱堆杂物」微类3项，调整证据要求字段顺序" },
  { version: "V2.3.1", date: "2026-08-10", author: "王志远", modules: ["组织、账号与权限"], note: "更新组织权限矩阵，新增全局协调角色升级权限" },
  { version: "V2.3.0", date: "2026-07-01", author: "李明", modules: ["全部模块"], note: "V2.3基线发布，包含全量配置迁移" },
]

// ─── 初始化：引擎卡行数据拆分（values + status） ─────────────────────────────

function splitCardRows(def: GeneratedCard): GcRow[] {
  const statusIdx = def.cols.indexOf("状态")
  return def.rows.map((raw) => {
    const cells = raw.slice()
    const st = (statusIdx >= 0 ? cells.splice(statusIdx, 1)[0] : "启用") || "启用"
    const status: RowStatus = st === "停用" ? "停用" : st === "待定责" ? "待定责" : "启用"
    return { values: cells, status }
  })
}

function initialState(): GcState {
  const rows: Record<string, GcRow[]> = {}
  for (const [modKey, cards] of Object.entries(CARDS)) {
    for (const card of cards) rows[card.id] = splitCardRows(card)
  }
  rows["space.grid"] = SPACE_SEED.map((r) => ({ values: [...r.values], status: r.status }))
  rows["sla.matrix"] = SLA_MATRIX_SEED.map((r) => ({ values: [...r.values], status: r.status }))
  return {
    rows,
    modules: { ...MODULE_SEED },
    versions: {
      org: "V2.3.1", space: "V2.3.0", eventstd: "V2.3.2", lifecycle: "V2.3.0",
      sla: "V2.3.0", dispatch: "V2.3.1", dedup: "V2.3.0", metric: "V2.3.0", publish: "—",
    },
    baseline: { version: "V2.3.2", date: "2026-08-15" },
    audit: AUDIT_SEED.map((a) => ({ ...a })),
    switches: { metricAdjust: true },
    ledgers: {
      "c-dc": {
        roles: LEDGER_SEED.roles.map((r) => ({ ...r, steps: [...r.steps], menus: [...(r.menus ?? [])], configModules: [...(r.configModules ?? [])], liveTabs: [...(r.liveTabs ?? [])] })),
        accounts: LEDGER_SEED.accounts.map((a) => ({ ...a, roles: [...a.roles], streets: [...a.streets], grids: [...a.grids], eventTypes: [...a.eventTypes] })),
      },
      "c-xc": {
        roles: LEDGER_SEED_XC.roles.map((r) => ({ ...r, steps: [...r.steps], menus: [...(r.menus ?? [])], configModules: [...(r.configModules ?? [])], liveTabs: [...(r.liveTabs ?? [])] })),
        accounts: LEDGER_SEED_XC.accounts.map((a) => ({ ...a, roles: [...a.roles], streets: [...a.streets], grids: [...a.grids], eventTypes: [...a.eventTypes] })),
      },
    },
    platform: {
      ...PLATFORM_SEED,
      customers: PLATFORM_SEED.customers.map((c) => ({ ...c })),
      seeTime: PLATFORM_SEED.seeTime.map((s) => ({ ...s, perms: [...s.perms], displayCustomers: [...s.displayCustomers] })),
    },
  }
}

// ─── Reducer ────────────────────────────────────────────────────────────────

type Action =
  | { type: "upsert"; cardKey: string; index: number; values: string[]; status?: RowStatus }
  | { type: "remove"; cardKey: string; index: number }
  | { type: "set-status"; cardKey: string; index: number; status: RowStatus }
  | { type: "toggle"; cardKey: string; index: number }
  | { type: "set-switch"; key: string; on: boolean }
  | { type: "publish"; modules: string[]; version: string; date: string; author: string }
  | { type: "rollback"; entry: AuditEntry; author: string; date: string }
  | { type: "reset" }
  // 责任台账（治理基础）：保存即生效，不经草稿发布；按客户隔离（cid）
  | { type: "ledger-role-upsert"; cid: string; role: LedgerRole }
  | { type: "ledger-role-remove"; cid: string; id: string }
  | { type: "ledger-role-status"; cid: string; id: string; status: "启用" | "停用" }
  | { type: "ledger-account-upsert"; cid: string; account: LedgerAccount }
  | { type: "ledger-account-status"; cid: string; id: string; status: "启用" | "停用" }
  | { type: "ledger-note"; entry: AuditEntry }
  // 平台与部署：客户 / SeeTime 用户 / 部署模式
  | { type: "platform-mode"; mode: DeployMode }
  | { type: "customer-create"; customer: Customer; ledger: LedgerState }
  | { type: "customer-status"; id: string; status: "启用" | "停用" }
  | { type: "customer-admin-assign"; cid: string; name: string; login: string }
  | { type: "seetime-upsert"; account: SeeTimeAccount }
  | { type: "seetime-status"; id: string; status: "启用" | "停用" }

function nextReleaseVersion(audit: AuditEntry[]): string {
  let max = 0
  for (const a of audit) {
    const m = a.version.match(/^V2\.3\.(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `V2.3.${max + 1}`
}

function reducer(state: GcState, action: Action): GcState {
  switch (action.type) {
    case "upsert": {
      const list = state.rows[action.cardKey] || []
      const rows = [...list]
      if (action.index >= 0 && action.index < rows.length) {
        rows[action.index] = { values: action.values, status: action.status ?? rows[action.index].status }
      } else {
        rows.push({ values: action.values, status: action.status ?? "启用" })
      }
      return { ...state, rows: { ...state.rows, [action.cardKey]: rows } }
    }
    case "remove": {
      const list = state.rows[action.cardKey] || []
      return { ...state, rows: { ...state.rows, [action.cardKey]: list.filter((_, i) => i !== action.index) } }
    }
    case "set-status": {
      const list = state.rows[action.cardKey] || []
      if (action.index < 0 || action.index >= list.length) return state
      const rows = [...list]
      rows[action.index] = { ...rows[action.index], status: action.status }
      return { ...state, rows: { ...state.rows, [action.cardKey]: rows } }
    }
    case "toggle": {
      const list = state.rows[action.cardKey] || []
      if (action.index < 0 || action.index >= list.length) return state
      const rows = [...list]
      const cur = rows[action.index].status
      if (cur === "待定责") return state
      rows[action.index] = { ...rows[action.index], status: cur === "启用" ? "停用" : "启用" }
      return { ...state, rows: { ...state.rows, [action.cardKey]: rows } }
    }
    case "set-switch":
      return { ...state, switches: { ...state.switches, [action.key]: action.on } }
    case "publish": {
      const modules = { ...state.modules }
      const versions = { ...state.versions }
      for (const id of action.modules) {
        modules[id] = "已发布"
        versions[id] = action.version
      }
      const entry: AuditEntry = {
        version: action.version, date: action.date, author: action.author,
        modules: action.modules.map((m) => m), note: "经发布前预览冲突校验后确认发布",
      }
      return {
        ...state, modules, versions,
        baseline: { version: action.version, date: action.date },
        audit: [entry, ...state.audit],
      }
    }
    case "rollback": {
      const modules = { ...state.modules }
      for (const name of action.entry.modules) {
        const id = moduleNameToId(name)
        if (id) modules[id] = "草稿"
      }
      const entry: AuditEntry = {
        version: action.entry.version + " · 回滚", date: action.date, author: action.author,
        modules: action.entry.modules, note: `回滚 ${action.entry.version}，相关模块回到草稿待重发布`,
        rollbackOf: action.entry.version,
      }
      return { ...state, modules, audit: [entry, ...state.audit] }
    }
    case "reset":
      return initialState()
    // 责任台账动作：全部按 cid 定位该客户的台账（客户是隔离边界）
    case "ledger-role-upsert": {
      const lg = state.ledgers[action.cid]
      if (!lg) return state
      const roles = lg.roles.slice()
      const i = roles.findIndex((r) => r.id === action.role.id)
      if (i >= 0) roles[i] = action.role
      else roles.push(action.role)
      return { ...state, ledgers: { ...state.ledgers, [action.cid]: { ...lg, roles } } }
    }
    case "ledger-role-remove": {
      const lg = state.ledgers[action.cid]
      if (!lg) return state
      const roles = lg.roles.filter((r) => r.id !== action.id)
      return { ...state, ledgers: { ...state.ledgers, [action.cid]: { ...lg, roles } } }
    }
    case "ledger-role-status": {
      const lg = state.ledgers[action.cid]
      if (!lg) return state
      const roles = lg.roles.slice()
      const i = roles.findIndex((r) => r.id === action.id)
      if (i < 0) return state
      roles[i] = { ...roles[i], status: action.status }
      return { ...state, ledgers: { ...state.ledgers, [action.cid]: { ...lg, roles } } }
    }
    case "ledger-account-upsert": {
      const lg = state.ledgers[action.cid]
      if (!lg) return state
      const accounts = lg.accounts.slice()
      const i = accounts.findIndex((a) => a.id === action.account.id)
      if (i >= 0) accounts[i] = action.account
      else accounts.push(action.account)
      return { ...state, ledgers: { ...state.ledgers, [action.cid]: { ...lg, accounts } } }
    }
    case "ledger-account-status": {
      const lg = state.ledgers[action.cid]
      if (!lg) return state
      const accounts = lg.accounts.slice()
      const i = accounts.findIndex((a) => a.id === action.id)
      if (i < 0) return state
      accounts[i] = { ...accounts[i], status: action.status }
      return { ...state, ledgers: { ...state.ledgers, [action.cid]: { ...lg, accounts } } }
    }
    case "ledger-note":
      return { ...state, audit: [action.entry, ...state.audit] }
    // ─── 平台与部署 ───────────────────────────────────────────────────────────
    case "platform-mode":
      return { ...state, platform: { ...state.platform, mode: action.mode } }
    case "customer-create":
      return {
        ...state,
        platform: { ...state.platform, customers: [...state.platform.customers, action.customer] },
        ledgers: { ...state.ledgers, [action.customer.id]: action.ledger },
      }
    case "customer-status": {
      const customers = state.platform.customers.slice()
      const i = customers.findIndex((c) => c.id === action.id)
      if (i < 0) return state
      customers[i] = { ...customers[i], status: action.status }
      return { ...state, platform: { ...state.platform, customers } }
    }
    case "customer-admin-assign": {
      const lg = state.ledgers[action.cid]
      if (!lg) return state
      const roleId = "r-cadm-" + Date.now().toString(36)
      const hasAdminRole = lg.roles.some((r) => r.name === "客户管理员")
      const roles = hasAdminRole
        ? lg.roles.slice()
        : [...lg.roles, {
            id: roleId, name: "客户管理员", steps: ["改配置"], menus: ["config"],
            configModules: ["org", "space"], liveTabs: [], source: "平台预置" as const, status: "启用" as const,
          }]
      const roleRef = (hasAdminRole ? lg.roles.find((r) => r.name === "客户管理员")!.id : roleId)
      const accounts = [...lg.accounts, {
        id: "a-cadm-" + Date.now().toString(36),
        name: action.name,
        login: action.login,
        org: "（待同步）",
        roles: [roleRef],
        scopeKind: "district" as const,
        streets: [],
        grids: [],
        eventTypes: [],
        lastLogin: "—",
        status: "启用" as const,
      }]
      const customers = state.platform.customers.map((c) =>
        c.id === action.cid ? { ...c, adminName: action.name, adminLogin: action.login } : c
      )
      return {
        ...state,
        platform: { ...state.platform, customers },
        ledgers: { ...state.ledgers, [action.cid]: { roles, accounts } },
      }
    }
    case "seetime-upsert": {
      const seeTime = state.platform.seeTime.slice()
      const i = seeTime.findIndex((s) => s.id === action.account.id)
      if (i >= 0) seeTime[i] = action.account
      else seeTime.push(action.account)
      return { ...state, platform: { ...state.platform, seeTime } }
    }
    case "seetime-status": {
      const seeTime = state.platform.seeTime.slice()
      const i = seeTime.findIndex((s) => s.id === action.id)
      if (i < 0) return state
      seeTime[i] = { ...seeTime[i], status: action.status }
      return { ...state, platform: { ...state.platform, seeTime } }
    }
  }
}

function moduleNameToId(name: string): string | null {
  const map: Record<string, string> = {
    "组织、账号与角色": "org", "组织、账号与权限": "org", // 旧名兼容历史审计记录
    "空间与责任关系": "space", "事件标准": "eventstd",
    "生命周期与处置规则": "lifecycle", "时限与异常监控": "sla", "Agent 派工与认领": "dispatch",
    "查重与复发治理": "dedup", "治理评价标准": "metric",
  }
  return map[name] ?? null
}

// ─── Context ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gc-native-v1"
interface GcStore {
  state: GcState
  dispatch: React.Dispatch<Action>
  releaseVersion: string
}
const GcCtx = createContext<GcStore | null>(null)

export function GcProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GcState>
        if (parsed && parsed.rows && parsed.modules) {
          const base = initialState()
          const merged: GcState = {
            ...base,
            ...parsed,
            rows: { ...base.rows, ...parsed.rows },
            audit: parsed.audit ?? base.audit,
            switches: parsed.switches ?? base.switches,
            platform: parsed.platform
              ? {
                  ...base.platform,
                  ...parsed.platform,
                  customers: parsed.platform.customers ?? base.platform.customers,
                  seeTime: (parsed.platform.seeTime ?? base.platform.seeTime).map((s) => ({
                    ...s, perms: [...(s.perms || [])], displayCustomers: [...(s.displayCustomers || [])],
                  })),
                }
              : base.platform,
          } as GcState
          // 迁移：老数据只有单客户 ledger → 挂到东城区；缺西城区骨架则补齐
          const oldLedger = (parsed as { ledger?: LedgerState }).ledger
          const dcLedger: LedgerState = (oldLedger
            ? {
                // 迁移：老数据角色无 menus / configModules 字段，用种子补齐
                roles: oldLedger.roles.map((r) => {
                  const seed = base.ledgers["c-dc"].roles.find((b) => b.id === r.id)
                  return {
                    ...seed,
                    ...r,
                    steps: [...r.steps],
                    menus: r.menus ?? seed?.menus ?? [],
                    configModules: r.configModules ?? seed?.configModules ?? [],
                    liveTabs: r.liveTabs ?? seed?.liveTabs ?? [],
                  }
                }),
                accounts: oldLedger.accounts.map((a) => ({ ...a, roles: [...a.roles], streets: [...a.streets], grids: [...a.grids], eventTypes: [...a.eventTypes] })),
              }
            : base.ledgers["c-dc"])
          merged.ledgers = {
            "c-dc": dcLedger,
            ...(parsed.ledgers ?? {}),
            "c-xc": parsed.ledgers?.["c-xc"] ?? base.ledgers["c-xc"],
          }
          // 迁移：清理空间表协同监督列的历史「（草稿）」标记
          const sg = merged.rows["space.grid"]
          if (sg) {
            merged.rows["space.grid"] = sg.map((r) => ({
              ...r,
              values: r.values.map((v) => v.replace("（草稿）", "")),
            }))
          }
          return merged
        }
      }
    } catch { /* ignore */ }
    return initialState()
  })
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])
  const releaseVersion = useMemo(() => nextReleaseVersion(state.audit), [state.audit])
  const value = useMemo(() => ({ state, dispatch, releaseVersion }), [state, releaseVersion])
  return <GcCtx.Provider value={value}>{children}</GcCtx.Provider>
}

export function useGc(): GcStore {
  const ctx = useContext(GcCtx)
  if (!ctx) throw new Error("useGc must be used within GcProvider")
  return ctx
}

// ─── Toast ──────────────────────────────────────────────────────────────────

const ToastCtx = createContext<(msg: string) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const toast = (m: string) => {
    setMsg(m)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 3200)
  }
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && (
        <div
          role="status"
          style={{
            position: "fixed", left: "50%", bottom: "84px", transform: "translateX(-50%)",
            zIndex: 90, maxWidth: "560px", padding: "9px 18px", borderRadius: "8px",
            backgroundColor: "rgba(23,32,48,0.92)", color: "#fff", fontSize: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)", lineHeight: 1.6,
          }}
        >
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
