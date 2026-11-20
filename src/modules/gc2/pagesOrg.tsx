// V2.0 治理配置：组织机构四页 —— 组织（树）、岗位、角色、账号
import { useMemo, useState } from "react"
import type { Account, EventRef, OrgNode, Post, RoleDef } from "./model"
import {
  CONFIG_PAGES,
  DISTRICTS,
  FEATURES,
  LIVE_TAB_OPS,
  LIVE_TABS,
  decodeRef,
  encodeRef,
  eventOptionGroups,
  orgName,
  refListText,
  roleName,
  roleFeatureText,
  roleOpsText,
  uid,
} from "./model"
import { useConfig } from "./store"
import {
  AddButton,
  Check,
  DataTable,
  Drawer,
  Field,
  MultiSelect,
  Panel,
  ReadonlyField,
  RowBtn,
  SearchBox,
  Select,
  TextInput,
  Toolbar,
  tdStyle,
  thStyle,
} from "./ui"

const gridBox = (cols: number) => ({
  display: "grid" as const,
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap: "10px 8px",
  padding: "12px",
  border: "1px solid var(--border)",
  borderRadius: 10,
})

/* ══════════ 组织（左树右详情） ══════════ */

export function OrgPage() {
  const { state, dispatch, saved } = useConfig()
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [drawer, setDrawer] = useState<null | { mode: "add" } | { mode: "edit"; id: string }>(null)
  const [name, setName] = useState("")
  const [type, setType] = useState("")
  const [nameErr, setNameErr] = useState(false)
  const [typeErr, setTypeErr] = useState(false)

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, OrgNode[]>()
    for (const o of state.orgs) {
      const arr = map.get(o.parentId)
      if (arr) arr.push(o)
      else map.set(o.parentId, [o])
    }
    return map
  }, [state.orgs])

  /** 检索：命中节点 + 命中节点的全部上级（null 表示不过滤） */
  const visibleIds = useMemo(() => {
    const kw = query.trim().toLowerCase()
    if (!kw) return null
    const byId = new Map(state.orgs.map((o) => [o.id, o]))
    const keep = new Set<string>()
    for (const o of state.orgs) {
      if (!o.name.toLowerCase().includes(kw)) continue
      let cur: string | null = o.id
      while (cur && !keep.has(cur)) {
        keep.add(cur)
        cur = byId.get(cur)?.parentId ?? null
      }
    }
    return keep
  }, [query, state.orgs])

  const rows = useMemo(() => {
    const out: { node: OrgNode; depth: number }[] = []
    const walk = (parent: string | null, depth: number) => {
      for (const node of childrenOf.get(parent) ?? []) {
        if (visibleIds && !visibleIds.has(node.id)) continue
        out.push({ node, depth })
        walk(node.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [childrenOf, visibleIds])

  const selectedNode = state.orgs.find((o) => o.id === selected) ?? null

  const openAdd = () => {
    if (!selectedNode) return
    setName("")
    setType("")
    setNameErr(false)
    setTypeErr(false)
    setDrawer({ mode: "add" })
  }

  const openEdit = (node: OrgNode) => {
    setName(node.name)
    setNameErr(false)
    setDrawer({ mode: "edit", id: node.id })
  }

  const save = () => {
    if (!drawer) return
    if (drawer.mode === "add") {
      const nErr = !name.trim()
      const tErr = !type
      setNameErr(nErr)
      setTypeErr(tErr)
      if (nErr || tErr || !selectedNode) return
      dispatch({
        type: "org/add",
        node: { id: uid("o"), name: name.trim(), type: type as OrgNode["type"], parentId: selectedNode.id },
      })
    } else {
      const nErr = !name.trim()
      setNameErr(nErr)
      if (nErr) return
      dispatch({ type: "org/rename", id: drawer.id, name: name.trim() })
    }
    saved()
    setDrawer(null)
  }

  const deletable = (node: OrgNode) =>
    !(
      state.orgs.some((o) => o.parentId === node.id) ||
      state.posts.some((p) => p.orgId === node.id) ||
      state.accounts.some((a) => a.orgId === node.id)
    )

  const postsHere = selectedNode ? state.posts.filter((p) => p.orgId === selectedNode.id) : []
  const accountsHere = selectedNode ? state.accounts.filter((a) => a.orgId === selectedNode.id) : []
  const staffNames = (postId: string) =>
    state.accounts.filter((a) => a.postId === postId).map((a) => a.name).join("、")

  return (
    <>
      <Toolbar>
        <AddButton onClick={openAdd} disabled={!selectedNode}>
          新增
        </AddButton>
      </Toolbar>

      <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
        {/* 左：树 */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            background: "var(--card-solid, #fff)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ padding: "12px 12px 10px" }}>
            <SearchBox value={query} onChange={setQuery} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
            {rows.map(({ node, depth }) => {
              const hasChildren = (childrenOf.get(node.id)?.length ?? 0) > 0
              const active = selected === node.id
              return (
                <div
                  key={node.id}
                  onClick={() => setSelected(node.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 34,
                    borderRadius: 8,
                    cursor: "pointer",
                    background: active ? "var(--primary-light)" : undefined,
                    color: active ? "var(--primary)" : "var(--foreground)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {Array.from({ length: depth }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 18,
                        alignSelf: "stretch",
                        borderLeft: "1px solid var(--border)",
                        flexShrink: 0,
                      }}
                    />
                  ))}
                  <span
                    style={{
                      color: "var(--muted-foreground)",
                      fontSize: 10,
                      width: 16,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {hasChildren ? "▾" : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {node.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右：选中单位的类型、上级、岗位、账号 */}
        {selectedNode && (
          <Panel>
            <div style={{ padding: "6px 16px 16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedNode.name}</div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--text-sub)" }}>类型：</span>
                  {selectedNode.type}
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--text-sub)" }}>上级：</span>
                  {selectedNode.parentId ? orgName(state, selectedNode.parentId) : "—"}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <RowBtn onClick={() => openEdit(selectedNode)}>编辑</RowBtn>
                  <RowBtn
                    danger
                    disabled={!deletable(selectedNode)}
                    onClick={() => {
                      dispatch({ type: "org/delete", id: selectedNode.id })
                      setSelected(null)
                    }}
                  >
                    删除
                  </RowBtn>
                </div>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-sub)", margin: "14px 0 8px" }}>
                岗位
              </div>
              <DataTable minWidth={420}>
                <thead>
                  <tr>
                    <th style={thStyle}>岗位</th>
                    <th style={thStyle}>角色</th>
                    <th style={thStyle}>人员</th>
                  </tr>
                </thead>
                <tbody>
                  {postsHere.length === 0 ? (
                    <tr>
                      <td style={tdStyle} colSpan={3}>—</td>
                    </tr>
                  ) : (
                    postsHere.map((p) => (
                      <tr key={p.id}>
                        <td style={tdStyle}>{p.name}</td>
                        <td style={tdStyle}>{roleName(state, p.roleId)}</td>
                        <td style={tdStyle}>{staffNames(p.id) || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </DataTable>

              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-sub)", margin: "18px 0 8px" }}>
                账号
              </div>
              <DataTable minWidth={420}>
                <thead>
                  <tr>
                    <th style={thStyle}>姓名</th>
                    <th style={thStyle}>手机号</th>
                    <th style={thStyle}>岗位</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsHere.length === 0 ? (
                    <tr>
                      <td style={tdStyle} colSpan={3}>—</td>
                    </tr>
                  ) : (
                    accountsHere.map((a) => (
                      <tr key={a.id}>
                        <td style={tdStyle}>{a.name}</td>
                        <td style={tdStyle}>{a.phone}</td>
                        <td style={tdStyle}>{postName(state, a.postId)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </DataTable>
            </div>
          </Panel>
        )}
      </div>

      {drawer && (
        <Drawer
          title={drawer.mode === "add" ? "新增单位" : "编辑单位"}
          onClose={() => setDrawer(null)}
          onSave={save}
        >
          <Field label="名称">
            <TextInput value={name} onChange={(v) => setName(v)} error={nameErr} />
          </Field>
          {drawer.mode === "add" ? (
            <>
              <Field label="类型">
                <Select
                  value={type}
                  onChange={(v) => setType(v)}
                  error={typeErr}
                  placeholder="请选择"
                  groups={[{ options: ["区", "街道", "委办局", "社区", "科室"].map((t) => ({ value: t, label: t })) }]}
                />
              </Field>
              <ReadonlyField label="上级" value={selectedNode ? selectedNode.name : "—"} />
            </>
          ) : null}
        </Drawer>
      )}
    </>
  )
}

/* ══════════ 岗位 ══════════ */

interface PostDraft {
  id: string | null
  name: string
  orgId: string
  roleId: string
  refs: string[]
  areas: string[]
}

export function PostPage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<PostDraft | null>(null)
  const [errs, setErrs] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")

  const staffNames = (postId: string) =>
    state.accounts.filter((a) => a.postId === postId).map((a) => a.name).join("、")

  const kw = query.trim().toLowerCase()
  const list = kw
    ? state.posts.filter((p) =>
        [
          p.name,
          orgName(state, p.orgId),
          roleName(state, p.roleId),
          staffNames(p.id),
          refListText(p.events),
          p.areas.join("、"),
        ]
          .join("\n")
          .toLowerCase()
          .includes(kw),
      )
    : state.posts

  const openAdd = () => {
    setErrs({})
    setDrawer({ id: null, name: "", orgId: "", roleId: "", refs: [], areas: [] })
  }

  const openEdit = (p: Post) => {
    setErrs({})
    setDrawer({
      id: p.id,
      name: p.name,
      orgId: p.orgId,
      roleId: p.roleId,
      refs: p.events.map(encodeRef),
      areas: [...p.areas],
    })
  }

  const save = () => {
    if (!drawer) return
    const e: Record<string, boolean> = {
      name: !drawer.name.trim(),
      orgId: !drawer.orgId,
      roleId: !drawer.roleId,
      refs: drawer.refs.length === 0,
      areas: drawer.areas.length === 0,
    }
    setErrs(e)
    if (Object.values(e).some(Boolean)) return
    const events: EventRef[] = drawer.refs.map(decodeRef)
    dispatch({
      type: "post/save",
      post: {
        id: drawer.id ?? uid("p"),
        name: drawer.name.trim(),
        orgId: drawer.orgId,
        roleId: drawer.roleId,
        events,
        areas: [...drawer.areas],
      },
    })
    saved()
    setDrawer(null)
  }

  const eventGroups = drawer
    ? eventOptionGroups(state, drawer.refs.map(decodeRef))
    : []

  return (
    <>
      <Toolbar>
        <div style={{ marginRight: "auto" }}>
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <AddButton onClick={openAdd}>新增岗位</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={960}>
          <thead>
            <tr>
              <th style={thStyle}>岗位</th>
              <th style={thStyle}>组织</th>
              <th style={thStyle}>角色</th>
              <th style={thStyle}>人员</th>
              <th style={thStyle}>负责的事件</th>
              <th style={thStyle}>负责的行政区</th>
              <th style={{ ...thStyle, width: 150 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{orgName(state, p.orgId)}</td>
                <td style={tdStyle}>{roleName(state, p.roleId)}</td>
                <td style={tdStyle}>{staffNames(p.id) || "—"}</td>
                <td style={tdStyle}>{refListText(p.events)}</td>
                <td style={tdStyle}>{p.areas.join("、")}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <RowBtn onClick={() => openEdit(p)}>编辑</RowBtn>
                    <RowBtn
                      danger
                      disabled={state.accounts.some((a) => a.postId === p.id)}
                      onClick={() => dispatch({ type: "post/delete", id: p.id })}
                    >
                      删除
                    </RowBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      {drawer && (
        <Drawer title={drawer.id ? "编辑岗位" : "新增岗位"} onClose={() => setDrawer(null)} onSave={save}>
          <Field label="岗位">
            <TextInput value={drawer.name} onChange={(v) => setDrawer({ ...drawer, name: v })} error={errs.name} />
          </Field>
          <Field label="组织">
            <Select
              value={drawer.orgId}
              onChange={(v) => setDrawer({ ...drawer, orgId: v })}
              error={errs.orgId}
              placeholder="请选择"
              groups={[{ options: state.orgs.map((o) => ({ value: o.id, label: o.name })) }]}
            />
          </Field>
          <Field label="角色">
            <Select
              value={drawer.roleId}
              onChange={(v) => setDrawer({ ...drawer, roleId: v })}
              error={errs.roleId}
              placeholder="请选择"
              groups={[{ options: state.roles.map((r) => ({ value: r.id, label: r.name })) }]}
            />
          </Field>
          <Field label="负责的事件">
            <MultiSelect
              groups={eventGroups}
              value={drawer.refs}
              onChange={(v) => setDrawer({ ...drawer, refs: v })}
              error={errs.refs}
            />
          </Field>
          <Field label="负责的行政区">
            <MultiSelect
              groups={[{ options: DISTRICTS.map((d) => ({ value: d, label: d })) }]}
              value={drawer.areas}
              onChange={(v) => setDrawer({ ...drawer, areas: v })}
              error={errs.areas}
            />
          </Field>
        </Drawer>
      )}
    </>
  )
}

/* ══════════ 角色 ══════════ */

interface RoleDraft {
  id: string | null
  name: string
  dashboard: boolean
  live: boolean
  archive: boolean
  stats: boolean
  workbench: boolean
  config: boolean
  configPages: string[]
  liveTabs: string[]
  opsByTab: Record<string, string[]>
}

export function RolePage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<RoleDraft | null>(null)
  const [nameErr, setNameErr] = useState(false)
  const [query, setQuery] = useState("")

  const kw = query.trim().toLowerCase()
  const list = kw
    ? state.roles.filter((r) =>
        [r.name, roleFeatureText(r), roleOpsText(r)].join("\n").toLowerCase().includes(kw),
      )
    : state.roles

  const openAdd = () => {
    setNameErr(false)
    setDrawer({
      id: null, name: "",
      dashboard: false, live: false, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: [], opsByTab: {},
    })
  }

  const openEdit = (r: RoleDef) => {
    setNameErr(false)
    setDrawer({
      id: r.id, name: r.name,
      dashboard: r.dashboard, live: r.live, archive: r.archive, stats: r.stats, workbench: r.workbench, config: r.config,
      configPages: [...r.configPages],
      liveTabs: [...r.liveTabs],
      opsByTab: Object.fromEntries(Object.entries(r.opsByTab).map(([k, v]) => [k, [...v]])),
    })
  }

  const save = () => {
    if (!drawer) return
    const nErr = !drawer.name.trim()
    setNameErr(nErr)
    if (nErr) return
    const opsByTab: Record<string, string[]> = {}
    if (drawer.live) {
      for (const tab of drawer.liveTabs) {
        const ops = drawer.opsByTab[tab]
        if (ops && ops.length > 0) opsByTab[tab] = ops
      }
    }
    dispatch({
      type: "role/save",
      role: {
        id: drawer.id ?? uid("r"),
        name: drawer.name.trim(),
        dashboard: drawer.dashboard,
        live: drawer.live,
        archive: drawer.archive,
        stats: drawer.stats,
        workbench: drawer.workbench,
        config: drawer.config,
        configPages: drawer.config ? drawer.configPages : [],
        liveTabs: drawer.live ? drawer.liveTabs : [],
        opsByTab,
      },
    })
    saved()
    setDrawer(null)
  }

  return (
    <>
      <Toolbar>
        <div style={{ marginRight: "auto" }}>
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <AddButton onClick={openAdd}>新增角色</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={720}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 150 }}>角色</th>
              <th style={thStyle}>功能权限</th>
              <th style={thStyle}>操作权限</th>
              <th style={{ ...thStyle, width: 150 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, color: "var(--text-sub)" }}>{roleFeatureText(r)}</td>
                <td style={{ ...tdStyle, color: "var(--text-sub)" }}>{roleOpsText(r)}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <RowBtn onClick={() => openEdit(r)}>编辑</RowBtn>
                    <RowBtn
                      danger
                      disabled={state.posts.some((p) => p.roleId === r.id)}
                      onClick={() => dispatch({ type: "role/delete", id: r.id })}
                    >
                      删除
                    </RowBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      {drawer && (
        <Drawer title={drawer.id ? "编辑角色" : "新增角色"} onClose={() => setDrawer(null)} onSave={save}>
          <Field label="角色">
            <TextInput value={drawer.name} onChange={(v) => setDrawer({ ...drawer, name: v })} error={nameErr} />
          </Field>
          <Field label="功能权限">
            <div style={gridBox(3)}>
              {FEATURES.map((f) => (
                <Check
                  key={f.key}
                  label={f.name}
                  checked={drawer[f.key]}
                  onChange={(v) => setDrawer({ ...drawer, [f.key]: v })}
                />
              ))}
            </div>
          </Field>
          {drawer.config && (
            <Field label="治理配置">
              <div style={gridBox(3)}>
                {CONFIG_PAGES.map((p) => (
                  <Check
                    key={p.id}
                    label={p.name}
                    checked={drawer.configPages.includes(p.id)}
                    onChange={(v) =>
                      setDrawer({
                        ...drawer,
                        configPages: v ? [...drawer.configPages, p.id] : drawer.configPages.filter((x) => x !== p.id),
                      })
                    }
                  />
                ))}
              </div>
            </Field>
          )}
          {drawer.live && (
            <>
              <Field label="AI实时治理">
                <div style={gridBox(4)}>
                  {LIVE_TABS.map((t) => (
                    <Check
                      key={t.id}
                      label={t.name}
                      checked={drawer.liveTabs.includes(t.id)}
                      onChange={(v) =>
                        setDrawer({
                          ...drawer,
                          liveTabs: v ? [...drawer.liveTabs, t.id] : drawer.liveTabs.filter((x) => x !== t.id),
                          opsByTab: v
                            ? { ...drawer.opsByTab, [t.id]: drawer.opsByTab[t.id] ?? [] }
                            : Object.fromEntries(Object.entries(drawer.opsByTab).filter(([k]) => k !== t.id)),
                        })
                      }
                    />
                  ))}
                </div>
              </Field>
              {LIVE_TABS.filter((t) => drawer.liveTabs.includes(t.id) && (LIVE_TAB_OPS[t.id] ?? []).length > 0).map(
                (t) => (
                  <Field key={t.id} label={`操作权限 · ${t.name}`}>
                    <div style={gridBox(3)}>
                      {LIVE_TAB_OPS[t.id].map((op) => (
                        <Check
                          key={op}
                          label={op}
                          checked={(drawer.opsByTab[t.id] ?? []).includes(op)}
                          onChange={(v) =>
                            setDrawer({
                              ...drawer,
                              opsByTab: {
                                ...drawer.opsByTab,
                                [t.id]: v
                                  ? [...(drawer.opsByTab[t.id] ?? []), op]
                                  : (drawer.opsByTab[t.id] ?? []).filter((x) => x !== op),
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  </Field>
                ),
              )}
            </>
          )}
        </Drawer>
      )}
    </>
  )
}

/* ══════════ 账号 ══════════ */

interface AccountDraft {
  id: string | null
  name: string
  phone: string
  orgId: string
  postId: string
}

export function AccountPage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<AccountDraft | null>(null)
  const [errs, setErrs] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")

  const kw = query.trim().toLowerCase()
  const list = kw
    ? state.accounts.filter((a) =>
        [a.name, a.phone, orgName(state, a.orgId), postName(state, a.postId), a.status]
          .join("\n")
          .toLowerCase()
          .includes(kw),
      )
    : state.accounts

  const openAdd = () => {
    setErrs({})
    setDrawer({ id: null, name: "", phone: "", orgId: "", postId: "" })
  }

  const openEdit = (a: Account) => {
    setErrs({})
    setDrawer({ id: a.id, name: a.name, phone: a.phone, orgId: a.orgId, postId: a.postId })
  }

  const save = () => {
    if (!drawer) return
    const phone = drawer.phone.trim()
    const post = state.posts.find((p) => p.id === drawer.postId)
    const mismatch = !!post && !!drawer.orgId && post.orgId !== drawer.orgId
    const e: Record<string, boolean> = {
      name: !drawer.name.trim(),
      phone: !/^\d{11}$/.test(phone) || state.accounts.some((a) => a.id !== drawer.id && a.phone === phone),
      orgId: !drawer.orgId || mismatch,
      postId: !drawer.postId || mismatch,
    }
    setErrs(e)
    if (Object.values(e).some(Boolean)) return
    dispatch({
      type: "account/save",
      account: {
        id: drawer.id ?? uid("a"),
        name: drawer.name.trim(),
        phone,
        orgId: drawer.orgId,
        postId: drawer.postId,
        status: "启用",
      },
    })
    saved()
    setDrawer(null)
  }

  return (
    <>
      <Toolbar>
        <div style={{ marginRight: "auto" }}>
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <AddButton onClick={openAdd}>新增账号</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={760}>
          <thead>
            <tr>
              <th style={thStyle}>姓名</th>
              <th style={thStyle}>手机号</th>
              <th style={thStyle}>组织</th>
              <th style={thStyle}>岗位</th>
              <th style={thStyle}>状态</th>
              <th style={{ ...thStyle, width: 190 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td style={tdStyle}>{a.name}</td>
                <td style={tdStyle}>{a.phone}</td>
                <td style={tdStyle}>{orgName(state, a.orgId)}</td>
                <td style={tdStyle}>{postName(state, a.postId)}</td>
                <td
                  style={{
                    ...tdStyle,
                    color: a.status === "启用" ? "var(--green)" : "var(--text-sub)",
                  }}
                >
                  {a.status}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <RowBtn onClick={() => openEdit(a)}>编辑</RowBtn>
                    <RowBtn danger={a.status === "启用"} onClick={() => dispatch({ type: "account/toggle", id: a.id })}>
                      {a.status === "启用" ? "停用" : "启用"}
                    </RowBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Panel>

      {drawer && (
        <Drawer title={drawer.id ? "编辑账号" : "新增账号"} onClose={() => setDrawer(null)} onSave={save}>
          <Field label="姓名">
            <TextInput value={drawer.name} onChange={(v) => setDrawer({ ...drawer, name: v })} error={errs.name} />
          </Field>
          <Field label="手机号">
            <TextInput value={drawer.phone} onChange={(v) => setDrawer({ ...drawer, phone: v })} error={errs.phone} />
          </Field>
          <Field label="组织">
            <Select
              value={drawer.orgId}
              onChange={(v) => setDrawer({ ...drawer, orgId: v })}
              error={errs.orgId}
              placeholder="请选择"
              groups={[{ options: state.orgs.map((o) => ({ value: o.id, label: o.name })) }]}
            />
          </Field>
          <Field label="岗位">
            <Select
              value={drawer.postId}
              onChange={(v) => setDrawer({ ...drawer, postId: v })}
              error={errs.postId}
              placeholder="请选择"
              groups={[
                {
                  options: state.posts.map((p) => ({
                    value: p.id,
                    label: `${p.name}（${orgName(state, p.orgId)}）`,
                  })),
                },
              ]}
            />
          </Field>
        </Drawer>
      )}
    </>
  )
}

function postName(state: ReturnType<typeof useConfig>["state"], postId: string): string {
  return state.posts.find((p) => p.id === postId)?.name ?? "—"
}
