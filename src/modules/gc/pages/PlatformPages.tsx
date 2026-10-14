// 平台与部署 · 客户 / SeeTime 用户（PRD 2026-09-22 M-平台与部署；成员入驻对齐 2026-10-12）
// - 客户：仅含「超管」的 SeeTime 账号可新建 / 停用；开客户必填第一名管理员（步骤=改配置），
//   生成空的组织同步位，不复制别的客户的角色、账号、网格和事件
// - 客户停用：该客户账号（含管理员）不能登录；已有事件留在该客户下
// - 管理员全部停用：含超管的 SeeTime 账号可再补一名客户管理员
// - SeeTime 用户：对齐 SeeTime/MOGO 成员入驻表单——姓名 / 手机号（必填）、邮箱、使用结束时间（选填）、
//   组织角色绑定（客户 + 组织 + 角色 + 相机权限范围 + 设为默认组织，至少 1 条，可添加多个租户）；
//   角色 = 功能权限（超管 / 客户展示），由绑定派生；客户展示至少绑定 1 个客户；
//   相机权限范围在客户相机权限分配区域内多选（同一层级）；环境必须保留至少一名启用的超管
// - 保存即生效（责任台账，不走草稿发布）；SeeTime 任何权限不能改客户治理基础
import { useMemo, useState } from "react"
import { useGc, useToast, type Customer, type SeeTimeAccount, type SeeTimeBind, type SeeTimePerm } from "../store"
import { adminLedgerSkeleton } from "../store"
import { enabledEventTypes, enabledStreets, MENUS, MENU_CHILDREN } from "../ledger"
import { FEATURE_LEAF_IDS, FEATURE_LIVE_TABS, FEATURE_CONFIG_MODULES } from "../catalog"
import { Chip, ConfirmModal, Drawer, S } from "../engine"

/** 树形勾选的方形勾选框：全选 ✓ / 部分 – / 未选 空（与角色功能菜单树同款） */
function TreeCheck({ on, partial }: { on: boolean; partial?: boolean }) {
  const active = on || partial
  return (
    <span
      style={{
        width: "14px", height: "14px", borderRadius: "3px", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: "10px", lineHeight: 1,
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
        backgroundColor: on ? "var(--primary)" : partial ? "rgba(50,109,255,0.15)" : "var(--background)",
        color: "#fff",
      }}
    >
      {on ? "✓" : partial ? "–" : ""}
    </span>
  )
}

