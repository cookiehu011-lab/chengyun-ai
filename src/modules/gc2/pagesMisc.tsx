// V2.0 治理配置：办理时限两页（时限 / 领取）+ 事件标准
import { useState } from "react"
import type { ClaimRow, ConfigState, EventRef, Sla, StdRow } from "./model"
import { encodeRef, decodeRef, refListText, stdInUse, uid } from "./model"
import { useConfig } from "./store"
import {
  AddButton,
  DataTable,
  Drawer,
  Field,
  Panel,
  RowBtn,
  TextInput,
  Toolbar,
  MultiSelect,
  tdStyle,
  thStyle,
} from "./ui"

/* ══════════ 时限 ══════════ */

interface SlaDraft {
  id: string | null
  events: string[]
  disposal: string
  check: string
}

/** 时限事件多选的分组选项：分类 / 大类 / 小类（小类只列启用的，当前引用保留） */
function slaEventGroups(state: ConfigState, current: string[]) {
  const categories = Array.from(new Set(state.std.map((s) => s.category)))
  const majors = Array.from(new Set(state.std.map((s) => s.major)))
  const enabled = state.std.filter((s) => s.status === "启用").map((s) => s.minor)
  const kept = current
    .filter((v) => v.startsWith("min:") && !enabled.includes(v.slice(4)))
    .map((v) => v.slice(4))
  return [
    { label: "分类", options: categories.map((c) => ({ value: `cat:${c}`, label: c })) },
    { label: "大类", options: majors.map((m) => ({ value: `maj:${m}`, label: m })) },
    {
      label: "小类",
      options: [...enabled, ...kept].map((m) => ({ value: `min:${m}`, label: m })),
    },
  ]
}

