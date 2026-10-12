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
import { enabledEventTypes } from "../ledger"
import { Chip, ConfirmModal, Drawer, S } from "../engine"

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function TagChip({ text, tone = "off" }: { text: string; tone?: "off" | "amber" | "blue" | "red" }) {
  const style =
    tone === "amber"
      ? { backgroundColor: "rgba(255,122,66,0.12)", color: "var(--amber)" }
      : tone === "blue"
        ? { backgroundColor: "rgba(50,109,255,0.1)", color: "var(--primary)" }
        : tone === "red"
          ? { backgroundColor: "rgba(228,94,88,0.12)", color: "var(--red)" }
          : { backgroundColor: "rgba(110,129,151,0.14)", color: "var(--muted-foreground)" }
  return (
    <span style={{ display: "inline-block", fontSize: "10px", padding: "1px 6px", borderRadius: "999px", marginRight: "4px", whiteSpace: "nowrap", ...style }}>
      {text}
    </span>
  )
}

// ─── 客户档案 · 原型演示目录（城市级联 / 相机来源 / 相机权限区域） ─────────────
const CITY_TREE = [
  { province: "北京市", cities: ["东城区", "西城区", "朝阳区"] },
  { province: "江苏省", cities: ["南京市", "苏州市"] },
]
const CAMERA_SOURCES_BY_CITY: Record<string, string[]> = {
  "北京市 / 东城区": ["东城公安一类视频", "东城管委二类视频"],
  "北京市 / 西城区": ["西城公安一类视频"],
  "北京市 / 朝阳区": ["朝阳公安一类视频", "朝阳城管二类视频"],
  "江苏省 / 南京市": ["南京江宁", "南京鼓楼", "南京玄武"],
  "江苏省 / 苏州市": ["苏州姑苏", "苏州工业园区"],
}
const CAMERA_AREAS_BY_CITY: Record<string, string[]> = {
  "北京市 / 东城区": ["东华门街道", "朝阳门街道", "东四街道", "前门街道"],
  "北京市 / 西城区": ["西长安街街道", "新街口街道", "德胜街道"],
  "北京市 / 朝阳区": ["三里屯街道", "望京街道", "朝外街道"],
  "江苏省 / 南京市": ["江宁区", "鼓楼区", "玄武区", "秦淮区"],
  "江苏省 / 苏州市": ["姑苏区", "工业园区", "虎丘区"],
}
// 事件标准细类按编码前缀分组（DM 道路秩序 / HJ 环境卫生 / GG 宣传广告）
const EVENT_GROUP_LABEL: Record<string, string> = { DM: "道路秩序", HJ: "环境卫生", GG: "宣传广告" }

