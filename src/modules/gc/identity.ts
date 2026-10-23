// 平台全局身份模型：账号 → 客户上下文 → 活动角色
// 顶栏右上角与治理配置页共用同一份身份状态（App.tsx 持有，治理配置只消费）。
// 选择规则（PRD 2026-09-22 · 平台全局身份）：
// - SeeTime 账号：超管可进入全部启用客户；客户展示仅可进入被勾选客户；
//   分配了多个客户 → 客户可下拉切换；仅 1 个客户 → 静态展示该客户
// - 客户账号：客户固定为所属客户；角色 = 台账中配置的角色，多个时可下拉切换
// - 角色 = 权限边界：治理配置按「当前所选角色」计算可见模块（不是角色并集）
import { PERSONAS, type Persona } from "./meta"
import type { Customer, DeployMode, GcState, LedgerState, SeeTimePerm } from "./store"

export interface IdentityState {
  /** 当前账号（meta.ts PERSONAS 的 id） */
  personaId: string
  /** 活动客户上下文 id（客户账号固定为其所属客户） */
  cid: string
  /** 活动角色 key：客户身份 = 台账角色 id；SeeTime 身份 = 功能权限 key（super / display） */
  roleKey: string
}

// V1.1 起键带版本号：与 /v1/（app-identity-v1）、/v1.1/（app-identity-v1.1）互不读写
export const IDENTITY_STORAGE_KEY = "app-identity-v1.2"

export function loadIdentity(): IdentityState | null {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<IdentityState>
    if (p && typeof p.personaId === "string" && p.personaId) {
      return { personaId: p.personaId, cid: typeof p.cid === "string" ? p.cid : "", roleKey: typeof p.roleKey === "string" ? p.roleKey : "" }
    }
  } catch { /* ignore */ }
  return null
}

export function saveIdentity(id: IdentityState) {
  try { localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(id)) } catch { /* ignore */ }
}

/** SeeTime 功能权限作为「角色」参与右上角选择 */
export const PERM_ROLE_NAME: Record<SeeTimePerm, string> = { super: "超管", display: "客户展示" }

/** 服务到期判断（SaaS 登录拦截）：服务到期时间已过 → 该客户的账号暂停登录 */
export function isCustomerExpired(c?: { expiresAt?: string } | null): boolean {
  if (!c?.expiresAt) return false
  return new Date(c.expiresAt + "T23:59:59").getTime() < Date.now()
}

export interface RoleOption {
  /** 客户身份 = 角色 id；SeeTime 身份 = perm key */
  key: string
  name: string
}

/** 部署模式下的可选账号：私有化只有唯一客户（东城区）的客户身份，无 SeeTime */
export function availablePersonas(mode: DeployMode): Persona[] {
  if (mode === "private") return PERSONAS.filter((p) => p.kind === "customer" && p.cid === "c-dc")
  return PERSONAS
}

/** 某账号可进入的客户上下文列表 */
export function customersForPersona(platform: GcState["platform"], persona: Persona): Customer[] {
  if (persona.kind === "customer") {
    return platform.customers.filter((c) => c.id === persona.cid)
  }
  const st = platform.seeTime.find((s) => s.id === persona.sid)
  if (!st) return []
  if (st.perms.includes("super")) return platform.customers.filter((c) => c.status === "启用")
  const picked = platform.customers.filter((c) => st.displayCustomers.includes(c.id))
  const enabled = picked.filter((c) => c.status === "启用")
  return enabled.length > 0 ? enabled : picked
}

/** 某账号在某客户上下文下的可选角色（客户身份只取启用角色，全部停用则回退全部） */
export function rolesForPersona(state: Pick<GcState, "platform" | "ledgers">, persona: Persona, cid: string): RoleOption[] {
  if (persona.kind === "seetime") {
    const st = state.platform.seeTime.find((s) => s.id === persona.sid)
    return (st?.perms ?? []).map((p) => ({ key: p, name: PERM_ROLE_NAME[p] }))
  }
  const ledger = state.ledgers[cid]
  if (!ledger) return []
  const account = ledger.accounts.find((a) => a.name === persona.name)
  if (!account) return []
  const referenced = account.roles
    .map((rid) => ledger.roles.find((r) => r.id === rid))
    .filter((r): r is NonNullable<typeof r> => !!r)
  const enabled = referenced.filter((r) => r.status === "启用")
  return (enabled.length > 0 ? enabled : referenced).map((r) => ({ key: r.id, name: r.name }))
}

/** 以某账号为当前身份，生成默认身份状态（客户取第一个可选，角色取第一个可选） */
export function identityForPersona(state: Pick<GcState, "platform" | "ledgers">, personaId: string): IdentityState {
  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]
  const customers = customersForPersona(state.platform, persona)
  const cid = customers[0]?.id ?? ""
  const roles = rolesForPersona(state, persona, cid)
  return { personaId: persona.id, cid, roleKey: roles[0]?.key ?? "" }
}

export interface IdentityView {
  persona: Persona
  /** 生效客户 id（已按可选范围校正） */
  cid: string
  customer?: Customer
  /** 生效角色 key（已按可选范围校正） */
  roleKey: string
  roleName: string
  roles: RoleOption[]
  customers: Customer[]
  ledger?: LedgerState
  /** 客户账号在台账中找不到同名账号（历史行为：不限制） */
  accountMissing: boolean
  /** 顶栏展示用：「姓名 · 角色」 */
  displayLabel: string
}

/** 校正并解析身份：personaId / cid / roleKey 失效时自动落到第一个可选项 */
export function resolveIdentity(state: Pick<GcState, "platform" | "ledgers">, identity: IdentityState): IdentityView {
  const options = availablePersonas(state.platform.mode)
  let persona = PERSONAS.find((p) => p.id === identity.personaId)
  if (!persona || !options.some((p) => p.id === persona!.id)) persona = options[0] ?? PERSONAS[0]
  const customers = customersForPersona(state.platform, persona)
  const cid = persona.kind === "customer"
    ? persona.cid ?? customers[0]?.id ?? ""
    : customers.some((c) => c.id === identity.cid) ? identity.cid : customers[0]?.id ?? ""
  const roles = rolesForPersona(state, persona, cid)
  const roleKey = roles.some((r) => r.key === identity.roleKey) ? identity.roleKey : roles[0]?.key ?? ""
  const customer = state.platform.customers.find((c) => c.id === cid)
  const ledger = cid ? state.ledgers[cid] : undefined
  const roleName = persona.kind === "seetime"
    ? (PERM_ROLE_NAME as Record<string, string>)[roleKey] ?? (roleKey || "—")
    : roles.find((r) => r.key === roleKey)?.name ?? ""
  const accountMissing = persona.kind === "customer" && !ledger?.accounts.some((a) => a.name === persona.name)
  return {
    persona,
    cid,
    customer,
    roleKey,
    roleName,
    roles,
    customers,
    ledger,
    accountMissing,
    displayLabel: `${persona.name} · ${roleName || "未关联角色"}`,
  }
}