export function SlaPage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<SlaDraft | null>(null)
  const [errs, setErrs] = useState<Record<string, boolean>>({})

  const openAdd = () => {
    setErrs({})
    setDrawer({ id: null, events: [], disposal: "", check: "" })
  }

  const openEdit = (s: Sla) => {
    setErrs({})
    setDrawer({ id: s.id, events: s.events.map(encodeRef), disposal: s.disposal, check: s.check })
  }

  const save = () => {
    if (!drawer) return
    const e: Record<string, boolean> = {
      events: drawer.events.length === 0,
      disposal: !drawer.disposal.trim(),
      check: !drawer.check.trim(),
    }
    setErrs(e)
    if (Object.values(e).some(Boolean)) return
    const sla: Sla = {
      id: drawer.id ?? uid("sl"),
      events: drawer.events.map(decodeRef),
      disposal: drawer.disposal.trim(),
      check: drawer.check.trim(),
    }
    dispatch({ type: "sla/save", sla })
    saved()
    setDrawer(null)
  }

  return (
    <>
      <Toolbar>
        <AddButton onClick={openAdd}>新增</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={640}>
          <thead>
            <tr>
              <th style={thStyle}>事件类型</th>
              <th style={thStyle}>处置时限</th>
              <th style={thStyle}>核查时限</th>
              <th style={{ ...thStyle, width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.slas.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>{refListText(s.events)}</td>
                <td style={tdStyle}>{s.disposal}</td>
                <td style={tdStyle}>{s.check}</td>
                <td style={tdStyle}>
                  <RowBtn onClick={() => openEdit(s)}>编辑</RowBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      {drawer && (
        <Drawer title={drawer.id ? "编辑" : "新增"} onClose={() => setDrawer(null)} onSave={save}>
          <Field label="事件类型">
            <MultiSelect
              groups={slaEventGroups(state, drawer.events)}
              value={drawer.events}
              onChange={(v) => setDrawer({ ...drawer, events: v })}
              error={errs.events}
            />
          </Field>
          <Field label="处置时限">
            <TextInput
              value={drawer.disposal}
              onChange={(v) => setDrawer({ ...drawer, disposal: v })}
              error={errs.disposal}
            />
          </Field>
          <Field label="核查时限">
            <TextInput
              value={drawer.check}
              onChange={(v) => setDrawer({ ...drawer, check: v })}
              error={errs.check}
            />
          </Field>
        </Drawer>
      )}
    </>
  )
}

/* ══════════ 领取 ══════════ */

export function ClaimPage() {
  const { state, dispatch, saved } = useConfig()
  const [editing, setEditing] = useState<ClaimRow | null>(null)
  const [value, setValue] = useState("")
  const [err, setErr] = useState(false)

  const openEdit = (row: ClaimRow) => {
    setErr(false)
    setValue(String(row.count))
    setEditing(row)
  }

  const save = () => {
    if (!editing) return
    const n = Number(value)
    if (!value.trim() || !Number.isInteger(n) || n < 1) {
      setErr(true)
      return
    }
    dispatch({ type: "claim/set", id: editing.id, count: n })
    saved()
    setEditing(null)
  }

  return (
    <>
      <Panel>
        <DataTable minWidth={420}>
          <thead>
            <tr>
              <th style={thStyle}>待办</th>
              <th style={thStyle}>每次领取</th>
              <th style={{ ...thStyle, width: 80 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.claim.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}>{row.todo}</td>
                <td style={tdStyle}>{row.count}件</td>
                <td style={tdStyle}>
                  <RowBtn onClick={() => openEdit(row)}>编辑</RowBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      {editing && (
        <Drawer title="编辑" onClose={() => setEditing(null)} onSave={save}>
          <Field label="每次领取">
            <TextInput
              type="number"
              value={value}
              onChange={(v) => {
                setValue(v)
                setErr(false)
              }}
              error={err}
            />
          </Field>
        </Drawer>
      )}
    </>
  )
}

/* ══════════ 事件标准 ══════════ */

interface StdDraft {
  id: string | null
  category: string
  major: string
  minor: string
  criteria: string
  materials: string
}

export function EventStdPage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<StdDraft | null>(null)
  const [errs, setErrs] = useState<Record<string, boolean>>({})

  const openAdd = () => {
    setErrs({})
    setDrawer({ id: null, category: "", major: "", minor: "", criteria: "", materials: "" })
  }

  const openEdit = (row: StdRow) => {
    setErrs({})
    setDrawer({
      id: row.id,
      category: row.category,
      major: row.major,
      minor: row.minor,
      criteria: row.criteria,
      materials: row.materials,
    })
  }

  const save = () => {
    if (!drawer) return
    const e: Record<string, boolean> = {
      category: !drawer.category.trim(),
      major: !drawer.major.trim(),
      minor: !drawer.minor.trim(),
      criteria: !drawer.criteria.trim(),
      materials: !drawer.materials.trim(),
    }
    setErrs(e)
    if (Object.values(e).some(Boolean)) return
    const existing = drawer.id ? state.std.find((s) => s.id === drawer.id) : undefined
    const row: StdRow = {
      id: drawer.id ?? uid("s"),
      category: drawer.category.trim(),
      major: drawer.major.trim(),
      minor: drawer.minor.trim(),
      criteria: drawer.criteria.trim(),
      materials: drawer.materials.trim(),
      status: existing?.status ?? "启用",
    }
    dispatch({ type: "std/save", row })
    saved()
    setDrawer(null)
  }

  return (
    <>
      <Toolbar>
        <AddButton onClick={openAdd}>新增</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={860}>
          <thead>
            <tr>
              <th style={thStyle}>分类</th>
              <th style={thStyle}>大类</th>
              <th style={thStyle}>小类</th>
              <th style={thStyle}>立案标准</th>
              <th style={thStyle}>办理材料</th>
              <th style={thStyle}>状态</th>
              <th style={{ ...thStyle, width: 130 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.std.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}>{row.category}</td>
                <td style={tdStyle}>{row.major}</td>
                <td style={tdStyle}>{row.minor}</td>
                <td style={tdStyle}>{row.criteria}</td>
                <td style={tdStyle}>{row.materials}</td>
                <td style={tdStyle}>{row.status}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <RowBtn onClick={() => openEdit(row)}>编辑</RowBtn>
                    <RowBtn
                      danger={row.status === "启用"}
                      disabled={row.status === "启用" && stdInUse(state, row.minor)}
                      onClick={() => dispatch({ type: "std/toggle", id: row.id })}
                    >
                      {row.status === "启用" ? "停用" : "启用"}
                    </RowBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      {drawer && (
        <Drawer title={drawer.id ? "编辑" : "新增"} onClose={() => setDrawer(null)} onSave={save}>
          <Field label="分类">
            <TextInput
              value={drawer.category}
              onChange={(v) => setDrawer({ ...drawer, category: v })}
              error={errs.category}
            />
          </Field>
          <Field label="大类">
            <TextInput
              value={drawer.major}
              onChange={(v) => setDrawer({ ...drawer, major: v })}
              error={errs.major}
            />
          </Field>
          <Field label="小类">
            <TextInput
              value={drawer.minor}
              onChange={(v) => setDrawer({ ...drawer, minor: v })}
              error={errs.minor}
            />
          </Field>
          <Field label="立案标准">
            <TextInput
              value={drawer.criteria}
              onChange={(v) => setDrawer({ ...drawer, criteria: v })}
              error={errs.criteria}
            />
          </Field>
          <Field label="办理材料">
            <TextInput
              value={drawer.materials}
              onChange={(v) => setDrawer({ ...drawer, materials: v })}
              error={errs.materials}
            />
          </Field>
        </Drawer>
      )}
    </>
  )
}
