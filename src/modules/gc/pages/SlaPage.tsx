// 时限与异常监控 · 原生版
// - 全局计时口径：引擎卡（冻结项已改为按行维护）
// - 时限矩阵：自定义卡；同一细类 + 等级 + 同一区域只能启用一条 → 重复启用阻断发布
import { useMemo, useState } from "react"
import { SLA_MATRIX_COLS, useGc, useToast, type GcRow } from "../store"
import { Chip, ConfirmModal, Drawer, S } from "../engine"
import { CARDS } from "../cards.generated"
import { CrudCard } from "../engine"

const TYPES = ["道路秩序", "环境卫生", "宣传广告", "施工管理"]
const LEVELS = ["一般", "较重", "严重"]
const REGIONS = ["全区", "朝阳门街道", "东华门街道", "建国门街道"]

export function slaGate(matrix: GcRow[]): { blocked: boolean; note: string; tip: string } {
  const seen = new Map<string, number>()
  for (const r of matrix) {
    if (r.status !== "启用") continue
    const k = `${r.values[1]}|${r.values[2]}|${r.values[3]}`
    seen.set(k, (seen.get(k) || 0) + 1)
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k.split("|")[0])
  if (dups.length > 0) {
    return {
      blocked: true,
      note: "不能进入发布前预览：先停用重复启用行（同一细类 + 等级 + 同一区域只能启用一条）。",
      tip: "当前草稿存在重复启用行，不能进入发布前预览",
    }
  }
  return {
    blocked: false,
    note: "本页只保存草稿；「确认发布」不在业务模块页，须经「发布前预览」做冲突校验后确认。",
    tip: "带着本草稿进入发布前预览",
  }
}

export function SlaPage() {
  const { state, dispatch } = useGc()
  const toast = useToast()
  const rows = state.rows["sla.matrix"] || []
  const caliberDef = CARDS.sla.find((c) => c.id === "sla-caliber")!
  const [query, setQuery] = useState("")
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; index: number } | null>(null)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [form, setForm] = useState<string[]>([])
  const [err, setErr] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return rows.map((r, i) => ({ r, i }))
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => r.values.some((v) => v.includes(q)))
  }, [rows, query])

  function openDrawer(mode: "add" | "edit", index: number) {
    setErr("")
    setForm(mode === "add"
      ? [TYPES[0], "", LEVELS[0], "全区", "", "", "提前 5 分钟 · 当前网格责任人", "打升级标记"]
      : [...rows[index].values])
    setDrawer({ mode, index })
  }

  function save() {
    if (!drawer) return
    const need = ["事件类型", "细类", "处置时限"]
    for (let i = 0; i < SLA_MATRIX_COLS.length; i++) {
      if (need.includes(SLA_MATRIX_COLS[i]) && !form[i].trim()) {
        setErr(`「${SLA_MATRIX_COLS[i]}」为必填项`)
        return
      }
    }
    if (drawer.mode === "add" && rows.some((r) => r.values[1] === form[1].trim() && r.values[2] === form[2] && r.values[3] === form[3])) {
      setErr("同一细类 + 等级 + 区域已存在（判重不建新行），请直接编辑原行")
      return
    }
    dispatch({ type: "upsert", cardKey: "sla.matrix", index: drawer.mode === "edit" ? drawer.index : -1, values: form.map((v) => v.trim()) })
    toast(drawer.mode === "add" ? "已新增时限行，写入草稿，尚未生效。" : "已更新时限行，写入草稿，尚未生效。")
    setDrawer(null)
  }

  return (
    <>
      <CrudCard def={caliberDef} noun="口径项" />
      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="时限矩阵">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>时限矩阵</h3>
          <span style={S.cardNote}>同一细类 + 等级 + 同一区域只能启用一条；重复启用会在发布前校验被拒绝</span>
        </header>
        <div style={S.toolbar}>
          <input style={S.search} value={query} placeholder="搜索时限矩阵" onChange={(e) => setQuery(e.target.value)} />
          <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={() => openDrawer("add", -1)}>＋ 新增时限行</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {[...SLA_MATRIX_COLS, "状态"].map((c) => <th key={c} style={S.th}>{c}</th>)}
                <th style={{ ...S.th, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={SLA_MATRIX_COLS.length + 2} style={S.empty}>{query ? "没有匹配的行" : "暂无时限行，点击右上角新增"}</td></tr>
              )}
              {filtered.map(({ r, i }) => (
                <tr key={i}>
                  {r.values.map((v, ci) => (
                    <td key={ci} style={ci === 1 ? { ...S.td, ...S.tdName } : { ...S.td, whiteSpace: "nowrap" }}>{v}</td>
                  ))}
                  <td style={S.td}><Chip status={r.status} /></td>
                  <td style={{ ...S.td, ...S.tdActions }}>
                    <button type="button" style={S.btnLink} onClick={() => openDrawer("edit", i)}>编辑</button>
                    <button
                      type="button" style={S.btnLink}
                      onClick={() => {
                        dispatch({ type: "toggle", cardKey: "sla.matrix", index: i })
                        toast(r.status === "启用" ? "已停用该行，写入草稿，尚未生效。" : "已启用该行，写入草稿，尚未生效。")
                      }}
                    >
                      {r.status === "启用" ? "停用" : "启用"}
                    </button>
                    <button type="button" style={S.btnLinkDanger} onClick={() => setConfirmDel(i)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {drawer && (
        <Drawer
          title={(drawer.mode === "add" ? "新增" : "编辑") + "时限行"}
          onClose={() => setDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={save}>保存到草稿</button>
            </>
          }
        >
          {SLA_MATRIX_COLS.map((label, i) => (
            <div key={label} style={{ marginBottom: "12px" }}>
              <label style={S.fieldLabel}>{label}{["事件类型", "细类", "处置时限"].includes(label) ? "（必填）" : ""}</label>
              {label === "事件类型" || label === "等级" ? (
                <select style={S.input} value={form[i]} onChange={(e) => setForm((p) => p.map((x, j) => (j === i ? e.target.value : x)))}>
                  {(label === "事件类型" ? TYPES : LEVELS).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : label === "区域" ? (
                <select style={S.input} value={form[i]} onChange={(e) => setForm((p) => p.map((x, j) => (j === i ? e.target.value : x)))}>
                  {REGIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input style={S.input} value={form[i]} placeholder={label === "细类" ? "如 共享单车乱停放" : ""} onChange={(e) => setForm((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
              )}
            </div>
          ))}
          {err && <div style={{ fontSize: "11px", color: "var(--red)" }}>{err}</div>}
        </Drawer>
      )}

      {confirmDel !== null && (
        <ConfirmModal
          title="删除确认"
          body={<>将删除「{rows[confirmDel]?.values[1]} · {rows[confirmDel]?.values[2]}」时限行。删除只影响草稿与后续发布。</>}
          confirmText="删除"
          onConfirm={() => {
            dispatch({ type: "remove", cardKey: "sla.matrix", index: confirmDel })
            toast("已删除时限行，写入草稿，尚未生效。")
            setConfirmDel(null)
          }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </>
  )
}
