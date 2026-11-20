// V2.0 治理配置：共享 UI 组件（输入、下拉、多选、抽屉、按钮）
// 约定：字段名就是唯一文字；校验失败只红框、不配说明；保存成功只吐「已保存」（见 store）。

import { useEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"

/* ── 基础控件 ─────────────────────────────────────────── */

const controlBase: CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  fontSize: 13,
  color: "var(--foreground)",
  background: "var(--control-bg)",
  border: "1px solid var(--control-border)",
  borderRadius: 9,
  outline: "none",
}

export function TextInput(props: {
  value: string
  onChange: (v: string) => void
  error?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      style={{
        ...controlBase,
        borderColor: props.error ? "var(--red)" : undefined,
        borderWidth: props.error ? 2 : 1,
      }}
    />
  )
}

/* ── 检索框（表格/树上方，按当前可见文字过滤） ──────────── */

export function SearchBox(props: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={props.value}
      placeholder="检索"
      onChange={(e) => props.onChange(e.target.value)}
      style={{ ...controlBase, width: 220, flexShrink: 0 }}
    />
  )
}

export interface Opt {
  value: string
  label: string
}
export interface OptGroup {
  label?: string
  options: Opt[]
}

export function Select(props: {
  value: string
  onChange: (v: string) => void
  groups: OptGroup[]
  error?: boolean
  placeholder?: string
}) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      style={{
        ...controlBase,
        appearance: "none",
        borderColor: props.error ? "var(--red)" : undefined,
        borderWidth: props.error ? 2 : 1,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%236E8197' stroke-width='1.6' stroke-linecap='round'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 30,
        cursor: "pointer",
      }}
    >
      {props.placeholder !== undefined && <option value="">{props.placeholder}</option>}
      {props.groups.map((g, gi) =>
        g.label ? (
          <optgroup key={gi} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : (
          g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        ),
      )}
    </select>
  )
}

/* ── 多选下拉（勾选列表 + 分组） ─────────────────────── */

export function MultiSelect(props: {
  groups: OptGroup[]
  value: string[]
  onChange: (v: string[]) => void
  error?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const labels = props.groups
    .flatMap((g) => g.options)
    .filter((o) => props.value.includes(o.value))
    .map((o) => o.label)

  const toggle = (v: string) => {
    props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v])
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          ...controlBase,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          textAlign: "left",
          cursor: "pointer",
          borderColor: props.error ? "var(--red)" : undefined,
          borderWidth: props.error ? 2 : 1,
          color: labels.length ? "var(--foreground)" : "var(--muted-foreground)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {labels.length ? labels.join("、") : (props.placeholder ?? "请选择")}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" style={{ flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" fill="none" stroke="#6E8197" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--card-solid, #fff)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            boxShadow: "var(--shadow-md)",
            padding: "6px 0",
          }}
        >
          {props.groups.map((g, gi) => (
            <div key={gi}>
              {g.label && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-sub)",
                    padding: "6px 12px 3px",
                    fontWeight: 600,
                  }}
                >
                  {g.label}
                </div>
              )}
              {g.options.map((o) => {
                const checked = props.value.includes(o.value)
                return (
                  <div
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 12px",
                      fontSize: 13,
                      cursor: "pointer",
                      background: checked ? "var(--primary-light)" : undefined,
                    }}
                  >
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: 4,
                        border: checked ? "none" : "1.5px solid var(--border-strong)",
                        background: checked ? "var(--primary)" : "transparent",
                        color: "#fff",
                        fontSize: 11,
                        lineHeight: "15px",
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    {o.label}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 勾选框 ───────────────────────────────────────────── */

export function Check(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 13,
        cursor: "pointer",
        color: "var(--foreground)",
      }}
    >
      <span
        onClick={(e) => {
          e.preventDefault()
          props.onChange(!props.checked)
        }}
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          border: props.checked ? "none" : "1.5px solid var(--border-strong)",
          background: props.checked ? "var(--primary)" : "transparent",
          color: "#fff",
          fontSize: 11,
          lineHeight: "15px",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {props.checked ? "✓" : ""}
      </span>
      {props.label}
    </label>
  )
}

/* ── 抽屉 ─────────────────────────────────────────────── */

export function Drawer(props: {
  title: string
  onClose: () => void
  onSave: () => void
  children: ReactNode
  saveLabel?: string
}) {
  return (
    <>
      <div
        onClick={props.onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(22, 45, 77, 0.36)",
          zIndex: 60,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: "92vw",
          background: "var(--card-solid, #fff)",
          zIndex: 61,
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>{props.title}</div>
          <button
            type="button"
            onClick={props.onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 16,
              color: "var(--text-sub)",
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 8px" }}>{props.children}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "12px 18px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button type="button" onClick={props.onClose} style={ghostBtn}>
            取消
          </button>
          <button type="button" onClick={props.onSave} style={primaryBtn}>
            {props.saveLabel ?? "保存"}
          </button>
        </div>
      </div>
    </>
  )
}

/* ── 字段 ─────────────────────────────────────────────── */

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginBottom: 6 }}>{props.label}</div>
      {props.children}
    </div>
  )
}

export function ReadonlyField(props: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginBottom: 6 }}>{props.label}</div>
      <div
        style={{
          ...controlBase,
          display: "flex",
          alignItems: "center",
          color: "var(--text-sub)",
          background: "var(--card-2, rgba(243,250,255,.72))",
        }}
      >
        {props.value}
      </div>
    </div>
  )
}

/* ── 按钮 ─────────────────────────────────────────────── */

export const primaryBtn: CSSProperties = {
  height: 32,
  padding: "0 16px",
  fontSize: 13,
  color: "var(--primary-foreground, #fff)",
  background: "var(--primary)",
  border: "none",
  borderRadius: 9,
  cursor: "pointer",
}

export const ghostBtn: CSSProperties = {
  height: 32,
  padding: "0 16px",
  fontSize: 13,
  color: "var(--foreground)",
  background: "transparent",
  border: "1px solid var(--border-strong)",
  borderRadius: 9,
  cursor: "pointer",
}

export function AddButton(props: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        ...primaryBtn,
        opacity: props.disabled ? 0.4 : 1,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.children}
    </button>
  )
}

export function RowBtn(props: { onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        height: 26,
        padding: "0 10px",
        fontSize: 12.5,
        color: props.danger ? "var(--red)" : "var(--primary)",
        background: "transparent",
        border: `1px solid ${props.danger ? "var(--red)" : "var(--border-strong)"}`,
        borderRadius: 7,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.35 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  )
}

/* ── 布局 ─────────────────────────────────────────────── */

export function Toolbar(props: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 12 }}>
      {props.children}
    </div>
  )
}

export function Panel(props: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card-solid, #fff)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "auto",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {props.children}
    </div>
  )
}

export function DataTable(props: { children: ReactNode; minWidth?: number }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: props.minWidth }}>
      {props.children}
    </table>
  )
}

export const thStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-sub)",
  padding: "10px 14px",
  borderBottom: "1px solid var(--border)",
  background: "var(--card-2, rgba(243,250,255,.72))",
  whiteSpace: "nowrap",
}

export const tdStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--foreground)",
  padding: "11px 14px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
}
