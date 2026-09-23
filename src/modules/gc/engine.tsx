// 治理配置 · 原生版通用引擎（移植自 partials/gc-crud-engine.html 的卡契约）
// 卡：标题 + 说明 + 工具条（搜索 + 新增）+ 表格（状态列 + 操作列由引擎管理）+ 抽屉表单 + 删除确认
import { useMemo, useState, type ReactNode } from "react"
import type { GeneratedCard, GeneratedField } from "./cards.generated"
import { useGc, useToast, type GcRow, type RowStatus } from "./store"

// ─── 样式常量 ────────────────────────────────────────────────────────────────

export const S = {
  card: {
    border: "1px solid var(--border)", borderRadius: "10px", backgroundColor: "var(--card)",
    boxShadow: "var(--shadow)", overflow: "hidden",
  } as React.CSSProperties,
  cardHead: {
    display: "flex", alignItems: "baseline", gap: "10px", padding: "12px 16px 10px",
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  cardTitle: { fontSize: "14px", fontWeight: 600, color: "var(--foreground)", margin: 0 } as React.CSSProperties,
  cardNote: { fontSize: "11px", color: "var(--muted-foreground)" } as React.CSSProperties,
  toolbar: {
    display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px",
    borderBottom: "1px solid var(--border)", backgroundColor: "var(--card-2)",
  } as React.CSSProperties,
  search: {
    flex: 1, maxWidth: "320px", height: "30px", padding: "0 10px", fontSize: "12px",
    border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--background)",
    color: "var(--foreground)", outline: "none",
  } as React.CSSProperties,
  btnPrimary: {
    height: "30px", padding: "0 14px", fontSize: "12px", fontWeight: 500, cursor: "pointer",
    border: "1px solid var(--primary)", borderRadius: "6px",
    backgroundColor: "var(--primary)", color: "#fff",
  } as React.CSSProperties,
  btnSecondary: {
    height: "30px", padding: "0 14px", fontSize: "12px", fontWeight: 500, cursor: "pointer",
    border: "1px solid var(--border-strong)", borderRadius: "6px",
    backgroundColor: "var(--card)", color: "var(--foreground)",
  } as React.CSSProperties,
  btnLink: {
    border: "none", background: "none", padding: "0 4px", fontSize: "12px", cursor: "pointer",
    color: "var(--primary)",
  } as React.CSSProperties,
  btnLinkDanger: {
    border: "none", background: "none", padding: "0 4px", fontSize: "12px", cursor: "pointer",
    color: "var(--red)",
  } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "12px" },
  th: {
    textAlign: "left", padding: "8px 12px", fontSize: "11px", fontWeight: 500,
    color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)",
    backgroundColor: "var(--card-2)", whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  td: {
    padding: "9px 12px", borderBottom: "1px solid var(--border)", color: "var(--foreground)",
    verticalAlign: "top",
  } as React.CSSProperties,
  tdName: { fontWeight: 500 } as React.CSSProperties,
  tdActions: { whiteSpace: "nowrap" as const, textAlign: "right" } as React.CSSProperties,
  empty: {
    padding: "28px 16px", textAlign: "center" as const, fontSize: "12px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  scrim: {
    position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.4)", zIndex: 70,
  } as React.CSSProperties,
  drawer: {
    position: "fixed", top: 0, right: 0, bottom: 0, width: "440px", maxWidth: "92vw",
    backgroundColor: "var(--panel-solid, var(--card))", zIndex: 71, display: "flex",
    flexDirection: "column" as const, boxShadow: "-12px 0 32px rgba(15,23,42,0.18)",
    borderLeft: "1px solid var(--border)",
  } as React.CSSProperties,
  drawerHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px", borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  drawerBody: { flex: 1, overflowY: "auto", padding: "16px 18px" } as React.CSSProperties,
  drawerFoot: {
    display: "flex", justifyContent: "flex-end", gap: "10px",
    padding: "12px 18px", borderTop: "1px solid var(--border)",
  } as React.CSSProperties,
  fieldLabel: {
    display: "block", fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "5px",
  } as React.CSSProperties,
  input: {
    width: "100%", boxSizing: "border-box" as const, height: "32px", padding: "0 10px",
    fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px",
    backgroundColor: "var(--background)", color: "var(--foreground)", outline: "none",
  } as React.CSSProperties,
  textarea: {
    width: "100%", boxSizing: "border-box" as const, minHeight: "64px", padding: "8px 10px",
    fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px",
    backgroundColor: "var(--background)", color: "var(--foreground)", outline: "none",
    resize: "vertical" as const,
  } as React.CSSProperties,
  modal: {
    position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
    zIndex: 72, width: "360px", maxWidth: "90vw", backgroundColor: "var(--panel-solid, var(--card))",
    border: "1px solid var(--border)", borderRadius: "10px", padding: "18px",
    boxShadow: "var(--shadow-lg)",
  } as React.CSSProperties,
}

