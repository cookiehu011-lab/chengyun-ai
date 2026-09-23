import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DAYS,
  PREDICT_INDEX,
  TOMORROW_LABEL,
  STREETS,
  TOP_GRIDS,
  streetById,
} from "../data/dongchengMapData"
import type { HeatMetric } from "../data/dongchengMapData"

// 颜色走 CSS 变量：科技皮肤下自动切换深色玻璃（文字/描边/阴影均随皮肤）
const T = {
  bg: "var(--background-soft)",
  card: "var(--card)",
  text: "var(--foreground)",
  textMuted: "var(--muted-foreground)",
  primary: "var(--primary)",
  accent: "var(--accent)",
  border: "var(--border)",
  mono: "JetBrains Mono, monospace",
}

interface AIConclusionProps {
  activeDistrict: string | null
  metric: HeatMetric
  dayIndex: number
  events: AttentionEvent[]
  presentationMode?: boolean
  setPresentationMode?: (v: boolean) => void
  /** 右侧扩展槽：核心指标紧凑条（App 传入，与本卡融合为一行，节省纵向空间） */
  kpiSlot?: ReactNode
}

const levelOrder: Record<string, number> = { 严重: 3, 较重: 2, 一般: 1 }

// Mirror of aiAttentionEvents from App.tsx to compute conclusion text.
// These shapes are kept in sync with the main dashboard data.
interface AttentionEvent {
  id: string
  type: string
  level: string
  location: string
  street: string
  gridId: string
  gridName: string
  date: string
  time: string
  status: string
  imgUrl: string
  desc: string
}

function useTypewriter(text: string, speed = 32) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(timer)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])

  return { displayed, done }
}

function computeConclusion(
  activeDistrict: string | null,
  metric: HeatMetric,
  dayIndex: number,
  events: AttentionEvent[],
): { title: string body: string meta: string } {
  const isPredict = dayIndex >= PREDICT_INDEX
  const selectedDate = isPredict ? TOMORROW_LABEL : DAYS[dayIndex]
  const isCurrent = dayIndex === DAYS.length - 1

  // 明日预测：输出预测结论而非实测统计
  if (isPredict) {
    const scopeLabel = activeDistrict ? activeDistrict : "当前范围内"
    if (metric === "repeat") {
      return {
        title: activeDistrict ? "街道复发预测" : "全域复发预测",
        body: `${scopeLabel}AI预测明日（${TOMORROW_LABEL}）复发热点集中在朝阳门南小街与东直门，建议提前预置巡查与清运力量，观察期专题照常跟踪。`,
        meta: `统计条件：时间粒度 日 | 周期 ${TOMORROW_LABEL}（预测） | 区域 ${activeDistrict ?? "全部"} | 事件类型 复发`,
      }
    }
    // 预测结论：只输出高峰时段 / 高发街道 / 事件类型 / 预置兵力，不预测事件数量
    return {
      title: activeDistrict ? "街道明日预测" : "全域明日预测",
      body: `${scopeLabel}AI预测明日（${TOMORROW_LABEL}）高发时段为 08:00–10:00、17:00–19:00，预计以占道经营、共享单车乱停为主${
        activeDistrict ? "" : "，高发街道集中在朝阳门、东直门、安定门"
      }；建议按预测提前预置巡查与清运力量。`,
      meta: `统计条件：时间粒度 日 | 周期 ${TOMORROW_LABEL}（预测） | 区域 ${
        activeDistrict ?? "全部"
      } | 预测内容 高峰时段·高发街道·事件类型·预置兵力`,
    }
  }

  const filtered = events.filter((e) => {
    if (e.date !== selectedDate) return false
    if (activeDistrict && e.street !== activeDistrict) return false
    return true
  })

  const total = filtered.length

  // Top event types
  const typeCounts = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {})
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => type)

  // Top streets or grids
  const topStreets = !activeDistrict
    ? Object.values(
        filtered.reduce<Record<string, { name: string count: number }>>(
          (acc, e) => {
            if (!acc[e.street]) acc[e.street] = { name: e.street, count: 0 }
            acc[e.street].count += 1
            return acc
          },
          {},
        ),
      )
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map((s) => s.name.replace("街道", ""))
    : []

  const topGrids = activeDistrict
    ? Object.values(
        filtered.reduce<Record<string, { name: string count: number }>>(
          (acc, e) => {
            if (!acc[e.gridName])
              acc[e.gridName] = { name: e.gridName, count: 0 }
            acc[e.gridName].count += 1
            return acc
          },
          {},
        ),
      )
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map((g) => g.name.replace("网格", ""))
    : []

  const dailyAvg = Math.round(total / 14)
  const trendText = metric === "repeat" ? "复发态势平稳" : "趋势波动平稳"
  const peakTime = isCurrent ? `${selectedDate} 8时` : `${selectedDate}`

  const typePhrase =
    topTypes.length > 0
      ? `问题以${topTypes.join("、")}为主`
      : "问题类型分布较散"

  const hotPhrase = activeDistrict
    ? topGrids.length > 0
      ? `热点集中在${topGrids.join("、")}`
      : "热点分布较散"
    : topStreets.length > 0
      ? `热点集中在${topStreets.join("、")}`
      : "热点分布较散"

  const title = activeDistrict ? "街道事件态势诊断" : "全域事件态势诊断"

  const scopeLabel = activeDistrict ? activeDistrict : "当前范围内"

  let body: string
  if (total === 0) {
    body = `${scopeLabel}AI未发现${
      metric === "repeat" ? "复发" : "严重/较重"
    }问题，${trendText}。`
  } else {
    body = `${scopeLabel}AI发现问题${total}件，日均${dailyAvg}件，${trendText}，高发于${peakTime}；${typePhrase}，${hotPhrase}。`
  }

  const meta = `统计条件：时间粒度 日 | 周期 ${selectedDate} | 区域 ${activeDistrict ?? "全部"} | 事件类型 ${
    metric === "severe" ? "发生数量" : "复发"
  }`

  return { title, body, meta }
}

