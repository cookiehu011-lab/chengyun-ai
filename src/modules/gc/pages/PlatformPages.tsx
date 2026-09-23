// 平台与部署 · 客户 / SeeTime 用户（PRD 2026-09-22 M-平台与部署）
// - 客户：仅含「超管」的 SeeTime 账号可新建 / 停用；开客户必填第一名管理员（步骤=改配置），
//   生成空的组织同步位，不复制别的客户的角色、账号、网格和事件
// - 客户停用：该客户账号（含管理员）不能登录；已有事件留在该客户下
// - 管理员全部停用：含超管的 SeeTime 账号可再补一名客户管理员
// - SeeTime 用户：功能权限只有 超管 / 客户展示 两项，可多选至少 1 项；
//   客户展示至少勾 1 个客户；环境必须保留至少一名启用的超管
// - 保存即生效（责任台账，不走草稿发布）；SeeTime 任何权限不能改客户治理基础
import { useMemo, useState } from "react"
import { useGc, useToast, type Customer, type SeeTimeAccount, type SeeTimePerm } from "../store"
import { adminLedgerSkeleton } from "../store"
import { Chip, ConfirmModal, Drawer, S } from "../engine"

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function TagChip({ text, tone = "off" }: { text: string; tone?: "off" | "amber" | "blue" }) {
  const style =
    tone === "amber"
      ? { backgroundColor: "rgba(255,122,66,0.12)", color: "var(--amber)" }
      : tone === "blue"
        ? { backgroundColor: "rgba(50,109,255,0.1)", color: "var(--primary)" }
        : { backgroundColor: "rgba(110,129,151,0.14)", color: "var(--muted-foreground)" }
  return (
    <span style={{ display: "inline-block", fontSize: "10px", padding: "1px 6px", borderRadius: "999px", marginRight: "4px", whiteSpace: "nowrap", ...style }}>
      {text}
    </span>
  )
}

