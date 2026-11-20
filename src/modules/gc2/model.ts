// V2.0 治理配置：数据模型与内置种子数据
// 原型没有独立数据库，这份种子就是初始数据；页面上的新增/编辑/停用写回同一份数据（持久化在 localStorage gc-config-v2.0）。

export type OrgType = "区" | "街道" | "委办局" | "社区" | "科室"

export interface OrgNode {
  id: string
  name: string
  type: OrgType
  parentId: string | null
}

/** 事件引用：全部事件（岗位）/ 不限（规则）/ 分类 / 大类 / 小类 */
export type EventRef =
  | { level: "all" }
  | { level: "none" }
  | { level: "category"; value: string }
  | { level: "major"; value: string }
  | { level: "minor"; value: string }

export interface StdRow {
  id: string
  category: string
  major: string
  minor: string
  criteria: string
  materials: string
  status: "启用" | "停用"
}

export interface RoleDef {
  id: string
  name: string
  dashboard: boolean
  live: boolean
  archive: boolean
  stats: boolean
  workbench: boolean
  config: boolean
  /** 治理配置二级页面 id（CONFIG_PAGE_IDS） */
  configPages: string[]
  /** AI实时治理二级标签 id（LIVE_TAB_IDS） */
  liveTabs: string[]
  /** 操作权限，挂在 AI实时治理二级下：tabId → 操作列表（勾选对应二级才生效） */
  opsByTab: Record<string, string[]>
}

export interface Post {
  id: string
  name: string
  orgId: string
  roleId: string
  events: EventRef[]
  areas: string[]
}

export interface Account {
  id: string
  name: string
  /** 11 位手机号，表内不重复 */
  phone: string
  orgId: string
  postId: string
  status: "启用" | "停用"
}

export interface Rule {
  id: string
  source: string
  event: EventRef
  /** "不限" | "东城区" | 街道名 */
  area: string
  path: "大循环" | "小循环"
  /** 组织 id 或 "manual"（待人工派发） */
  org: string
}

export interface Sla {
  id: string
  events: EventRef[]
  disposal: string
  check: string
}

export interface ClaimRow {
  id: "accept" | "check"
  todo: string
  count: number
}

export interface ConfigState {
  seedRev: number
  orgs: OrgNode[]
  posts: Post[]
  roles: RoleDef[]
  accounts: Account[]
  rules: Rule[]
  slas: Sla[]
  claim: ClaimRow[]
  std: StdRow[]
}

/* ── 固定枚举 ─────────────────────────────────────────── */

/** 行政区种子：页面不能新增、不能改名 */
export const DISTRICTS = ["东城区", "永外街道", "建国门街道"]
/** 去向页可选街道（承接近端处置的行政区） */
export const STREETS = ["永外街道", "建国门街道"]

export const SOURCES = [
  "摄像头识别",
  "监督员上报",
  "中心登记",
  "消防上报",
  "群众上报",
  "街道自行发现",
  "专项点位",
]

export const PATHS = ["大循环", "小循环"] as const

export const ORG_TYPES: OrgType[] = ["区", "街道", "委办局", "社区", "科室"]

export const LIVE_TABS = [
  { id: "recognition", name: "全量识别" },
  { id: "accept", name: "待受理" },
  { id: "dispose", name: "待处置" },
  { id: "check", name: "待核查" },
]

/** AI实时治理各二级下的操作权限（全量识别无操作） */
export const LIVE_TAB_OPS: Record<string, string[]> = {
  recognition: [],
  accept: ["受理", "撤回办理", "转复核", "不立案", "派发", "复核", "申请作废"],
  dispose: ["认领", "处置", "自核查", "申请结案", "申请作废"],
  check: ["外场核查", "申请结案", "申请作废", "确认闭环"],
}

export const CONFIG_PAGES = [
  { id: "org", name: "组织" },
  { id: "post", name: "岗位" },
  { id: "role", name: "角色" },
  { id: "account", name: "账号" },
  { id: "rule", name: "规则" },
  { id: "route", name: "去向" },
  { id: "sla", name: "时限" },
  { id: "claim", name: "领取" },
  { id: "std", name: "事件标准" },
]

export const FEATURES = [
  { key: "dashboard", name: "治理大屏" },
  { key: "live", name: "AI实时治理" },
  { key: "archive", name: "事件档案" },
  { key: "stats", name: "AI统计" },
  { key: "workbench", name: "AI工作台" },
  { key: "config", name: "治理配置" },
] as const

export type FeatureKey = (typeof FEATURES)[number]["key"]

/** 角色表格里功能权限的展示顺序（勾选顺序见 FEATURES） */
const FEATURE_DISPLAY_ORDER: FeatureKey[] = [
  "config",
  "dashboard",
  "live",
  "archive",
  "stats",
  "workbench",
]

