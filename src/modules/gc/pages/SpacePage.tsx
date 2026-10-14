// 空间与责任 · 原生版（PRD 2026-09-22 责任台账口径；双来源修订 2026-10-12）
// - 网格双来源：平台同步（只读）+ 手动创建（2026-10-14：网格名称取自外部平台网格清单下拉选择，编号随名称回显，创建后不可改）
// - 两种来源都可停用/启用与定责；不提供删除（编码是派发快照与账号范围的引用键）
// - 网格三态派生：停用优先；无主责或主责账号已停用 → 待定责（派发不可用）
// - 定责抽屉：主责候选人 = 启用账号 + 步骤含处置 + 范围含该网格；协同监督 = 外场核查回传 + 范围含该网格；
//   一格一名主责、一名协同监督（可空）；变更原因必填并写入审计留痕
// - 派发可用性试算：按当前配置即时演算「匹配 → 主责 → 类型覆盖 → 外场」四类结论
// - 保存即生效：变更只影响此后新的派发 / 新派的外场任务，已派发事件不改人
import { useMemo, useState } from "react"
import { useGc, useToast, type GcRow } from "../store"
import { Chip, Drawer, S } from "../engine"
import {
  communitiesOfStreet, enabledEventTypes, enabledStreets, gridEffectiveStatus, gridRows,
  ownerCandidates, ownerNameIsSet, stepsOf, supCandidates, type GridRowView,
} from "../ledger"

const GRID_MANUAL = "手动创建"

// 外部平台网格清单（演示数据）：网格名称 ↔ 编号一一对应。
// 手动创建 / 批量导入时，网格从清单中下拉选择，编号按所选名称回显；清单外名称（导入）按序自动补号。
const GRID_CATALOG: Record<string, { name: string; code: string }[]> = {
  "朝阳门街道": [
    { name: "朝内大街北网格", code: "G-0401" },
    { name: "朝阳门外南大街网格", code: "G-0402" },
    { name: "大方家胡同网格", code: "G-0403" },
    { name: "朝内大街网格", code: "G-0417" },
    { name: "朝阳门南小街网格", code: "G-0418" },
    { name: "东花市大街网格", code: "G-0419" },
  ],
  "东华门街道": [
    { name: "东华门大街网格", code: "G-0404" },
    { name: "王府井西街网格", code: "G-0405" },
    { name: "金宝街北网格", code: "G-0421" },
  ],
  "建国门街道": [
    { name: "苏州胡同网格", code: "G-0406" },
    { name: "大羊毛胡同网格", code: "G-0407" },
    { name: "建国门内大街网格", code: "G-0420" },
  ],
  "前门街道": [
    { name: "前门东大街网格", code: "G-0408" },
    { name: "西打磨厂网格", code: "G-0422" },
  ],
}

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const EMPTY_OWNER = "—（空）"
const EMPTY_SUP = "—"

function Line({ tone, children }: { tone: "green" | "red" | "amber" | "gray"; children: React.ReactNode }) {
  const color = tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : "var(--muted-foreground)"
  return (
    <div style={{ fontSize: "12px", lineHeight: 1.8, color }}>
      {children}
    </div>
  )
}

