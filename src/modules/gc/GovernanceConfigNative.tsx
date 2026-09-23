// 治理配置 · 原生版壳（替代 iframe 集成的 29 页静态原型）
// 左导航：平台（SaaS 专属）+ 治理基础 + 规则模块分组 + 内容区 + 身份切换
// 产品规则（PRD 2026-09-22）：
// - 部署模式安装时确定（演示环境提供切换仅作演示）：SaaS=客户+SeeTime 用户；私有化=唯一客户、无 SeeTime
// - 客户身份按「角色 → 功能菜单权限」看治理配置子模块；SeeTime 身份只见平台模块（超管）或无权限空态（客户展示）
// - 业务规则模块只写草稿，发布在「发布与审计」；责任台账（治理基础 / 平台）保存即生效
import { useEffect, useMemo, useState } from "react"
import { GcProvider, ToastProvider, useGc } from "./store"
import { ModuleContent } from "./defs"
import { GROUPS, MODULES, PERSONAS } from "./meta"
import { S } from "./engine"
import { menusOf, configModulesOf } from "./ledger"

function StatusChip({ status }: { status: "已发布" | "草稿" | "即时生效" }) {
  const style =
    status === "草稿"
      ? { backgroundColor: "rgba(255,122,66,0.12)", color: "var(--amber)" }
      : status === "即时生效"
        ? { backgroundColor: "rgba(50,109,255,0.1)", color: "var(--primary)" }
        : { backgroundColor: "rgba(53,185,133,0.12)", color: "var(--green)" }
  return (
    <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "999px", whiteSpace: "nowrap", ...style }}>
      {status}
    </span>
  )
}

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

