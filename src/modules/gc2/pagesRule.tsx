// V2.0 治理配置：派发规则两页 —— 规则（表）、去向（三下拉 + 默认列表）
import { useMemo, useState } from "react"
import type { Rule } from "./model"
import {
  DISTRICTS,
  PATHS,
  SOURCES,
  STREETS,
  decodeRef,
  encodeRef,
  orgName,
  ruleEventOptionGroups,
  ruleEventText,
  uid,
} from "./model"
import { computeRoute, duplicateRuleIds, ruleCoversMinor, rulePost } from "./matching"
import { useConfig } from "./store"
import {
  AddButton,
  DataTable,
  Drawer,
  Field,
  Panel,
  RowBtn,
  SearchBox,
  Select,
  TextInput,
  Toolbar,
  tdStyle,
  thStyle,
} from "./ui"

/* ══════════ 规则 ══════════ */

interface RuleDraft {
  id: string | null
  source: string
  event: string
  area: string
  path: string
  org: string
}

export function RulePage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<RuleDraft | null>(null)
  const [errs, setErrs] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")

  const dup = duplicateRuleIds(state)

  const kw = query.trim().toLowerCase()
  const list = kw
    ? state.rules.filter((r) =>
        [
          r.source,
          ruleEventText(r.event),
          r.area,
          r.path,
          dup.has(r.id) ? "重复" : r.org === "manual" ? "待人工派发" : orgName(state, r.org),
        ]
          .join("\n")
          .toLowerCase()
          .includes(kw),
      )
    : state.rules

  const openAdd = () => {
    setErrs({})
    setDrawer({ id: null, source: "", event: "", area: "", path: "", org: "" })
  }

  const openEdit = (r: Rule) => {
    setErrs({})
    setDrawer({
      id: r.id,
      source: r.source,
      event: encodeRef(r.event),
      area: r.area,
      path: r.path,
      org: r.org,
    })
  }

  const save = () => {
    if (!drawer) return
    const e: Record<string, boolean> = {
      source: !drawer.source,
      event: !drawer.event,
      area: !drawer.area,
      path: !drawer.path,
      org: !drawer.org,
    }
    setErrs(e)
    if (Object.values(e).some(Boolean)) return
    const rule: Rule = {
      id: drawer.id ?? uid("ru"),
      source: drawer.source,
      event: decodeRef(drawer.event),
      area: drawer.area,
      path: drawer.path as Rule["path"],
      org: drawer.org,
    }
    dispatch({ type: "rule/save", rule })
    // 来源、事件类型、行政区 三项都一样时：保存不关抽屉，两行组织列写「重复」
    const conflict = state.rules.some(
      (r) =>
        r.id !== rule.id &&
        r.source === rule.source &&
        encodeRef(r.event) === encodeRef(rule.event) &&
        r.area === rule.area,
    )
    if (conflict) return
    saved()
    setDrawer(null)
  }

  return (
    <>
      <Toolbar>
        <div style={{ marginRight: "auto" }}>
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <AddButton onClick={openAdd}>新增规则</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={860}>
          <thead>
            <tr>
              <th style={thStyle}>来源</th>
              <th style={thStyle}>事件类型</th>
              <th style={thStyle}>行政区</th>
              <th style={thStyle}>办理路径</th>
              <th style={thStyle}>组织</th>
              <th style={{ ...thStyle, width: 150 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const isDup = dup.has(r.id)
              return (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.source}</td>
                  <td style={tdStyle}>{ruleEventText(r.event)}</td>
                  <td style={tdStyle}>{r.area}</td>
                  <td style={tdStyle}>{r.path}</td>
                  <td style={{ ...tdStyle, color: isDup ? "var(--red)" : undefined }}>
                    {isDup ? "重复" : r.org === "manual" ? "待人工派发" : orgName(state, r.org)}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <RowBtn onClick={() => openEdit(r)}>编辑</RowBtn>
                      <RowBtn danger onClick={() => dispatch({ type: "rule/delete", id: r.id })}>
                        删除
                      </RowBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </Panel>

      {drawer && (
        <Drawer title={drawer.id ? "编辑规则" : "新增规则"} onClose={() => setDrawer(null)} onSave={save}>
          <Field label="来源">
            <Select
              value={drawer.source}
              onChange={(v) => setDrawer({ ...drawer, source: v })}
              error={errs.source}
              placeholder="请选择"
              groups={[{ options: SOURCES.map((s) => ({ value: s, label: s })) }]}
            />
          </Field>
          <Field label="事件类型">
            <Select
              value={drawer.event}
              onChange={(v) => setDrawer({ ...drawer, event: v })}
              error={errs.event}
              placeholder="请选择"
              groups={ruleEventOptionGroups(state, decodeRef(drawer.event || "none"))}
            />
          </Field>
          <Field label="行政区">
            <Select
              value={drawer.area}
              onChange={(v) => setDrawer({ ...drawer, area: v })}
              error={errs.area}
              placeholder="请选择"
              groups={[
                {
                  options: ["不限", ...DISTRICTS].map((a) => ({ value: a, label: a })),
                },
              ]}
            />
          </Field>
          <Field label="办理路径">
            <Select
              value={drawer.path}
              onChange={(v) => setDrawer({ ...drawer, path: v })}
              error={errs.path}
              placeholder="请选择"
              groups={[{ options: PATHS.map((p) => ({ value: p, label: p })) }]}
            />
          </Field>
          <Field label="组织">
            <Select
              value={drawer.org}
              onChange={(v) => setDrawer({ ...drawer, org: v })}
              error={errs.org}
              placeholder="请选择"
              groups={[
                { options: [{ value: "manual", label: "待人工派发" }] },
                { options: state.orgs.map((o) => ({ value: o.id, label: o.name })) },
              ]}
            />
          </Field>
        </Drawer>
      )}
    </>
  )
}

/* ══════════ 去向（默认列表：每条规则一行；三下拉选完只留一行计算结果） ══════════ */

interface RouteRow {
  source: string
  event: string
  area: string
  path: string
  org: string
  post: string
}

export function RoutePage() {
  const { state } = useConfig()
  const [src, setSrc] = useState("")
  const [minor, setMinor] = useState("")
  const [street, setStreet] = useState("")

  const ready = !!src && !!minor && !!street

  const rows = useMemo<RouteRow[]>(() => {
    if (ready) {
      const result = computeRoute(state, src, minor, street)
      return [
        {
          source: src,
          event: minor,
          area: street,
          path: result.path,
          org: result.org,
          post: result.post,
        },
      ]
    }
    return state.rules
      .filter(
        (r) =>
          (!src || r.source === src) &&
          (!minor || ruleCoversMinor(state, r, minor)) &&
          (!street || r.area === "不限" || r.area === "东城区" || r.area === street),
      )
      .map((r) => ({
        source: r.source,
        event: ruleEventText(r.event),
        area: r.area,
        path: r.path,
        org: r.org === "manual" ? "待人工派发" : orgName(state, r.org),
        post: rulePost(state, r),
      }))
  }, [state, src, minor, street, ready])

  const enabledMinors = state.std.filter((s) => s.status === "启用")

  return (
    <>
      <div style={{ display: "flex", gap: 18, marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginBottom: 6 }}>来源</div>
          <Select
            value={src}
            onChange={setSrc}
            placeholder="请选择"
            groups={[{ options: SOURCES.map((s) => ({ value: s, label: s })) }]}
          />
        </div>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginBottom: 6 }}>事件类型</div>
          <div style={{ width: 220 }}>
            <Select
              value={minor}
              onChange={setMinor}
              placeholder="请选择"
              groups={[{ options: enabledMinors.map((s) => ({ value: s.minor, label: s.minor })) }]}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--text-sub)", marginBottom: 6 }}>行政区</div>
          <Select
            value={street}
            onChange={setStreet}
            placeholder="请选择"
            groups={[{ options: STREETS.map((s) => ({ value: s, label: s })) }]}
          />
        </div>
      </div>

      <Panel>
        <DataTable minWidth={720}>
          <thead>
            <tr>
              <th style={thStyle}>来源</th>
              <th style={thStyle}>事件类型</th>
              <th style={thStyle}>行政区</th>
              <th style={thStyle}>办理路径</th>
              <th style={thStyle}>组织</th>
              <th style={thStyle}>落到岗位</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={tdStyle}>{row.source}</td>
                <td style={tdStyle}>{row.event}</td>
                <td style={tdStyle}>{row.area}</td>
                <td style={tdStyle}>{row.path}</td>
                <td style={tdStyle}>{row.org}</td>
                <td style={tdStyle}>{row.post}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>
    </>
  )
}
