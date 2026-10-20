// 治理配置 · 模块元数据（左导航 / 面包屑共用）
// 所有模块统一「编辑 → 保存即生效」：每次保存写入配置并生成一条变更记录（PRD 2026-09-22）
// 平台分组（客户 / SeeTime 用户）仅在 SaaS 部署下出现；私有化直接是唯一客户
export type ModuleGroup = "平台" | "治理基础" | "流程运行" | "持续治理" | "配置管理"

export interface GcModuleMeta {
  id: string
  name: string
  group: ModuleGroup
  h1: string
  desc: string
  /** 责任台账：保存即生效，并在变更记录中留痕 */
  mode?: "ledger"
  /** 平台模块：仅在 SaaS 部署模式出现 */
  platform?: boolean
}

export const GROUPS: ModuleGroup[] = ["平台", "治理基础", "流程运行", "持续治理", "配置管理"]

export const MODULES: GcModuleMeta[] = [
  { id: "customers", name: "客户", group: "平台", h1: "客户", mode: "ledger", platform: true, desc: "SaaS 多客户：仅含「超管」的 SeeTime 账号可新建 / 停用客户；开客户必填第一名管理员（步骤=改配置）；客户停用后其账号不能登录" },
  { id: "seetime", name: "SeeTime 用户", group: "平台", h1: "SeeTime 用户", mode: "ledger", platform: true, desc: "SeeTime 账号按功能权限配置：超管 / 客户展示（至少 1 项）；环境保留至少一名启用的超管；不办理、不改客户治理基础" },
  { id: "org", name: "组织、账号与角色", group: "治理基础", h1: "组织、账号与角色", mode: "ledger", desc: "自定义角色绑定冻结步骤；账号配置角色、范围、负责的事件类型；保存即生效" },
  { id: "space", name: "空间与责任关系", group: "治理基础", h1: "空间与责任关系", mode: "ledger", desc: "网格同步只读；每格唯一主责与一名协同监督；待定责或主责停用时派发不可用；保存即生效" },
  { id: "eventstd", name: "事件标准", group: "流程运行", h1: "事件标准", desc: "维护本区域事件分类、立案标准和办理所需材料。保存后立即生效。" },
  { id: "lifecycle", name: "生命周期与处置规则", group: "流程运行", h1: "生命周期与处置规则", desc: "阶段与底线规则由系统固定；本页只读展示。" },
  { id: "sla", name: "办理时限与提醒", group: "流程运行", h1: "办理时限与提醒", desc: "全局计时口径与时限矩阵；超时只提醒并显示超时标识，不改变事件状态。" },
  { id: "dispatch", name: "待办领取", group: "流程运行", h1: "待办领取", desc: "配置每次领取件数；保存后立即生效" },
  { id: "metric", name: "治理评价标准", group: "持续治理", h1: "治理评价标准", desc: "考核目标、指标口径、难度校正；流程规则由系统固定，本页只读展示。" },
  { id: "publish", name: "变更记录", group: "配置管理", h1: "变更记录", desc: "所有配置保存后自动留痕：时间、操作人、配置模块与变更内容" },
]

// ─── 演示身份（身份切换器） ───────────────────────────────────────────────────
// kind = customer：映射到某客户责任台账中的同名账号，消费「角色 → 功能菜单权限」
// kind = seetime：映射到平台层 SeeTime 账号，消费功能权限（超管 / 客户展示）
// 私有化部署下，SeeTime 身份不出现（PRD：私有化无 SeeTime 用户）

export interface Persona {
  id: string
  label: string
  /** 真实姓名（审计留痕 author 用） */
  name: string
  kind: "customer" | "seetime"
  /** kind=customer：所属客户 id */
  cid?: string
  /** kind=seetime：SeeTime 账号 id */
  sid?: string
}

export const PERSONAS: Persona[] = [
  { id: "p-wq", label: "王倩 · 东城区客户管理员", name: "王倩", kind: "customer", cid: "c-dc" },
  { id: "p-zm", label: "赵敏 · 东城区审核与派发", name: "赵敏", kind: "customer", cid: "c-dc" },
  { id: "p-ly", label: "刘洋 · 东城区网格责任人", name: "刘洋", kind: "customer", cid: "c-dc" },
  { id: "p-gj", label: "高建 · 西城区客户管理员", name: "高建", kind: "customer", cid: "c-xc" },
  { id: "p-sys", label: "系统运营 · SeeTime 超管", name: "系统运营", kind: "seetime", sid: "st-sys" },
  { id: "p-ly2", label: "陆遥 · SeeTime 客户展示", name: "陆遥", kind: "seetime", sid: "st-ly" },
]