export default function AIConclusion({
  activeDistrict,
  metric,
  dayIndex,
  events,
  presentationMode,
  setPresentationMode,
  kpiSlot,
}: AIConclusionProps) {
  const { title, body, meta } = useMemo(
    () => computeConclusion(activeDistrict, metric, dayIndex, events),
    [activeDistrict, metric, dayIndex, events],
  )

  const { displayed } = useTypewriter(body, 28)

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--glass-border)",
        borderRadius: 14,
        padding: "10px 16px",
        boxShadow: "var(--glass-shadow)",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        rowGap: 6,
        gap: 12,
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)"
        e.currentTarget.style.boxShadow = "var(--glass-shadow-strong)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "var(--glass-shadow)"
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(50,109,255,0.55) 25%, rgba(36,214,210,0.45) 75%, transparent)",
        }}
      />
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background:
            "linear-gradient(135deg, rgba(50,109,255,0.18) 0%, rgba(36,214,210,0.18) 100%)",
          border: "1px solid var(--glass-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 14px rgba(50,109,255,0.15), inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="5" cy="7" r="2" />
          <circle cx="5" cy="17" r="2" />
          <circle cx="12" cy="12" r="2.5" />
          <circle cx="19" cy="7" r="2" />
          <circle cx="19" cy="17" r="2" />
          <path d="M7 8L10 11M7 16L10 13M14 11L17 8M14 13L17 16" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 340 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: T.text,
              letterSpacing: "0.02em",
              flexShrink: 0,
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 10,
              color: T.textMuted,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
              minWidth: 0,
            }}
          >
            {meta}
          </span>
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12.5,
            color: T.text,
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          {displayed}
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: "1.1em",
              background: "linear-gradient(180deg, #326DFF, #24D6D2)",
              marginLeft: 2,
              verticalAlign: "text-bottom",
              animation: "typewriter-cursor 1s steps(1) infinite",
              borderRadius: 1,
            }}
          />
        </div>
      </div>
      {kpiSlot && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            paddingLeft: 14,
            borderLeft: "1px solid var(--row-border)",
          }}
        >
          {kpiSlot}
        </div>
      )}
      {setPresentationMode && (
        <button
          onClick={() => setPresentationMode(!presentationMode)}
          title={presentationMode ? "退出全屏汇报" : "全屏汇报模式"}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            border: "none",
            background: "linear-gradient(135deg, #24D6D2 0%, #4FE3E0 100%)",
            borderRadius: 9,
            cursor: "pointer",
            flexShrink: 0,
            boxShadow: "0 4px 14px rgba(36,214,210,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)"
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(36,214,210,0.45), inset 0 1px 0 rgba(255,255,255,0.3)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(36,214,210,0.35), inset 0 1px 0 rgba(255,255,255,0.25)"
          }}
        >
          {presentationMode ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m3 0v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