export const FEATURE_NAME: Record<FeatureKey, string> = {
  dashboard: "治理大屏",
  live: "AI实时治理",
  archive: "事件档案",
  stats: "AI统计",
  workbench: "AI工作台",
  config: "治理配置",
}

/* ── 事件引用工具 ─────────────────────────────────────── */

export function encodeRef(r: EventRef): string {
  switch (r.level) {
    case "all":
      return "all"
    case "none":
      return "none"
    case "category":
      return `cat:${r.value}`
    case "major":
      return `maj:${r.value}`
    case "minor":
      return `min:${r.value}`
  }
}

export function decodeRef(s: string): EventRef {
  if (s === "all") return { level: "all" }
  if (s === "none") return { level: "none" }
  if (s.startsWith("cat:")) return { level: "category", value: s.slice(4) }
  if (s.startsWith("maj:")) return { level: "major", value: s.slice(4) }
  return { level: "minor", value: s.slice(4) }
}

/** 规则事件类型的展示文本 */
export function ruleEventText(r: EventRef): string {
  return r.level === "none" ? "不限" : r.value
}

/** 岗位/时限里事件引用的展示文本 */
export function refText(r: EventRef): string {
  return r.level === "all" ? "全部事件" : r.value
}

/** 事件引用列表 → 展示文本（"垃圾满溢、占道经营" / "全部事件"） */
export function refListText(refs: EventRef[]): string {
  return refs.map(refText).join("、")
}

/** 事件引用的稳定键（规则查重用） */
export function refKey(r: EventRef): string {
  return encodeRef(r)
}