// ─── 基础组件 ────────────────────────────────────────────────────────────────

export function Chip({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { bg: string; fg: string }> = {
    "启用": { bg: "rgba(53,185,133,0.12)", fg: "var(--green)" },
    "停用": { bg: "rgba(110,129,151,0.14)", fg: "var(--muted-foreground)" },
    "待定责": { bg: "rgba(255,122,66,0.12)", fg: "var(--amber)" },
  }
  const c = map[status]
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "999px",
      fontSize: "11px", backgroundColor: c.bg, color: c.fg, whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  )
}

export function Scrim({ onClose }: { onClose: () => void }) {
  return <div style={S.scrim} onClick={onClose} />
}

export function Drawer({ title, onClose, children, foot }: {
  title: string; onClose: () => void; children: ReactNode; foot: ReactNode
}) {
  return (
    <>
      <Scrim onClose={onClose} />
      <div style={S.drawer} role="dialog" aria-label={title}>
        <div style={S.drawerHead}>
          <strong style={{ fontSize: "13px" }}>{title}</strong>
          <button type="button" style={{ ...S.btnLink, color: "var(--muted-foreground)", fontSize: "16px", lineHeight: 1 }} onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div style={S.drawerBody}>{children}</div>
        <div style={S.drawerFoot}>{foot}</div>
      </div>
    </>
  )
}

export function ConfirmModal({ title, body, confirmText, onConfirm, onClose }: {
  title: string; body: ReactNode; confirmText: string
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <>
      <Scrim onClose={onClose} />
      <div style={S.modal} role="alertdialog" aria-label={title}>
        <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px" }}>{title}</div>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: "16px" }}>{body}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" style={S.btnSecondary} onClick={onClose}>取消</button>
          <button type="button" style={{ ...S.btnPrimary, backgroundColor: "var(--red)", borderColor: "var(--red)" }} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "8px", border: "none",
        background: "none", cursor: "pointer", padding: 0, fontSize: "12px",
        color: "var(--foreground)",
      }}
    >
      <span style={{
        width: "34px", height: "18px", borderRadius: "999px", position: "relative",
        backgroundColor: on ? "var(--green)" : "rgba(110,129,151,0.4)", transition: "background-color 0.15s",
      }}>
        <span style={{
          position: "absolute", top: "2px", left: on ? "18px" : "2px", width: "14px", height: "14px",
          borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.15s",
        }} />
      </span>
      <span>{label}：{on ? "开" : "关"}</span>
    </button>
  )
}

// ─── 字段输入 ────────────────────────────────────────────────────────────────

