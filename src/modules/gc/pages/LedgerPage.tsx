// 治理基础 · 责任台账页（组织、账号与角色）
// PRD 2026-09-22（双来源修订 2026-10-12）：
// - 组织双来源：平台同步（名称/层级/上级只读；街道可停用）+ 手动创建（本系统维护，可编辑、可停用）
// - 手动创建的街道与同步街道同权：可勾选为账号范围、可挂网格；社区仅展示，不能作为范围或挂责任人
// - 角色：名称自定义（2–20 字，启用角色中唯一），步骤只能从冻结清单多选，互斥拒绝保存
// - 账号：必填角色（可多选）；步骤并集不许违反互斥；范围按画像动态（全区/街道多选 或 网格多选）；
//   负责的事件类型至少 1 个（来源=事件标准启用细类）；仅改配置/只看则范围固定全区、不配类型
// - 保存即生效（不走草稿发布）；已派发事件与已派出外场任务不改人
import { useMemo, useState } from "react"
import { useGc, useToast, type LedgerAccount, type LedgerRole } from "../store"
import { Chip, ConfirmModal, Drawer, S } from "../engine"
import {
  STEPS, STEP_CAPTIONS, MENUS, MENU_CHILDREN, menuName, menuSummary, validateStepSet, stepsOf, menusOf, accountProfile,
  enabledStreets, gridRows, scopeText,
} from "../ledger"

// ─── 小组件 ──────────────────────────────────────────────────────────────────

function MutedAction() {
  return <span style={{ fontSize: "12px", color: "var(--muted-foreground)", opacity: 0.6 }}>—</span>
}

function TagChip({ text, tone = "off" }: { text: string; tone?: "off" | "amber" }) {
  return (
    <span
      style={{
        display: "inline-block", fontSize: "10px", padding: "1px 6px", borderRadius: "999px",
        marginRight: "4px", whiteSpace: "nowrap",
        backgroundColor: tone === "amber" ? "rgba(255,122,66,0.12)" : "rgba(110,129,151,0.14)",
        color: tone === "amber" ? "var(--amber)" : "var(--muted-foreground)",
      }}
    >
      {text}
    </span>
  )
}

/** 树形勾选的方形勾选框：全选 ✓ / 部分 – / 未选 空 */
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

// 功能菜单树全量（用于「全选」）：一级 + AI实时治理页签 + 治理配置子模块
const ALL_MENU_IDS = MENUS.map((m) => m.id)
const ALL_LIVE_TABS = MENU_CHILDREN.live.map((c) => c.id)
const ALL_CONFIG_MODULES = MENU_CHILDREN.config.map((c) => c.id)