export function SpacePage({ author, cid, orgSynced }: { author: string; cid: string; orgSynced: boolean }) {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const ledger = state.ledgers[cid]
  const rows = state.rows["space.grid"] || []
  const [query, setQuery] = useState("")
  const [bindIdx, setBindIdx] = useState<number | null>(null)
  const [bForm, setBForm] = useState({ owner: "", sup: "", reason: "" })
  const [err, setErr] = useState("")
  // 新建 / 编辑网格（手动来源）
  const [gridDrawer, setGridDrawer] = useState<{ mode: "add" | "edit"; index: number } | null>(null)
  const [gForm, setGForm] = useState({ code: "", name: "", street: "", community: "", reason: "" })
  const [gErr, setGErr] = useState("")
  // 批量导入（街道名称、网格名称两列）
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [importReason, setImportReason] = useState("")

  // 试算
  const [simGrid, setSimGrid] = useState("")
  const [simType, setSimType] = useState("")

  const allGrids = gridRows(state.rows)
  const types = enabledEventTypes(state.rows)
  const streetOptions = enabledStreets(state.rows)

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return allGrids
    return allGrids.filter((g) => [g.code, g.street, g.community, g.owner, g.sup].some((v) => v.includes(q)))
  }, [allGrids, query])

  function ownerAccount(name: string) {
    return ledger.accounts.find((a) => a.name === name)
  }

  function openBind(i: number) {
    const g = allGrids[i]
    setErr("")
    setBForm({ owner: g.owner || EMPTY_OWNER, sup: g.sup || EMPTY_SUP, reason: "" })
    setBindIdx(i)
  }

  function saveBind() {
    if (bindIdx === null) return
    const g = allGrids[bindIdx]
    const row = rows[g.index]
    const owner = bForm.owner === EMPTY_OWNER ? EMPTY_OWNER : bForm.owner
    const sup = bForm.sup === EMPTY_SUP ? EMPTY_SUP : bForm.sup
    const ownerChanged = owner !== (g.owner || EMPTY_OWNER)
    const supChanged = sup !== (g.sup || EMPTY_SUP)
    if (!ownerChanged && !supChanged) {
      toast("未做变更：主责与协同监督均未改动。")
      setBindIdx(null)
      return
    }
    if (!bForm.reason.trim()) { setErr("「变更原因」为必填项：设置 / 更换主责与协同监督必须留痕"); return }
    const values = [...row.values]
    while (values.length < 7) values.push("平台同步")
    values[3] = owner
    values[4] = sup
    let status: GcRow["status"] = row.status
    if (row.status !== "停用" && owner !== EMPTY_OWNER && ownerAccount(owner)?.status === "启用") status = "启用"
    dispatch({ type: "upsert", cardKey: "space.grid", index: g.index, values, status })
    const changes = [
      ownerChanged ? `主责 ${g.owner || "（空）"} → ${owner}` : null,
      supChanged ? `协同监督 ${g.sup || "（空）"} → ${sup}` : null,
    ].filter(Boolean).join("，")
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author: author.split(" · ")[0] || author,
        modules: ["空间与责任关系"], note: `网格 ${g.code}：${changes}（原因：${bForm.reason.trim()}）`, immediate: true,
      },
    })
    toast("已保存，立即生效：只影响此后新的立案派发与新派的外场任务；已派发事件与已派出任务的责任人不变。")
    setBindIdx(null)
  }

  function toggle(i: number) {
    const g = allGrids[i]
    if (g.stored === "启用") {
      dispatch({ type: "set-status", cardKey: "space.grid", index: g.index, status: "停用" })
      toast(`已停用网格「${g.code}」，立即生效：新事件不再匹配到此格；已落在此格的事件仍显示原网格。`)
      return
    }
    const eff = gridEffectiveStatus(g, ledger)
    if (eff === "待定责") {
      toast(!ownerNameIsSet(g.owner)
        ? `网格「${g.code}」还没有网格主责：请先在「定责」中指定，再启用。`
        : `网格「${g.code}」的主责账号已停用：请更换主责后再启用。`)
      return
    }
    dispatch({ type: "set-status", cardKey: "space.grid", index: g.index, status: "启用" })
    toast(`已启用网格「${g.code}」，立即生效：新事件可匹配到此格。`)
  }

  // ─── 新建 / 编辑网格（手动来源） ────────────────────────────────────────────
  /** 下一个可用网格编码：G-0NNN 递增，全表唯一 */
  function nextGridCode(): string {
    let max = 400
    for (const g of allGrids) {
      const m = /^G-(\d+)$/.exec(g.code)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return `G-${String(max + 1).padStart(4, "0")}`
  }
  function openGridAdd() {
    setGErr("")
    setGForm({ code: "", name: "", street: "", community: "", reason: "" })
    setGridDrawer({ mode: "add", index: -1 })
  }
  function openGridEdit(i: number) {
    const g = allGrids[i]
    if (!g) return
    setGErr("")
    setGForm({ code: g.code, name: g.name === g.code ? "" : g.name, street: g.street, community: g.community === "—" ? "" : g.community, reason: "" })
    setGridDrawer({ mode: "edit", index: i })
  }
  /** 新建时选街道：清空网格选择，等选网格后回显编号 */
  function onAddStreetChange(street: string) {
    setGForm((p) => ({ ...p, street, community: "", name: "", code: "" }))
  }
  /** 网格编号回显：编号来自外部平台网格清单，与名称一一对应；清单外名称按序自动补号 */
  function codeForName(street: string, name: string): string {
    const hit = GRID_CATALOG[street]?.find((x) => x.name === name)
    return hit?.code || nextGridCode()
  }
  /** 选网格（下拉）：编号按所选名称回显 */
  function onGridNameChange(name: string) {
    if (gridDrawer?.mode === "edit") {
      const orig = allGrids[gridDrawer.index]
      const keep = !name || name === (orig?.name || "")
      setGForm((p) => ({ ...p, name, code: keep ? p.code : codeForName(p.street, name) }))
    } else {
      setGForm((p) => ({ ...p, name, code: name ? codeForName(p.street, name) : "" }))
    }
  }
  /** 该街道下已创建的网格名称（用于从清单中排除） */
  function createdNamesOf(street: string): string[] {
    return allGrids.filter((g) => g.street === street).map((g) => g.name || g.code)
  }
  /** 网格下拉选项：外部平台清单中该街道下尚未创建的网格 */
  function catalogOptionsOf(street: string): string[] {
    const created = new Set(createdNamesOf(street))
    return (GRID_CATALOG[street] || []).filter((x) => !created.has(x.name)).map((x) => x.name)
  }

  // ─── 批量导入：街道名称、网格名称两列 ──────────────────────────────────────
  interface ImportRow { street: string; name: string; ok: boolean; why?: string }
  const importParsed: ImportRow[] = useMemo(() => {
    if (!importOpen) return []
    return importText.split("\n").map((raw) => {
      const line = raw.trim()
      if (!line) return null
      const parts = line.split(/[,，、\t]/).map((p) => p.trim()).filter(Boolean)
      if (parts.length < 2) return { street: line, name: "", ok: false, why: "格式错误：需要「街道名称,网格名称」两列" }
      const [street, name] = parts
      if (!streetOptions.includes(street)) return { street, name, ok: false, why: "街道不存在或已停用" }
      if (allGrids.some((g) => g.street === street && (g.name === name || g.community === name)))
        return { street, name, ok: false, why: "该街道下已有同名网格" }
      return { street, name, ok: true }
    }).filter(Boolean) as ImportRow[]
  }, [importOpen, importText, allGrids, streetOptions])

  function confirmImport() {
    const okRows = importParsed.filter((r) => r.ok)
    if (!okRows.length) { toast("没有可导入的行：请检查格式与街道名称。"); return }
    if (!importReason.trim()) { toast("「变更原因」为必填项：批量导入必须留痕。"); return }
    const authorName = author.split(" · ")[0] || author
    let fallback = parseInt(nextGridCode().replace("G-", ""), 10)
    okRows.forEach((r, i) => {
      // 编号回显：清单内的名称用清单编号；清单外按序自动补号
      const catalogCode = GRID_CATALOG[r.street]?.find((x) => x.name === r.name)?.code
      const code = catalogCode || `G-${String(fallback++).padStart(4, "0")}`
      const values = [code, r.street, "—", "—（空）", "—", "—", GRID_MANUAL, r.name]
      dispatch({ type: "upsert", cardKey: "space.grid", index: rows.length + i, values, status: "待定责" })
    })
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—", date: today(), author: authorName,
        modules: ["空间与责任关系"], note: `批量导入 ${okRows.length} 个网格：${okRows.map((r) => `${r.name}（${r.street}）`).slice(0, 5).join("、")}${okRows.length > 5 ? " 等" : ""}（原因：${importReason.trim()}）`, immediate: true,
      },
    })
    const skip = importParsed.length - okRows.length
    toast(`已导入 ${okRows.length} 个网格（${skip ? `跳过 ${skip} 行` : "无跳过"}），均为「待定责」：请逐格定责后派发才可用。`)
    setImportOpen(false)
    setImportText("")
    setImportReason("")
  }

  function saveGrid() {
    if (!gridDrawer) return
    const code = gForm.code.trim()
    const name = gForm.name.trim()
    const street = gForm.street.trim()
    const community = gForm.community.trim() || "—"
    if (!name) { setGErr("「网格」为必选项：请先选择街道下的网格"); return }
    if (!/^[A-Za-z0-9\-_]+$/.test(code)) { setGErr("网格编码只允许字母、数字、连字符和下划线"); return }
    if (allGrids.some((g, i) => g.code === code && i !== gridDrawer.index)) { setGErr(`网格编码「${code}」已存在`); return }
    if (!street) { setGErr("「所属街道」为必选项：请先选择街道"); return }
    if (!gForm.reason.trim()) { setGErr("「变更原因」为必填项：创建 / 编辑网格必须留痕"); return }
    const authorName = author.split(" · ")[0] || author
    if (gridDrawer.mode === "add") {
      // 新网格无主责 → 三态派生为「待定责」；保存后引导去定责
      const values = [code, street, community, "—（空）", "—", "—", GRID_MANUAL, name]
      dispatch({ type: "upsert", cardKey: "space.grid", index: rows.length, values, status: "待定责" })
      dispatch({
        type: "ledger-note",
        entry: {
          version: "—", date: today(), author: authorName,
          modules: ["空间与责任关系"], note: `手动创建网格 ${name}（${code}，${street} · ${community}）（原因：${gForm.reason.trim()}）`, immediate: true,
        },
      })
      toast(`已创建网格「${name}」（${code}），当前为「待定责」：请立即在操作列点「定责」指定主责，指定后派发才可用。`)
    } else {
      const g = allGrids[gridDrawer.index]
      const row = rows[g.index]
      const values = [...row.values]
      while (values.length < 7) values.push("平台同步")
      if (values.length < 8) values.push(name || g.code)
      values[1] = street
      values[2] = community
      values[7] = name || g.code
      dispatch({ type: "upsert", cardKey: "space.grid", index: g.index, values, status: row.status })
      dispatch({
        type: "ledger-note",
        entry: {
          version: "—", date: today(), author: authorName,
          modules: ["空间与责任关系"], note: `编辑网格 ${g.code}：${g.street}·${g.community} → ${street}·${community}（原因：${gForm.reason.trim()}）`, immediate: true,
        },
      })
      toast(`已保存网格「${name || g.code}」，立即生效：此后新事件按新的街道 / 社区归属；已派发事件保留原快照。`)
    }
    setGridDrawer(null)
  }

  // ─── 试算 ────────────────────────────────────────────────────────────────
  const sim = useMemo(() => {
    const g = allGrids.find((x) => x.code === simGrid)
    if (!g || !simType) return null
    const lines: { tone: "green" | "red" | "amber" | "gray"; text: string }[] = []
    if (g.stored === "停用") {
      lines.push({ tone: "amber", text: "未能匹配网格：该网格已停用，新事件不再匹配到此格。可以判无效；派发不可用（未匹配网格 ≠ 不予立案）。" })
    } else if (!ownerNameIsSet(g.owner)) {
      lines.push({ tone: "amber", text: "待定责：该网格没有主责。事件可以停在有效审核；立案派发不可用。" })
    } else {
      const acc = ownerAccount(g.owner)
      if (!acc || acc.status !== "启用") {
        lines.push({ tone: "amber", text: "主责已停用：派发不可用。空间页显示「主责已停用」；请更换主责或停用网格。" })
      } else if (!stepsOf(ledger, acc).includes("处置")) {
        lines.push({ tone: "amber", text: "主责账号不再具备「处置」步骤：派发不可用。请检查其角色配置或更换主责。" })
      } else if (!acc.eventTypes.includes(simType)) {
        lines.push({ tone: "red", text: `主责不负责该事件类型：派发不可用，事件可以保持有效（主责 ${acc.name} 负责：${acc.eventTypes.join("、") || "—"}）。` })
      } else {
        lines.push({ tone: "green", text: `可以立案派发：主责 ${acc.name}（负责 ${acc.eventTypes.length} 类事件，含「${simType}」）。派发成功会把当时的街道、网格、主责、事件类型写入事件快照，此后配置变更不改写。` })
      }
      const sup = ownerAccount(g.sup) && g.sup !== EMPTY_SUP ? ownerAccount(g.sup) : undefined
      if (!ownerNameIsSet(g.sup) || !sup) {
        lines.push({ tone: "gray", text: "协同监督为空：核查可以结案或退回，不能派外场。" })
      } else if (sup.status !== "启用") {
        lines.push({ tone: "amber", text: "协同监督账号已停用：不能派外场；结案和退回仍可用。" })
      } else if (!stepsOf(ledger, sup).includes("外场核查回传")) {
        lines.push({ tone: "amber", text: "协同监督账号不再具备「外场核查回传」步骤：不能派外场；结案和退回仍可用。" })
      } else if (!sup.eventTypes.includes(simType)) {
        lines.push({ tone: "amber", text: `协同监督不负责该事件类型：不能派外场（${sup.name} 负责：${sup.eventTypes.join("、") || "—"}）；结案和退回仍可用。` })
      } else {
        lines.push({ tone: "green", text: `可以派外场：协同监督 ${sup.name}。派出时把当时的协同监督写入子任务，此后更换监督员不改写已派任务。` })
      }
    }
    return { g, lines }
  }, [simGrid, simType, allGrids, ledger])

  const bindGrid: GridRowView | null = bindIdx !== null ? allGrids[bindIdx] : null
  const bindRow: GcRow | null = bindGrid ? rows[bindGrid.index] : null

  // 定责抽屉候选人（含当前值，便于查看已失效账号）
  const bindOwnerOpts = useMemo(() => {
    if (!bindGrid) return []
    const cur = ownerNameIsSet(bindGrid.owner) ? [bindGrid.owner] : []
    const cands = ownerCandidates(bindGrid.code, ledger).map((a) => a.name).filter((n) => !cur.includes(n))
    return [...cur, ...cands]
  }, [bindGrid, ledger])
  const bindSupOpts = useMemo(() => {
    if (!bindGrid) return []
    const cur = ownerNameIsSet(bindGrid.sup) ? [bindGrid.sup] : []
    const cands = supCandidates(bindGrid.code, ledger).map((a) => a.name).filter((n) => !cur.includes(n))
    return [...cur, ...cands]
  }, [bindGrid, ledger])

  return (
    <>
      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="网格责任表">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>网格责任表</h3>
          <span style={S.cardNote}>
            双来源：平台同步（只读）＋ 手动创建（网格取自外部平台网格清单，编号随名称回显，创建后不可改）；两种来源都可启停与定责——每格一名主责、一名协同监督（可空）
          </span>
        </header>
        <div style={S.toolbar}>
          <input style={S.search} value={query} placeholder="搜索网格名称 / 编码 / 街道 / 责任人" onChange={(e) => setQuery(e.target.value)} />
          <button type="button" style={{ ...S.btnSecondary, marginLeft: "auto" }} onClick={() => { setImportText(""); setImportReason(""); setImportOpen(true) }}>⇪ 批量导入</button>
          <button type="button" style={S.btnPrimary} onClick={openGridAdd}>＋ 新建网格</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["网格名称", "网格编号", "所属街道", "社区", "网格主责", "协同监督", "生效日期", "来源"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={S.empty}>
                    {query
                      ? "没有匹配的网格"
                      : orgSynced
                        ? "暂无网格数据：等待平台同步，或点击右上角手动创建。"
                        : "网格同步位为空：等待平台同步，或点击右上角手动创建，创建后定责即可派发。"}
                  </td>
                </tr>
              )}
              {filtered.map((g) => {
                const eff = gridEffectiveStatus(g, ledger)
                const ownerAcc = ownerNameIsSet(g.owner) ? ownerAccount(g.owner) : undefined
                const ownerDead = ownerNameIsSet(g.owner) && (!ownerAcc || ownerAcc.status !== "启用")
                const manual = g.source === GRID_MANUAL
                return (
                  <tr key={g.code}>
                    <td style={{ ...S.td, ...S.tdName }}>
                      {g.name && g.name !== g.code ? g.name : "—"}
                    </td>
                    <td style={{ ...S.td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px" }}>{g.code}</td>
                    <td style={S.td}>{g.street}</td>
                    <td style={S.td}>{g.community}</td>
                    <td style={S.td}>{g.owner}{ownerDead ? "（主责已停用）" : ""}</td>
                    <td style={S.td}>{g.sup}</td>
                    <td style={S.td}>{g.effDate}</td>
                    <td style={S.td}>{manual
                      ? <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "999px", backgroundColor: "rgba(50,109,255,0.1)", color: "var(--primary)" }}>{GRID_MANUAL}</span>
                      : "平台同步"}</td>
                    <td style={S.td}><Chip status={eff} /></td>
                    <td style={{ ...S.td, ...S.tdActions }}>
                      <button type="button" style={S.btnLink} onClick={() => openBind(g.index)}>定责</button>
                      {manual && <button type="button" style={S.btnLink} onClick={() => openGridEdit(g.index)}>编辑</button>}
                      <button type="button" style={S.btnLink} onClick={() => toggle(g.index)}>
                        {g.stored === "启用" ? "停用" : "启用"}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 派发可用性试算 */}
      {orgSynced && (
      <section style={{ ...S.card, marginBottom: "14px", padding: "14px 16px" }} aria-label="派发可用性试算">
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
          <h3 style={S.cardTitle}>派发可用性试算</h3>
          <span style={S.cardNote}>按当前配置即时演算办理侧消费规则：匹配网格 → 主责 → 类型覆盖 → 外场；不落库，不产生事件</span>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          <select style={{ ...S.input, maxWidth: "220px" }} value={simGrid} onChange={(e) => setSimGrid(e.target.value)} aria-label="选择网格">
            <option value="">选择网格…</option>
            {allGrids.map((g) => <option key={g.code} value={g.code}>{g.code} · {g.street}</option>)}
          </select>
          <select style={{ ...S.input, maxWidth: "220px" }} value={simType} onChange={(e) => setSimType(e.target.value)} aria-label="选择事件类型">
            <option value="">选择事件类型（启用细类）…</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {sim ? (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
            {sim.lines.map((l, i) => <Line key={i} tone={l.tone}>{l.text}</Line>)}
          </div>
        ) : (
          <div style={S.empty}>选择网格与事件类型后，这里给出「可否派发 / 可否派外场」的即时结论。</div>
        )}
      </section>
      )}

      {bindGrid && bindRow && (
        <Drawer
          title={`网格 ${bindGrid.code} · 定责`}
          onClose={() => setBindIdx(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setBindIdx(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={saveBind}>保存（立即生效）</button>
            </>
          }
        >
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>网格（同步数据，只读）</label>
            <input style={{ ...S.input, backgroundColor: "var(--card-2)", color: "var(--muted-foreground)" }} value={`${bindGrid.code} · ${bindGrid.street} · ${bindGrid.community}`} readOnly />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>网格主责（一格一名；候选人 = 启用账号 + 具备「处置」步骤 + 范围包含本网格）</label>
            <select style={S.input} value={bForm.owner} onChange={(e) => setBForm((p) => ({ ...p, owner: e.target.value }))}>
              {bindOwnerOpts.length === 0 && <option value={EMPTY_OWNER}>{EMPTY_OWNER}</option>}
              {bindOwnerOpts.map((n) => {
                const a = ownerAccount(n)
                const dead = !a || a.status !== "启用"
                return <option key={n} value={n}>{n}{dead ? "（已停用，不可派发）" : ""}</option>
              })}
            </select>
            {bindOwnerOpts.length === 0 && (
              <div style={{ fontSize: "10px", color: "var(--amber)", marginTop: "6px" }}>
                没有符合条件的候选人：请先给账号绑定含「处置」步骤的角色，并在其范围中加入本网格。
              </div>
            )}
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>协同监督（一格一名，可空；候选人 = 启用账号 + 具备「外场核查回传」步骤 + 范围包含本网格）</label>
            <select style={S.input} value={bForm.sup} onChange={(e) => setBForm((p) => ({ ...p, sup: e.target.value }))}>
              <option value={EMPTY_SUP}>{EMPTY_SUP}</option>
              {bindSupOpts.map((n) => {
                const a = ownerAccount(n)
                const dead = !a || a.status !== "启用"
                return <option key={n} value={n}>{n}{dead ? "（已停用）" : ""}</option>
              })}
            </select>
            {bForm.sup === EMPTY_SUP && (
              <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                协同监督为空：核查可以结案或退回，不能派外场。
              </div>
            )}
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>变更原因（必填，写入版本历史与审计留痕）</label>
            <textarea style={S.textarea} value={bForm.reason} placeholder="如 为空网格指定主责" onChange={(e) => setBForm((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          {err && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px" }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            更换主责 / 协同监督只影响此后新的派发与外场任务：已经派发、尚未退回的事件仍是原主责；已派出、尚未回传的任务仍是原监督员。
          </div>
        </Drawer>
      )}

      {gridDrawer && (
        <Drawer
          title={gridDrawer.mode === "add" ? "新建网格" : `编辑网格「${gForm.name || gForm.code || "…"}」`}
          onClose={() => setGridDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setGridDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={saveGrid}>保存（立即生效）</button>
            </>
          }
        >
          {/* ① 先选街道 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>① 所属街道（必选，启用中的街道；含手动创建的街道）</label>
            <select
              style={{ ...S.input, ...(gridDrawer.mode === "add" && !gForm.street ? { borderColor: "rgba(50,109,255,0.45)" } : null) }}
              value={gForm.street}
              onChange={(e) => {
                if (gridDrawer.mode === "add") onAddStreetChange(e.target.value)
                else setGForm((p) => ({ ...p, street: e.target.value, community: "" }))
              }}
            >
              <option value="">请先选择所属街道…</option>
              {(gridDrawer.mode === "edit" && gForm.street && !streetOptions.includes(gForm.street)
                ? [gForm.street, ...streetOptions]
                : streetOptions
              ).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {/* ② 基于街道：名称 / 编码 / 社区（联动） */}
          <div style={{
            opacity: gForm.street ? 1 : 0.45,
            pointerEvents: gForm.street ? "auto" : "none",
            display: "grid", gap: "12px",
          }}>
            <div>
              <label style={S.fieldLabel}>② 网格（下拉选择，来自外部平台网格清单；清单中已创建的不再出现）</label>
              <select
                style={{ ...S.input, ...(gForm.name ? null : { borderColor: "rgba(50,109,255,0.45)" }) }}
                value={gForm.name}
                onChange={(e) => onGridNameChange(e.target.value)}
              >
                <option value="">请选择网格…</option>
                {(gridDrawer.mode === "edit" && gForm.name && !catalogOptionsOf(gForm.street).includes(gForm.name)
                  ? [gForm.name, ...catalogOptionsOf(gForm.street)]
                  : catalogOptionsOf(gForm.street)
                ).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {gForm.street && catalogOptionsOf(gForm.street).length === 0 && (
                <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                  「{gForm.street}」清单中的网格均已创建；如需新增网格名称，请在外部平台登记后同步，或通过批量导入。
                </div>
              )}
            </div>
            <div>
              <label style={S.fieldLabel}>网格编号（按所选网格回显，来自外部平台清单；创建后不可改）</label>
              <input
                style={{ ...S.input, backgroundColor: "var(--card-2)", color: "var(--muted-foreground)" }}
                value={gForm.code}
                placeholder="选择网格后回显编号，如 G-0401"
                readOnly
              />
              <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                编号与网格名称一一对应（清单回显），不手工编号；编号是账号范围与派发快照的引用键，创建后不可修改；删除不提供，停用即可让新事件不再匹配。
              </div>
            </div>
            <div>
              <label style={S.fieldLabel}>社区（选填；仅显示「{gForm.street || "所选街道"}」下的社区）</label>
              <select style={S.input} value={gForm.community} onChange={(e) => setGForm((p) => ({ ...p, community: e.target.value }))}>
                <option value="">不指定社区…</option>
                {communitiesOfStreet(state.rows, gForm.street).map((n) => <option key={n} value={n}>{n}</option>)}
                {gridDrawer.mode === "edit" && gForm.community && !communitiesOfStreet(state.rows, gForm.street).includes(gForm.community) && (
                  <option value={gForm.community}>{gForm.community}（原值）</option>
                )}
              </select>
              {gForm.street && communitiesOfStreet(state.rows, gForm.street).length === 0 && (
                <div style={{ fontSize: "10px", color: "var(--muted-foreground)", marginTop: "6px" }}>
                  「{gForm.street}」下暂无启用中的社区：可在「组织、账号与角色」中手动创建，或留空。
                </div>
              )}
            </div>
          </div>
          <div style={{ marginBottom: "12px", marginTop: "12px" }}>
            <label style={S.fieldLabel}>变更原因（必填，写入审计留痕）</label>
            <textarea style={S.textarea} value={gForm.reason} placeholder="如 外部平台尚未同步，先建网格承接新片区" onChange={(e) => setGForm((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          {gErr && <div style={{ fontSize: "11px", color: "var(--red)", marginBottom: "8px", lineHeight: 1.7 }}>{gErr}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            新建网格初始为「待定责」（无主责）：派发不可用，需在操作列点「定责」指定一名主责后才可承接派发。
            手动创建的网格与同步网格同权：可启停、可定责；平台同步网格仍以外部平台为权威源，编码与归属只读。
          </div>
        </Drawer>
      )}

      {importOpen && (
        <Drawer
          title="批量导入网格"
          onClose={() => setImportOpen(false)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setImportOpen(false)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={confirmImport}>
                确认导入{importParsed.filter((r) => r.ok).length ? `（${importParsed.filter((r) => r.ok).length} 个网格）` : ""}
              </button>
            </>
          }
        >
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>粘贴数据：每行一个网格，格式「街道名称,网格名称」（支持逗号 / 顿号 / Tab 分隔）</label>
            <textarea
              style={{ ...S.textarea, minHeight: "140px", fontFamily: "var(--mono, monospace)", fontSize: "12px" }}
              value={importText}
              placeholder={"朝阳门街道,朝内大街北网格\n朝阳门街道,朝内大街南网格\n东四街道,东四北大街网格\n前门街道,西打磨厂网格"}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          {importText.trim() && (
            <div style={{ marginBottom: "12px", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", maxHeight: "180px", overflowY: "auto" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "6px" }}>
                预览：可导入 <span style={{ color: "var(--green)" }}>{importParsed.filter((r) => r.ok).length}</span> 个
                {importParsed.some((r) => !r.ok) && <>，跳过 <span style={{ color: "var(--red)" }}>{importParsed.filter((r) => !r.ok).length}</span> 行</>}
              </div>
              {importParsed.map((r, i) => (
                <div key={i} style={{ fontSize: "11px", lineHeight: 1.8, color: r.ok ? "var(--foreground)" : "var(--red)", display: "flex", gap: 8 }}>
                  <span style={{ flexShrink: 0 }}>{r.ok ? "✓" : "✕"}</span>
                  <span>
                    {r.street}{r.name ? ` · ${r.name}` : ""}
                    {r.why ? `（${r.why}）` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBottom: "12px" }}>
            <label style={S.fieldLabel}>变更原因（必填，写入审计留痕）</label>
            <textarea style={S.textarea} value={importReason} placeholder="如 外部平台按片区新增网格，批量导入" onChange={(e) => setImportReason(e.target.value)} />
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
            导入后编码自动生成（G-0NNN 递增、全表唯一），来源为「手动创建」，可编辑；每个网格初始「待定责」，需逐格定责后派发才可用。
            街道必须已存在且启用（含手动创建的街道）；同街道下名称重复的行会跳过，不会覆盖已有网格。
          </div>
        </Drawer>
      )}
    </>
  )
}