function Shell() {
  const { state, dispatch } = useGc()
  const mode = state.platform.mode
  const [activeId, setActiveId] = useState("org")
  const [personaId, setPersonaId] = useState<string>(PERSONAS[0].id)
  const [personaOpen, setPersonaOpen] = useState(false)
  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]

  // 当前身份的台账上下文
  const cid = persona.kind === "customer" ? persona.cid! : "c-dc"
  const customer = state.platform.customers.find((c) => c.id === cid)
  const ledger = state.ledgers[cid]
  const meta = MODULES.find((m) => m.id === activeId)!

  // ─── 导航与权限 ────────────────────────────────────────────────────────────
  // 客户身份：按角色功能菜单看治理配置子模块（映射到台账同名账号）；账号不存在则不限制
  // SeeTime 身份：超管 → 平台两页；仅客户展示 → 治理配置内无可用页面
  const { visibleIds, navGroups } = useMemo(() => {
    if (persona.kind === "seetime") {
      const st = state.platform.seeTime.find((s) => s.id === persona.sid)
      const ids = st && st.perms.includes("super")
        ? MODULES.filter((m) => m.platform).map((m) => m.id)
        : []
      return { visibleIds: ids, navGroups: ["平台"] as const }
    }
    const account = ledger?.accounts.find((a) => a.name === persona.name)
    const pMenus = account ? menusOf(ledger!, account) : null
    const hasConfig = pMenus === null || pMenus.includes("config")
    let ids = pMenus === null
      ? MODULES.filter((m) => !m.platform).map((m) => m.id)
      : hasConfig
        ? configModulesOf(ledger!, account!).filter((id) => !MODULES.find((m) => m.id === id)?.platform)
        : []
    return { visibleIds: ids, navGroups: null }
  }, [persona, ledger, state.platform.seeTime])

  const platformPersona = persona.kind === "seetime"
  const noAccess = !platformPersona && (visibleIds.length === 0 || !visibleIds.includes(activeId))
  const displayOnlyNoAccess = platformPersona && visibleIds.length === 0

  // 可选身份：私有化只保留唯一客户（东城区）的身份，不出现 SeeTime / 第二家客户
  const personaOptions = useMemo(() => {
    if (mode === "private") return PERSONAS.filter((p) => p.kind === "customer" && p.cid === "c-dc")
    return PERSONAS
  }, [mode])

  // 切换身份 / 部署模式后，落在第一个可见模块上
  useEffect(() => {
    if (persona.kind === "seetime") {
      const target = visibleIds[0] ?? "customers"
      if (!visibleIds.includes(activeId)) setActiveId(target)
      return
    }
    if (visibleIds.length > 0 && !visibleIds.includes(activeId)) setActiveId(visibleIds[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, mode])

  // 演示切换部署模式：私有化下 SeeTime 身份自动落回客户管理员
  function switchMode(next: "saas" | "private") {
    if (next === mode) return
    dispatch({ type: "platform-mode", mode: next })
    if (next === "private" && persona.kind === "seetime") {
      setPersonaId(PERSONAS[0].id)
    }
  }

  const pubStatus = state.modules[activeId] ?? "已发布"

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
                    <NavBtn key={m.id} m={m} on={m.id === activeId} onClick={() => setActiveId(m.id)} chip={state.modules[m.id] ?? "已发布"} ledgerMode={m.mode === "ledger"} />
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
                    <NavBtn key={m.id} m={m} on={m.id === activeId} onClick={() => setActiveId(m.id)} chip={state.modules[m.id] ?? "已发布"} ledgerMode={m.mode === "ledger"} />
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
        {/* 面包屑 + 身份切换 */}
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
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button
              type="button"
              style={{ ...S.btnSecondary, height: "28px", fontSize: "11px" }}
              onClick={() => setPersonaOpen((v) => !v)}
            >
              {persona.label} ▾
            </button>
            {personaOpen && (
              <div style={{
                position: "absolute", right: 0, top: "32px", zIndex: 50, minWidth: "200px",
                border: "1px solid var(--border)", borderRadius: "8px", backgroundColor: "var(--panel-solid, var(--card))",
                boxShadow: "var(--shadow-lg)", padding: "4px",
              }}>
                {personaOptions.map((p) => (
                  <button
                    key={p.id} type="button"
                    onClick={() => { setPersonaId(p.id); setPersonaOpen(false) }}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "7px 10px",
                      fontSize: "12px", border: "none", background: "none", cursor: "pointer",
                      borderRadius: "6px", color: p.id === personaId ? "var(--primary)" : "var(--foreground)",
                      fontWeight: p.id === personaId ? 600 : 400,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 滚动内容 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
            <div>
              <h1 style={{ fontSize: "17px", fontWeight: 600, margin: 0, marginBottom: "4px" }}>{meta.h1}</h1>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>{meta.desc}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <StatusChip status={meta.mode === "ledger" ? "即时生效" : pubStatus} />
              {meta.mode !== "ledger" && (
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", fontFamily: "JetBrains Mono, monospace" }}>
                  {state.versions[activeId] || "—"}
                </span>
              )}
            </div>
          </div>

          {meta.mode === "ledger" ? (
            <div style={{
              padding: "8px 12px", marginBottom: "12px", borderRadius: "7px", fontSize: "11px", lineHeight: 1.7,
              backgroundColor: "rgba(50,109,255,0.07)", border: "1px solid rgba(50,109,255,0.22)", color: "var(--primary)",
            }}>
              责任台账：保存即写入并立即生效——对新事件、新待办、新派发、新外场任务生效；已派发事件与已派出任务的责任人保持不变，不走草稿发布。
              {!platformPersona && customer ? `当前客户：${customer.name}。` : ""}
            </div>
          ) : pubStatus === "草稿" ? (
            <div style={{
              padding: "8px 12px", marginBottom: "12px", borderRadius: "7px", fontSize: "11px", lineHeight: 1.7,
              backgroundColor: "rgba(255,122,66,0.08)", border: "1px solid rgba(255,122,66,0.25)", color: "var(--amber)",
            }}>
              草稿编辑中：改动写入草稿，尚未生效；发布需在「发布与审计」页经「发布前预览」冲突校验后确认。
            </div>
          ) : (
            <div style={{
              padding: "8px 12px", marginBottom: "12px", borderRadius: "7px", fontSize: "11px", lineHeight: 1.7,
              backgroundColor: "rgba(53,185,133,0.07)", border: "1px solid rgba(53,185,133,0.22)", color: "var(--green)",
            }}>
              当前显示生效中配置（{state.versions[activeId] || "—"}）；在此修改会写入草稿，发布后才对业务生效。
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
                切换到「系统运营 · SeeTime 超管」演示平台管理。
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
                当前身份「{persona.label}」的角色未分配「{meta.name}」的功能菜单权限。
                <br />
                由客户管理员在「组织、账号与角色 → 角色」中为角色勾选功能菜单，保存后立即生效。
              </div>
            </div>
          ) : (
            <ModuleContent id={activeId} author={persona.label} cid={cid} orgSynced={customer?.orgSynced ?? true} />
          )}
        </div>
      </div>
    </div>
  )
}

function NavBtn({ m, on, onClick, chip, ledgerMode }: {
  m: { id: string; name: string }
  on: boolean
  onClick: () => void
  chip: "已发布" | "草稿"
  ledgerMode: boolean
}) {
  const st = ledgerMode ? ("即时生效" as const) : chip
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
      <StatusChip status={st} />
    </button>
  )
}

const T_BG = "var(--background)"

export default function GovernanceConfigNative() {
  return (
    <GcProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </GcProvider>
  )
}