function ChipMulti({ options, selected, onToggle, disabledIds, disabledTag }: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  /** 这些选项不可勾选（如已停用）；若同时已在 selected 中则保留展示 */
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

// ─── 组织架构（外部同步 + 手动创建 双源） ─────────────────────────────────────
// - 平台同步条目：名称/层级/上级只读；街道可停用
// - 手动创建条目：本系统维护，可编辑、可停用；手动街道同样可勾选为账号范围
// - 社区仅展示：不能作为范围或挂责任人（无论来源）

const ORG_SYNC = "平台同步"
const ORG_MANUAL = "手动创建"

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function OrgCard({ orgSynced, author }: { orgSynced: boolean; author: string }) {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const rows = state.rows["org"] || []
  const [query, setQuery] = useState("")
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; index: number } | null>(null)
  const [form, setForm] = useState({ name: "", level: "街道" as "街道" | "社区", parent: "" })
  const [err, setErr] = useState("")

  const districtName = rows.find((r) => r.values[1] === "区级")?.values[0] ?? "东城区"
  const streetNames = rows.filter((r) => r.values[1] === "街道" && r.status === "启用").map((r) => r.values[0])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return rows.map((r, i) => ({ r, i }))
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => r.values.some((v) => v.includes(q)))
  }, [rows, query])

  function sourceOf(r: { values: string[] }): string {
    return r.values[3] === ORG_MANUAL ? ORG_MANUAL : ORG_SYNC
  }

  function toggleRow(i: number) {
    const row = rows[i]
    const on = row.status === "启用"
    const name = row.values[0]
    const level = row.values[1]
    dispatch({ type: "toggle", cardKey: "org", index: i })
    toast(level === "社区"
      ? `已${on ? "停用" : "启用"}社区「${name}」：立即生效。社区仅展示，不影响账号范围。`
      : on
        ? `已停用街道「${name}」：立即生效。不能再被新的范围勾上；账号上已勾的旧范围仍显示，新事件不再因它进入待办。`
        : `已启用街道「${name}」：立即生效，可重新被范围勾选。`)
  }

  function openAdd() {
    setErr("")
    setForm({ name: "", level: "街道", parent: districtName })
    setDrawer({ mode: "add", index: -1 })
  }
  function openEdit(i: number) {
    const r = rows[i]
    if (!r) return
    setErr("")
    setForm({ name: r.values[0], level: r.values[1] === "社区" ? "社区" : "街道", parent: r.values[2] })
    setDrawer({ mode: "edit", index: i })
  }

  function save() {
    if (!drawer) return
    const name = form.name.trim()
    if (!name) { setErr("「机构名称」为必填项"); return }
    if (name.length > 20) { setErr("机构名称不超过 20 字"); return }
    const dup = rows.some((r, i) => r.values[0] === name && i !== drawer.index)
    if (dup) { setErr(`机构名称「${name}」已存在`); return }
    if (form.level === "社区") {
      // 社区的上级必须是街道（编辑时允许保留原上级，即使该街道已停用）
      const validParents = streetNames.slice()
      if (drawer.mode === "edit" && form.parent && !validParents.includes(form.parent)) validParents.unshift(form.parent)
      if (!validParents.includes(form.parent)) { setErr("社区必须挂在一条街道下：请选择上级街道"); return }
    }
    if (drawer.mode === "add") {
      const values = [name, form.level, form.level === "街道" ? districtName : form.parent, ORG_MANUAL, "—"]
      dispatch({ type: "upsert", cardKey: "org", index: rows.length, values, status: "启用" })
      dispatch({
        type: "ledger-note",
        entry: {
          version: "—", date: today(), author: author.split(" · ")[0] || author,
          modules: ["组织、账号与角色"], note: `手动创建${form.level}「${name}」（上级：${values[2]}）`, immediate: true,
        },
      })
      toast(form.level === "街道"
        ? `已创建街道「${name}」，立即生效：可勾选为账号负责范围，可挂网格。`
        : `已创建社区「${name}」，立即生效：挂${values[2]}下。社区仅展示。`)
    } else {
      const prev = rows[drawer.index]
      const values = [...prev.values]
      values[0] = name
      values[2] = form.level === "街道" ? districtName : form.parent
      dispatch({ type: "upsert", cardKey: "org", index: drawer.index, values, status: prev.status })
      dispatch({
        type: "ledger-note",
        entry: {
          version: "—", date: today(), author: author.split(" · ")[0] || author,
          modules: ["组织、账号与角色"], note: `编辑${form.level}「${prev.values[0]}」→「${name}」（上级：${values[2]}）`, immediate: true,
        },
      })
      toast(`已保存${form.level}「${name}」，立即生效。`)
    }
    setDrawer(null)
  }

  const emptyNode = (
    <div style={{ padding: "26px 16px", textAlign: "center", fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.8 }}>
      <div style={{ fontSize: "22px", marginBottom: "8px" }}>⏳</div>
      {orgSynced
        ? "暂无组织数据。"
        : <>组织同步位为空：等待平台同步组织架构；也可在右上角手动创建，创建即生效。</>}
      <br />
      {!orgSynced && "同步完成前，手动创建的街道即可用于账号范围与网格归属。"}
    </div>
  )

  return (
    <section style={{ ...S.card, marginBottom: "14px" }} aria-label="组织架构">
      <header style={S.cardHead}>
        <h3 style={S.cardTitle}>组织架构</h3>
        <span style={S.cardNote}>
          双来源：平台同步（名称、层级、上级只读；街道可停用）＋ 手动创建（本系统维护，可编辑、可停用，街道同样可勾选为账号范围）；社区仅展示，不能作为范围或挂责任人
        </span>
      </header>
      <div style={S.toolbar}>
        <input style={S.search} value={query} placeholder="搜索组织架构" onChange={(e) => setQuery(e.target.value)} />
        <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={openAdd}>＋ 新建组织</button>
      </div>
      {rows.length === 0 && emptyNode}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["机构名称", "层级", "上级机构", "来源"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={S.empty}>{query ? "没有匹配的组织节点" : "暂无组织数据"}</td></tr>
              )}
              {filtered.map(({ r, i }) => {
                const level = r.values[1]
                const isStreet = level === "街道"
                const manual = sourceOf(r) === ORG_MANUAL
                return (
                  <tr key={i}>
                    <td style={{ ...S.td, ...S.tdName }}>
                      {r.values[0]}
                      {manual && <TagChip text="手动" />}
                    </td>
                    <td style={S.td}>{level}</td>
                    <td style={S.td}>{r.values[2]}</td>
                    <td style={S.td}>{sourceOf(r)}</td>
                    <td style={S.td}><Chip status={r.status} /></td>
                    <td style={{ ...S.td, ...S.tdActions }}>
                      {manual && <button type="button" style={S.btnLink} onClick={() => openEdit(i)}>编辑</button>}
                      {isStreet || manual ? (
                        <button type="button" style={S.btnLink} onClick={() => toggleRow(i)}>
                          {r.status === "启用" ? "停用" : "启用"}
                        </button>
                      ) : (
                        <MutedAction />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <Drawer
          title={drawer.mode === "add" ? "新建组织" : `编辑组织「${rows[drawer.index]?.values[0] || "…"}」`}
          onClose={() => setDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={save}>保存（立即生效）</button>
            </>
          }
        >
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>机构名称（必填，不超过 20 字，不能与现有机构重名）</label>
            <input style={S.input} value={form.name} placeholder="如 朝阳门街道" onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>层级{drawer.mode === "edit" ? "（创建后不可改）" : "（区级来自平台同步，不提供手动创建）"}</label>
            {drawer.mode === "add" ? (
              <div style={{ display: "flex", gap: "6px" }}>
                {(["街道", "社区"] as const).map((lv) => (
                  <button
                    key={lv} type="button"
                    onClick={() => setForm((p) => ({ ...p, level: lv, parent: lv === "街道" ? districtName : p.parent || streetNames[0] || "" }))}
                    style={{
                      fontSize: "11px", padding: "4px 12px", borderRadius: "6px", cursor: "pointer",
                      border: `1px solid ${form.level === lv ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: form.level === lv ? "rgba(50,109,255,0.1)" : "var(--background)",
                      color: form.level === lv ? "var(--primary)" : "var(--muted-foreground)",
                    }}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            ) : (
              <input style={{ ...S.input, backgroundColor: "var(--card-2)", color: "var(--muted-foreground)" }} value={form.level} readOnly />
            )}
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>{form.level === "街道" ? `上级机构（固定：${districtName}）` : "上级街道（必选）"}</label>
            {form.level === "街道" ? (
              <input style={{ ...S.input, backgroundColor: "var(--card-2)", color: "var(--muted-foreground)" }} value={districtName} readOnly />
            ) : (
              <select style={S.input} value={form.parent} onChange={(e) => setForm((p) => ({ ...p, parent: e.target.value }))}>
                <option value="">选择上级街道…</option>
                {(drawer.mode === "edit" && form.parent && !streetNames.includes(form.parent)
                  ? [form.parent, ...streetNames]
                  : streetNames
                ).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </div>
          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px", lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            手动创建的组织由本系统维护：可编辑、可停用；手动创建的街道与同步街道同权——可勾选为账号负责范围、可挂网格主责与协同监督。
            社区仅展示，不能作为范围或挂责任人。平台同步条目仍保持只读（街道可停用），以外部平台为权威源。
          </div>
        </Drawer>
      )}
    </section>
  )
}

// ─── 角色 ────────────────────────────────────────────────────────────────────

function RoleCard({ cid }: { cid: string }) {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const ledger = state.ledgers[cid]
  const rows = ledger?.roles ?? []
  const [query, setQuery] = useState("")
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; id: string } | null>(null)
  const [form, setForm] = useState({
    name: "", steps: [] as string[],
    leafMenus: [] as string[], // Web 端无二级结构的菜单（dashboard/archive/stats/workbench）
    configModules: [] as string[], // Web 端治理配置二级子模块
    liveTabs: [] as string[], // Web 端 AI实时治理二级页签
    appLeafMenus: [] as string[], // App 端无二级结构的菜单
    appConfigModules: [] as string[], // App 端治理配置二级子模块
    appLiveTabs: [] as string[], // App 端 AI实时治理二级页签
    subscribeTypes: [] as string[], // 订阅事件类型（来自客户订阅事件类型集合）
  })
  const [err, setErr] = useState("")
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  // 客户订阅事件类型集合：角色订阅只能在此范围内选（平台层客户页维护）
  const subscribedCatalog = state.platform.customers.find((c) => c.id === cid)?.subscribedTypes ?? []

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return rows.map((r, i) => ({ r, i }))
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => r.name.includes(q) || r.steps.some((s) => s.includes(q)))
  }, [rows, query])

  function memberCount(roleId: string): number {
    return ledger.accounts.filter((a) => a.status === "启用" && a.roles.includes(roleId)).length
  }

  function openAdd() {
    setErr("")
    setForm({ name: "", steps: [], leafMenus: [], configModules: [], liveTabs: [], appLeafMenus: [], appConfigModules: [], appLiveTabs: [], subscribeTypes: [] })
    setDrawer({ mode: "add", id: "" })
  }
  function openEdit(id: string) {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    setErr("")
    const menus = r.menus ?? []
    const appMenus = r.appMenus ?? []
    setForm({
      name: r.name,
      steps: [...r.steps],
      leafMenus: menus.filter((mid) => !MENU_CHILDREN[mid]),
      configModules: [...(r.configModules ?? [])],
      liveTabs: [...(r.liveTabs ?? [])],
      appLeafMenus: appMenus.filter((mid) => !MENU_CHILDREN[mid]),
      appConfigModules: [...(r.appConfigModules ?? [])],
      appLiveTabs: [...(r.appLiveTabs ?? [])],
      subscribeTypes: [...(r.subscribeTypes ?? [])],
    })
    setDrawer({ mode: "edit", id })
  }

  function toggleLeafMenu(id: string) {
    setForm((p) => ({
      ...p,
      leafMenus: p.leafMenus.includes(id) ? p.leafMenus.filter((x) => x !== id) : [...p.leafMenus, id],
    }))
  }
  /** 勾/取消一级父节点：勾上=全选二级；取消=清空二级 */
  function toggleParent(id: string) {
    const children = MENU_CHILDREN[id]
    if (!children) { toggleLeafMenu(id); return }
    if (id === "live") {
      setForm((p) => ({ ...p, liveTabs: p.liveTabs.length === children.length ? [] : children.map((c) => c.id) }))
    } else {
      setForm((p) => ({ ...p, configModules: p.configModules.length === children.length ? [] : children.map((c) => c.id) }))
    }
  }
  function toggleLiveTab(id: string) {
    setForm((p) => ({ ...p, liveTabs: p.liveTabs.includes(id) ? p.liveTabs.filter((x) => x !== id) : [...p.liveTabs, id] }))
  }
  function toggleConfigModule(id: string) {
    setForm((p) => ({ ...p, configModules: p.configModules.includes(id) ? p.configModules.filter((x) => x !== id) : [...p.configModules, id] }))
  }
  function toggleSubscribeType(id: string) {
    setForm((p) => ({ ...p, subscribeTypes: p.subscribeTypes.includes(id) ? p.subscribeTypes.filter((x) => x !== id) : [...p.subscribeTypes, id] }))
  }

  // ── App 端功能菜单（与 Web 端同款树形勾选，互相独立）──
  function toggleAppLeafMenu(id: string) {
    setForm((p) => ({
      ...p,
      appLeafMenus: p.appLeafMenus.includes(id) ? p.appLeafMenus.filter((x) => x !== id) : [...p.appLeafMenus, id],
    }))
  }
  function toggleAppParent(id: string) {
    const children = MENU_CHILDREN[id]
    if (!children) { toggleAppLeafMenu(id); return }
    if (id === "live") {
      setForm((p) => ({ ...p, appLiveTabs: p.appLiveTabs.length === children.length ? [] : children.map((c) => c.id) }))
    } else {
      setForm((p) => ({ ...p, appConfigModules: p.appConfigModules.length === children.length ? [] : children.map((c) => c.id) }))
    }
  }
  function toggleAppLiveTab(id: string) {
    setForm((p) => ({ ...p, appLiveTabs: p.appLiveTabs.includes(id) ? p.appLiveTabs.filter((x) => x !== id) : [...p.appLiveTabs, id] }))
  }
  function toggleAppConfigModule(id: string) {
    setForm((p) => ({ ...p, appConfigModules: p.appConfigModules.includes(id) ? p.appConfigModules.filter((x) => x !== id) : [...p.appConfigModules, id] }))
  }

  function save() {
    if (!drawer) return
    const name = form.name.trim()
    if (name.length < 2 || name.length > 20) { setErr("角色名称需 2–20 字"); return }
    if (form.steps.length === 0) { setErr("至少为角色选择一个步骤"); return }
    // menus 由树形选择合成：叶子勾选 + 任一二级被勾则父级生效
    const menus = [
      ...form.leafMenus,
      ...(form.liveTabs.length > 0 ? ["live"] : []),
      ...(form.configModules.length > 0 ? ["config"] : []),
    ]
    if (menus.length === 0) { setErr("至少为 Web 端分配一个功能菜单"); return }
    // App 端同一套合成；允许全空 = 该角色未开通 App 端
    const appMenus = [
      ...form.appLeafMenus,
      ...(form.appLiveTabs.length > 0 ? ["live"] : []),
      ...(form.appConfigModules.length > 0 ? ["config"] : []),
    ]
    const dup = rows.some((r) => r.status === "启用" && r.name === name && r.id !== drawer.id)
    if (dup) { setErr(`角色名称「${name}」在启用角色中已存在，请换个名称`); return }
    const stepErr = validateStepSet(form.steps)
    if (stepErr) { setErr(stepErr); return }
    const prev = drawer.mode === "edit" ? rows.find((x) => x.id === drawer.id) : undefined
    const role: LedgerRole = {
      id: prev?.id || "r-" + Date.now().toString(36),
      name,
      steps: [...form.steps],
      menus,
      configModules: [...form.configModules],
      liveTabs: [...form.liveTabs],
      appMenus,
      appConfigModules: [...form.appConfigModules],
      appLiveTabs: [...form.appLiveTabs],
      subscribeTypes: form.subscribeTypes.filter((t) => subscribedCatalog.includes(t)),
      source: prev?.source || "自定义",
      status: prev?.status || "启用",
    }
    dispatch({ type: "ledger-role-upsert", cid, role })
    toast(
      `已保存角色「${name}」，立即生效：Web 端 ${menuSummary(menus, form.configModules, form.liveTabs).length} 项菜单` +
      (appMenus.length ? `，App 端 ${menuSummary(appMenus, form.appConfigModules, form.appLiveTabs).length} 项菜单` : "，App 端未开通") +
      (form.subscribeTypes.length ? `，订阅事件类型 ${form.subscribeTypes.length} 项` : "。") ,
    )
    setDrawer(null)
  }

  function requestDelete(id: string) {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    const used = memberCount(id)
    if (used > 0) {
      toast(`角色「${r.name}」仍被 ${used} 个启用账号使用，不能删除。可先停用：停用后不能再赋给新账号，已绑定账号立即失去该角色的步骤。`)
      return
    }
    setConfirmDel(id)
  }

  function toggleStatus(id: string) {
    const r = rows.find((x) => x.id === id)
    if (!r) return
    const on = r.status === "启用"
    dispatch({ type: "ledger-role-status", cid, id, status: on ? "停用" : "启用" })
    toast(on
      ? `已停用角色「${r.name}」：立即生效。不能再赋给新账号，已绑定账号立即失去该角色的步骤。`
      : `已启用角色「${r.name}」。`)
  }

  return (
    <section style={{ ...S.card, marginBottom: "14px" }} aria-label="角色">
      <header style={S.cardHead}>
        <h3 style={S.cardTitle}>角色</h3>
        <span style={S.cardNote}>角色名称自定义；能做的步骤只能从冻结清单多选，不能自造；现场步骤不能与管理步骤同配</span>
      </header>
      <div style={S.toolbar}>
        <input style={S.search} value={query} placeholder="搜索角色或步骤" onChange={(e) => setQuery(e.target.value)} />
        <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={openAdd}>＋ 新增角色</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              {["角色", "成员数", "负责步骤", "功能菜单", "订阅事件类型", "来源"].map((c) => <th key={c} style={S.th}>{c}</th>)}
              <th style={S.th}>状态</th>
              <th style={{ ...S.th, textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={S.empty}>{query ? "没有匹配的角色" : "暂无角色，点击右上角新增"}</td></tr>
            )}
            {filtered.map(({ r }) => (
              <tr key={r.id}>
                <td style={{ ...S.td, ...S.tdName }}>{r.name}</td>
                <td style={S.td}>{memberCount(r.id)}</td>
                <td style={S.td}>{r.steps.join("、")}</td>
                <td style={S.td}>
                  {(r.menus ?? []).length ? menuSummary(r.menus, r.configModules, r.liveTabs).join("、") : "—"}
                  {(r.appMenus ?? []).length > 0 && (
                    <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "2px" }}>
                      App：{menuSummary(r.appMenus, r.appConfigModules, r.appLiveTabs).join("、")}
                    </div>
                  )}
                  {(r.appMenus ?? []).length === 0 && (
                    <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "2px" }}>App：未开通</div>
                  )}
                </td>
                <td style={S.td}>
                  {(r.subscribeTypes ?? []).length
                    ? <span style={{ fontSize: "11px" }}>{r.subscribeTypes!.slice(0, 3).join("、")}{r.subscribeTypes!.length > 3 ? ` 等 ${r.subscribeTypes!.length} 项` : ""}</span>
                    : <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>不限（全部）</span>}
                </td>
                <td style={S.td}>{r.source}</td>
                <td style={S.td}><Chip status={r.status} /></td>
                <td style={{ ...S.td, ...S.tdActions }}>
                  <button type="button" style={S.btnLink} onClick={() => openEdit(r.id)}>编辑</button>
                  <button type="button" style={S.btnLink} onClick={() => toggleStatus(r.id)}>
                    {r.status === "启用" ? "停用" : "启用"}
                  </button>
                  <button type="button" style={S.btnLinkDanger} onClick={() => requestDelete(r.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && (
        <Drawer
          title={(drawer.mode === "add" ? "新增角色" : `编辑角色「${form.name || "…"}」`)}
          onClose={() => setDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={save}>保存（立即生效）</button>
            </>
          }
        >
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>角色名称（必填，2–20 字，启用角色中唯一）</label>
            <input style={S.input} value={form.name} placeholder="如 立案派发" onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: "8px" }}>
            <label style={S.fieldLabel}>能做的步骤（从冻结清单多选，不能自造）</label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "6px" }}>
            {STEPS.map((s) => {
              const on = form.steps.includes(s)
              return (
                <button
                  key={s} type="button"
                  onClick={() => setForm((p) => ({
                    ...p,
                    steps: on ? p.steps.filter((x) => x !== s) : [...p.steps, s],
                  }))}
                  style={{
                    display: "flex", alignItems: "baseline", gap: "8px", textAlign: "left",
                    fontSize: "12px", padding: "8px 10px", borderRadius: "7px", cursor: "pointer",
                    border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                    backgroundColor: on ? "rgba(50,109,255,0.08)" : "var(--background)",
                    color: "var(--foreground)",
                  }}
                >
                  <span style={{ fontWeight: 600, color: on ? "var(--primary)" : "var(--foreground)", minWidth: "96px" }}>
                    {on ? "✓ " : ""}{s}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{STEP_CAPTIONS[s]}</span>
                </button>
              )
            })}
          </div>
          <div style={{ marginBottom: "8px", marginTop: "12px" }}>
            <label style={S.fieldLabel}>可用的功能菜单（一级=菜单，二级=菜单内页签 / 子模块；Web / App 端分别配置）</label>
          </div>
          {([
            { end: "web" as const, label: "Web 端", color: "var(--primary)", leaf: form.leafMenus, live: form.liveTabs, config: form.configModules,
              tParent: toggleParent, tLeaf: toggleLeafMenu, tLive: toggleLiveTab, tConfig: toggleConfigModule },
            { end: "app" as const, label: "App 端", color: "var(--purple)", leaf: form.appLeafMenus, live: form.appLiveTabs, config: form.appConfigModules,
              tParent: toggleAppParent, tLeaf: toggleAppLeafMenu, tLive: toggleAppLiveTab, tConfig: toggleAppConfigModule },
          ]).map((e) => {
            const appTotal = ALL_MENU_IDS.length + ALL_LIVE_TABS.length + ALL_CONFIG_MODULES.length
            const appSelected = e.leaf.length + e.live.length + e.config.length
            const empty = appSelected === 0
            return (
              <div key={e.end} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: e.color }}>{e.label}</span>
                  <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                    {empty ? (e.end === "app" ? "未开通 · 勾选菜单或点「全选」开通" : "必选") : "已开通"}
                  </span>
                  {e.end === "app" && (
                    <span style={{ fontSize: "10px", color: "var(--muted-foreground)", marginLeft: "auto", fontFamily: "JetBrains Mono, monospace" }}>
                      已选 {appSelected}/{appTotal}
                    </span>
                  )}
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "4px 10px", marginBottom: "12px" }}>
                  {MENUS.map((m) => {
                    const children = MENU_CHILDREN[m.id]
                    const childIds = m.id === "live" ? e.live : m.id === "config" ? e.config : undefined
                    const childCount = childIds?.length ?? 0
                    const on = children ? childCount > 0 : e.leaf.includes(m.id)
                    const all = children ? childCount === children.length : on
                    const toggle = children ? () => e.tParent(m.id) : () => e.tLeaf(m.id)
                    return (
                      <div key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <button
                          type="button"
                          onClick={toggle}
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
                                  onClick={() => (m.id === "live" ? e.tLive(c.id) : e.tConfig(c.id))}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 2px" }}>
                    <button
                      type="button" style={S.btnLink}
                      onClick={() => setForm((p) => (e.end === "web"
                        ? { ...p, leafMenus: [...ALL_MENU_IDS], liveTabs: [...ALL_LIVE_TABS], configModules: [...ALL_CONFIG_MODULES] }
                        : { ...p, appLeafMenus: [...ALL_MENU_IDS], appLiveTabs: [...ALL_LIVE_TABS], appConfigModules: [...ALL_CONFIG_MODULES] }))}
                    >
                      全选
                    </button>
                    <button
                      type="button" style={S.btnLink}
                      onClick={() => setForm((p) => (e.end === "web"
                        ? { ...p, leafMenus: [], liveTabs: [], configModules: [] }
                        : { ...p, appLeafMenus: [], appLiveTabs: [], appConfigModules: [] }))}
                    >
                      清空{e.end === "app" ? "（未开通）" : ""}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ marginBottom: "8px", marginTop: "12px" }}>
            <label style={S.fieldLabel}>订阅事件类型（来自客户订阅事件类型集合；不选 = 不限）</label>
          </div>
          {subscribedCatalog.length === 0 ? (
            <div style={{ fontSize: "11px", color: "var(--amber)", border: "1px dashed var(--border)", borderRadius: "8px", padding: "10px", lineHeight: "1.7" }}>
              该客户尚未订阅事件类型（由平台在「客户」页开通订阅）。开通后才能在此为角色配置订阅事件类型。
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <button type="button" style={S.btnLink} onClick={() => setForm((p) => ({ ...p, subscribeTypes: [...subscribedCatalog] }))}>全选</button>
                <button type="button" style={S.btnLink} onClick={() => setForm((p) => ({ ...p, subscribeTypes: [] }))}>清空（不限）</button>
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", marginLeft: "auto" }}>
                  已选 {form.subscribeTypes.length}/{subscribedCatalog.length}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                {subscribedCatalog.map((t) => {
                  const on = form.subscribeTypes.includes(t)
                  return (
                    <button
                      key={t} type="button"
                      onClick={() => toggleSubscribeType(t)}
                      style={{
                        fontSize: "11px", padding: "4px 10px", borderRadius: "6px", cursor: "pointer",
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
            </>
          )}
          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginTop: "6px", lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "10px", lineHeight: 1.7 }}>
            步骤与菜单相互独立：步骤决定能做什么（办理权限），菜单决定能看到哪里（可见范围）。
            勾选一级菜单默认全选二级，可单独调整；二级全部取消即视为未分配该菜单。
            订阅事件类型来自客户订阅集合（平台层客户页维护），不选 = 不限，即订阅该客户全部事件类型。
            互斥规则：处置 / 外场核查回传 不能与 事件有效审核、立案派发、核查审核、作废深化、改配置、只看 同配；
            改配置 / 只看 不能与任何办理步骤同配。事件有效审核、立案派发、核查审核、作废深化 允许同配在多个角色。
          </div>
        </Drawer>
      )}

      {confirmDel !== null && (
        <ConfirmModal
          title="删除角色"
          body={<>将删除角色「{rows.find((x) => x.id === confirmDel)?.name}」。该角色当前没有被启用账号使用，删除立即生效。</>}
          confirmText="删除"
          onConfirm={() => {
            const r = rows.find((x) => x.id === confirmDel)
            dispatch({ type: "ledger-role-remove", cid, id: confirmDel })
            toast(`已删除角色「${r?.name}」，立即生效。`)
            setConfirmDel(null)
          }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </section>
  )
}

// ─── 账号 ────────────────────────────────────────────────────────────────────

function AccountCard({ cid, orgSynced }: { cid: string; orgSynced: boolean }) {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const ledger = state.ledgers[cid]
  const rows = ledger?.accounts ?? []
  const [query, setQuery] = useState("")
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; id: string } | null>(null)
  const [f, setF] = useState({
    name: "", login: "", org: "东城区", roles: [] as string[],
    scopeKind: "district" as LedgerAccount["scopeKind"],
    streets: [] as string[], grids: [] as string[], eventTypes: [] as string[],
  })
  const [err, setErr] = useState("")
  const [confirmStop, setConfirmStop] = useState<string | null>(null)

  const roleOptions = (ledger?.roles ?? []).filter((r) => r.status === "启用")
  // 负责事件类型的可选范围 = 客户订阅事件类型集合（平台层客户页维护）
  const subscribedCatalog = state.platform.customers.find((c) => c.id === cid)?.subscribedTypes ?? []
  const allStreets = enabledStreets(state.rows)
  const grids = gridRows(state.rows)
  const gridOptions = grids.map((g) => g.code)
  const disabledGrids = grids.filter((g) => g.stored === "停用").map((g) => g.code)
  const disabledStreetIds = (state.rows["org"] || [])
    .filter((r) => r.values[1] === "街道" && r.status !== "启用").map((r) => r.values[0])

  const unionSteps = useMemo(() => {
    const acc: LedgerAccount = {
      id: "", name: f.name, login: f.login, org: f.org, roles: f.roles,
      scopeKind: f.scopeKind, streets: f.streets, grids: f.grids,
      eventTypes: f.eventTypes, lastLogin: "", status: "启用",
    }
    return stepsOf(ledger, acc)
  }, [ledger, f.roles])
  const profile = accountProfile(unionSteps)
  const unionErr = f.roles.length > 0 ? validateStepSet(unionSteps) : null
  const unionMenus = useMemo(() => {
    const acc: LedgerAccount = {
      id: "", name: f.name, login: f.login, org: f.org, roles: f.roles,
      scopeKind: f.scopeKind, streets: f.streets, grids: f.grids,
      eventTypes: f.eventTypes, lastLogin: "", status: "启用",
    }
    return menusOf(ledger, acc)
  }, [ledger, f.roles])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return rows
    return rows.filter((a) => a.name.includes(q) || a.login.includes(q) || scopeText(a).includes(q))
  }, [rows, query])

  function openAdd() {
    setErr("")
    setF({ name: "", login: "", org: orgSynced ? "东城区" : "（待同步）", roles: [], scopeKind: "district", streets: [], grids: [], eventTypes: [] })
    setDrawer({ mode: "add", id: "" })
  }
  function openEdit(id: string) {
    const a = rows.find((x) => x.id === id)
    if (!a) return
    setErr("")
    setF({
      name: a.name, login: a.login, org: a.org, roles: [...a.roles],
      scopeKind: a.scopeKind, streets: [...a.streets], grids: [...a.grids],
      eventTypes: [...a.eventTypes],
    })
    setDrawer({ mode: "edit", id })
  }

  function save() {
    if (!drawer) return
    const name = f.name.trim()
    const login = f.login.trim()
    if (!name) { setErr("「姓名」为必填项"); return }
    if (!login) { setErr("「账号」为必填项"); return }
    const dupLogin = rows.some((a) => a.login === login && a.id !== drawer.id)
    if (dupLogin) { setErr(`账号「${login}」已存在`); return }
    if (f.roles.length === 0) { setErr("账号必须至少绑定一个角色"); return }
    if (unionErr) { setErr(unionErr); return }
    const prev = drawer.mode === "edit" ? rows.find((x) => x.id === drawer.id) : undefined
    if (profile === "audit") {
      if (f.scopeKind === "streets" && f.streets.length === 0) {
        setErr("范围选择了「指定街道」：至少勾选 1 个启用中的街道"); return
      }
      if (f.eventTypes.length === 0) { setErr("负责的事件类型至少选 1 个（来源：客户订阅事件类型集合）"); return }
    } else if (profile === "field") {
      if (f.grids.length === 0) { setErr("范围至少勾选 1 个网格（可多选启用中的网格）"); return }
      if (f.eventTypes.length === 0) { setErr("负责的事件类型至少选 1 个（来源：客户订阅事件类型集合）"); return }
    }
    const scopeKind: LedgerAccount["scopeKind"] = profile === "field" ? "grids" : profile === "audit" ? f.scopeKind : "district"
    const account: LedgerAccount = {
      id: prev?.id || "a-" + Date.now().toString(36),
      name, login, org: f.org, roles: [...f.roles],
      scopeKind,
      streets: scopeKind === "streets" ? [...f.streets] : [],
      grids: scopeKind === "grids" ? [...f.grids] : [],
      eventTypes: profile === "view" ? [] : f.eventTypes.filter((t) => subscribedCatalog.includes(t)),
      lastLogin: prev?.lastLogin || "—",
      status: prev?.status || "启用",
    }
    dispatch({ type: "ledger-account-upsert", cid, account })
    toast(`已保存账号「${name}」，立即生效：影响新待办、新派发与新外场任务；已派发事件和已派出的外场任务不改人。`)
    setDrawer(null)
  }

  function toggleStatus(id: string) {
    const a = rows.find((x) => x.id === id)
    if (!a) return
    if (a.status === "启用") { setConfirmStop(id); return }
    dispatch({ type: "ledger-account-status", cid, id, status: "启用" })
    toast(`已启用账号「${a.name}」。`)
  }

  return (
    <section style={{ ...S.card, marginBottom: "14px" }} aria-label="账号">
      <header style={S.cardHead}>
        <h3 style={S.cardTitle}>账号</h3>
        <span style={S.cardNote}>账号上配置角色、范围、负责的事件类型；保存即生效——只影响新待办与新派发，不改写已派发事件</span>
      </header>
      <div style={S.toolbar}>
        <input style={S.search} value={query} placeholder="搜索姓名、账号或范围" onChange={(e) => setQuery(e.target.value)} />
        <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={openAdd}>＋ 新增账号</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              {["姓名", "账号", "角色", "归属组织", "负责范围", "负责事件类型", "最近登录"].map((c) => <th key={c} style={S.th}>{c}</th>)}
              <th style={S.th}>状态</th>
              <th style={{ ...S.th, textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={S.empty}>{query ? "没有匹配的账号" : "暂无账号，点击右上角新增"}</td></tr>
            )}
            {filtered.map((a) => {
              const names = a.roles.map((rid) => ledger.roles.find((r) => r.id === rid)?.name).filter(Boolean)
              return (
                <tr key={a.id}>
                  <td style={{ ...S.td, ...S.tdName }}>{a.name}</td>
                  <td style={S.td}>{a.login}</td>
                  <td style={S.td}>{names.join("、") || "—"}</td>
                  <td style={S.td}>{a.org}</td>
                  <td style={S.td}>{scopeText(a)}</td>
                  <td style={S.td}>{a.eventTypes.length ? a.eventTypes.join("、") : "—"}</td>
                  <td style={S.td}>{a.lastLogin}</td>
                  <td style={S.td}><Chip status={a.status} /></td>
                  <td style={{ ...S.td, ...S.tdActions }}>
                    <button type="button" style={S.btnLink} onClick={() => openEdit(a.id)}>编辑</button>
                    <button type="button" style={S.btnLink} onClick={() => toggleStatus(a.id)}>
                      {a.status === "启用" ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {drawer && (
        <Drawer
          title={(drawer.mode === "add" ? "新增账号" : `编辑账号「${f.name || "…"}」`)}
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
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>归属组织</label>
            <select style={S.input} value={f.org} onChange={(e) => setF((p) => ({ ...p, org: e.target.value }))}>
              {orgSynced
                ? (state.rows["org"] || []).filter((r) => r.status === "启用" && r.values[1] !== "社区").map((r) => (
                    <option key={r.values[0]} value={r.values[0]}>{r.values[0]}</option>
                  ))
                : <option value="（待同步）">（待同步）</option>}
            </select>
            {!orgSynced && (
              <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                组织同步位为空：归属组织在平台同步后自动带入。
              </div>
            )}
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={S.fieldLabel}>角色（必填，可多选；已停用角色不能再赋给新账号）</label>
            <ChipMulti
              options={roleOptions.map((r) => r.name)}
              selected={f.roles.map((rid) => ledger.roles.find((r) => r.id === rid)?.name || "")}
              onToggle={(name) => {
                const rid = ledger.roles.find((r) => r.name === name)?.id
                if (!rid) return
                setF((p) => ({ ...p, roles: p.roles.includes(rid) ? p.roles.filter((x) => x !== rid) : [...p.roles, rid] }))
              }}
            />
          </div>
          {f.roles.length > 0 && (
            <div style={{ marginBottom: "12px", padding: "8px 10px", borderRadius: "7px", backgroundColor: "var(--card-2)", fontSize: "11px", lineHeight: 1.8 }}>
              <div style={{ color: "var(--muted-foreground)" }}>步骤并集（由启用角色推导）</div>
              <div style={{ color: unionErr ? "var(--red)" : "var(--foreground)" }}>
                {unionSteps.length ? unionSteps.join("、") : "（所选角色均未启用或无步骤）"}
              </div>
              <div style={{ color: "var(--muted-foreground)", marginTop: "4px" }}>可见菜单（由启用角色推导）</div>
              <div style={{ color: unionMenus.length ? "var(--foreground)" : "var(--amber)" }}>
                {unionMenus.length ? unionMenus.map(menuName).join("、") : "（无可用菜单：账号将看不到任何系统菜单）"}
              </div>
              {unionErr && <div style={{ marginTop: "4px" }}>{unionErr}</div>}
            </div>
          )}
          {profile === "audit" && (
            <>
              <div style={{ marginBottom: "10px" }}>
                <label style={S.fieldLabel}>负责范围（具备审核类步骤：全区，或若干启用中的街道）</label>
                <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                  {(["district", "streets"] as const).map((k) => (
                    <button
                      key={k} type="button"
                      onClick={() => setF((p) => ({ ...p, scopeKind: k }))}
                      style={{
                        fontSize: "11px", padding: "4px 12px", borderRadius: "6px", cursor: "pointer",
                        border: `1px solid ${f.scopeKind === k ? "var(--primary)" : "var(--border)"}`,
                        backgroundColor: f.scopeKind === k ? "rgba(50,109,255,0.1)" : "var(--background)",
                        color: f.scopeKind === k ? "var(--primary)" : "var(--muted-foreground)",
                      }}
                    >
                      {k === "district" ? "全区" : "指定街道"}
                    </button>
                  ))}
                </div>
                {f.scopeKind === "streets" && (
                  <ChipMulti
                    options={allStreets}
                    selected={f.streets}
                    onToggle={(v) => setF((p) => ({ ...p, streets: p.streets.includes(v) ? p.streets.filter((x) => x !== v) : [...p.streets, v] }))}
                    disabledIds={[...disabledStreetIds, ...(state.rows["org"] || []).filter((r) => r.values[1] === "社区").map((r) => r.values[0])]}
                    disabledTag="已停用"
                  />
                )}
                {f.scopeKind === "streets" && (
                  <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                    已停用的街道不能再勾选；账号上已勾的旧范围仍显示，新事件不再因它进入待办。社区不能作为范围。
                  </div>
                )}
              </div>
            </>
          )}
          {profile === "field" && (
            <div style={{ marginBottom: "10px" }}>
              <label style={S.fieldLabel}>负责范围（具备处置 / 外场步骤：多选启用中的网格）</label>
              <ChipMulti
                options={gridOptions}
                selected={f.grids}
                onToggle={(v) => setF((p) => ({ ...p, grids: p.grids.includes(v) ? p.grids.filter((x) => x !== v) : [...p.grids, v] }))}
                disabledIds={disabledGrids}
                disabledTag="已停用"
              />
              <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                已停用的网格不能再勾选；已勾的旧网格仍显示，新事件不再匹配到它。
              </div>
            </div>
          )}
          {profile === "view" && (
            <div style={{ marginBottom: "10px", fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              负责范围：固定为全区（仅改配置 / 只看账号）；不配置负责的事件类型。
            </div>
          )}
          {profile === "none" && f.roles.length > 0 && (
            <div style={{ marginBottom: "10px", fontSize: "11px", color: "var(--red)" }}>所选角色没有可用的启用步骤，请检查角色配置。</div>
          )}
          {profile !== "view" && profile !== "none" && (
            <div style={{ marginBottom: "12px" }}>
              <label style={S.fieldLabel}>负责的事件类型（至少 1 个；来源：客户订阅事件类型集合）</label>
              {subscribedCatalog.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--amber)", border: "1px dashed var(--border)", borderRadius: "8px", padding: "10px", lineHeight: "1.7" }}>
                  该客户尚未订阅事件类型（由平台在「客户」页开通订阅），暂不能配置负责的事件类型。
                </div>
              ) : (
                <ChipMulti
                  options={subscribedCatalog}
                  selected={f.eventTypes}
                  onToggle={(v) => setF((p) => ({ ...p, eventTypes: p.eventTypes.includes(v) ? p.eventTypes.filter((x) => x !== v) : [...p.eventTypes, v] }))}
                />
              )}
            </div>
          )}
          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px", lineHeight: 1.7 }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            保存即写入并立即生效。改负责事件类型或范围：只影响此后新进入的待办和新的派发、新的外场任务；已派发事件、已派出的外场任务不改人。
          </div>
        </Drawer>
      )}

      {confirmStop !== null && (
        <ConfirmModal
          title="停用账号"
          body={<>停用后「{rows.find((x) => x.id === confirmStop)?.name}」立即不能领取新待办。不自动摘掉网格主责或协同监督：若他仍是某网格唯一主责，该网格派发不可用，空间页将标明「主责已停用」。</>}
          confirmText="确认停用"
          onConfirm={() => {
            const a = rows.find((x) => x.id === confirmStop)
            dispatch({ type: "ledger-account-status", cid, id: confirmStop, status: "停用" })
            toast(`已停用账号「${a?.name}」：立即不能领新待办；网格主责 / 协同监督保持不变。`)
            setConfirmStop(null)
          }}
          onClose={() => setConfirmStop(null)}
        />
      )}
    </section>
  )
}

// ─── 页面（三页签） ──────────────────────────────────────────────────────────

const TABS = [
  { id: "org", label: "组织架构" },
  { id: "account", label: "账号" },
  { id: "role", label: "角色" },
] as const

export function LedgerPage({ cid, orgSynced, author }: { cid: string; orgSynced: boolean; author: string }) {
  const { state } = useGc()
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("org")
  const lg = state.ledgers[cid]
  const counts: Record<string, number> = {
    org: (state.rows["org"] || []).length,
    account: lg?.accounts.length ?? 0,
    role: lg?.roles.length ?? 0,
  }
  return (
    <>
      <div
        role="tablist"
        aria-label="组织、账号与角色分区"
        style={{ display: "flex", gap: "2px", borderBottom: "1px solid var(--border)", marginBottom: "12px" }}
      >
        {TABS.map((t) => {
          const on = t.id === tab
          return (
            <button
              key={t.id} type="button" role="tab" aria-selected={on}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 14px", fontSize: "12px", cursor: "pointer",
                border: "none", background: "none", marginBottom: "-1px",
                color: on ? "var(--primary)" : "var(--muted-foreground)",
                fontWeight: on ? 600 : 400,
                borderBottom: `2px solid ${on ? "var(--primary)" : "transparent"}`,
              }}
            >
              {t.label}（{counts[t.id]}）
            </button>
          )
        })}
      </div>
      {tab === "org" && <OrgCard orgSynced={orgSynced} author={author} />}
      {tab === "account" && <AccountCard cid={cid} orgSynced={orgSynced} />}
      {tab === "role" && <RoleCard cid={cid} />}
    </>
  )
}