function FieldInput({ f, value, onChange }: {
  f: GeneratedField; value: string; onChange: (v: string) => void
}) {
  if (f.type === "select") {
    return (
      <select style={S.input} value={value} onChange={(e) => onChange(e.target.value)}>
        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (f.type === "textarea") {
    return <textarea style={S.textarea} value={value} placeholder={f.ph || ""} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <input
      style={S.input} value={value} placeholder={f.ph || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ─── CrudCard ───────────────────────────────────────────────────────────────

export interface CrudCardProps {
  def: GeneratedCard
  /** store 键，默认 def.id */
  cardKey?: string
  /** 行操作区追加按钮（渲染在「编辑」之前） */
  rowButtons?: (row: GcRow, index: number) => ReactNode
  /** 新增行初始状态 */
  newStatus?: RowStatus
  /** 抽屉标题名词（如 机构 / 账号） */
  noun?: string
}

export function CrudCard({ def, cardKey, rowButtons, newStatus = "启用", noun }: CrudCardProps) {
  const key = cardKey || def.id
  const { state, dispatch } = useGc()
  const toast = useToast()
  const [query, setQuery] = useState("")
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; index: number } | null>(null)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)

  const valueCols = useMemo(() => def.cols.filter((c) => c !== "状态" && c !== "操作"), [def.cols])
  const rows = state.rows[key] || []
  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return rows.map((r, i) => ({ r, i }))
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => r.values.some((v) => v.includes(q)))
  }, [rows, query])

  const [form, setForm] = useState<string[]>([])
  const [formErr, setFormErr] = useState("")

  function openDrawer(mode: "add" | "edit", index: number) {
    setFormErr("")
    if (mode === "add") {
      setForm(def.fields.map((f) => f.def ?? ""))
    } else {
      const row = rows[index]
      setForm(def.fields.map((_, i) => row.values[i] ?? ""))
    }
    setDrawer({ mode, index })
  }

  function saveDrawer() {
    if (!drawer) return
    for (let i = 0; i < def.fields.length; i++) {
      const f = def.fields[i]
      if (f.required && !form[i].trim()) {
        setFormErr(`「${f.label}」为必填项`)
        return
      }
    }
    const nameIdx = def.fields.findIndex((f) => f.kind === "name")
    if (drawer.mode === "add" && nameIdx >= 0) {
      const dup = rows.findIndex((r) => r.values[nameIdx] === form[nameIdx].trim())
      if (dup >= 0) {
        setFormErr(`「${form[nameIdx].trim()}」已存在（判重不建新行），请直接编辑原行`)
        return
      }
    }
    const values = def.fields.map((_, i) => form[i].trim())
    dispatch({ type: "upsert", cardKey: key, index: drawer.mode === "edit" ? drawer.index : -1, values })
    toast(drawer.mode === "add" ? `已新增${noun || def.title}，写入草稿，尚未生效。` : `已更新${noun || def.title}，写入草稿，尚未生效。`)
    setDrawer(null)
  }

  return (
    <section style={{ ...S.card, marginBottom: "14px" }} aria-label={def.title}>
      <header style={S.cardHead}>
        <h3 style={S.cardTitle}>{def.title}</h3>
        <span style={S.cardNote}>{def.note}</span>
      </header>
      <div style={S.toolbar}>
        <input
          style={S.search}
          value={query}
          placeholder={`搜索${def.title}`}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" style={{ ...S.btnPrimary, marginLeft: "auto" }} onClick={() => openDrawer("add", -1)}>
          ＋ 新增{noun || ""}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              {def.cols.filter((c) => c !== "操作").map((c) => (
                <th key={c} style={{ ...S.th, ...(c === "状态" ? { width: "64px" } : {}) }}>{c}</th>
              ))}
              <th style={{ ...S.th, textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={def.cols.length} style={S.empty}>
                  {query ? "没有匹配的行，换个关键词试试" : "暂无数据，点击右上角新增"}
                </td>
              </tr>
            )}
            {filtered.map(({ r, i }) => (
              <tr key={i}>
                {r.values.map((v, ci) => (
                  <td key={ci} style={ci === 0 ? { ...S.td, ...S.tdName } : S.td}>{v}</td>
                ))}
                <td style={S.td}><Chip status={r.status} /></td>
                <td style={{ ...S.td, ...S.tdActions }}>
                  {rowButtons?.(r, i)}
                  <button type="button" style={S.btnLink} onClick={() => openDrawer("edit", i)}>编辑</button>
                  <button
                    type="button" style={S.btnLink}
                    onClick={() => {
                      dispatch({ type: "toggle", cardKey: key, index: i })
                      toast(r.status === "启用" ? "已停用，写入草稿，尚未生效。" : "已启用，写入草稿，尚未生效。")
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

      {drawer && (
        <Drawer
          title={(drawer.mode === "add" ? "新增" : "编辑") + (noun || def.title)}
          onClose={() => setDrawer(null)}
          foot={
            <>
              <button type="button" style={S.btnSecondary} onClick={() => setDrawer(null)}>取消</button>
              <button type="button" style={S.btnPrimary} onClick={saveDrawer}>保存到草稿</button>
            </>
          }
        >
          {def.fields.map((f, i) => (
            <div key={f.k} style={{ marginBottom: "12px" }}>
              <label style={S.fieldLabel}>
                {f.label}{f.required ? "（必填）" : ""}
              </label>
              <FieldInput f={f} value={form[i] ?? ""} onChange={(v) => setForm((prev) => prev.map((x, j) => (j === i ? v : x)))} />
            </div>
          ))}
          {formErr && (
            <div style={{ fontSize: "11px", color: "var(--red)", marginTop: "4px" }}>{formErr}</div>
          )}
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "10px", lineHeight: 1.7 }}>
            保存写入草稿，尚未生效；发布需在「发布与审计」页经「发布前预览」冲突校验后确认。
          </div>
        </Drawer>
      )}

      {confirmDel !== null && (
        <ConfirmModal
          title="删除确认"
          body={<>将删除「{rows[confirmDel]?.values[0]}」这一行。删除只影响草稿与后续发布，历史事件仍引用发布时的规则版本。</>}
          confirmText="删除"
          onConfirm={() => {
            dispatch({ type: "remove", cardKey: key, index: confirmDel })
            toast("已删除，写入草稿，尚未生效。")
            setConfirmDel(null)
          }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </section>
  )
}

// 渲染一组引擎卡
export function CardList({ defs, rowButtons, nouns }: {
  defs: GeneratedCard[]
  rowButtons?: Record<string, (row: GcRow, index: number) => ReactNode>
  nouns?: Record<string, string>
}) {
  return (
    <>
      {defs.map((def) => (
        <CrudCard key={def.id} def={def} rowButtons={rowButtons?.[def.id]} noun={nouns?.[def.id]} />
      ))}
    </>
  )
}