let seq = 0
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`
}

/* ── 种子数据 ─────────────────────────────────────────── */

export function seedState(): ConfigState {
  const orgs: OrgNode[] = [
    { id: "o-zb", name: "东城区城市管理指挥中心", type: "区", parentId: null },
    { id: "o-yw", name: "永外街道", type: "街道", parentId: "o-zb" },
    { id: "o-jgm", name: "建国门街道", type: "街道", parentId: "o-zb" },
    { id: "o-sr", name: "市容环境管理委员会", type: "委办局", parentId: "o-zb" },
  ]

  const roles: RoleDef[] = [
    {
      id: "r-sl", name: "区受理人",
      dashboard: false, live: true, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: ["accept"],
      opsByTab: { accept: ["受理", "撤回办理", "转复核", "不立案", "派发", "申请作废"] },
    },
    {
      id: "r-zz", name: "值班长",
      dashboard: false, live: true, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: ["accept"],
      opsByTab: { accept: ["复核", "派发", "申请作废"] },
    },
    {
      id: "r-jdcz", name: "街道处置人",
      dashboard: false, live: true, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: ["dispose"],
      opsByTab: { dispose: ["认领", "处置", "自核查"] },
    },
    {
      id: "r-jdfz", name: "街道负责人",
      dashboard: false, live: true, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: ["dispose", "check"],
      opsByTab: { dispose: ["申请结案", "申请作废"], check: ["申请结案", "申请作废", "确认闭环"] },
    },
    {
      id: "r-hc", name: "核查员",
      dashboard: false, live: true, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: ["check"],
      opsByTab: { check: ["外场核查"] },
    },
    {
      id: "r-jbcz", name: "委办局处置人",
      dashboard: false, live: true, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: ["dispose"],
      opsByTab: { dispose: ["认领", "处置", "自核查"] },
    },
    {
      id: "r-jbsh", name: "委办局审核人",
      dashboard: false, live: true, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: ["dispose", "check"],
      opsByTab: { dispose: ["申请结案", "申请作废"], check: ["申请结案", "申请作废"] },
    },
    {
      id: "r-khgl", name: "客户管理员",
      dashboard: false, live: false, archive: true, stats: false, workbench: false, config: true,
      configPages: CONFIG_PAGES.map((p) => p.id), liveTabs: [],
      opsByTab: {},
    },
  ]

  const std: StdRow[] = [
    {
      id: "s-ljmy", category: "市容环境", major: "暴露垃圾", minor: "垃圾满溢",
      criteria: "垃圾桶满溢，垃圾溢出桶外", materials: "处置前后照片", status: "启用",
    },
    {
      id: "s-zdjy", category: "街面秩序", major: "占道经营", minor: "占道经营",
      criteria: "在人行道摆摊经营", materials: "现场照片", status: "启用",
    },
    {
      id: "s-xftd", category: "公共安全", major: "消防安全", minor: "消防通道堵塞",
      criteria: "消防车通道被占用", materials: "现场照片", status: "启用",
    },
  ]

  const posts: Post[] = [
    { id: "p-sl", name: "受理岗", orgId: "o-zb", roleId: "r-sl", events: [{ level: "all" }], areas: ["东城区"] },
    { id: "p-fh", name: "复核岗", orgId: "o-zb", roleId: "r-zz", events: [{ level: "all" }], areas: ["东城区"] },
    { id: "p-hc", name: "核查岗", orgId: "o-zb", roleId: "r-hc", events: [{ level: "all" }], areas: ["东城区"] },
    {
      id: "p-yw-cz", name: "街道处置岗", orgId: "o-yw", roleId: "r-jdcz",
      events: [{ level: "minor", value: "垃圾满溢" }, { level: "minor", value: "占道经营" }],
      areas: ["永外街道"],
    },
    {
      id: "p-yw-sh", name: "街道审核岗", orgId: "o-yw", roleId: "r-jdfz",
      events: [{ level: "minor", value: "垃圾满溢" }, { level: "minor", value: "占道经营" }],
      areas: ["永外街道"],
    },
    {
      id: "p-jgm-cz", name: "街道处置岗", orgId: "o-jgm", roleId: "r-jdcz",
      events: [{ level: "minor", value: "垃圾满溢" }],
      areas: ["建国门街道"],
    },
    {
      id: "p-jgm-sh", name: "街道审核岗", orgId: "o-jgm", roleId: "r-jdfz",
      events: [{ level: "minor", value: "垃圾满溢" }],
      areas: ["建国门街道"],
    },
    {
      id: "p-sr-cz", name: "委办局处置岗", orgId: "o-sr", roleId: "r-jbcz",
      events: [{ level: "minor", value: "占道经营" }],
      areas: ["东城区"],
    },
    {
      id: "p-sr-sh", name: "委办局审核岗", orgId: "o-sr", roleId: "r-jbsh",
      events: [{ level: "minor", value: "占道经营" }],
      areas: ["东城区"],
    },
  ]

  const accounts: Account[] = [
    { id: "a-zm", name: "赵敏", phone: "13800001001", orgId: "o-zb", postId: "p-sl", status: "启用" },
    { id: "a-zn", name: "周宁", phone: "13800001002", orgId: "o-zb", postId: "p-fh", status: "启用" },
    { id: "a-lc", name: "李超", phone: "13800001003", orgId: "o-zb", postId: "p-hc", status: "启用" },
    { id: "a-wl", name: "王磊", phone: "13800001004", orgId: "o-yw", postId: "p-yw-cz", status: "启用" },
    { id: "a-zw", name: "张伟", phone: "13800001005", orgId: "o-yw", postId: "p-yw-cz", status: "启用" },
    { id: "a-cj", name: "陈静", phone: "13800001006", orgId: "o-yw", postId: "p-yw-sh", status: "启用" },
    { id: "a-ly", name: "刘洋", phone: "13800001007", orgId: "o-jgm", postId: "p-jgm-cz", status: "启用" },
    { id: "a-sj", name: "孙洁", phone: "13800001008", orgId: "o-jgm", postId: "p-jgm-sh", status: "启用" },
    { id: "a-mq", name: "马强", phone: "13800001009", orgId: "o-sr", postId: "p-sr-cz", status: "启用" },
    { id: "a-wq2", name: "吴倩", phone: "13800001010", orgId: "o-sr", postId: "p-sr-sh", status: "启用" },
  ]

  const rules: Rule[] = [
    { id: "ru-1", source: "摄像头识别", event: { level: "minor", value: "垃圾满溢" }, area: "永外街道", path: "大循环", org: "o-yw" },
    { id: "ru-2", source: "摄像头识别", event: { level: "minor", value: "垃圾满溢" }, area: "建国门街道", path: "大循环", org: "o-jgm" },
    { id: "ru-3", source: "监督员上报", event: { level: "minor", value: "占道经营" }, area: "东城区", path: "大循环", org: "o-sr" },
    { id: "ru-4", source: "消防上报", event: { level: "none" }, area: "不限", path: "大循环", org: "manual" },
    { id: "ru-5", source: "群众上报", event: { level: "none" }, area: "不限", path: "大循环", org: "manual" },
    { id: "ru-6", source: "街道自行发现", event: { level: "minor", value: "垃圾满溢" }, area: "永外街道", path: "小循环", org: "o-yw" },
  ]

  const slas: Sla[] = [
    {
      id: "sl-1",
      events: [{ level: "minor", value: "垃圾满溢" }],
      disposal: "4小时", check: "2小时",
    },
    {
      id: "sl-2",
      events: [{ level: "minor", value: "占道经营" }, { level: "minor", value: "消防通道堵塞" }],
      disposal: "1小时", check: "1小时",
    },
  ]

  const claim: ClaimRow[] = [
    { id: "accept", todo: "待受理", count: 5 },
    { id: "check", todo: "待核查", count: 5 },
  ]

  return { seedRev: 2, orgs, posts, roles, accounts, rules, slas, claim, std }
}

/* ── 查找辅助 ─────────────────────────────────────────── */

export function orgName(state: ConfigState, id: string): string {
  return state.orgs.find((o) => o.id === id)?.name ?? "—"
}

export function roleName(state: ConfigState, id: string): string {
  return state.roles.find((r) => r.id === id)?.name ?? "—"
}

/** 角色功能权限单元格文本（"AI实时治理（待受理）" / "治理配置（全部二级）、事件档案"） */
export function roleFeatureText(role: RoleDef): string {
  const parts: string[] = []
  for (const key of FEATURE_DISPLAY_ORDER) {
    if (key === "config") {
      if (role.config) {
        const all = role.configPages.length === CONFIG_PAGES.length
        const names = CONFIG_PAGES.filter((p) => role.configPages.includes(p.id)).map((p) => p.name)
        parts.push(`治理配置（${all ? "全部二级" : names.join("、")}）`)
      }
    } else if (key === "live") {
      if (role.live) {
        const names = LIVE_TABS.filter((t) => role.liveTabs.includes(t.id)).map((t) => t.name)
        parts.push(`AI实时治理（${names.join("、")}）`)
      }
    } else if (role[key]) {
      parts.push(FEATURE_NAME[key])
    }
  }
  return parts.join("、")
}

/** 角色操作权限单元格文本：操作写在其所属二级后面（无 → "无"） */
export function roleOpsText(role: RoleDef): string {
  if (!role.live) return "无"
  const parts: string[] = []
  for (const tab of LIVE_TABS) {
    const ops = role.opsByTab[tab.id]
    if (ops && ops.length > 0) parts.push(`${tab.name}：${ops.join("、")}`)
  }
  return parts.length > 0 ? parts.join("；") : "无"
}

/** 小类是否被某条规则或某个岗位用上（用于「停用」是否可点） */
export function stdInUse(state: ConfigState, minor: string): boolean {
  return (
    state.rules.some((r) => r.event.level === "minor" && r.event.value === minor) ||
    state.posts.some((p) => p.events.some((e) => e.level === "minor" && e.value === minor))
  )
}

/** 小类是否启用 */
export function minorEnabled(state: ConfigState, minor: string): boolean {
  const row = state.std.find((s) => s.minor === minor)
  return !!row && row.status === "启用"
}

/** 事件引用下拉的分组选项：全部事件 / 分类 / 大类 / 小类（小类只列启用的，已在引用里的停用小类保留可选） */
export function eventOptionGroups(state: ConfigState, current: EventRef[]) {
  const categories = Array.from(new Set(state.std.map((s) => s.category)))
  const majors = Array.from(new Set(state.std.map((s) => s.major)))
  const enabledMinors = state.std.filter((s) => s.status === "启用").map((s) => s.minor)
  const keptStopped = current
    .filter((r) => r.level === "minor" && !enabledMinors.includes(r.value))
    .map((r) => (r as { value: string }).value)
  return [
    { label: undefined as string | undefined, options: [{ value: "all", label: "全部事件" }] },
    { label: "分类", options: categories.map((c) => ({ value: `cat:${c}`, label: c })) },
    { label: "大类", options: majors.map((m) => ({ value: `maj:${m}`, label: m })) },
    {
      label: "小类",
      options: [...enabledMinors, ...keptStopped].map((m) => ({ value: `min:${m}`, label: m })),
    },
  ]
}

/** 规则事件类型下拉的分组选项：不限 / 分类 / 大类 / 小类（小类只列启用的，当前值保留） */
export function ruleEventOptionGroups(state: ConfigState, current: EventRef) {
  const categories = Array.from(new Set(state.std.map((s) => s.category)))
  const majors = Array.from(new Set(state.std.map((s) => s.major)))
  const enabled = state.std.filter((s) => s.status === "启用")
  const currentMinor =
    current.level === "minor" && !enabled.some((s) => s.minor === current.value) ? [current.value] : []
  return [
    { label: undefined as string | undefined, options: [{ value: "none", label: "不限" }] },
    { label: "分类", options: categories.map((c) => ({ value: `cat:${c}`, label: c })) },
    { label: "大类", options: majors.map((m) => ({ value: `maj:${m}`, label: m })) },
    {
      label: "小类",
      options: [...enabled.map((s) => s.minor), ...currentMinor].map((m) => ({ value: `min:${m}`, label: m })),
    },
  ]
}
