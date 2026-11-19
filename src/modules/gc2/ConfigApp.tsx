// V2.0 治理配置：外壳 —— 左侧菜单（四个一级）+ 主区页面
// 一级：组织机构 / 派发规则 / 办理时限 / 事件标准（无二级，点击直接进入）
// 点开一级，再点二级，才进入页面；页面只有标题与表格，没有说明。
import { useState } from "react"
import type { ReactNode } from "react"
import { AccountPage, OrgPage, PostPage, RolePage } from "./pagesOrg"
import { RoutePage, RulePage } from "./pagesRule"
import { ClaimPage, EventStdPage, SlaPage } from "./pagesMisc"
import { ConfigProvider } from "./store"

type PageId =
  | "org" | "post" | "role" | "account"
  | "rule" | "route"
  | "sla" | "claim"
  | "std"

interface GroupDef {
  id: string
  name: string
  children: { id: PageId; name: string }[]
}

const GROUPS: GroupDef[] = [
  {
    id: "g-org",
    name: "组织机构",
    children: [
      { id: "org", name: "组织" },
      { id: "post", name: "岗位" },
      { id: "role", name: "角色" },
      { id: "account", name: "账号" },
    ],
  },
  {
    id: "g-rule",
    name: "派发规则",
    children: [
      { id: "rule", name: "规则" },
      { id: "route", name: "去向" },
    ],
  },
  {
    id: "g-sla",
    name: "办理时限",
    children: [
      { id: "sla", name: "时限" },
      { id: "claim", name: "领取" },
    ],
  },
]

const STD_ITEM = { id: "std" as PageId, name: "事件标准" }

const PAGE_NAMES: Record<PageId, string> = Object.fromEntries([
  ...GROUPS.flatMap((g) => g.children.map((c) => [c.id, c.name])),
  [STD_ITEM.id, STD_ITEM.name],
]) as Record<PageId, string>

function PageBody({ page }: { page: PageId }) {
  switch (page) {
    case "org": return <OrgPage />
    case "post": return <PostPage />
    case "role": return <RolePage />
    case "account": return <AccountPage />
    case "rule": return <RulePage />
    case "route": return <RoutePage />
    case "sla": return <SlaPage />
    case "claim": return <ClaimPage />
    case "std": return <EventStdPage />
  }
}

function Sidebar(props: {
  page: PageId
  onNavigate: (id: PageId) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "g-org": true })

  const groupHeader = (g: GroupDef): ReactNode => {
    const open = !!expanded[g.id]
    const activeInside = g.children.some((c) => c.id === props.page)
    return (
      <button
        key={g.id}
        type="button"
        onClick={() => setExpanded((m) => ({ ...m, [g.id]: !open }))}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "9px 14px",
          fontSize: 12.5,
          fontWeight: activeInside ? 600 : 500,
          color: activeInside ? "var(--sidebar-active-text)" : "var(--sidebar-muted)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {g.name}
        <span
          style={{
            fontSize: 9,
            color: "var(--sidebar-muted)",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        >
          ▶
        </span>
      </button>
    )
  }

  const subItem = (c: { id: PageId; name: string }): ReactNode => {
    const active = props.page === c.id
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => props.onNavigate(c.id)}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 14px 8px 28px",
          fontSize: 13,
          color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
          background: active ? "var(--sidebar-active-bg)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontWeight: active ? 600 : 400,
        }}
      >
        {c.name}
      </button>
    )
  }

  return (
    <div
      style={{
        width: 232,
        flexShrink: 0,
        height: "100%",
        overflowY: "auto",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        padding: "14px 8px",
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--sidebar-text)",
          padding: "4px 14px 14px",
        }}
      >
        治理配置
      </div>
      {GROUPS.map((g) => (
        <div key={g.id}>
          {groupHeader(g)}
          {expanded[g.id] && g.children.map(subItem)}
        </div>
      ))}
      <div style={{ borderTop: "1px solid var(--sidebar-border)", margin: "8px 6px" }} />
      {subItem(STD_ITEM)}
    </div>
  )
}

function Shell() {
  const [page, setPage] = useState<PageId>("org")
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <Sidebar
        page={page}
        onNavigate={(id) => {
          setPage(id)
        }}
      />
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "18px 22px 28px" }}>
        <h1
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--foreground)",
            margin: "0 0 14px",
          }}
        >
          {PAGE_NAMES[page]}
        </h1>
        <PageBody page={page} />
      </div>
    </div>
  )
}

export default function ConfigApp() {
  return (
    <ConfigProvider>
      <Shell />
    </ConfigProvider>
  )
}
