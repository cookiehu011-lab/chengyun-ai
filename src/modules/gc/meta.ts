// 治理配置 · 模块元数据（左导航 / 面包屑 / 发布清单共用）
// mode = "ledger" 的模块是责任台账：保存即生效，不经草稿发布（PRD 2026-09-22）
// 平台分组（客户 / SeeTime 用户）仅在 SaaS 部署下出现；私有化直接是唯一客户
export type ModuleGroup = "平台" | "治理基础" | "流程运行" | "持续治理" | "配置管理"

export interface GcModuleMeta {
  id: string
  name: string
  group: ModuleGroup
  h1: string
  desc: string
  /** 责任台账：保存即生效，不参与草稿 / 发布 */
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
  { id: "eventstd", name: "事件标准", group: "流程运行", h1: "事件标准", desc: "问题分类字典、立案标准、原因字典；细类互斥冲突阻断发布" },
  { id: "lifecycle", name: "生命周期与处置规则", group: "流程运行", h1: "生命周期与处置规则", desc: "阶段骨架、流转规则、自动结案；互斥冲突阻断发布" },
  { id: "sla", name: "时限与异常监控", group: "流程运行", h1: "时限与异常监控", desc: "全局计时口径与时限矩阵；重复启用行阻断发布" },
  { id: "dispatch", name: "Agent 派工与认领", group: "流程运行", h1: "Agent 派工与认领", desc: "领取批次、回收链路、紧急置顶；批次全部停用阻断发布" },
  { id: "dedup", name: "查重与复发治理", group: "持续治理", h1: "查重与复发治理", desc: "判重条件、复发识别、候选专题；缺空间条件阻断发布" },
  { id: "metric", name: "治理评价标准", group: "持续治理", h1: "治理评价标准", desc: "考核目标、指标口径、难度校正；校正关闭时参与比较的指标阻断发布" },
  { id: "publish", name: "发布与审计", group: "配置管理", h1: "发布与审计", desc: "规则模块的草稿冲突校验、发布前预览、版本历史与回滚；责任台账即时生效不经发布" },
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
