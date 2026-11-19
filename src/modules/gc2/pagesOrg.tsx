// V2.0 治理配置：组织机构四页 —— 组织（树）、岗位、角色、账号
import { useMemo, useState } from "react"
import type { Account, EventRef, OrgNode, Post, RoleDef } from "./model"
import {
  CONFIG_PAGES,
  DISTRICTS,
  FEATURES,
  LIVE_OPS,
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
  Select,
  TextInput,
  Toolbar,
  tdStyle,
  thStyle,
} from "./ui"

/* ══════════ 组织（树） ══════════ */

export function OrgPage() {
  const { state, dispatch, saved } = useConfig()
  const [selected, setSelected] = useState<string | null>(null)
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

  const rows = useMemo(() => {
    const out: { node: OrgNode; depth: number }[] = []
    const walk = (parent: string | null, depth: number) => {
      for (const node of childrenOf.get(parent) ?? []) {
        out.push({ node, depth })
        walk(node.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [childrenOf])

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

  return (
    <>
      <Toolbar>
        <AddButton onClick={openAdd} disabled={!selectedNode}>
          新增
        </AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={560}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: "42%" }}>名称</th>
              <th style={thStyle}>类型</th>
              <th style={thStyle}>上级</th>
              <th style={{ ...thStyle, width: 150 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ node, depth }) => {
              const hasChildren = (childrenOf.get(node.id)?.length ?? 0) > 0
              return (
                <tr
                  key={node.id}
                  onClick={() => setSelected(node.id)}
                  style={{
                    cursor: "pointer",
                    background: selected === node.id ? "var(--primary-light)" : undefined,
                  }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: depth * 20 + 4 }}>
                      <span style={{ color: "var(--muted-foreground)", fontSize: 10, width: 10 }}>
                        {hasChildren ? "▾" : ""}
                      </span>
                      {node.name}
                    </div>
                  </td>
                  <td style={tdStyle}>{node.type}</td>
                  <td style={tdStyle}>{node.parentId ? orgName(state, node.parentId) : "—"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <RowBtn onClick={() => openEdit(node)}>编辑</RowBtn>
                      <RowBtn danger disabled={!deletable(node)} onClick={() => dispatch({ type: "org/delete", id: node.id })}>
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
        <AddButton onClick={openAdd}>新增岗位</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={860}>
          <thead>
            <tr>
              <th style={thStyle}>岗位</th>
              <th style={thStyle}>组织</th>
              <th style={thStyle}>角色</th>
              <th style={thStyle}>负责的事件</th>
              <th style={thStyle}>负责的行政区</th>
              <th style={{ ...thStyle, width: 150 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.posts.map((p) => (
              <tr key={p.id}>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{orgName(state, p.orgId)}</td>
                <td style={tdStyle}>{roleName(state, p.roleId)}</td>
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
  ops: string[]
}

export function RolePage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<RoleDraft | null>(null)
  const [nameErr, setNameErr] = useState(false)

  const openAdd = () => {
    setNameErr(false)
    setDrawer({
      id: null, name: "",
      dashboard: false, live: false, archive: false, stats: false, workbench: false, config: false,
      configPages: [], liveTabs: [], ops: [],
    })
  }

  const openEdit = (r: RoleDef) => {
    setNameErr(false)
    setDrawer({
      id: r.id, name: r.name,
      dashboard: r.dashboard, live: r.live, archive: r.archive, stats: r.stats, workbench: r.workbench, config: r.config,
      configPages: [...r.configPages], liveTabs: [...r.liveTabs], ops: [...r.ops],
    })
  }

  const save = () => {
    if (!drawer) return
    const nErr = !drawer.name.trim()
    setNameErr(nErr)
    if (nErr) return
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
        ops: drawer.live ? drawer.ops : [],
      },
    })
    saved()
    setDrawer(null)
  }

  return (
    <>
      <Toolbar>
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
            {state.roles.map((r) => (
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "10px 8px",
                padding: "12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px 8px",
                  padding: "12px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              >
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "10px 8px",
                    padding: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                  }}
                >
                  {LIVE_TABS.map((t) => (
                    <Check
                      key={t.id}
                      label={t.name}
                      checked={drawer.liveTabs.includes(t.id)}
                      onChange={(v) =>
                        setDrawer({
                          ...drawer,
                          liveTabs: v ? [...drawer.liveTabs, t.id] : drawer.liveTabs.filter((x) => x !== t.id),
                        })
                      }
                    />
                  ))}
                </div>
              </Field>
              <Field label="操作权限">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "10px 8px",
                    padding: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                  }}
                >
                  {LIVE_OPS.map((op) => (
                    <Check
                      key={op}
                      label={op}
                      checked={drawer.ops.includes(op)}
                      onChange={(v) =>
                        setDrawer({ ...drawer, ops: v ? [...drawer.ops, op] : drawer.ops.filter((x) => x !== op) })
                      }
                    />
                  ))}
                </div>
              </Field>
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
  login: string
  orgId: string
  postId: string
}

export function AccountPage() {
  const { state, dispatch, saved } = useConfig()
  const [drawer, setDrawer] = useState<AccountDraft | null>(null)
  const [errs, setErrs] = useState<Record<string, boolean>>({})

  const openAdd = () => {
    setErrs({})
    setDrawer({ id: null, name: "", login: "", orgId: "", postId: "" })
  }

  const openEdit = (a: Account) => {
    setErrs({})
    setDrawer({ id: a.id, name: a.name, login: a.login, orgId: a.orgId, postId: a.postId })
  }

  const save = () => {
    if (!drawer) return
    const post = state.posts.find((p) => p.id === drawer.postId)
    const mismatch = !!post && !!drawer.orgId && post.orgId !== drawer.orgId
    const e: Record<string, boolean> = {
      name: !drawer.name.trim(),
      login: !drawer.login.trim(),
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
        login: drawer.login.trim(),
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
        <AddButton onClick={openAdd}>新增账号</AddButton>
      </Toolbar>
      <Panel>
        <DataTable minWidth={760}>
          <thead>
            <tr>
              <th style={thStyle}>姓名</th>
              <th style={thStyle}>登录账号</th>
              <th style={thStyle}>组织</th>
              <th style={thStyle}>岗位</th>
              <th style={thStyle}>状态</th>
              <th style={{ ...thStyle, width: 190 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.accounts.map((a) => (
              <tr key={a.id}>
                <td style={tdStyle}>{a.name}</td>
                <td style={tdStyle}>{a.login}</td>
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
          <Field label="登录账号">
            <TextInput value={drawer.login} onChange={(v) => setDrawer({ ...drawer, login: v })} error={errs.login} />
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
