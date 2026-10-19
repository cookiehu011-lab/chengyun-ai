import { useState } from "react"
import { assetUrl } from "../assetUrl"

const kpiData = [
  {
    label: "存续事件",
    value: "247",
    unit: "件",
    trend: "+12",
    trendUp: true,
    color: "#3B82F6",
  },
  {
    label: "今日闭环",
    value: "83",
    unit: "件",
    trend: "+7",
    trendUp: true,
    color: "#10B981",
  },
  {
    label: "严重事件",
    value: "14",
    unit: "件",
    trend: "+3",
    trendUp: false,
    color: "#EF4444",
  },
  {
    label: "平均处置时长",
    value: "2.4",
    unit: "小时",
    trend: "-0.3h",
    trendUp: true,
    color: "#F59E0B",
  },
]

const lifecycleData = [
  { label: "待立案", count: 38, color: "#3B82F6", risk: "2件临近超时" },
  { label: "待处置", count: 94, color: "#F59E0B", risk: "11件超时" },
  { label: "待核查", count: 67, color: "#8B5CF6", risk: "5件待外场核查" },
  { label: "待作废审核", count: 12, color: "#F97316", risk: "" },
  { label: "已结案(今)", value: 71, count: 71, color: "#10B981", risk: "" },
  { label: "已中止(今)", count: 7, color: "#6B7280", risk: "" },
  { label: "已无效(今)", count: 5, color: "#EF4444", risk: "" },
]

const topGrids = [
  { name: "朝阳门南小街网格", count: 23, trend: "+5" },
  { name: "东直门内大街网格", count: 19, trend: "+2" },
  { name: "建国门内大街网格", count: 16, trend: "-1" },
  { name: "北新桥三条网格", count: 14, trend: "+3" },
  { name: "东四十条网格", count: 11, trend: "0" },
]

const aiAttentionEvents = [
  {
    id: "DC-2026-08201",
    type: "违规占道施工",
    level: "严重",
    location: "朝阳门南小街12号东侧",
    time: "08:23",
    status: "待核查",
    imgUrl: "/placeholders/scene-construction.svg",
    desc: "施工方封闭整条人行道，致使行人借道机动车道，已持续4小时",
    gridName: "朝阳门南小街网格",
  },
  {
    id: "DC-2026-08185",
    type: "大型垃圾堆积",
    level: "严重",
    location: "东直门内大街69号楼后巷",
    time: "07:51",
    status: "待处置",
    imgUrl: "/placeholders/scene-car.svg",
    desc: "装修废料堆满整条小巷，已超时36小时，网格责任人首次处置被退回",
    gridName: "东直门内大街网格",
  },
  {
    id: "DC-2026-08162",
    type: "无证户外广告",
    level: "一般",
    location: "建国门内大街22号楼裙房顶部",
    time: "昨日 22:10",
    status: "待立案",
    imgUrl: "/placeholders/scene-billboard.svg",
    desc: "AI识别到3块超规格广告牌，夜间灯光对周边居民造成影响",
    gridName: "建国门内大街网格",
  },
]

// 部署 base 适配：子路径部署（GitHub Pages）下 public/ 资源需拼接前缀
aiAttentionEvents.forEach((e) => {
  e.imgUrl = assetUrl(e.imgUrl)
})

const districts = [
  { name: "朝阳门街道", x: 62, y: 30, events: 47, level: "high" },
  { name: "东直门街道", x: 75, y: 20, events: 38, level: "medium" },
  { name: "建国门街道", x: 60, y: 50, events: 29, level: "medium" },
  { name: "北新桥街道", x: 45, y: 25, events: 24, level: "low" },
  { name: "东四街道", x: 40, y: 45, events: 31, level: "medium" },
  { name: "龙潭街道", x: 55, y: 68, events: 18, level: "low" },
  { name: "崇外街道", x: 70, y: 65, events: 22, level: "low" },
  { name: "景山街道", x: 28, y: 35, events: 15, level: "low" },
  { name: "交道口街道", x: 38, y: 18, events: 23, level: "low" },
]

const levelColors: Record<string, string> = {
  high: "rgba(239,68,68,0.35)",
  medium: "rgba(245,158,11,0.25)",
  low: "rgba(59,130,246,0.2)",
}

const levelBorderColors: Record<string, string> = {
  high: "rgba(239,68,68,0.8)",
  medium: "rgba(245,158,11,0.6)",
  low: "rgba(59,130,246,0.4)",
}

