// 治理配置 · 原生版壳（替代 iframe 集成的 29 页静态原型）
// 左导航：平台（SaaS 专属）+ 治理基础 + 规则模块分组 + 内容区 + 全局身份选择器
// 产品规则（PRD 2026-09-22）：
// - 部署模式安装时确定（演示环境提供切换仅作演示）：SaaS=客户+SeeTime 用户；私有化=唯一客户、无 SeeTime
// - 身份模型（平台全局）：账号 → 客户上下文 → 活动角色；由 App 顶栏统一持有，本页只消费
// - 客户身份按「当前所选角色 → 功能菜单权限」看治理配置子模块（非角色并集）；
//   SeeTime 身份：超管 → 平台模块；客户展示 → 无权限空态
// - 所有模块统一「编辑 → 保存即生效」；每次保存写入变更记录
import { useEffect, useMemo, useState } from "react"
import { ToastProvider, useGc } from "./store"
import { ModuleContent } from "./defs"
import { GROUPS, MODULES } from "./meta"
import { isCustomerExpired } from "./identity"
import {
  availablePersonas,
  identityForPersona,
  resolveIdentity,
  type IdentityState,
} from "./identity"

function ModeChip({ mode }: { mode: "saas" | "private" }) {
  return (
    <span
      style={{
        fontSize: "9px", padding: "1px 7px", borderRadius: "999px", whiteSpace: "nowrap",
        border: "1px solid var(--border)", color: "var(--muted-foreground)",
      }}
    >
      {mode === "saas" ? "SaaS" : "私有化"}
    </span>
  )
}