function ChipMulti({ options, selected, onToggle, disabledIds, disabledTag }: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  disabledIds?: string[]
  disabledTag?: string
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {options.map((o) => {
        const on = selected.includes(o)
        const dis = (disabledIds || []).includes(o) && !on
        const stale = (disabledIds || []).includes(o) && on
        return (
          <button
            key={o} type="button" disabled={dis}
            onClick={() => onToggle(o)}
            style={{
              fontSize: "11px", padding: "4px 10px", borderRadius: "6px",
              cursor: dis ? "not-allowed" : "pointer",
              border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: on ? "rgba(50,109,255,0.1)" : "var(--background)",
              color: dis ? "var(--muted-foreground)" : on ? "var(--primary)" : "var(--foreground)",
              opacity: dis ? 0.55 : 1,
            }}
          >
            {on ? "✓ " : ""}{o}
            {stale && disabledTag ? <span style={{ color: "var(--amber)", marginLeft: "4px" }}>{disabledTag}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── 客户 ────────────────────────────────────────────────────────────────────

export function CustomersPage({ author }: { author: string }) {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const customers = state.platform.customers
  const [drawer, setDrawer] = useState(false)
  const [f, setF] = useState({ name: "", adminName: "", adminLogin: "" })
  const [err, setErr] = useState("")
  const [confirmStop, setConfirmStop] = useState<string | null>(null)
  const [adminDrawer, setAdminDrawer] = useState<string | null>(null) // cid
  const [af, setAf] = useState({ name: "", login: "" })
  const [aErr, setAErr] = useState("")

  const enabledCustomers = customers.filter((c) => c.status === "启用")

  function enabledAccountCount(cid: string): number {
    return (state.ledgers[cid]?.accounts || []).filter((a) => a.status === "启用").length
  }
  function adminState(c: Customer): { ok: boolean; text: string } {
    const acc = (state.ledgers[c.id]?.accounts || []).find((a) => a.name === c.adminName)
    if (!acc) return { ok: false, text: `${c.adminName}（账号不存在）` }
    if (acc.status !== "启用") return { ok: false, text: `${c.adminName}（已停用）` }
    return { ok: true, text: c.adminName }
  }

  function openAdd() {
    setErr("")
    setF({ name: "", adminName: "", adminLogin: "" })
    setDrawer(true)
  }

  function save() {
    const name = f.name.trim()
    const adminName = f.adminName.trim()
    const adminLogin = f.adminLogin.trim()
    if (name.length < 2 || name.length > 20) { setErr("客户名称需 2–20 字"); return }
    if (customers.some((c) => c.name === name)) { setErr(`客户名称「${name}」已存在`); return }
    if (!adminName) { setErr("「管理员姓名」为必填项：未指定第一名客户管理员不能完成开客户"); return }
    if (!adminLogin) { setErr("「管理员账号」为必填项：未指定第一名客户管理员不能完成开客户"); return }
    const customer: Customer = {
      id: "c-" + Date.now().toString(36),
      name, status: "启用",
      adminName, adminLogin,
      orgSynced: false,
      createdAt: today(),
    }
    dispatch({ type: "customer-create", customer, ledger: adminLedgerSkeleton(adminName, adminLogin) })
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author,
        modules: ["客户"], note: `开客户「${name}」，指定第一名管理员 ${adminName}（步骤=改配置），生成空的组织同步位`, immediate: true,
      },
    })
    toast(`已开客户「${name}」：不复制其他客户的角色、账号、网格和事件；组织 / 网格等待平台同步后可配置治理基础。`)
    setDrawer(false)
  }

  function toggleStatus(id: string) {
    const c = customers.find((x) => x.id === id)
    if (!c) return
    if (c.status === "启用") { setConfirmStop(id); return }
    dispatch({ type: "customer-status", id, status: "启用" })
    toast(`已启用客户「${c.name}」：其账号可重新登录。`)
  }

  function saveAdmin() {
    if (!adminDrawer) return
    const c = customers.find((x) => x.id === adminDrawer)
    if (!c) return
    const name = af.name.trim()
    const login = af.login.trim()
    if (!name) { setAErr("「姓名」为必填项"); return }
    if (!login) { setAErr("「账号」为必填项"); return }
    const lg = state.ledgers[adminDrawer]
    if (lg && lg.accounts.some((a) => a.login === login)) { setAErr(`账号「${login}」在该客户内已存在`); return }
    dispatch({ type: "customer-admin-assign", cid: adminDrawer, name, login })
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author,
        modules: ["客户"], note: `客户「${c.name}」管理员全部停用，补一名客户管理员 ${name}（步骤=改配置）`, immediate: true,
      },
    })
    toast(`已为客户「${c.name}」补一名管理员「${name}」：该客户恢复治理基础编辑能力。`)
    setAdminDrawer(null)
  }

  return (
    <>
      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="客户">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>客户</h3>
          <span style={S.cardNote}>客户是隔离边界：组织、角色、账号、网格、事件都归一个客户；仅含「超管」的 SeeTime 账号能新建 / 停用客户</span>
        </header>
        <div style={S.toolbar}>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
            当前环境 {enabledCustomers.length} 家启用客户
          </span>
          <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={openAdd}>＋ 开客户</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["客户名称", "客户管理员", "启用账号数", "组织同步", "创建日期"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr><td colSpan={7} style={S.empty}>暂无客户</td></tr>
              )}
              {customers.map((c) => {
                const adm = adminState(c)
                return (
                  <tr key={c.id}>
                    <td style={{ ...S.td, ...S.tdName }}>{c.name}</td>
                    <td style={S.td}>
                      {adm.text}
                      {!adm.ok && c.status === "启用" && (
                        <span style={{ marginLeft: "6px" }}>
                          <button type="button" style={S.btnLink} onClick={() => { setAf({ name: "", login: "" }); setAErr(""); setAdminDrawer(c.id) }}>
                            补一名管理员
                          </button>
                        </span>
                      )}
                    </td>
                    <td style={S.td}>{enabledAccountCount(c.id)}</td>
                    <td style={S.td}>{c.orgSynced ? <TagChip text="已同步" tone="blue" /> : <TagChip text="空同步位 · 等待平台同步" tone="amber" />}</td>
                    <td style={S.td}>{c.createdAt}</td>
                    <td style={S.td}><Chip status={c.status} /></td>
                    <td style={{ ...S.td, ...S.tdActions }}>
                      <button type="button" style={S.btnLink} onClick={() => toggleStatus(c.id)}>
                        {c.status === "启用" ? "停用" : "启用"}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {drawer && (
        <Drawer
          title="开客户"
          onClose={() => setDrawer(false)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(false)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={save}>开客户（立即生效）</button>
            </>
          }
        >
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>客户名称（必填，2–20 字，不能与现有客户重名）</label>
            <input style={S.input} value={f.name} placeholder="如 西城区" onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>第一名客户管理员 · 姓名（必填）</label>
            <input style={S.input} value={f.adminName} placeholder="如 高建" onChange={(e) => setF((p) => ({ ...p, adminName: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>第一名客户管理员 · 账号（必填）</label>
            <input style={S.input} value={f.adminLogin} placeholder="name@seetime" onChange={(e) => setF((p) => ({ ...p, adminLogin: e.target.value }))} />
          </div>
          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px", lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            开客户时必须同时指定第一名客户管理员（角色步骤仅为「改配置」），否则不能完成开客户。
            新客户生成空的组织同步位：不复制别的客户的角色、账号、网格和事件；组织 / 网格等平台同步后，
            由该客户的管理员配置治理基础。
          </div>
        </Drawer>
      )}

      {adminDrawer !== null && (
        <Drawer
          title={`为客户「${customers.find((x) => x.id === adminDrawer)?.name || ""}」补一名管理员`}
          onClose={() => setAdminDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setAdminDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={saveAdmin}>指定管理员（立即生效）</button>
            </>
          }
        >
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>姓名（必填）</label>
            <input style={S.input} value={af.name} onChange={(e) => setAf((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>账号（必填）</label>
            <input style={S.input} value={af.login} placeholder="name@seetime" onChange={(e) => setAf((p) => ({ ...p, login: e.target.value }))} />
          </div>
          {aErr && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px" }}>{aErr}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            客户管理员角色步骤仅为「改配置」。管理员全部停用后，这家无人能改治理基础；
            由含超管权限的 SeeTime 账号再指定一名。
          </div>
        </Drawer>
      )}

      {confirmStop !== null && (
        <ConfirmModal
          title="停用客户"
          body={<>停用后「{customers.find((x) => x.id === confirmStop)?.name}」的全部账号（含管理员）不能登录；含超管的 SeeTime 账号仍能在客户列表看到这家，但不能再打开这家的展示；已有事件留在该客户下。</>}
          confirmText="确认停用"
          onConfirm={() => {
            const c = customers.find((x) => x.id === confirmStop)
            dispatch({ type: "customer-status", id: confirmStop, status: "停用" })
            dispatch({
              type: "ledger-note",
              entry: { version: "—", date: today(), author, modules: ["客户"], note: `停用客户「${c?.name}」`, immediate: true },
            })
            toast(`已停用客户「${c?.name}」：其账号全部不能登录；已有事件保留。`)
            setConfirmStop(null)
          }}
          onClose={() => setConfirmStop(null)}
        />
      )}
    </>
  )
}

// ─── SeeTime 用户 ────────────────────────────────────────────────────────────

const PERM_LABELS: Record<SeeTimePerm, string> = { super: "超管", display: "客户展示" }

function permSummary(perms: SeeTimePerm[]): string {
  return perms.map((p) => PERM_LABELS[p]).join("、") || "—"
}

export function SeeTimePage({ author }: { author: string }) {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const seeTime = state.platform.seeTime
  const customers = state.platform.customers
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; id: string } | null>(null)
  const [f, setF] = useState({ name: "", login: "", perms: [] as SeeTimePerm[], displayCustomers: [] as string[] })
  const [err, setErr] = useState("")
  const [confirmStop, setConfirmStop] = useState<string | null>(null)

  const enabledSupers = seeTime.filter((s) => s.status === "启用" && s.perms.includes("super"))
  const customerNames = useMemo(() => customers.map((c) => c.name), [customers])
  const disabledCustomerNames = customers.filter((c) => c.status !== "启用").map((c) => c.name)

  function customerNameByIds(ids: string[]): string {
    return ids.map((id) => customers.find((c) => c.id === id)?.name ?? id).join("、")
  }
  function scopeText(s: SeeTimeAccount): string {
    if (s.perms.includes("super")) return "全部客户"
    if (s.perms.includes("display")) return s.displayCustomers.length ? customerNameByIds(s.displayCustomers) : "—"
    return "—"
  }

  function openAdd() {
    setErr("")
    setF({ name: "", login: "", perms: [], displayCustomers: [] })
    setDrawer({ mode: "add", id: "" })
  }
  function openEdit(id: string) {
    const s = seeTime.find((x) => x.id === id)
    if (!s) return
    setErr("")
    setF({ name: s.name, login: s.login, perms: [...s.perms], displayCustomers: [...s.displayCustomers] })
    setDrawer({ mode: "edit", id })
  }

  function save() {
    if (!drawer) return
    const name = f.name.trim()
    const login = f.login.trim()
    if (!name) { setErr("「姓名」为必填项"); return }
    if (!login) { setErr("「账号」为必填项"); return }
    const dup = seeTime.some((s) => s.login === login && s.id !== drawer.id)
    if (dup) { setErr(`账号「${login}」已存在`); return }
    if (f.perms.length === 0) { setErr("功能权限至少选 1 项（超管 / 客户展示）；不能自造第三项"); return }
    const prev = drawer.mode === "edit" ? seeTime.find((x) => x.id === drawer.id) : undefined
    if (f.perms.includes("display") && f.displayCustomers.length === 0) {
      setErr("「客户展示」至少勾 1 个客户"); return
    }
    // 末位超管保护：环境必须保留至少一名启用的超管
    if (prev && prev.status === "启用" && prev.perms.includes("super") && !f.perms.includes("super") && enabledSupers.length <= 1) {
      setErr("不能去掉最后一名启用的超管：环境必须保留至少一名超管。可先给其他账号勾上「超管」。"); return
    }
    const account: SeeTimeAccount = {
      id: prev?.id || "st-" + Date.now().toString(36),
      name, login,
      perms: [...f.perms],
      displayCustomers: f.perms.includes("display") ? [...f.displayCustomers] : [],
      lastLogin: prev?.lastLogin || "—",
      status: prev?.status || "启用",
    }
    dispatch({ type: "seetime-upsert", account })
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author,
        modules: ["SeeTime 用户"],
        note: prev ? `更新 SeeTime 账号「${name}」功能权限：${permSummary(account.perms)}` : `新建 SeeTime 账号「${name}」，功能权限：${permSummary(account.perms)}`,
        immediate: true,
      },
    })
    toast(`已保存 SeeTime 账号「${name}」，立即生效。SeeTime 权限不含办理步骤，也不能改客户治理基础。`)
    setDrawer(null)
  }

  function toggleStatus(id: string) {
    const s = seeTime.find((x) => x.id === id)
    if (!s) return
    if (s.status === "启用") {
      if (s.perms.includes("super") && enabledSupers.length <= 1) {
        toast("不能停用最后一名启用的超管：环境必须保留至少一名超管。")
        return
      }
      setConfirmStop(id)
      return
    }
    dispatch({ type: "seetime-status", id, status: "启用" })
    toast(`已启用 SeeTime 账号「${s.name}」。`)
  }

  return (
    <>
      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="SeeTime 用户">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>SeeTime 用户</h3>
          <span style={S.cardNote}>每个账号单独勾功能权限，不默认超管；功能权限不含办理步骤，也不能保存任何客户的治理基础</span>
        </header>
        <div style={S.toolbar}>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
            环境当前 {enabledSupers.length} 名启用超管（必须保留至少 1 名）
          </span>
          <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={openAdd}>＋ 新增 SeeTime 账号</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["姓名", "账号", "功能权限", "可看客户", "最近登录"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {seeTime.length === 0 && (
                <tr><td colSpan={7} style={S.empty}>暂无 SeeTime 账号</td></tr>
              )}
              {seeTime.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...S.td, ...S.tdName }}>{s.name}</td>
                  <td style={S.td}>{s.login}</td>
                  <td style={S.td}>
                    {s.perms.includes("super") ? <TagChip text="超管" tone="blue" /> : null}
                    {s.perms.includes("display") ? <TagChip text="客户展示" /> : null}
                    {s.perms.length === 0 && "—"}
                  </td>
                  <td style={S.td}>{scopeText(s)}</td>
                  <td style={S.td}>{s.lastLogin}</td>
                  <td style={S.td}><Chip status={s.status} /></td>
                  <td style={{ ...S.td, ...S.tdActions }}>
                    <button type="button" style={S.btnLink} onClick={() => openEdit(s.id)}>编辑</button>
                    <button type="button" style={S.btnLink} onClick={() => toggleStatus(s.id)}>
                      {s.status === "启用" ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {drawer && (
        <Drawer
          title={(drawer.mode === "add" ? "新增 SeeTime 账号" : `编辑 SeeTime 账号「${f.name || "…"}」`)}
          onClose={() => setDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={save}>保存（立即生效）</button>
            </>
          }
        >
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>姓名（必填）</label>
            <input style={S.input} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>账号（必填）</label>
            <input style={S.input} value={f.login} placeholder="name@seetime" onChange={(e) => setF((p) => ({ ...p, login: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={S.fieldLabel}>功能权限（可多选，至少 1 项；不能自造第三项）</label>
            <ChipMulti
              options={["超管", "客户展示"]}
              selected={f.perms.map((p) => PERM_LABELS[p])}
              onToggle={(label) => {
                const perm: SeeTimePerm = label === "超管" ? "super" : "display"
                setF((p) => ({ ...p, perms: p.perms.includes(perm) ? p.perms.filter((x) => x !== perm) : [...p.perms, perm] }))
              }}
            />
          </div>
          {f.perms.includes("super") && (
            <div style={{ marginBottom: "10px", fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              超管：新建和停用客户；开客户时指定第一名管理员；管理员全部停用后补一名；管理 SeeTime 账号；查看全部客户的展示。
            </div>
          )}
          {f.perms.includes("display") && (
            <div style={{ marginBottom: "10px" }}>
              <label style={S.fieldLabel}>可看客户（客户展示：至少勾 1 个）</label>
              <ChipMulti
                options={customerNames}
                selected={f.displayCustomers.map((id) => customers.find((c) => c.id === id)?.name ?? id)}
                onToggle={(label) => {
                  const id = customers.find((c) => c.name === label)?.id
                  if (!id) return
                  setF((p) => ({ ...p, displayCustomers: p.displayCustomers.includes(id) ? p.displayCustomers.filter((x) => x !== id) : [...p.displayCustomers, id] }))
                }}
                disabledIds={disabledCustomerNames}
                disabledTag="已停用"
              />
              <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                只能进入被勾选客户的展示（大屏、统计、档案）；客户停用后从可展示列表中消失。超管自动可见全部客户。
              </div>
            </div>
          )}
          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px", lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            两种功能权限都不含办理步骤，也不能保存某一家的组织、角色、账号、空间与责任。
            环境里必须保留至少一名启用的超管。
          </div>
        </Drawer>
      )}

      {confirmStop !== null && (
        <ConfirmModal
          title="停用 SeeTime 账号"
          body={<>停用后「{seeTime.find((x) => x.id === confirmStop)?.name}」立即不能登录。环境必须保留至少一名启用的超管。</>}
          confirmText="确认停用"
          onConfirm={() => {
            const s = seeTime.find((x) => x.id === confirmStop)
            dispatch({ type: "seetime-status", id: confirmStop, status: "停用" })
            dispatch({
              type: "ledger-note",
              entry: { version: "—", date: today(), author, modules: ["SeeTime 用户"], note: `停用 SeeTime 账号「${s?.name}」`, immediate: true },
            })
            toast(`已停用 SeeTime 账号「${s?.name}」。`)
            setConfirmStop(null)
          }}
          onClose={() => setConfirmStop(null)}
        />
      )}
    </>
  )
}
