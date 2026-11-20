// V2.0 治理配置：派发去向的规则匹配
// 优先级（不展示在页面上，仅用于匹配）：
//   1. 来源必须与规则相等
//   2. 事件类型：规则「不限」，或所选小类落在规则的分类/大类/小类之下
//   3. 行政区：规则「不限」/「东城区」，或等于所选街道
//   4. 具体度：小类 > 大类 > 分类 > 不限；行政区：街道 > 东城区 > 不限
//   5. 两条一样具体 → 办理路径写「规则重复」，组织/落到岗位写「—」
//   6. 无命中 → 大循环 / 待人工派发 / 受理岗

import type { ConfigState, EventRef, Rule, StdRow } from "./model"

export interface RouteResult {
  path: string
  org: string
  post: string
}

function eventScore(r: EventRef): number {
  switch (r.level) {
    case "minor":
      return 3
    case "major":
      return 2
    case "category":
      return 1
    default:
      return 0
  }
}

function areaScore(area: string): number {
  if (area === "不限") return 0
  if (area === "东城区") return 1
  return 2
}

function eventCoversRule(ref: EventRef, row: StdRow): boolean {
  switch (ref.level) {
    case "none":
      return true
    case "minor":
      return ref.value === row.minor
    case "major":
      return ref.value === row.major
    case "category":
      return ref.value === row.category
    default:
      return false
  }
}

/** 岗位负责的事件是否覆盖该小类（含全部事件/大类/分类） */
function postEventsCover(refs: EventRef[], row: StdRow): boolean {
  return refs.some(
    (ref) =>
      ref.level === "all" ||
      (ref.level === "minor" && ref.value === row.minor) ||
      (ref.level === "major" && ref.value === row.major) ||
      (ref.level === "category" && ref.value === row.category),
  )
}

/** 岗位的角色在 AI实时治理 下是否有「认领」：看的是待处置二级下的认领 */
function roleHasClaim(state: ConfigState, roleId: string): boolean {
  const role = state.roles.find((r) => r.id === roleId)
  return !!role && role.live && (role.opsByTab["dispose"] ?? []).includes("认领")
}

/** 组织下落到哪个岗位：事件覆盖 + 行政区覆盖（含东城区）+ 角色可认领 */
function pickPost(state: ConfigState, orgId: string, row: StdRow, street: string): string | null {
  const post = state.posts.find(
    (p) =>
      p.orgId === orgId &&
      postEventsCover(p.events, row) &&
      (p.areas.includes(street) || p.areas.includes("东城区")) &&
      roleHasClaim(state, p.roleId),
  )
  return post ? post.name : null
}

function noMatch(state: ConfigState): RouteResult {
  return {
    path: "大循环",
    org: "待人工派发",
    post: state.posts.find((p) => p.name === "受理岗")?.name ?? "—",
  }
}

export function computeRoute(state: ConfigState, source: string, minor: string, street: string): RouteResult {
  const row = state.std.find((s) => s.minor === minor && s.status === "启用")
  if (!row) return noMatch(state)

  const candidates = state.rules.filter(
    (r) =>
      r.source === source &&
      eventCoversRule(r.event, row) &&
      (r.area === "不限" || r.area === "东城区" || r.area === street),
  )
  if (candidates.length === 0) return noMatch(state)

  let bestScore = -1
  for (const r of candidates) {
    const score = eventScore(r.event) * 10 + areaScore(r.area)
    if (score > bestScore) bestScore = score
  }
  const best = candidates.filter((r) => eventScore(r.event) * 10 + areaScore(r.area) === bestScore)
  if (best.length > 1) {
    return { path: "规则重复", org: "—", post: "—" }
  }

  const rule = best[0]
  const org = rule.org === "manual" ? "待人工派发" : (state.orgs.find((o) => o.id === rule.org)?.name ?? "—")
  const post =
    rule.org === "manual"
      ? (state.posts.find((p) => p.name === "受理岗")?.name ?? "—")
      : (pickPost(state, rule.org, row, street) ?? "—")
  return { path: rule.path, org, post }
}

/** 规则的事件类型是否覆盖某个启用小类（去向默认列表按所选小类过滤用） */
export function ruleCoversMinor(state: ConfigState, rule: Rule, minor: string): boolean {
  const row = state.std.find((s) => s.minor === minor && s.status === "启用")
  return !!row && eventCoversRule(rule.event, row)
}

/** 去向默认列表：单条规则落到哪个岗位 */
export function rulePost(state: ConfigState, rule: Rule): string {
  if (rule.org === "manual") return state.posts.find((p) => p.name === "受理岗")?.name ?? "—"
  const rows = state.std.filter((s) => s.status === "启用" && eventCoversRule(rule.event, s))
  for (const row of rows) {
    const post = pickPost(state, rule.org, row, rule.area)
    if (post) return post
  }
  return "—"
}

/** 规则表查重：来源+事件类型+行政区 完全相同的行（组织列写「重复」） */
export function duplicateRuleIds(state: ConfigState): Set<string> {
  const groups = new Map<string, string[]>()
  for (const r of state.rules) {
    const eventKey = r.event.level === "none" ? "none" : `${r.event.level}:${r.event.value}`
    const key = `${r.source}|${eventKey}|${r.area}`
    const arr = groups.get(key)
    if (arr) arr.push(r.id)
    else groups.set(key, [r.id])
  }
  const dup = new Set<string>()
  for (const ids of groups.values()) {
    if (ids.length > 1) for (const id of ids) dup.add(id)
  }
  return dup
}
