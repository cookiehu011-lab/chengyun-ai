// 办理时限与提醒 · 原生版
// - 全局计时口径：只读展示（由系统固定的 4 条统一口径）
// - 时限矩阵：可编辑卡；同一细类 + 等级 + 同一区域只能启用一条
// - 超时只提醒并显示超时标识，不改变事件状态、不升级、不发短信
import { useMemo, useState } from "react"
import { SLA_MATRIX_COLS, SLA_MATRIX_SEED, useGc, useToast, type GcRow } from "../store"
import { Chip, ConfirmModal, CrudCard, Drawer, S } from "../engine"
import { CARDS } from "../cards.generated"

const TYPES = ["道路秩序", "环境卫生", "宣传广告", "施工管理"]
const LEVELS = ["一般", "较重", "严重"]
const REGIONS = ["全区", "朝阳门街道", "东华门街道", "建国门街道"]

/** 判断是否为种子示例行（演示数值不当默认值，需标注「示例」；编辑过的行不再标注） */
function isDemoRow(r: GcRow): boolean {
  return SLA_MATRIX_SEED.some((s) => s.values.join("|") === r.values.join("|") && s.status === r.status)
}

export function SlaPage({ author }: { author: string }) {
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

  /** 变更留痕：写入变更记录（保存即生效） */
  function logChange(verb: string, target: string) {
    dispatch({
      type: "ledger-note",
      entry: {
        version: "—",
        date: nowText(),
        author: author || "—",
        modules: ["办理时限与提醒"],
        note: `时限矩阵 · ${verb}「${target}」`,
        immediate: true,
      },
    })
  }

  function openDrawer(mode: "add" | "edit", index: number) {
    setErr("")
    // 新增表单一律空白起步（下拉占位「请选择」），不预填演示数值
    setForm(mode === "add" ? SLA_MATRIX_COLS.map(() => "") : [...rows[index].values])
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
      setErr("同一细类 + 等级 + 区域已存在，请直接编辑原行")
      return
    }
    const values = form.map((v) => v.trim())
    dispatch({ type: "upsert", cardKey: "sla.matrix", index: drawer.mode === "edit" ? drawer.index : -1, values })
    logChange(drawer.mode === "add" ? "新增" : "更新", `${values[1]} · ${values[2]}`)
    toast(drawer.mode === "add" ? "已新增时限行，保存并生效，变更记录已生成。" : "时限行已保存并生效，变更记录已生成。")
    setDrawer(null)
  }

  return (
    <>
      {/* 页面口径说明 */}
      <div style={{ ...S.card, marginBottom: "14px", padding: "12px 16px" }}>
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          超时只提醒并显示超时标识，不改变事件状态、不升级、不发短信。
        </span>
      </div>

      {/* 全局计时口径：系统固定，只读 */}
      <CrudCard def={caliberDef} noun="口径项" moduleName="办理时限与提醒" author={author} readOnly />

      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="时限矩阵">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>时限矩阵</h3>
          <span style={S.cardNote}>同一细类 + 等级 + 同一区域只能启用一条；保存后立即生效</span>
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
                    <td key={ci} style={ci === 1 ? { ...S.td, ...S.tdName } : { ...S.td, whiteSpace: "nowrap" }}>
                      {v}
                      {/* 种子演示行标注「示例」，避免演示数值被当作默认口径 */}
                      {ci === 0 && isDemoRow(r) && (
                        <span style={{ marginLeft: "6px", fontSize: "10px", padding: "1px 6px", borderRadius: "999px", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>示例</span>
                      )}
                    </td>
                  ))}
                  <td style={S.td}><Chip status={r.status} /></td>
                  <td style={{ ...S.td, ...S.tdActions }}>
                    <button type="button" style={S.btnLink} onClick={() => openDrawer("edit", i)}>编辑</button>
                    <button
                      type="button" style={S.btnLink}
                      onClick={() => {
                        dispatch({ type: "toggle", cardKey: "sla.matrix", index: i })
                        logChange(r.status === "启用" ? "停用" : "启用", `${r.values[1]} · ${r.values[2]}`)
                        toast(r.status === "启用" ? "已停用并生效，变更记录已生成。" : "已启用并生效，变更记录已生成。")
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
              <button type="button" style={S.btnPrimary} onClick={save}>保存</button>
            </>
          }
        >
          {SLA_MATRIX_COLS.map((label, i) => (
            <div key={label} style={{ marginBottom: "12px" }}>
              <label style={S.fieldLabel}>{label}{["事件类型", "细类", "处置时限"].includes(label) ? "（必填）" : ""}</label>
              {label === "事件类型" || label === "等级" || label === "区域" ? (
                <select style={S.input} value={form[i]} onChange={(e) => setForm((p) => p.map((x, j) => (j === i ? e.target.value : x)))}>
                  <option value="">请选择</option>
                  {(label === "事件类型" ? TYPES : label === "等级" ? LEVELS : REGIONS).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input style={S.input} value={form[i]} placeholder={label === "细类" ? "如 共享单车乱停放" : ""} onChange={(e) => setForm((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
              )}
            </div>
          ))}
          {err && <div style={{ fontSize: "11px", color: "var(--red)" }}>{err}</div>}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "10px", lineHeight: 1.7 }}>
            保存后立即生效，并在「变更记录」中生成一条记录。
          </div>
        </Drawer>
      )}

      {confirmDel !== null && (
        <ConfirmModal
          title="删除确认"
          body={<>将删除「{rows[confirmDel]?.values[1]} · {rows[confirmDel]?.values[2]}」时限行，删除后立即生效。</>}
          confirmText="删除"
          onConfirm={() => {
            logChange("删除", `${rows[confirmDel]?.values[1]} · ${rows[confirmDel]?.values[2]}`)
            dispatch({ type: "remove", cardKey: "sla.matrix", index: confirmDel })
            toast("已删除并生效，变更记录已生成。")
            setConfirmDel(null)
          }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </>
  )
}

/** 生成当前时间文本（变更记录「时间」列用，精确到分） */
function nowText(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