/** 一端的功能勾选状态：一级叶子 / AI实时治理页签 / 治理配置子模块（粒度到二级功能） */
interface FeatSet { leaf: string[]; live: string[]; config: string[] }
const emptyFeat = (): FeatSet => ({ leaf: [], live: [], config: [] })
const fullFeat = (): FeatSet => ({ leaf: [...FEATURE_LEAF_IDS], live: [...FEATURE_LIVE_TABS], config: [...FEATURE_CONFIG_MODULES] })
/** 合成为存储形态：直接存二级明细 id（leaf + AI实时治理页签 + 治理配置子模块），父级状态由二级推导，往返无损 */
function composeFeat(x: FeatSet): string[] {
  return [...x.leaf, ...x.live, ...x.config]
}
/** 从存储形态恢复勾选状态；ids 为空 = 全量订阅（老数据缺省语义） */
function decomposeFeat(ids: string[] | undefined): FeatSet {
  if (!ids || ids.length === 0) return fullFeat()
  return {
    leaf: ids.filter((i) => FEATURE_LEAF_IDS.includes(i)),
    live: ids.filter((i) => FEATURE_LIVE_TABS.includes(i)),
    config: ids.filter((i) => FEATURE_CONFIG_MODULES.includes(i)),
  }
}
/** 功能摘要（角色表「功能菜单」列同款）：带二级数量 */
function featSummaryText(f: FeatSet): string {
  return MENUS.filter((m) => (m.id === "live" ? f.live.length > 0 : m.id === "config" ? f.config.length > 0 : f.leaf.includes(m.id)))
    .map((m) => (m.id === "live" ? `AI实时治理 ${f.live.length}/${FEATURE_LIVE_TABS.length}` : m.id === "config" ? `治理配置 ${f.config.length}/${FEATURE_CONFIG_MODULES.length}` : m.name))
    .join("、")
}

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
    featWeb: fullFeat(), featApp: fullFeat(),
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
      featWeb: fullFeat(), featApp: fullFeat(),
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
      featWeb: decomposeFeat(c.subscribedFeatures?.web), featApp: decomposeFeat(c.subscribedFeatures?.app),
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
    if (composeFeat(f.featWeb).length === 0 && composeFeat(f.featApp).length === 0)
      return "「订阅功能」至少选择 1 项：客户至少要能使用 Web 或 App 端的一个功能"
    return null
  }

  // ── 订阅功能树（Web / App 端，粒度到二级功能；与角色「可用的功能菜单」同交互） ──
  function toggleFeat(end: "web" | "app", kind: "leaf" | "live" | "config", id: string) {
    setF((p) => {
      const cur = end === "web" ? p.featWeb : p.featApp
      const arr = cur[kind]
      const upd: FeatSet = { ...cur, [kind]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] }
      return end === "web" ? { ...p, featWeb: upd } : { ...p, featApp: upd }
    })
  }
  function toggleFeatParent(end: "web" | "app", id: string) {
    const children = MENU_CHILDREN[id]
    setF((p) => {
      const cur = end === "web" ? p.featWeb : p.featApp
      let upd: FeatSet
      if (!children) {
        upd = { ...cur, leaf: cur.leaf.includes(id) ? cur.leaf.filter((x) => x !== id) : [...cur.leaf, id] }
      } else if (id === "live") {
        upd = { ...cur, live: cur.live.length === children.length ? [] : children.map((c) => c.id) }
      } else {
        upd = { ...cur, config: cur.config.length === children.length ? [] : children.map((c) => c.id) }
      }
      return end === "web" ? { ...p, featWeb: upd } : { ...p, featApp: upd }
    })
  }
  function featAll(end: "web" | "app") {
    const upd = fullFeat()
    setF((p) => (end === "web" ? { ...p, featWeb: upd } : { ...p, featApp: upd }))
  }
  function featNone(end: "web" | "app") {
    const upd = emptyFeat()
    setF((p) => (end === "web" ? { ...p, featWeb: upd } : { ...p, featApp: upd }))
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
        subscribedFeatures: { web: composeFeat(f.featWeb), app: composeFeat(f.featApp) },
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
          modules: ["客户"], note: `开客户「${name}」（${customer.city}，订阅事件 ${customer.subscribedTypes.length} 项、功能 Web ${featSummaryText(f.featWeb) || "未开通"} / App ${featSummaryText(f.featApp) || "未开通"}，服务到期 ${customer.expiresAt || "未设置"}），指定第一名管理员 ${adminName}`, immediate: true,
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
        subscribedFeatures: { web: composeFeat(f.featWeb), app: composeFeat(f.featApp) },
        expiresAt: f.expiresAt,
      },
    })
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author,
        modules: ["客户"], note: `更新客户「${c.name}」档案（联系人 / 城市 / 相机配置 / 订阅事件 ${subscribed.length} 项、功能 Web ${featSummaryText(f.featWeb) || "未开通"} / App ${featSummaryText(f.featApp) || "未开通"} / 服务到期 ${f.expiresAt || "未设置"}）`, immediate: true,
      },
    })
    toast(`已更新客户「${c.name}」配置，立即生效：订阅事件 ${subscribed.length} 项、功能 Web ${f.featWeb.leaf.length + f.featWeb.live.length + f.featWeb.config.length} 项 / App ${f.featApp.leaf.length + f.featApp.live.length + f.featApp.config.length} 项，角色 / 账号的可用范围随之收敛。`)
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
                {["客户名称", "联系人", "所属城市", "相机权限", "订阅事件类型", "订阅功能", "服务到期", "客户管理员", "启用账号数", "组织同步"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr><td colSpan={13} style={S.empty}>暂无客户</td></tr>
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
                    <td style={S.td}>
                      {(() => {
                        const w = (c.subscribedFeatures?.web ?? []).filter((i) => i !== "live" && i !== "config")
                        const a = (c.subscribedFeatures?.app ?? []).filter((i) => i !== "live" && i !== "config")
                        const total = FEATURE_LEAF_IDS.length + FEATURE_LIVE_TABS.length + FEATURE_CONFIG_MODULES.length
                        return w.length + a.length > 0
                          ? <span style={{ fontSize: "11px" }}>Web {w.length}/{total} · App {a.length}/{total}</span>
                          : <TagChip text="未配置" tone="amber" />
                      })()}
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

          {/* ── 订阅功能（Web / App 端，粒度到二级功能，不下沉到操作标签） ── */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "4px 0 2px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>订阅功能（Web / App 端）</span>
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
              一级=功能，二级=功能内页签 / 子模块；客户内角色 / 账号的可用菜单只能在此范围内配置
            </span>
          </div>
          {([
            { end: "web" as const, label: "Web 端", color: "var(--primary)", feat: f.featWeb },
            { end: "app" as const, label: "App 端", color: "var(--purple)", feat: f.featApp },
          ]).map((e) => {
            const total = FEATURE_LEAF_IDS.length + FEATURE_LIVE_TABS.length + FEATURE_CONFIG_MODULES.length
            const sel = e.feat.leaf.length + e.feat.live.length + e.feat.config.length
            return (
              <div key={e.end} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: e.color }}>{e.label}</span>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                    {sel === 0 ? "未开通 · 勾选功能或点「全选」开通" : "已开通"}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)", marginLeft: "auto", fontFamily: "JetBrains Mono, monospace" }}>
                    已选 {sel}/{total}
                  </span>
                  <button type="button" style={{ ...S.btnLink, fontSize: "10px", padding: 0 }} onClick={() => featAll(e.end)}>全选</button>
                  <button type="button" style={{ ...S.btnLink, fontSize: "10px", padding: 0 }} onClick={() => featNone(e.end)}>清空{e.end === "app" ? "（未开通）" : ""}</button>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "4px 10px" }}>
                  {MENUS.map((m) => {
                    const children = MENU_CHILDREN[m.id]
                    const childIds = m.id === "live" ? e.feat.live : m.id === "config" ? e.feat.config : undefined
                    const childCount = childIds?.length ?? 0
                    const on = children ? childCount > 0 : e.feat.leaf.includes(m.id)
                    const all = children ? childCount === children.length : on
                    return (
                      <div key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <button
                          type="button"
                          onClick={() => toggleFeatParent(e.end, m.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: "8px", width: "100%",
                            padding: "7px 2px", border: "none", background: "none", cursor: "pointer",
                            fontSize: "12px", color: "var(--foreground)", textAlign: "left",
                            fontWeight: children ? 600 : 400,
                          }}
                        >
                          <TreeCheck on={on} partial={on && !all} />
                          <span style={{ flex: 1 }}>{m.name}</span>
                          {children && (
                            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", fontFamily: "JetBrains Mono, monospace" }}>
                              {childCount}/{children.length}
                            </span>
                          )}
                        </button>
                        {children && on && (
                          <div style={{ paddingLeft: "24px", paddingBottom: "4px" }}>
                            {children.map((c) => {
                              const cOn = (childIds ?? []).includes(c.id)
                              return (
                                <button
                                  key={c.id} type="button"
                                  onClick={() => toggleFeat(e.end, m.id === "live" ? "live" : "config", c.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "8px", width: "100%",
                                    padding: "4px 2px", border: "none", background: "none", cursor: "pointer",
                                    fontSize: "11px", color: "var(--foreground)", textAlign: "left",
                                  }}
                                >
                                  <TreeCheck on={cOn} />
                                  <span>{c.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px", lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            客户是隔离边界：组织、角色、账号、网格、事件都归一个客户。开客户时必须同时指定第一名客户管理员（角色步骤仅为「改配置」）。
            服务到期时间为 SaaS 授权：到期后该客户全部账号（含管理员）将不能登录，续期后恢复。
            订阅事件包 = 该客户可用的 AI 事件算法集合，客户内角色 / 账号的事件类型配置只能在此范围内选。
            订阅功能 = 该客户可用的 Web / App 端功能集合（粒度到二级功能，不下沉到操作标签），客户内角色 / 账号的可用菜单不能超出该范围。
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

// ─── SeeTime 用户（成员入驻：姓名 / 手机 / 邮箱 / 使用结束时间 / 组织角色绑定） ──

const PERM_LABELS: Record<SeeTimePerm, string> = { super: "超管", display: "客户展示" }

function permSummary(perms: SeeTimePerm[]): string {
  return perms.map((p) => PERM_LABELS[p]).join("、") || "—"
}

const emptyBind = (): SeeTimeBind => ({ customer: "", org: "", roles: [], cameras: [], def: false })

// 行政级联（省-市-区-街道，示例树）：相机权限范围只能在客户已接入的街道层多选
const REGION_STREETS: Record<string, string[]> = {
  东城区: ["东华门街道", "朝阳门街道", "东四街道", "北新桥街道", "安定门街道", "东直门街道", "和平里街道", "建国门街道"],
}

export function SeeTimePage({ author }: { author: string }) {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const seeTime = state.platform.seeTime
  const customers = state.platform.customers
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; id: string } | null>(null)
  const [f, setF] = useState({
    name: "", phone: "", email: "", expiresAt: "", perms: [] as SeeTimePerm[], binds: [] as SeeTimeBind[],
  })
  const [err, setErr] = useState("")
  const [confirmStop, setConfirmStop] = useState<string | null>(null)

  const enabledSupers = seeTime.filter((s) => s.status === "启用" && s.perms.includes("super"))
  const customerNames = useMemo(() => customers.filter((c) => c.status === "启用").map((c) => c.name), [customers])

  function customerById(id: string): Customer | undefined {
    return customers.find((c) => c.id === id)
  }
  // 绑定组织选项：该客户全区 + 启用中的街道（含手动创建街道）
  function orgOptions(cid: string): string[] {
    const c = customerById(cid)
    if (!c) return []
    return [c.name, ...enabledStreets(state.rows)]
  }
  function scopeText(s: SeeTimeAccount): string {
    if (s.perms.includes("super")) return "全部客户"
    const names = s.displayCustomers.map((id) => customerById(id)?.name ?? id)
    return names.length ? names.join("、") : "—"
  }

  function openAdd() {
    setErr("")
    setF({ name: "", phone: "", email: "", expiresAt: "", perms: [], binds: [emptyBind()] })
    setDrawer({ mode: "add", id: "" })
  }
  function openEdit(id: string) {
    const s = seeTime.find((x) => x.id === id)
    if (!s) return
    setErr("")
    setF({
      name: s.name, phone: s.phone === "—" ? "" : s.phone, email: s.email, expiresAt: s.expiresAt,
      perms: [...s.perms],
      binds: s.binds.map((b) => ({ ...b, roles: [...b.roles], cameras: [...b.cameras] })),
    })
    setDrawer({ mode: "edit", id })
  }

  // ── 绑定编辑 ──
  function setBind(i: number, patch: Partial<SeeTimeBind>) {
    setF((p) => ({ ...p, binds: p.binds.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  }
  function switchBindCustomer(i: number, name: string) {
    const c = customers.find((x) => x.name === name)
    if (!c) return
    // 客户角色 / 组织 / 相机范围都依赖所选客户：换客户即重置
    setBind(i, { customer: c.id, org: "", roles: [], cameras: [] })
  }
  function togglePlatformPerm(perm: SeeTimePerm) {
    setF((p) => ({ ...p, perms: p.perms.includes(perm) ? p.perms.filter((x) => x !== perm) : [...p.perms, perm] }))
  }
  // 客户角色依赖所选客户：来自该客户责任台账中启用中的角色
  function clientRoles(cid: string): { id: string; name: string }[] {
    if (!cid) return []
    return (state.ledgers[cid]?.roles ?? []).filter((r) => r.status === "启用").map((r) => ({ id: r.id, name: r.name }))
  }
  function toggleBindRole(i: number, roleId: string) {
    const b = f.binds[i]
    setBind(i, { roles: b.roles.includes(roleId) ? b.roles.filter((x) => x !== roleId) : [...b.roles, roleId] })
  }
  function roleName(cid: string, roleId: string): string {
    return state.ledgers[cid]?.roles.find((r) => r.id === roleId)?.name ?? roleId
  }
  // 端摘要：读台账角色定义（Web 端菜单必配；App 端菜单在「组织、账号与角色 → 角色」配置）
  function roleEndsLabel(cid: string, roleId: string): string {
    const r = state.ledgers[cid]?.roles.find((x) => x.id === roleId)
    if (!r) return "—"
    const app = (r.appMenus ?? []).length > 0
    return app ? "Web·App" : "Web"
  }
  function toggleBindCamera(i: number, area: string) {
    const b = f.binds[i]
    setBind(i, { cameras: b.cameras.includes(area) ? b.cameras.filter((x) => x !== area) : [...b.cameras, area] })
  }
  function setDefaultBind(i: number) {
    // 设为默认组织：全部绑定中至多一条为默认；再点一次取消
    const cur = f.binds[i].def
    setF((p) => ({ ...p, binds: p.binds.map((b, j) => ({ ...b, def: j === i ? !cur : false })) }))
  }
  function addBind() {
    setF((p) => ({ ...p, binds: [...p.binds, emptyBind()] }))
  }
  function removeBind(i: number) {
    setF((p) => ({ ...p, binds: p.binds.filter((_, j) => j !== i) }))
  }

  function save() {
    if (!drawer) return
    const name = f.name.trim()
    const phone = f.phone.trim()
    const email = f.email.trim()
    if (!name) { setErr("「姓名」为必填项"); return }
    if (!/^1\d{10}$/.test(phone)) { setErr("「手机号」为必填项：请输入 11 位手机号"); return }
    const dupPhone = seeTime.some((s) => s.phone === phone && s.id !== drawer.id)
    if (dupPhone) { setErr(`手机号「${phone}」已被其他账号使用`); return }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { setErr("邮箱格式不正确"); return }
    if (f.binds.length === 0) { setErr("客户绑定至少 1 条：请「＋ 添加客户」"); return }
    for (let i = 0; i < f.binds.length; i++) {
      const b = f.binds[i]
      const tag = f.binds.length > 1 ? `绑定 ${i + 1}` : "客户绑定"
      if (!b.customer) { setErr(`${tag}：请选择客户`); return }
      if (!b.org) { setErr(`${tag}：请选择组织（依赖所选客户）`); return }
      if (b.roles.length === 0) { setErr(`${tag}：客户角色至少选 1 项（来自该客户责任台账）`); return }
      if (b.cameras.length === 0) { setErr(`${tag}：请选择相机权限范围（省-市-区-街道级联后，在该客户已接入的街道层多选）`); return }
      const c = customerById(b.customer)
      if (c && c.cameraAreas.length > 0 && b.cameras.some((a) => !c.cameraAreas.includes(a))) {
        setErr(`${tag}：相机权限范围必须在「${c.name}」已接入的行政范围内选择`); return
      }
    }
    const dupBind = new Set(f.binds.map((b) => `${b.customer}|${b.org}`))
    if (dupBind.size < f.binds.length) { setErr("同一「客户 + 组织」不能重复绑定"); return }
    if (!f.binds.some((b) => b.def)) { setErr("请选择一条绑定为「默认组织」（登录后默认进入）"); return }
    const prev = drawer.mode === "edit" ? seeTime.find((x) => x.id === drawer.id) : undefined
    // 平台角色 = 账号级配置（独立于客户绑定）；可看客户 = 绑定的客户集合
    const perms: SeeTimePerm[] = [...f.perms]
    const displayCustomers = Array.from(new Set(f.binds.map((b) => b.customer)))
    // 末位超管保护：环境必须保留至少一名启用的超管
    if (prev && prev.status === "启用" && prev.perms.includes("super") && !perms.includes("super") && enabledSupers.length <= 1) {
      setErr("不能去掉最后一名启用的超管：环境必须保留至少一名超管。可先给其他账号勾上「超管」。"); return
    }
    const account: SeeTimeAccount = {
      id: prev?.id || "st-" + Date.now().toString(36),
      name, phone, email, expiresAt: f.expiresAt,
      login: prev?.login || (email ? `${email.split("@")[0]}@seetime` : `${phone}@seetime`),
      binds: f.binds.map((b) => ({ ...b, roles: [...b.roles], cameras: [...b.cameras] })),
      perms,
      displayCustomers,
      lastLogin: prev?.lastLogin || "—",
      status: prev?.status || "启用",
    }
    dispatch({ type: "seetime-upsert", account })
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author,
        modules: ["SeeTime 用户"],
        note: prev
          ? `更新 SeeTime 账号「${name}」：平台角色 ${permSummary(perms)}，客户绑定 ${account.binds.length} 条`
          : `成员入驻：新建 SeeTime 账号「${name}」（${phone}），平台角色 ${permSummary(perms)}，客户绑定 ${account.binds.length} 条`,
        immediate: true,
      },
    })
    toast(`已${prev ? "保存" : "创建并启用"} SeeTime 账号「${name}」，立即生效。SeeTime 权限不含办理步骤，也不能改客户治理基础。`)
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

  const phoneEmail = (s: SeeTimeAccount) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span>{s.phone}</span>
      {s.email && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{s.email}</span>}
    </div>
  )
  const bindSummary = (s: SeeTimeAccount) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {s.binds.map((b, i) => (
        <span key={i} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {customerById(b.customer)?.name ?? b.customer} · {b.org}
          {b.def && <TagChip text="默认" tone="blue" />}
          <span style={{ color: "var(--muted-foreground)", fontSize: 10 }}>
            相机 {b.cameras.length ? b.cameras.join("、") : "—"}
          </span>
          {b.roles.length > 0 && (
            <span style={{ color: "var(--muted-foreground)", fontSize: 10 }}>
              {b.roles.map((r) => `${roleName(b.customer, r)}（${roleEndsLabel(b.customer, r)}）`).join("、")}
            </span>
          )}
        </span>
      ))}
    </div>
  )

  return (
    <>
      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="SeeTime 用户">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>SeeTime 用户</h3>
          <span style={S.cardNote}>
            成员入驻：姓名 / 手机号必填，组织角色绑定（客户 + 组织 + 角色 + 相机权限范围 + 默认组织）至少 1 条；角色不含办理步骤，也不能保存任何客户的治理基础
          </span>
        </header>
        <div style={S.toolbar}>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
            环境当前 {enabledSupers.length} 名启用超管（必须保留至少 1 名）
          </span>
          <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={openAdd}>＋ 成员入驻</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["姓名", "手机号 / 邮箱", "组织角色绑定", "功能权限", "可看客户", "使用结束时间", "最近登录"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {seeTime.length === 0 && (
                <tr><td colSpan={9} style={S.empty}>暂无 SeeTime 账号</td></tr>
              )}
              {seeTime.map((s) => {
                const exp = expiryBadge(s.expiresAt)
                return (
                  <tr key={s.id}>
                    <td style={{ ...S.td, ...S.tdName }}>{s.name}<div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{s.login}</div></td>
                    <td style={S.td}>{phoneEmail(s)}</td>
                    <td style={S.td}>{bindSummary(s)}</td>
                    <td style={S.td}>
                      {s.perms.includes("super") ? <TagChip text="超管" tone="blue" /> : null}
                      {s.perms.includes("display") ? <TagChip text="客户展示" /> : null}
                      {s.perms.length === 0 && s.binds.every((b) => b.roles.length === 0) && "—"}
                      {s.binds.some((b) => b.roles.length > 0) && (
                        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
                          {Array.from(new Set(s.binds.flatMap((b) => b.roles.map((r) => `${roleName(b.customer, r)}（${roleEndsLabel(b.customer, r)}）`)))).join("、")}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>{scopeText(s)}</td>
                    <td style={S.td}>{s.expiresAt ? <TagChip text={exp.text} tone={exp.tone} /> : "长期"}</td>
                    <td style={S.td}>{s.lastLogin}</td>
                    <td style={S.td}><Chip status={s.status} /></td>
                    <td style={{ ...S.td, ...S.tdActions }}>
                      <button type="button" style={S.btnLink} onClick={() => openEdit(s.id)}>编辑</button>
                      <button type="button" style={S.btnLink} onClick={() => toggleStatus(s.id)}>
                        {s.status === "启用" ? "停用" : "启用"}
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
          title={drawer.mode === "add" ? "成员入驻 · 新建 SeeTime 账号" : `编辑 SeeTime 账号「${f.name || "…"}」`}
          onClose={() => setDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={save}>
                {drawer.mode === "add" ? "创建并启用用户" : "保存（立即生效）"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={S.fieldLabel}>姓名（必填）</label>
              <input style={S.input} value={f.name} placeholder="请输入您的姓名" onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.fieldLabel}>手机号（必填，登录标识）</label>
              <input style={S.input} value={f.phone} placeholder="请输入您的手机号" maxLength={11} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={S.fieldLabel}>邮箱（选填）</label>
              <input style={S.input} value={f.email} placeholder="email@example.com" onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.fieldLabel}>使用结束时间（选填；到期自动停用）</label>
              <input style={S.input} type="date" value={f.expiresAt} onChange={(e) => setF((p) => ({ ...p, expiresAt: e.target.value }))} />
            </div>
          </div>

          {/* 平台角色：账号级配置，独立于客户绑定之外 */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <span style={S.fieldLabel}>平台角色（SeeTime 运营层，独立于客户）</span>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>可都不选</span>
            </div>
            <ChipMulti
              options={["超管", "客户展示"]}
              selected={f.perms.map((p) => PERM_LABELS[p])}
              onToggle={(label) => togglePlatformPerm(label === "超管" ? "super" : "display")}
            />
            {f.perms.includes("super") && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                超管：新建和停用客户；开客户时指定第一名管理员；管理员全部停用后补一名；管理 SeeTime 账号；查看全部客户的展示。
              </div>
            )}
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={S.fieldLabel}>客户绑定（至少 1 条；一个账号可绑定多个客户）</span>
              <button type="button" style={S.btnSecondary} onClick={addBind}>＋ 添加客户</button>
            </div>
            {f.binds.map((b, i) => {
              const c = customerById(b.customer)
              const citySegs = c ? c.city.split(" / ") : []
              const regionPath = citySegs.length
                ? [citySegs[0], citySegs.length > 2 ? citySegs[1] : "市辖区", citySegs[citySegs.length - 1]]
                : []
              return (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", marginBottom: 10, backgroundColor: "var(--card-2)" }}>
                  {/* 卡头：绑定 N · 默认组织 · 删除 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--foreground)" }}>绑定 {i + 1}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <label style={{ fontSize: 11, color: b.def ? "var(--primary)" : "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: b.def ? 700 : 500 }}>
                        <input type="checkbox" checked={!!b.def} onChange={() => setDefaultBind(i)} />
                        设为默认组织
                      </label>
                      {f.binds.length > 1 && (
                        <button type="button" onClick={() => removeBind(i)} title="删除此绑定" style={{ border: "1px solid var(--red)", color: "var(--red)", background: "transparent", borderRadius: 999, width: 20, height: 20, cursor: "pointer", lineHeight: 1 }}>−</button>
                      )}
                    </div>
                  </div>

                  {/* ① 归属：客户 + 组织 */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={S.fieldLabel}>① 客户</label>
                      <select style={S.input} value={b.customer ? customerById(b.customer)?.name ?? "" : ""} onChange={(e) => switchBindCustomer(i, e.target.value)}>
                        <option value="">请选择所属客户</option>
                        {customerNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={S.fieldLabel}>② 组织</label>
                      <select style={S.input} value={b.org} onChange={(e) => setBind(i, { org: e.target.value })}>
                        <option value="">请选择组织</option>
                        {(b.customer ? orgOptions(b.customer) : []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* ③ 客户角色：勾选；功能访问端（Web / App）由角色定义决定，在「组织、账号与角色 → 角色」配置 */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fieldLabel}>③ 客户角色（必选，来自该客户责任台账）</label>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", backgroundColor: "var(--card)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--purple)" }}>选择角色</span>
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                          {b.customer ? `${c?.name ?? ""} 责任台账 · 换客户即重置` : "先选客户"}
                        </span>
                      </div>
                      {b.customer && clientRoles(b.customer).length > 0 ? (
                        <ChipMulti
                          options={clientRoles(b.customer).map((r) => r.name)}
                          selected={b.roles.map((r) => roleName(b.customer, r))}
                          onToggle={(label) => {
                            const role = clientRoles(b.customer).find((r) => r.name === label)
                            if (role) toggleBindRole(i, role.id)
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "2px 0" }}>
                          {b.customer ? "该客户暂无启用中的客户角色" : "选择客户后，展示该客户台账中的启用角色"}
                        </div>
                      )}
                      {b.roles.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>已选角色的功能访问端（由角色定义决定，在「组织、账号与角色 → 角色」中配置 Web / App 端菜单）</div>
                          {b.roles.map((roleId) => (
                            <div key={roleId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", backgroundColor: "var(--card-2)" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>{roleName(b.customer, roleId)}</span>
                                <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 999, border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                                  {roleEndsLabel(b.customer, roleId)}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleBindRole(i, roleId)}
                                title="移除此角色"
                                style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", background: "transparent", borderRadius: 999, width: 18, height: 18, cursor: "pointer", lineHeight: 1, fontSize: 11 }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ④ 相机权限范围：省-市-区路径条 + 街道层多选 */}
                  <div>
                    <label style={S.fieldLabel}>④ 相机权限范围</label>
                    {c && c.cameraAreas.length > 0 ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                          {regionPath.map((seg, k) => (
                            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              {k > 0 && <span style={{ color: "var(--muted-foreground)", fontSize: 10 }}>›</span>}
                              <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", fontWeight: 600 }}>{seg}</span>
                            </span>
                          ))}
                          <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 2 }}>接入归属（自动）</span>
                        </div>
                        <ChipMulti
                          options={c.cameraAreas.filter((a) => (REGION_STREETS[regionPath[regionPath.length - 1]] ?? [a]).includes(a))}
                          selected={b.cameras}
                          onToggle={(label) => toggleBindCamera(i, label)}
                        />
                        <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 6 }}>
                          街道层多选（同一层级），仅限「{c.name}」已接入相机的行政范围
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "4px 0" }}>
                        {b.customer ? "该客户尚未接入行政范围的相机：请先在客户档案中配置相机接入（省-市-区-街道）" : "选择客户后，按该客户已接入的相机区域选择"}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {err && <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 8, lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            登录名保存时自动生成（name@seetime）。平台角色是账号级配置，与客户绑定相互独立；
            客户绑定内的组织、客户角色、相机范围都依赖所选客户，换客户即重置，客户停用后其绑定不可再选。
            每个客户角色可分别配置 Web 端 / App 端功能访问（至少开通一端）。SeeTime 的任何角色都不含办理步骤，也不能保存某一家的组织、角色、账号、空间与责任。
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