/** 服务到期状态徽标（SaaS）：已到期 / 30 天内即将到期 / 正常 / 未设置 */
function expiryBadge(expiresAt: string): { text: string; tone: "blue" | "amber" | "red" | "off" } {
  if (!expiresAt) return { text: "未设置", tone: "off" }
  const days = Math.ceil((new Date(expiresAt + "T23:59:59").getTime() - Date.now()) / 86400000)
  if (days < 0) return { text: `已到期 ${-days} 天`, tone: "red" }
  if (days <= 30) return { text: `${days} 天后到期`, tone: "amber" }
  return { text: `${expiresAt} 到期`, tone: "blue" }
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
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; id: string } | null>(null)
  const [f, setF] = useState({
    name: "", adminName: "", adminLogin: "",
    contactName: "", contactPhone: "",
    province: "", city: "",
    cameraSources: [] as string[], cameraAreas: [] as string[],
    subQuery: "", subscribed: [] as string[],
    expiresAt: "",
  })
  const [err, setErr] = useState("")
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]) // 订阅事件包分组折叠（搜索时自动全展开）
  const [confirmStop, setConfirmStop] = useState<string | null>(null)
  const [adminDrawer, setAdminDrawer] = useState<string | null>(null) // cid
  const [af, setAf] = useState({ name: "", login: "" })
  const [aErr, setAErr] = useState("")

  const enabledCustomers = customers.filter((c) => c.status === "启用")
  // 平台事件目录：事件标准里启用中的细类；客户订阅集合只能在其中选
  const catalogTypes = useMemo(() => enabledEventTypes(state.rows), [state.rows])
  // 订阅事件包按编码前缀分组展示（DM 道路秩序 / HJ 环境卫生 / GG 宣传广告）
  const groupedCatalog = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of state.rows["dict"] || []) {
      if (r.status !== "启用") continue
      const prefix = (r.values[1] || "").slice(0, 2).toUpperCase()
      const g = EVENT_GROUP_LABEL[prefix] || "其他"
      const list = map.get(g) ?? []
      if (!list.includes(r.values[0])) list.push(r.values[0])
      map.set(g, list)
    }
    return [...map.entries()].map(([group, types]) => ({ group, types }))
  }, [state.rows])
  // 抽屉当前城市对应的相机来源 / 权限区域选项
  const cityKey = f.province && f.city ? `${f.province} / ${f.city}` : ""
  const sourceOptions = CAMERA_SOURCES_BY_CITY[cityKey] ?? []
  const areaOptions = CAMERA_AREAS_BY_CITY[cityKey] ?? []
  // 订阅事件包搜索过滤后的分组
  const filteredGroups = useMemo(() => {
    const q = f.subQuery.trim()
    if (!q) return groupedCatalog
    return groupedCatalog
      .map(({ group, types }) => ({ group, types: types.filter((t) => t.includes(q)) }))
      .filter(({ types }) => types.length > 0)
  }, [groupedCatalog, f.subQuery])

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
    setF({
      name: "", adminName: "", adminLogin: "",
      contactName: "", contactPhone: "",
      province: "", city: "",
      cameraSources: [], cameraAreas: [],
      subQuery: "", subscribed: [],
      expiresAt: "",
    })
    setDrawer({ mode: "add", id: "" })
  }

  function openEdit(c: Customer) {
    setErr("")
    const province = (c.city || "").split(" / ")[0] ?? ""
    const city = (c.city || "").split(" / ")[1] ?? ""
    setF({
      name: c.name, adminName: c.adminName, adminLogin: c.adminLogin,
      contactName: c.contactName, contactPhone: c.contactPhone,
      province, city,
      cameraSources: [...(c.cameraSources ?? [])], cameraAreas: [...(c.cameraAreas ?? [])],
      subQuery: "", subscribed: [...(c.subscribedTypes ?? [])],
      expiresAt: c.expiresAt ?? "",
    })
    setDrawer({ mode: "edit", id: c.id })
  }

  /** 相机资源配置 + 客户档案公共校验；返回 null 表示通过 */
  function validateProfile(): string | null {
    if (!f.contactName.trim()) return "「客户联系人姓名」为必填项"
    if (!f.province || !f.city) return "「所在城市」为必选项：请先选择省 / 市"
    if (f.cameraSources.length === 0) return "「相机来源」至少选择 1 个"
    if (f.cameraAreas.length === 0) return "「相机权限分配」至少选择 1 个区域"
    return null
  }

  function save() {
    if (!drawer) return
    const name = f.name.trim()
    const adminName = f.adminName.trim()
    const adminLogin = f.adminLogin.trim()
    if (drawer.mode === "add") {
      if (name.length < 2 || name.length > 20) { setErr("客户名称需 2–20 字"); return }
      if (customers.some((c) => c.name === name)) { setErr(`客户名称「${name}」已存在`); return }
      if (!adminName) { setErr("「管理员姓名」为必填项：未指定第一名客户管理员不能完成开客户"); return }
      if (!adminLogin) { setErr("「管理员账号」为必填项：未指定第一名客户管理员不能完成开客户"); return }
      const pErr = validateProfile()
      if (pErr) { setErr(pErr); return }
      const customer: Customer = {
        id: "c-" + Date.now().toString(36),
        name, status: "启用",
        adminName, adminLogin,
        orgSynced: false,
        createdAt: today(),
        subscribedTypes: f.subscribed.filter((t) => catalogTypes.includes(t)),
        contactName: f.contactName.trim(),
        contactPhone: f.contactPhone.trim(),
        city: `${f.province} / ${f.city}`,
        cameraSources: [...f.cameraSources],
        cameraAreas: [...f.cameraAreas],
        expiresAt: f.expiresAt,
      }
      dispatch({ type: "customer-create", customer, ledger: adminLedgerSkeleton(adminName, adminLogin) })
      dispatch({
        type: "ledger-note",
        entry: {
          version: "—", date: today(), author,
          modules: ["客户"], note: `开客户「${name}」（${customer.city}，订阅 ${customer.subscribedTypes.length} 项，服务到期 ${customer.expiresAt || "未设置"}），指定第一名管理员 ${adminName}`, immediate: true,
        },
      })
      toast(`已开客户「${name}」：客户档案与订阅已保存；组织 / 网格等待平台同步后可配置治理基础。`)
      setDrawer(null)
      return
    }
    // 编辑：客户档案 + 相机资源配置 + 订阅事件包（名称与管理员不可改）
    const c = customers.find((x) => x.id === drawer.id)
    if (!c) return
    const pErr = validateProfile()
    if (pErr) { setErr(pErr); return }
    const subscribed = f.subscribed.filter((t) => catalogTypes.includes(t))
    dispatch({
      type: "customer-update", cid: c.id,
      patch: {
        contactName: f.contactName.trim(),
        contactPhone: f.contactPhone.trim(),
        city: `${f.province} / ${f.city}`,
        cameraSources: [...f.cameraSources],
        cameraAreas: [...f.cameraAreas],
        subscribedTypes: subscribed,
        expiresAt: f.expiresAt,
      },
    })
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author,
        modules: ["客户"], note: `更新客户「${c.name}」档案（联系人 / 城市 / 相机配置 / 订阅 ${subscribed.length} 项 / 服务到期 ${f.expiresAt || "未设置"}）`, immediate: true,
      },
    })
    toast(`已更新客户「${c.name}」配置，立即生效：订阅 ${subscribed.length} 项，角色 / 账号的事件类型配置随之收敛。`)
    setDrawer(null)
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
                {["客户名称", "联系人", "所属城市", "相机权限", "订阅事件类型", "服务到期", "客户管理员", "启用账号数", "组织同步"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr><td colSpan={12} style={S.empty}>暂无客户</td></tr>
              )}
              {customers.map((c) => {
                const adm = adminState(c)
                const exp = expiryBadge(c.expiresAt ?? "")
                return (
                  <tr key={c.id}>
                    <td style={{ ...S.td, ...S.tdName }}>{c.name}</td>
                    <td style={S.td}>
                      <div>{c.contactName || "—"}</div>
                      {c.contactPhone && <div style={{ fontSize: "10px", color: "var(--muted-foreground)", fontFamily: "JetBrains Mono, monospace" }}>{c.contactPhone}</div>}
                    </td>
                    <td style={S.td}>{c.city || "—"}</td>
                    <td style={S.td}>
                      {(c.cameraSources ?? []).length || (c.cameraAreas ?? []).length
                        ? <span style={{ fontSize: "11px" }}>{(c.cameraSources ?? []).length} 源 · {(c.cameraAreas ?? []).length} 区域</span>
                        : <TagChip text="未配置" tone="amber" />}
                    </td>
                    <td style={S.td}>
                      {(c.subscribedTypes ?? []).length
                        ? <span style={{ fontSize: "11px" }}>{c.subscribedTypes.slice(0, 3).join("、")}{c.subscribedTypes.length > 3 ? ` 等 ${c.subscribedTypes.length} 项` : ""}</span>
                        : <TagChip text="未开通订阅" tone="amber" />}
                    </td>
                    <td style={S.td}><TagChip text={exp.text} tone={exp.tone} /></td>
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
                    <td style={S.td}><Chip status={c.status} /></td>
                    <td style={{ ...S.td, ...S.tdActions }}>
                      <button type="button" style={S.btnLink} onClick={() => openEdit(c)}>编辑</button>
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
          title={drawer.mode === "add" ? "创建客户信息" : `编辑客户「${f.name}」`}
          onClose={() => setDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={save}>
                {drawer.mode === "add" ? "提交客户配置" : "保存客户配置（立即生效）"}
              </button>
            </>
          }
        >
          {/* ── 基本信息 ── */}
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "10px" }}>基本信息</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: "16px" }}>
            <div>
              <label style={S.fieldLabel}>{drawer.mode === "add" ? "* 客户名称" : "客户名称（不可改）"}</label>
              <input
                style={{ ...S.input, opacity: drawer.mode === "add" ? 1 : 0.65 }}
                value={f.name}
                disabled={drawer.mode === "edit"}
                placeholder="请输入客户名称"
                onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={S.fieldLabel}>* 客户联系人姓名</label>
              <input style={S.input} value={f.contactName} placeholder="请输入姓名" onChange={(e) => setF((p) => ({ ...p, contactName: e.target.value }))} />
            </div>
            <div>
              <label style={S.fieldLabel}>联系电话</label>
              <input style={S.input} value={f.contactPhone} placeholder="请输入联系电话" onChange={(e) => setF((p) => ({ ...p, contactPhone: e.target.value }))} />
            </div>
            <div>
              <label style={S.fieldLabel}>服务到期时间（SaaS）</label>
              <input style={S.input} type="date" value={f.expiresAt} onChange={(e) => setF((p) => ({ ...p, expiresAt: e.target.value }))} />
            </div>
          </div>
          {drawer.mode === "add" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: "16px", padding: "10px", border: "1px dashed var(--border)", borderRadius: "8px" }}>
              <div>
                <label style={S.fieldLabel}>* 第一名客户管理员 · 姓名</label>
                <input style={S.input} value={f.adminName} placeholder="如 高建" onChange={(e) => setF((p) => ({ ...p, adminName: e.target.value }))} />
              </div>
              <div>
                <label style={S.fieldLabel}>* 第一名客户管理员 · 账号</label>
                <input style={S.input} value={f.adminLogin} placeholder="name@seetime" onChange={(e) => setF((p) => ({ ...p, adminLogin: e.target.value }))} />
              </div>
            </div>
          )}

          {/* ── 相机资源配置 ── */}
          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "2px" }}>相机资源配置</div>
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "10px" }}>
            配置客户所在城市与接入的相机来源。
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ ...S.fieldLabel, whiteSpace: "nowrap" }}>* 所在城市</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxWidth: "420px" }}>
              <select
                style={S.input}
                value={f.province}
                onChange={(e) => setF((p) => ({ ...p, province: e.target.value, city: "", cameraSources: [], cameraAreas: [] }))}
              >
                <option value="">请选择省份</option>
                {CITY_TREE.map((x) => <option key={x.province} value={x.province}>{x.province}</option>)}
              </select>
              <select
                style={S.input}
                value={f.city}
                disabled={!f.province}
                onChange={(e) => setF((p) => ({ ...p, city: e.target.value, cameraSources: [], cameraAreas: [] }))}
              >
                <option value="">请选择城市</option>
                {(CITY_TREE.find((x) => x.province === f.province)?.cities ?? []).map((ct) => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ ...S.fieldLabel, whiteSpace: "nowrap" }}>* 相机来源</label>
            {sourceOptions.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--muted-foreground)", padding: "4px 0" }}>先选择所在城市后可选相机来源</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {sourceOptions.map((src) => {
                  const on = f.cameraSources.includes(src)
                  return (
                    <button
                      key={src} type="button"
                      onClick={() => setF((p) => ({ ...p, cameraSources: on ? p.cameraSources.filter((x) => x !== src) : [...p.cameraSources, src] }))}
                      style={{
                        fontSize: "11px", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap",
                        border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: on ? "rgba(50,109,255,0.08)" : "var(--background)",
                        color: on ? "var(--primary)" : "var(--foreground)",
                      }}
                    >
                      {on ? "✓ " : ""}{src}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ ...S.fieldLabel, whiteSpace: "nowrap" }}>* 相机权限分配（按区域，仅可在同一层级选择）</label>
            {areaOptions.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--muted-foreground)", padding: "4px 0" }}>先选择所在城市后可选区域</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {areaOptions.map((ar) => {
                  const on = f.cameraAreas.includes(ar)
                  return (
                    <button
                      key={ar} type="button"
                      onClick={() => setF((p) => ({ ...p, cameraAreas: on ? p.cameraAreas.filter((x) => x !== ar) : [...p.cameraAreas, ar] }))}
                      style={{
                        fontSize: "11px", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap",
                        border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: on ? "rgba(50,109,255,0.08)" : "var(--background)",
                        color: on ? "var(--primary)" : "var(--foreground)",
                      }}
                    >
                      {on ? "✓ " : ""}{ar}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 订阅事件包 ── */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>订阅事件包（事件类型）</span>
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
              勾选该客户可以使用的 AI 事件算法集。已选 {f.subscribed.length} 个事件
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <button type="button" style={{ ...S.btnLink, whiteSpace: "nowrap" }} onClick={() => setF((p) => ({ ...p, subscribed: [...catalogTypes] }))}>全选</button>
            <button type="button" style={{ ...S.btnLink, whiteSpace: "nowrap" }} onClick={() => setF((p) => ({ ...p, subscribed: [] }))}>清空</button>
            <input
              style={{ ...S.input, width: "180px", padding: "5px 10px", marginLeft: "auto", flexShrink: 0 }}
              value={f.subQuery}
              placeholder="搜索事件类型"
              onChange={(e) => setF((p) => ({ ...p, subQuery: e.target.value }))}
            />
          </div>
          {/* 已选汇总：点击可快速取消（类型多时直接管理已选，不必在长列表里找） */}
          {f.subscribed.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px", padding: "6px 8px", border: "1px dashed var(--border)", borderRadius: "8px" }}>
              {f.subscribed.map((t) => (
                <button
                  key={t} type="button"
                  title="点击取消订阅"
                  onClick={() => setF((p) => ({ ...p, subscribed: p.subscribed.filter((x) => x !== t) }))}
                  style={{
                    fontSize: "10.5px", padding: "2px 8px", borderRadius: "999px", cursor: "pointer", whiteSpace: "nowrap",
                    border: "1px solid rgba(50,109,255,0.35)", backgroundColor: "rgba(50,109,255,0.08)", color: "var(--primary)",
                  }}
                >
                  {t} ✕
                </button>
              ))}
            </div>
          )}
          <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px", maxHeight: "300px", overflowY: "auto" }}>
            {filteredGroups.length === 0 && (
              <div style={{ fontSize: "11px", color: "var(--muted-foreground)", padding: "6px 0" }}>没有匹配的事件类型</div>
            )}
            {filteredGroups.map(({ group, types }) => {
              const searching = f.subQuery.trim().length > 0
              const collapsed = !searching && collapsedGroups.includes(group)
              const pickedInGroup = types.filter((t) => f.subscribed.includes(t)).length
              return (
                <div key={group} style={{ marginBottom: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups((p) => (p.includes(group) ? p.filter((x) => x !== group) : [...p, group]))}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px", width: "100%",
                      padding: "2px 0", marginBottom: collapsed ? "2px" : "6px",
                      border: "none", background: "none", cursor: "pointer", textAlign: "left",
                      fontSize: "11px", color: "var(--muted-foreground)",
                    }}
                  >
                    <span style={{ fontSize: "9px", transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>▼</span>
                    <span style={{ fontWeight: 600 }}>{group}</span>
                    <span style={{ fontSize: "10px" }}>{pickedInGroup}/{types.length}</span>
                  </button>
                  {!collapsed && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {types.map((t) => {
                        const on = f.subscribed.includes(t)
                        return (
                          <button
                            key={t} type="button"
                            onClick={() => setF((p) => ({ ...p, subscribed: on ? p.subscribed.filter((x) => x !== t) : [...p.subscribed, t] }))}
                            style={{
                              fontSize: "11px", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", whiteSpace: "nowrap",
                              border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                              backgroundColor: on ? "rgba(50,109,255,0.08)" : "var(--background)",
                              color: on ? "var(--primary)" : "var(--foreground)",
                            }}
                          >
                            {on ? "✓ " : ""}{t}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px", lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            客户是隔离边界：组织、角色、账号、网格、事件都归一个客户。开客户时必须同时指定第一名客户管理员（角色步骤仅为「改配置」）。
            服务到期时间为 SaaS 授权：到期后该客户全部账号（含管理员）将不能登录，续期后恢复。
            订阅事件包 = 该客户可用的 AI 事件算法集合，客户内角色 / 账号的事件类型配置只能在此范围内选。
            新客户生成空的组织同步位：不复制别的客户的角色、账号、网格和事件。
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
