// 空间与责任 · 原生版（PRD 2026-09-22 责任台账口径）
// - 网格来自同步：编码/名称/街道/社区只读；禁止新增、删除网格；可停用/启用
// - 网格三态派生：停用优先；无主责或主责账号已停用 → 待定责（派发不可用）
// - 定责抽屉：主责候选人 = 启用账号 + 步骤含处置 + 范围含该网格；协同监督 = 外场核查回传 + 范围含该网格；
//   一格一名主责、一名协同监督（可空）；变更原因必填并写入审计留痕
// - 派发可用性试算：按当前配置即时演算「匹配 → 主责 → 类型覆盖 → 外场」四类结论
// - 保存即生效：变更只影响此后新的派发 / 新派的外场任务，已派发事件不改人
import { useMemo, useState } from "react"
import { useGc, useToast, type GcRow } from "../store"
import { Chip, Drawer, S } from "../engine"
import {
  enabledEventTypes, gridEffectiveStatus, gridRows, ownerCandidates,
  ownerNameIsSet, stepsOf, supCandidates, type GridRowView,
} from "../ledger"

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

  // 试算
  const [simGrid, setSimGrid] = useState("")
  const [simType, setSimType] = useState("")

  const allGrids = gridRows(state.rows)
  const types = enabledEventTypes(state.rows)

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
          <span style={S.cardNote}>网格来自外部平台同步：编码、名称、街道、社区、边界只读；禁止新增 / 删除；可启停与定责——每格一名主责、一名协同监督（可空）</span>
        </header>
        <div style={S.toolbar}>
          <input style={S.search} value={query} placeholder="搜索网格、街道或责任人" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["网格编码", "所属街道", "社区", "网格主责", "协同监督", "生效日期"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={S.th}>状态</th>
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {!orgSynced && (
                <tr>
                  <td colSpan={8} style={S.empty}>
                    网格同步位为空：新客户开立后等待平台同步网格；同步完成后在此定责。
                  </td>
                </tr>
              )}
              {orgSynced && filtered.length === 0 && (
                <tr><td colSpan={8} style={S.empty}>{query ? "没有匹配的网格" : "暂无网格数据"}</td></tr>
              )}
              {orgSynced && filtered.map((g) => {
                const eff = gridEffectiveStatus(g, ledger)
                const ownerAcc = ownerNameIsSet(g.owner) ? ownerAccount(g.owner) : undefined
                const ownerDead = ownerNameIsSet(g.owner) && (!ownerAcc || ownerAcc.status !== "启用")
                return (
                  <tr key={g.code}>
                    <td style={{ ...S.td, ...S.tdName }}>{g.code}</td>
                    <td style={S.td}>{g.street}</td>
                    <td style={S.td}>{g.community}</td>
                    <td style={S.td}>{g.owner}{ownerDead ? "（主责已停用）" : ""}</td>
                    <td style={S.td}>{g.sup}</td>
                    <td style={S.td}>{g.effDate}</td>
                    <td style={S.td}><Chip status={eff} /></td>
                    <td style={{ ...S.td, ...S.tdActions }}>
                      <button type="button" style={S.btnLink} onClick={() => openBind(g.index)}>定责</button>
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
    </>
  )
}
