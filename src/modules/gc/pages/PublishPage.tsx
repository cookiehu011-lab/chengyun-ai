// 变更记录 · 原生版
// 产品规则：所有配置「编辑 → 保存即生效」；每次保存由各页面写入一条留痕（时间、操作人、配置模块、变更内容）。
// 本页只读展示留痕列表，支持关键词搜索筛选。
import { useMemo, useState } from "react"
import { useGc } from "../store"
import { S } from "../engine"

export function PublishPage() {
  const { state } = useGc()
  const [query, setQuery] = useState("")

  // 关键词搜索：命中时间 / 操作人 / 配置模块 / 变更内容任意一列即保留
  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return state.audit
    return state.audit.filter(
      (a) =>
        a.date.includes(q) ||
        a.author.includes(q) ||
        a.modules.some((m) => m.includes(q)) ||
        a.note.includes(q),
    )
  }, [state.audit, query])

  return (
    <section style={S.card} aria-label="变更记录">
      <header style={S.cardHead}>
        <h3 style={S.cardTitle}>变更记录</h3>
        <span style={S.cardNote}>所有配置保存后自动留痕：时间、操作人、配置模块与变更内容</span>
      </header>
      <div style={S.toolbar}>
        <input
          style={S.search}
          value={query}
          placeholder="搜索时间、操作人、配置模块或变更内容"
          onChange={(e) => setQuery(e.target.value)}
        />
        <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--muted-foreground)" }}>
          共 {filtered.length} 条
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: "150px" }}>时间</th>
              <th style={{ ...S.th, width: "160px" }}>操作人</th>
              <th style={{ ...S.th, width: "180px" }}>配置模块</th>
              <th style={S.th}>变更内容</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} style={S.empty}>
                  {query ? "没有匹配的记录，换个关键词试试" : "暂无变更记录；保存任意配置后会自动生成"}
                </td>
              </tr>
            )}
            {filtered.map((a, i) => (
              <tr key={`${a.date}-${i}`}>
                <td style={{ ...S.td, whiteSpace: "nowrap", color: "var(--muted-foreground)" }}>{a.date}</td>
                <td style={S.td}>{a.author}</td>
                <td style={S.td}>{a.modules.join("、")}</td>
                <td style={S.td}>{a.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
