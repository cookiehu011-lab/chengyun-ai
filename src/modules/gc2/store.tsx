// V2.0 治理配置：状态容器（含 localStorage 持久化与「已保存」提示）
// 存储键带版本号：与 /v1.3/ 等更早版本互不读写。

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { Account, ClaimRow, ConfigState, OrgNode, Post, RoleDef, Rule, Sla, StdRow } from "./model"
import { seedState } from "./model"

const STORAGE_KEY = "gc-config-v2.0"
const SEED_REV = 2

export type ConfigAction =
  | { type: "org/add"; node: OrgNode }
  | { type: "org/rename"; id: string; name: string }
  | { type: "org/delete"; id: string }
  | { type: "post/save"; post: Post }
  | { type: "post/delete"; id: string }
  | { type: "role/save"; role: RoleDef }
  | { type: "role/delete"; id: string }
  | { type: "account/save"; account: Account }
  | { type: "account/toggle"; id: string }
  | { type: "rule/save"; rule: Rule }
  | { type: "rule/delete"; id: string }
  | { type: "sla/save"; sla: Sla }
  | { type: "claim/set"; id: ClaimRow["id"]; count: number }
  | { type: "std/save"; row: StdRow }
  | { type: "std/toggle"; id: string }

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...list, item]
  return list.map((x) => (x.id === item.id ? item : x))
}

function reducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case "org/add":
      return { ...state, orgs: [...state.orgs, action.node] }
    case "org/rename":
      return { ...state, orgs: state.orgs.map((o) => (o.id === action.id ? { ...o, name: action.name } : o)) }
    case "org/delete":
      return { ...state, orgs: state.orgs.filter((o) => o.id !== action.id) }
    case "post/save":
      return { ...state, posts: upsert(state.posts, action.post) }
    case "post/delete":
      return { ...state, posts: state.posts.filter((p) => p.id !== action.id) }
    case "role/save":
      return { ...state, roles: upsert(state.roles, action.role) }
    case "role/delete":
      return { ...state, roles: state.roles.filter((r) => r.id !== action.id) }
    case "account/save":
      return { ...state, accounts: upsert(state.accounts, action.account) }
    case "account/toggle":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.id ? { ...a, status: a.status === "启用" ? "停用" : "启用" } : a,
        ),
      }
    case "rule/save":
      return { ...state, rules: upsert(state.rules, action.rule) }
    case "rule/delete":
      return { ...state, rules: state.rules.filter((r) => r.id !== action.id) }
    case "sla/save":
      return { ...state, slas: upsert(state.slas, action.sla) }
    case "claim/set":
      return {
        ...state,
        claim: state.claim.map((c) => (c.id === action.id ? { ...c, count: action.count } : c)),
      }
    case "std/save":
      return { ...state, std: upsert(state.std, action.row) }
    case "std/toggle": {
      const row = state.std.find((s) => s.id === action.id)
      if (!row) return state
      const stopping = row.status === "启用"
      return {
        ...state,
        std: state.std.map((s) =>
          s.id === action.id ? { ...s, status: stopping ? "停用" : "启用" } : s,
        ),
        // 停用的小类从时限里去掉
        slas: stopping
          ? state.slas.map((s) => ({
              ...s,
              events: s.events.filter((e) => !(e.level === "minor" && e.value === row.minor)),
            }))
          : state.slas,
      }
    }
    default:
      return state
  }
}

function loadState(): ConfigState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ConfigState
      if (parsed && parsed.seedRev === SEED_REV && Array.isArray(parsed.orgs) && Array.isArray(parsed.std)) {
        return parsed
      }
    }
  } catch {
    /* 忽略损坏缓存，回种子 */
  }
  return seedState()
}

interface ConfigContextValue {
  state: ConfigState
  dispatch: (action: ConfigAction) => void
  saved: () => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  useEffect(() => {
    if (!toast) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 1800)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [toast])

  const saved = useCallback(() => setToast("已保存"), [])

  const value = useMemo(() => ({ state, dispatch, saved }), [state, saved])
  return (
    <ConfigContext.Provider value={value}>
      {children}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 80,
            background: "rgba(22, 45, 77, 0.92)",
            color: "#fff",
            fontSize: 13,
            padding: "8px 20px",
            borderRadius: 999,
            boxShadow: "var(--shadow-md)",
          }}
        >
          {toast}
        </div>
      )}
    </ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider")
  return ctx
}
