// 平台全局身份选择器（主应用顶栏右上角 / 治理配置页顶栏共用）
// 结构：[账号 ▾] │ 客户 [值 ▾?] │ 角色 [值 ▾?]
// 交互规则：
// - 账号：始终可切换（按部署模式过滤可选项）
// - 客户：SeeTime 账号分配多个客户时可下拉切换；仅 1 个客户或客户账号 → 静态展示
// - 角色：有多个可选角色时可下拉切换；仅 1 个 → 静态展示
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useGc } from "./store"
import {
  availablePersonas,
  identityForPersona,
  isCustomerExpired,
  resolveIdentity,
  type IdentityState,
} from "./identity"

type MenuKey = "account" | "customer" | "role"

const panelStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 6px)",
  zIndex: 80,
  minWidth: 224,
  border: "1px solid var(--border)",
  borderRadius: 10,
  backgroundColor: "var(--panel-solid, var(--card))",
  boxShadow: "var(--shadow-lg)",
  padding: 4,
}

function Caret() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55, flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function IdentityPicker({
  identity,
  onChange,
}: {
  identity: IdentityState
  onChange: (next: IdentityState) => void
}) {
  const { state } = useGc()
  const view = resolveIdentity(state, identity)
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const [blockMsg, setBlockMsg] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenu) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [openMenu])

  const accounts = availablePersonas(state.platform.mode)
  const customerSwitchable = view.customers.length > 1
  const roleSwitchable = view.roles.length > 1

  const segmentStyle = (switchable: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 9px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "transparent",
    cursor: switchable ? "pointer" : "default",
    color: "var(--foreground)",
    transition: "background 0.15s ease",
  })

  const labelStyle: CSSProperties = {
    fontSize: 10,
    color: "var(--muted-foreground)",
    fontWeight: 500,
    flexShrink: 0,
  }
  const valueStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  }

  function pickAccount(id: string) {
    setBlockMsg("")
    const target = accounts.find((p) => p.id === id)
    // SaaS 登录拦截：客户所属服务已到期 → 该客户账号不能登录（SeeTime 平台账号不受限）
    if (target && target.kind === "customer") {
      const cust = state.platform.customers.find((c) => c.id === target.cid)
      if (isCustomerExpired(cust)) {
        setBlockMsg(`客户「${cust?.name}」服务已于 ${cust?.expiresAt} 到期，账号暂停登录；请由 SeeTime 平台为客户续期后恢复。`)
        return
      }
    }
    setOpenMenu(null)
    if (id === view.persona.id) return
    onChange(identityForPersona(state, id))
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="账号、客户与角色切换"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 12,
        border: "1px solid var(--border)",
        backgroundColor: "var(--chip-bg, var(--card-2))",
        boxShadow: "inset 0 1px 0 var(--inset-hi, rgba(255,255,255,0.4))",
        position: "relative",
      }}
    >
      {/* 账号段 */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={openMenu === "account"}
          title="切换账号"
          style={{ ...segmentStyle(true) }}
          onClick={() => setOpenMenu(openMenu === "account" ? null : "account")}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--chip-bg-hover, rgba(148,163,184,0.14))" }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary, #326DFF) 0%, #5A8BFF 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {view.persona.name.slice(0, 1)}
          </span>
          <span style={{ ...valueStyle, maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis" }}>{view.persona.name}</span>
          {view.persona.kind === "customer" && isCustomerExpired(state.platform.customers.find((c) => c.id === view.persona.cid)) && (
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, flexShrink: 0, border: "1px solid rgba(228,94,88,0.35)", color: "var(--red)", whiteSpace: "nowrap" }}>
              服务到期
            </span>
          )}
          <Caret />
        </button>
        {openMenu === "account" && (
          <div style={panelStyle} role="listbox" aria-label="选择账号">
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", padding: "5px 10px 4px", fontWeight: 600 }}>
              切换账号{state.platform.mode === "private" ? "（私有化 · 仅本客户身份）" : ""}
            </div>
            {blockMsg && (
              <div style={{ fontSize: 10.5, lineHeight: 1.6, color: "var(--red)", backgroundColor: "rgba(228,94,88,0.08)", border: "1px solid rgba(228,94,88,0.25)", borderRadius: 7, padding: "6px 9px", margin: "2px 6px 6px" }}>
                {blockMsg}
              </div>
            )}
            {accounts.map((p) => {
              const active = p.id === view.persona.id
              const custObj = p.kind === "customer" ? state.platform.customers.find((c) => c.id === p.cid) : undefined
              const expired = isCustomerExpired(custObj)
              const cust = p.kind === "customer"
                ? custObj?.name ?? "—"
                : "SeeTime 平台账号"
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  aria-disabled={expired || undefined}
                  onClick={() => pickAccount(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    border: "none",
                    background: "none",
                    cursor: expired ? "not-allowed" : "pointer",
                    borderRadius: 7,
                    opacity: expired ? 0.55 : 1,
                    backgroundColor: active ? "rgba(50,109,255,0.08)" : "transparent",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "var(--primary)" : "var(--foreground)", flexShrink: 0 }}>
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 999,
                      flexShrink: 0,
                      border: expired ? "1px solid rgba(228,94,88,0.35)" : "1px solid var(--border)",
                      color: expired ? "var(--red)" : "var(--muted-foreground)",
                    }}
                  >
                    {expired ? `${cust} · 服务到期` : cust}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 16, backgroundColor: "var(--border)", flexShrink: 0 }} />

      {/* 客户段 */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          aria-haspopup={customerSwitchable ? "listbox" : undefined}
          aria-expanded={customerSwitchable ? openMenu === "customer" : undefined}
          title={customerSwitchable ? "切换客户上下文" : view.customer ? `所属客户：${view.customer.name}` : "客户上下文"}
          style={segmentStyle(customerSwitchable)}
          onClick={customerSwitchable ? () => setOpenMenu(openMenu === "customer" ? null : "customer") : undefined}
          onMouseEnter={customerSwitchable ? (e) => { e.currentTarget.style.backgroundColor = "var(--chip-bg-hover, rgba(148,163,184,0.14))" } : undefined}
          onMouseLeave={customerSwitchable ? (e) => { e.currentTarget.style.backgroundColor = "transparent" } : undefined}
        >
          <span style={labelStyle}>客户</span>
          <span style={valueStyle}>{view.customer?.name ?? "—"}</span>
          {customerSwitchable && <Caret />}
        </button>
        {openMenu === "customer" && customerSwitchable && (
          <div style={panelStyle} role="listbox" aria-label="选择客户">
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", padding: "5px 10px 4px", fontWeight: 600 }}>
              分配了 {view.customers.length} 个客户，切换后按该客户上下文查看与操作
            </div>
            {view.customers.map((c) => {
              const active = c.id === view.cid
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { setOpenMenu(null); onChange({ ...identity, cid: c.id }) }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    borderRadius: 7,
                    fontSize: 12,
                    color: active ? "var(--primary)" : "var(--foreground)",
                    fontWeight: active ? 700 : 400,
                    backgroundColor: active ? "rgba(50,109,255,0.08)" : "transparent",
                  }}
                >
                  <span>{c.name}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                    {c.status === "启用" ? "启用中" : "已停用"}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 16, backgroundColor: "var(--border)", flexShrink: 0 }} />

      {/* 角色段 */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          aria-haspopup={roleSwitchable ? "listbox" : undefined}
          aria-expanded={roleSwitchable ? openMenu === "role" : undefined}
          title={roleSwitchable ? "切换当前角色（权限随角色变化）" : view.roleName ? `当前角色：${view.roleName}` : "未关联角色"}
          style={segmentStyle(roleSwitchable)}
          onClick={roleSwitchable ? () => setOpenMenu(openMenu === "role" ? null : "role") : undefined}
          onMouseEnter={roleSwitchable ? (e) => { e.currentTarget.style.backgroundColor = "var(--chip-bg-hover, rgba(148,163,184,0.14))" } : undefined}
          onMouseLeave={roleSwitchable ? (e) => { e.currentTarget.style.backgroundColor = "transparent" } : undefined}
        >
          <span style={labelStyle}>角色</span>
          <span style={valueStyle}>{view.roleName || "未关联"}</span>
          {roleSwitchable && <Caret />}
        </button>
        {openMenu === "role" && roleSwitchable && (
          <div style={panelStyle} role="listbox" aria-label="选择角色">
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", padding: "5px 10px 4px", fontWeight: 600 }}>
              该账号配置了 {view.roles.length} 个角色，切换后按所选角色生效权限
            </div>
            {view.roles.map((r) => {
              const active = r.key === view.roleKey
              return (
                <button
                  key={r.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { setOpenMenu(null); onChange({ ...identity, roleKey: r.key }) }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    borderRadius: 7,
                    fontSize: 12,
                    color: active ? "var(--primary)" : "var(--foreground)",
                    fontWeight: active ? 700 : 400,
                    backgroundColor: active ? "rgba(50,109,255,0.08)" : "transparent",
                  }}
                >
                  {r.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