function Shell({
  identity,
  onIdentityChange,
}: {
  identity: IdentityState
  onIdentityChange: (next: IdentityState) => void
}) {
  const { state, dispatch } = useGc()
  const mode = state.platform.mode
  const [activeId, setActiveId] = useState("org")

  // 全局身份解析：账号 / 客户上下文 / 活动角色（失效自动校正）
  const view = useMemo(() => resolveIdentity(state, identity), [state, identity])
  const { persona, cid, customer, ledger, roleKey, roleName, accountMissing } = view
  const meta = MODULES.find((m) => m.id === activeId)!
  const author = accountMissing ? persona.label : `${persona.name} · ${roleName || "未关联角色"}`

  // ─── 导航与权限（按「当前所选角色」计算，非角色并集） ────────────────────────
  // 客户身份：所选角色的功能菜单决定治理配置子模块；台账无同名账号 → 不限制（历史行为）
  // SeeTime 身份：超管 → 平台两页；客户展示 → 治理配置内无可用页面
  const { visibleIds, navGroups } = useMemo(() => {
    // 客户侧隐藏：生命周期与处置规则、治理评价标准（持续治理分组随 metric 一同消失）
    const CUSTOMER_HIDDEN = new Set(["lifecycle", "metric"])
    if (persona.kind === "seetime") {
      const platformIds = roleKey === "super" ? MODULES.filter((m) => m.platform).map((m) => m.id) : []
      // SeeTime 账号（系统运营 / 陆遥）可维护治理评价标准
      const ids = [...platformIds, "metric"]
      return { visibleIds: ids, navGroups: ["平台", "持续治理"] as const }
    }
    if (accountMissing || !ledger) {
      const ids = MODULES.filter((m) => !m.platform && !CUSTOMER_HIDDEN.has(m.id)).map((m) => m.id)
      return { visibleIds: ids, navGroups: null }
    }
    const role = ledger.roles.find((r) => r.id === roleKey)
    if (!role || role.status !== "启用") return { visibleIds: [] as string[], navGroups: null }
    const hasConfig = (role.menus ?? []).includes("config")
    const ids = hasConfig
      ? (role.configModules ?? []).filter((id) => {
          const m = MODULES.find((x) => x.id === id)
          return !!m && !m.platform && !CUSTOMER_HIDDEN.has(id)
        })
      : []
    return { visibleIds: ids, navGroups: null }
  }, [persona, ledger, roleKey, accountMissing])

  const platformPersona = persona.kind === "seetime"
  const noAccess = !platformPersona && (visibleIds.length === 0 || !visibleIds.includes(activeId))
  const displayOnlyNoAccess = platformPersona && visibleIds.length === 0

  // 切换身份 / 部署模式后，落在第一个可见模块上
  useEffect(() => {
    if (persona.kind === "seetime") {
      const target = visibleIds[0] ?? "customers"
      if (!visibleIds.includes(activeId)) setActiveId(target)
      return
    }
    if (visibleIds.length > 0 && !visibleIds.includes(activeId)) setActiveId(visibleIds[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.personaId, identity.roleKey, identity.cid, mode])

  // 演示切换部署模式：私有化下仅保留东城区客户身份，当前身份不可用则自动落回
  function switchMode(next: "saas" | "private") {
    if (next === mode) return
    dispatch({ type: "platform-mode", mode: next })
    if (next === "private" && !availablePersonas("private").some((p) => p.id === persona.id)) {
      onIdentityChange(identityForPersona(state, "p-wq"))
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden", backgroundColor: T_BG }}>
      {/* 左导航 */}
      <aside
        aria-label="治理配置模块导航"
        style={{
          width: "264px", minWidth: "264px", borderRight: "1px solid var(--border)",
          backgroundColor: "var(--sidebar-bg, var(--card-2))", overflowY: "auto",
          padding: "12px 10px",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "4px 8px 10px", borderBottom: "1px solid var(--border)", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>治理配置</div>
            <ModeChip mode={mode} />
          </div>
          <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "3px", lineHeight: 1.6 }}>
            {platformPersona
              ? "平台管理 · SeeTime 身份"
              : `${customer?.name ?? "—"} · ${persona.kind === "customer" ? "客户上下文" : ""}`}
            {mode === "saas" && !platformPersona && "（SaaS 多客户中的这一家）"}
            {mode === "private" && "（私有化 · 安装时确定的唯一客户）"}
          </div>
        </div>

        {displayOnlyNoAccess && (
          <div style={{ padding: "14px 10px", fontSize: "11px", color: "var(--amber)", lineHeight: 1.8 }}>
            当前 SeeTime 账号仅含「客户展示」权限：治理配置中没有可编辑页面。
            客户大屏、统计、档案请在对应入口查看被授权的客户。
          </div>
        )}

        {navGroups
          ? navGroups.map((g) => {
              const mods = MODULES.filter((m) => m.group === g && visibleIds.includes(m.id))
              if (mods.length === 0) return null
              return (
                <div key={g} style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", color: "var(--muted-foreground)", fontWeight: 600, letterSpacing: "0.05em", padding: "6px 8px 4px" }}>
                    {g}
                  </div>
                  {mods.map((m) => (
                    <NavBtn key={m.id} m={m} on={m.id === activeId} onClick={() => setActiveId(m.id)} />
                  ))}
                </div>
              )
            })
          : GROUPS.filter((g) => g !== "平台").map((g) => {
              const mods = MODULES.filter((m) => m.group === g && visibleIds.includes(m.id))
              if (mods.length === 0) return null
              return (
                <div key={g} style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", color: "var(--muted-foreground)", fontWeight: 600, letterSpacing: "0.05em", padding: "6px 8px 4px" }}>
                    {g}
                  </div>
                  {mods.map((m) => (
                    <NavBtn key={m.id} m={m} on={m.id === activeId} onClick={() => setActiveId(m.id)} />
                  ))}
                </div>
              )
            })}

        {/* 部署模式（演示切换） */}
        <div style={{ marginTop: "auto", paddingTop: "12px" }}>
          <div style={{ padding: "10px", borderRadius: "8px", border: "1px dashed var(--border)", fontSize: "10px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            <div style={{ marginBottom: "6px", fontWeight: 600 }}>部署模式（演示切换）</div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
              {(["saas", "private"] as const).map((k) => (
                <button
                  key={k} type="button"
                  onClick={() => switchMode(k)}
                  style={{
                    flex: 1, fontSize: "10px", padding: "4px 0", borderRadius: "6px", cursor: "pointer",
                    border: `1px solid ${mode === k ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: mode === k ? "rgba(50,109,255,0.1)" : "var(--background)",
                    color: mode === k ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                >
                  {k === "saas" ? "SaaS" : "私有化"}
                </button>
              ))}
            </div>
            实际安装时确定，运行中不能在页面修改。私有化：唯一客户，无 SeeTime 用户。
          </div>
        </div>
      </aside>

      {/* 内容区 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 面包屑 + 全局身份（与主应用顶栏共用同一份状态） */}
        <div
          aria-label="面包屑"
          style={{
            display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px",
            borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)", flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>治理配置</span>
          <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>/</span>
          <span style={{ fontSize: "12px", fontWeight: 600 }}>{meta.name}</span>
          {!platformPersona && customer && (
            <span
              style={{
                fontSize: "10px", padding: "2px 8px", borderRadius: "999px",
                backgroundColor: "rgba(53,185,133,0.1)", color: "var(--green)", border: "1px solid rgba(53,185,133,0.25)",
              }}
            >
              {customer.name}{customer.status === "停用" ? "（已停用）" : ""}
            </span>
          )}
        </div>

        {/* SaaS 服务到期横幅：当前客户上下文的服务已到期（含超管进入到期客户） */}
        {isCustomerExpired(customer) && (
          <div
            aria-label="服务到期提示"
            style={{
              display: "flex", alignItems: "center", gap: "8px", margin: "10px 20px 0",
              padding: "8px 12px", borderRadius: "8px", fontSize: "11px", lineHeight: 1.6,
              color: "var(--red)", backgroundColor: "rgba(228,94,88,0.08)", border: "1px solid rgba(228,94,88,0.3)",
            }}
          >
            <span style={{ fontWeight: 700 }}>服务已到期</span>
            <span>
              客户「{customer?.name}」服务已于 {customer?.expiresAt} 到期：该客户全部账号暂停登录，当前会话为到期只读状态；请由 SeeTime 平台在「客户」页续期后恢复。
            </span>
          </div>
        )}

        {/* 滚动内容 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
            <div>
              <h1 style={{ fontSize: "17px", fontWeight: 600, margin: 0, marginBottom: "4px" }}>{meta.h1}</h1>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>{meta.desc}</div>
            </div>
          </div>

          {/* 保存即生效提示（变更记录页自身不显示；生命周期与处置规则页为只读展示，同样不显示） */}
          {activeId !== "publish" && activeId !== "lifecycle" && (
            <div style={{
              padding: "8px 12px", marginBottom: "12px", borderRadius: "7px", fontSize: "11px", lineHeight: 1.7,
              backgroundColor: "rgba(53,185,133,0.07)", border: "1px solid rgba(53,185,133,0.22)", color: "var(--green)",
            }}>
              修改保存后立即生效，并写入「变更记录」；已派发事件与已派出外场任务的责任人保持不变。
              {!platformPersona && customer ? `当前客户：${customer.name}。` : ""}
            </div>
          )}

          {displayOnlyNoAccess ? (
            <div style={{
              margin: "40px auto", maxWidth: "460px", textAlign: "center",
              padding: "28px 24px", borderRadius: "10px", border: "1px solid var(--border)", backgroundColor: "var(--card)",
            }}>
              <div style={{ fontSize: "26px", marginBottom: "10px" }}>👁️</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>客户展示身份 · 无治理配置页面</div>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.8 }}>
                SeeTime 账号「{persona.name}」仅含「客户展示」功能权限：只能查看被勾选客户的大屏、统计、档案，
                <br />
                不能新建客户、管理 SeeTime 账号，也不能改任何一家的治理基础。
                <br />
                在右上角切换账号到「系统运营」（SeeTime 超管）演示平台管理。
              </div>
            </div>
          ) : noAccess ? (
            <div style={{
              margin: "40px auto", maxWidth: "460px", textAlign: "center",
              padding: "28px 24px", borderRadius: "10px", border: "1px solid var(--border)", backgroundColor: "var(--card)",
            }}>
              <div style={{ fontSize: "26px", marginBottom: "10px" }}>🔒</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>暂无访问权限</div>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.8 }}>
                当前身份「{author}」的角色未分配「{meta.name}」的功能菜单权限。
                <br />
                可在右上角切换该账号的其他角色，或由客户管理员在「组织、账号与角色 → 角色」中为角色勾选功能菜单，保存后立即生效。
              </div>
            </div>
          ) : (
            <ModuleContent id={activeId} author={author} cid={cid} orgSynced={customer?.orgSynced ?? true} />
          )}
        </div>
      </div>
    </div>
  )
}

function NavBtn({ m, on, onClick }: {
  m: { id: string; name: string }
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      key={m.id}
      type="button"
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "8px",
        padding: "8px 10px", marginBottom: "2px", borderRadius: "7px", cursor: "pointer",
        border: `1px solid ${on ? "var(--primary)" : "transparent"}`,
        backgroundColor: on ? "rgba(50,109,255,0.1)" : "transparent",
        color: on ? "var(--primary)" : "var(--foreground)", textAlign: "left",
        fontSize: "12px",
      }}
    >
      <span style={{ flex: 1, fontWeight: on ? 600 : 400 }}>{m.name}</span>
    </button>
  )
}

const T_BG = "var(--background)"

export default function GovernanceConfigNative({
  identity,
  onIdentityChange,
}: {
  identity: IdentityState
  onIdentityChange: (next: IdentityState) => void
}) {
  return (
    <ToastProvider>
      <Shell identity={identity} onIdentityChange={onIdentityChange} />
    </ToastProvider>
  )
}