export default function GovernanceDashboard() {
  const [activeLifecycle, setActiveLifecycle] = useState<string | null>(null)
  const [mapFullscreen, setMapFullscreen] = useState(false)

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--background)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          height: "48px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--card)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: 600, fontSize: "15px" }}>治理大屏</span>
          <span
            style={{
              fontSize: "11px",
              color: "var(--muted-foreground)",
              padding: "2px 6px",
              backgroundColor: "rgba(59,130,246,0.1)",
              borderRadius: "4px",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            东城区全域
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
            数据截至{" "}
            {new Date().toLocaleDateString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
            })}{" "}
            {new Date().toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <button
            style={{
              fontSize: "12px",
              color: "var(--accent)",
              border: "1px solid rgba(6,182,212,0.3)",
              backgroundColor: "rgba(6,182,212,0.08)",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            全屏汇报模式
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          backgroundColor: "var(--border)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {kpiData.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              backgroundColor: "var(--card)",
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              borderTop: "2px solid " + kpi.color,
            }}
          >
            <div
              style={{
                width: "3px",
                height: "36px",
                borderRadius: "2px",
                backgroundColor: kpi.color,
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--muted-foreground)",
                  marginBottom: "2px",
                }}
              >
                {kpi.label}
              </div>
              <div
                style={{ display: "flex", alignItems: "baseline", gap: "4px" }}
              >
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: kpi.color,
                    lineHeight: 1,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {kpi.value}
                </span>
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  {kpi.unit}
                </span>
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontSize: "12px",
                color: kpi.trendUp ? "#10B981" : "#EF4444",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {kpi.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Main 3-column layout */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: mapFullscreen ? "1fr" : "260px 1fr 280px",
          overflow: "hidden",
          minHeight: 0,
          transition: "grid-template-columns 0.25s ease",
        }}
      >
        {/* Left: Lifecycle + Top Grids */}
        {!mapFullscreen && (
          <div
            style={{
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Lifecycle */}
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--muted-foreground)",
                  marginBottom: "10px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                }}
              >
                生命周期脉冲
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                {lifecycleData.map((item) => {
                  const isActive = activeLifecycle === item.label
                  const max = 94
                  const pct = Math.min(
                    100,
                    Math.round((item.count / max) * 100),
                  )
                  return (
                    <button
                      key={item.label}
                      onClick={() =>
                        setActiveLifecycle(isActive ? null : item.label)
                      }
                      className="data-row"
                      style={{
                        background: isActive
                          ? "rgba(59,130,246,0.08)"
                          : undefined,
                        border: isActive
                          ? "1px solid rgba(59,130,246,0.3)"
                          : "1px solid transparent",
                        borderRadius: "5px",
                        padding: "6px 8px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition:
                          "background-color 0.15s, box-shadow 0.15s, border-color 0.15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            color: isActive ? "#3B82F6" : "var(--foreground)",
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: item.color,
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {item.count}
                        </span>
                      </div>
                      <div
                        style={{
                          height: "3px",
                          backgroundColor: "var(--secondary)",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            backgroundColor: item.color,
                            borderRadius: "2px",
                            transition: "width 0.4s",
                          }}
                        />
                      </div>
                      {item.risk && (
                        <div
                          style={{
                            marginTop: "3px",
                            fontSize: "10px",
                            color: "#F59E0B",
                          }}
                        >
                          ⚠ {item.risk}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Top Grids */}
            <div style={{ padding: "14px 16px", flex: 1, overflow: "auto" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--muted-foreground)",
                  marginBottom: "10px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                }}
              >
                高发网格 TOP 5
              </div>
              {topGrids.map((grid, i) => (
                <div
                  key={grid.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "7px 0",
                    borderBottom:
                      i < topGrids.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "4px",
                      flexShrink: 0,
                      backgroundColor:
                        i === 0
                          ? "#EF4444"
                          : i === 1
                            ? "#F59E0B"
                            : "var(--secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: i < 2 ? "#fff" : "var(--muted-foreground)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  >
                    {grid.name}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {grid.count}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: grid.trend.startsWith("+")
                        ? "#EF4444"
                        : grid.trend === "0"
                          ? "var(--muted-foreground)"
                          : "#10B981",
                    }}
                  >
                    {grid.trend}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Center: Map */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            backgroundColor: "#F8FAFC",
          }}
        >
          {/* Map grid overlay */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0.08,
            }}
          >
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Map label */}
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "16px",
              zIndex: 10,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "rgba(14,165,233,0.85)",
                fontWeight: 500,
                letterSpacing: "0.1em",
              }}
            >
              东城区 · 城市治理态势地图
            </div>
            {activeLifecycle && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "10px",
                  color: "#3B82F6",
                  backgroundColor: "rgba(59,130,246,0.15)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: "1px solid rgba(59,130,246,0.3)",
                }}
              >
                当前筛选：{activeLifecycle}
              </div>
            )}
          </div>

          {/* Legend */}
          <div
            style={{
              position: "absolute",
              bottom: "14px",
              left: "16px",
              display: "flex",
              gap: "12px",
              zIndex: 10,
            }}
          >
            {[
              { color: "rgba(239,68,68,0.7)", label: "严重" },
              { color: "rgba(245,158,11,0.6)", label: "较多" },
              { color: "rgba(59,130,246,0.5)", label: "一般" },
            ].map((l) => (
              <div
                key={l.label}
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "2px",
                    backgroundColor: l.color,
                  }}
                />
                <span
                  style={{ fontSize: "10px", color: "var(--muted-foreground)" }}
                >
                  {l.label}
                </span>
              </div>
            ))}
          </div>

          {/* District bubbles */}
          {districts.map((d) => (
            <div
              key={d.name}
              style={{
                position: "absolute",
                left: `${d.x}%`,
                top: `${d.y}%`,
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                zIndex: 5,
              }}
            >
              <div
                style={{
                  width: `${Math.max(50, d.events * 1.5)}px`,
                  height: `${Math.max(40, d.events * 1.2)}px`,
                  borderRadius: "8px",
                  backgroundColor: levelColors[d.level],
                  border: `1px solid ${levelBorderColors[d.level]}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  transition: "all 0.2s",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#fff",
                    fontFamily: "JetBrains Mono, monospace",
                    lineHeight: 1,
                  }}
                >
                  {d.events}
                </span>
              </div>
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "10px",
                  color: "#fff",
                  backgroundColor: "rgba(15,23,42,0.75)",
                  padding: "1px 5px",
                  borderRadius: "3px",
                  whiteSpace: "nowrap",
                }}
              >
                {d.name}
              </div>
            </div>
          ))}

          {/* Map fullscreen toggle */}
          <button
            onClick={() => setMapFullscreen(!mapFullscreen)}
            style={{
              position: "absolute",
              top: "14px",
              right: "16px",
              fontSize: "11px",
              color: mapFullscreen ? "#fff" : "var(--accent)",
              border: mapFullscreen
                ? "1px solid rgba(255,255,255,0.4)"
                : "1px solid rgba(59,130,246,0.3)",
              backgroundColor: mapFullscreen
                ? "rgba(15,23,42,0.6)"
                : "rgba(59,130,246,0.1)",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              zIndex: 20,
              backdropFilter: "blur(4px)",
            }}
          >
            {mapFullscreen ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                退出全屏
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                地图全屏
              </>
            )}
          </button>
        </div>

        {/* Right: AI Current Attention */}
        {!mapFullscreen && (
          <div
            style={{
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "var(--accent)",
                  display: "block",
                }}
                className="pulse-dot"
              />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                AI 当前关注
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "10px",
                  color: "var(--muted-foreground)",
                }}
              >
                严重事件 · 3件
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
              {aiAttentionEvents.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    marginBottom: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    backgroundColor: "var(--card)",
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    boxShadow:
                      "0 0 20px rgba(14,165,233,0.08), inset 0 1px 0 rgba(14,165,233,0.1)",
                  }}
                >
                  {/* Image */}
                  <div
                    style={{
                      height: "130px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={evt.imgUrl}
                      alt={evt.type}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 50%)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        right: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                      }}
                    >
                      <span
                        style={{
                          backgroundColor:
                            evt.level === "严重"
                              ? "rgba(239,68,68,0.9)"
                              : "rgba(245,158,11,0.9)",
                          color: "#fff",
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "3px",
                        }}
                      >
                        {evt.level}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {evt.time}
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: "10px 10px 8px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--foreground)",
                        }}
                      >
                        {evt.type}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#8B5CF6",
                          backgroundColor: "rgba(139,92,246,0.12)",
                          padding: "1px 6px",
                          borderRadius: "3px",
                          border: "1px solid rgba(139,92,246,0.25)",
                        }}
                      >
                        {evt.status}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--muted-foreground)",
                        marginBottom: "5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {evt.location}
                    </div>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--secondary-foreground)",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {evt.desc}
                    </p>
                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "10px",
                        color: "var(--muted-foreground)",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      #{evt.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
