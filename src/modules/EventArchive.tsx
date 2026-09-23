import { useState } from "react"
import { assetUrl } from "../assetUrl"

interface ArchiveEvent {
  id: string
  finalStatus: "已结案" | "已中止" | "已无效"
  type: string
  location: string
  camera: string
  happenTime: string
  endTime: string
  inspector: string
  gridPerson: string
  duration: string
  hasRecurrence: boolean
  imgUrl: string
}

const archiveEvents: ArchiveEvent[] = [
  {
    id: "DC-2026-08155",
    finalStatus: "已结案",
    type: "共享单车违规停放",
    location: "朝阳门南小街地铁口",
    camera: "CAM-CYM-047",
    happenTime: "2026-08-18 14:22",
    endTime: "2026-08-19 09:15",
    inspector: "张晓琳",
    gridPerson: "李建国",
    duration: "18小时53分",
    hasRecurrence: false,
    imgUrl: "/placeholders/scene-generic.svg",
  },
  {
    id: "DC-2026-08147",
    finalStatus: "已结案",
    type: "无证户外广告",
    location: "东直门内大街32号楼南立面",
    camera: "CAM-DZM-014",
    happenTime: "2026-08-17 09:00",
    endTime: "2026-08-18 16:40",
    inspector: "陈明",
    gridPerson: "赵文华",
    duration: "31小时40分",
    hasRecurrence: true,
    imgUrl: "/placeholders/scene-generic.svg",
  },
  {
    id: "DC-2026-08138",
    finalStatus: "已中止",
    type: "违规施工",
    location: "建国门外大街16号在建项目",
    camera: "CAM-JGM-023",
    happenTime: "2026-08-16 07:30",
    endTime: "2026-08-17 11:00",
    inspector: "张晓琳",
    gridPerson: "刘明远",
    duration: "27小时30分",
    hasRecurrence: false,
    imgUrl: "/placeholders/scene-generic.svg",
  },
  {
    id: "DC-2026-08129",
    finalStatus: "已无效",
    type: "乱堆杂物（误报）",
    location: "北新桥三条胡同深处",
    camera: "CAM-BXQ-009",
    happenTime: "2026-08-15 21:18",
    endTime: "2026-08-15 21:45",
    inspector: "陈明",
    gridPerson: "—",
    duration: "27分钟",
    hasRecurrence: false,
    imgUrl: "/placeholders/scene-garbage.svg",
  },
  {
    id: "DC-2026-08121",
    finalStatus: "已结案",
    type: "店外经营占道",
    location: "东四十条甲22号临街餐馆",
    camera: "CAM-DST-031",
    happenTime: "2026-08-15 12:10",
    endTime: "2026-08-15 17:55",
    inspector: "张晓琳",
    gridPerson: "王芳",
    duration: "5小时45分",
    hasRecurrence: true,
    imgUrl: "/placeholders/scene-generic.svg",
  },
  {
    id: "DC-2026-08114",
    finalStatus: "已结案",
    type: "违规停放机动车",
    location: "朝阳门南小街3号楼前",
    camera: "CAM-CYM-047",
    happenTime: "2026-08-14 08:55",
    endTime: "2026-08-14 15:30",
    inspector: "陈明",
    gridPerson: "李建国",
    duration: "6小时35分",
    hasRecurrence: false,
    imgUrl: "/placeholders/scene-generic.svg",
  },
]

// 部署 base 适配：子路径部署（GitHub Pages）下 public/ 资源需拼接前缀
archiveEvents.forEach((e) => {
  e.imgUrl = assetUrl(e.imgUrl)
})

const statusColors: Record<string, string> = {
  已结案: "#35B985",
  已中止: "#6E8197",
  已无效: "#E45E58",
}
const statusBg: Record<string, string> = {
  已结案: "rgba(53,185,133,0.12)",
  已中止: "rgba(110,129,151,0.1)",
  已无效: "rgba(228,94,88,0.08)",
}

function ArchiveDetailPanel({
  event,
  onClose,
}: {
  event: ArchiveEvent
  onClose: () => void
}) {
  const [expandTimeline, setExpandTimeline] = useState(false)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--accent)",
          }}
        >
          #{event.id}
        </span>
        <span
          style={{
            fontSize: "11px",
            padding: "2px 7px",
            borderRadius: "4px",
            backgroundColor: statusBg[event.finalStatus],
            color: statusColors[event.finalStatus],
            border: `1px solid ${statusColors[event.finalStatus]}40`,
          }}
        >
          {event.finalStatus}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button
            style={{
              fontSize: "12px",
              color: "var(--muted-foreground)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ↑
          </button>
          <button
            style={{
              fontSize: "12px",
              color: "var(--muted-foreground)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ↓
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: "16px",
              color: "var(--muted-foreground)",
              background: "none",
              border: "none",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {/* Final verdict */}
        <div
          style={{
            marginBottom: "14px",
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: statusBg[event.finalStatus],
            border: `1px solid ${statusColors[event.finalStatus]}30`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: statusColors[event.finalStatus],
                  marginBottom: "2px",
                }}
              >
                终态结论
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                {event.type} · {event.finalStatus}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{ fontSize: "11px", color: "var(--muted-foreground)" }}
              >
                总处置时长
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {event.duration}
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: "8px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              fontSize: "11px",
            }}
          >
            <div>
              <span style={{ color: "var(--muted-foreground)" }}>核查人：</span>
              {event.inspector}
            </div>
            <div>
              <span style={{ color: "var(--muted-foreground)" }}>
                结案时间：
              </span>
              {event.endTime.split(" ")[1]}
            </div>
          </div>
        </div>

        {/* Key evidence */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "var(--muted-foreground)",
              marginBottom: "8px",
              fontWeight: 500,
            }}
          >
            关键证据
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <div
              style={{
                borderRadius: "6px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <img
                src={event.imgUrl}
                alt="发现图"
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "6px",
                  left: "6px",
                  fontSize: "10px",
                  backgroundColor: "rgba(22,45,77,0.75)",
                  color: "#fff",
                  padding: "2px 5px",
                  borderRadius: "3px",
                }}
              >
                发现图
              </div>
            </div>
            <div
              style={{
                borderRadius: "6px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <img
                src={assetUrl("/placeholders/scene-generic.svg")}
                alt="处置后图"
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "6px",
                  left: "6px",
                  fontSize: "10px",
                  backgroundColor: "rgba(53,185,133,0.8)",
                  color: "#fff",
                  padding: "2px 5px",
                  borderRadius: "3px",
                }}
              >
                处置后图
              </div>
            </div>
          </div>
        </div>

        {/* Agent final judgment */}
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 12px",
            border: "1px solid rgba(36,214,210,0.2)",
            borderRadius: "7px",
            backgroundColor: "rgba(36,214,210,0.04)",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "var(--accent)",
              fontWeight: 600,
              marginBottom: "5px",
            }}
          >
            Agent 最终判断
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--foreground)",
              lineHeight: 1.5,
            }}
          >
            同相机发现图与处置后截图对比，问题已消除，置信度
            96%。处置方反馈与视觉证据一致，无证据冲突。
          </div>
        </div>

        {/* Recurrence risk */}
        {event.hasRecurrence && (
          <div
            style={{
              marginBottom: "14px",
              padding: "10px 12px",
              border: "1px solid rgba(255,122,66,0.25)",
              borderRadius: "7px",
              backgroundColor: "rgba(255,122,66,0.05)",
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
              <div
                style={{ fontSize: "11px", color: "#FF7A42", fontWeight: 600 }}
              >
                ⚠ 结案后复发风险
              </div>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--foreground)",
                lineHeight: 1.5,
                marginBottom: "6px",
              }}
            >
              该位置已出现 3 次同类事件，达到复发识别阈值候选条件。
            </div>
            <button
              style={{
                fontSize: "10px",
                color: "#FF7A42",
                border: "1px solid rgba(255,122,66,0.3)",
                backgroundColor: "transparent",
                padding: "3px 8px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              前往 AI统计 · 专题统计查看 →
            </button>
          </div>
        )}

        {/* Expandable timeline */}
        <div>
          <button
            onClick={() => setExpandTimeline(!expandTimeline)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: expandTimeline ? "7px 7px 0 0" : "7px",
              cursor: "pointer",
              fontSize: "11px",
              color: "var(--foreground)",
            }}
          >
            <span style={{ fontWeight: 500 }}>生命周期 · 操作记录</span>
            <span style={{ color: "var(--muted-foreground)" }}>
              {expandTimeline ? "↑ 收起" : "↓ 展开"}
            </span>
          </button>
          {expandTimeline && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderTop: "none",
                borderRadius: "0 0 7px 7px",
                padding: "12px",
              }}
            >
              {[
                {
                  time: event.endTime.split(" ")[1],
                  actor: "核查结案 · 张晓琳",
                  action: "确认结案",
                  color: "#35B985",
                },
                {
                  time: "08:50",
                  actor: "网格责任人 · 李建国",
                  action: "提交处置结果及2张现场图",
                  color: "#326DFF",
                },
                {
                  time: "08:30",
                  actor: "Agent",
                  action: "获取原相机最新截图，整理证据链，进入待核查",
                  color: "#24D6D2",
                },
                {
                  time: event.happenTime.split(" ")[1],
                  actor: "Agent",
                  action: "AI视频识别发现候选事件，完成查重、空间匹配",
                  color: "#24D6D2",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: item.color,
                        flexShrink: 0,
                      }}
                    />
                    {i < 3 && (
                      <div
                        style={{
                          width: "1px",
                          flex: 1,
                          backgroundColor: "var(--border)",
                          minHeight: "20px",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingBottom: "8px" }}>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--muted-foreground)",
                        marginBottom: "2px",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {item.time} · {item.actor}
                    </div>
                    <div
                      style={{ fontSize: "11px", color: "var(--foreground)" }}
                    >
                      {item.action}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EventArchive() {
  const [selectedEvent, setSelectedEvent] = useState<ArchiveEvent | null>(
    archiveEvents[0],
  )
  const [filterStatus, setFilterStatus] = useState<string>("全部")
  const [searchQuery, setSearchQuery] = useState("")
  const [showAIQuery, setShowAIQuery] = useState(false)
  const [aiQuery, setAiQuery] = useState("")
  const [hoverSearch, setHoverSearch] = useState(false)

  const filtered = archiveEvents.filter((e) => {
    if (filterStatus !== "全部" && e.finalStatus !== filterStatus) return false
    if (
      searchQuery &&
      !e.id.includes(searchQuery) &&
      !e.type.includes(searchQuery) &&
      !e.location.includes(searchQuery)
    )
      return false
    return true
  })

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
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
        <span style={{ fontWeight: 600, fontSize: "15px" }}>事件档案</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setShowAIQuery(!showAIQuery)}
            style={{
              fontSize: "12px",
              color: "var(--accent)",
              border: "1px solid rgba(36,214,210,0.3)",
              backgroundColor: showAIQuery
                ? "rgba(36,214,210,0.12)"
                : "rgba(36,214,210,0.07)",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            AI查档 {showAIQuery ? "·" : ""}
          </button>
        </div>
      </div>

      <div
        style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
      >
        {/* List area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search + filters */}
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索事件ID、类型或位置..."
              style={{
                padding: "6px 10px",
                backgroundColor: "var(--secondary)",
                border: "1px solid var(--border)",
                borderRadius: "5px",
                color: "var(--foreground)",
                fontSize: "12px",
                width: "220px",
              }}
            />
            {["全部", "已结案", "已中止", "已无效"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                  border: `1px solid ${
                    filterStatus === s
                      ? s === "已结案"
                        ? "#35B985"
                        : s === "已中止"
                          ? "#6E8197"
                          : s === "已无效"
                            ? "#E45E58"
                            : "#326DFF"
                      : "var(--border)"
                  }`,
                  backgroundColor:
                    filterStatus === s ? "rgba(50,109,255,0.1)" : "transparent",
                  color:
                    filterStatus === s
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                }}
              >
                {s}
              </button>
            ))}
            <span
              style={{
                marginLeft: "auto",
                fontSize: "11px",
                color: "var(--muted-foreground)",
              }}
            >
              共 {filtered.length} 件
            </span>
          </div>

          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 120px 90px 90px 80px",
              gap: "8px",
              padding: "6px 16px",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "rgba(50,109,255,0.04)",
              fontSize: "10px",
              color: "var(--muted-foreground)",
              fontWeight: 500,
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            <span>事件ID</span>
            <span>类型 · 位置</span>
            <span>终态</span>
            <span>审核人</span>
            <span>完成时间</span>
            <span>总时长</span>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.map((evt) => (
              <div
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className="data-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 120px 90px 90px 80px",
                  gap: "8px",
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  backgroundColor:
                    selectedEvent?.id === evt.id
                      ? "rgba(50,109,255,0.06)"
                      : undefined,
                  borderLeft:
                    selectedEvent?.id === evt.id
                      ? "2px solid #326DFF"
                      : "2px solid transparent",
                  alignItems: "center",
                  transition: "background-color 0.15s, box-shadow 0.15s",
                }}
              >
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "10px",
                    color: "var(--accent)",
                  }}
                >
                  #{evt.id.slice(-6)}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      marginBottom: "2px",
                    }}
                  >
                    {evt.type}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--muted-foreground)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {evt.location}
                    {evt.hasRecurrence && (
                      <span style={{ color: "#FF7A42", marginLeft: "4px" }}>
                        · 复发
                      </span>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    width: "fit-content",
                    backgroundColor: statusBg[evt.finalStatus],
                    color: statusColors[evt.finalStatus],
                    border: `1px solid ${statusColors[evt.finalStatus]}30`,
                  }}
                >
                  {evt.finalStatus}
                </span>
                <span style={{ fontSize: "11px", color: "var(--foreground)" }}>
                  {evt.inspector}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--muted-foreground)",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {evt.endTime.split(" ")[0].slice(5)}
                </span>
                <span
                  style={{ fontSize: "11px", color: "var(--muted-foreground)" }}
                >
                  {evt.duration}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: Archive detail or AI Query */}
        {showAIQuery ? (
          <div
            style={{
              width: "360px",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
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
              />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                AI查档
              </span>
              <span
                style={{ fontSize: "10px", color: "var(--muted-foreground)" }}
              >
                已闭环事件 · 近30天
              </span>
              <button
                onClick={() => setShowAIQuery(false)}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted-foreground)",
                  fontSize: "14px",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
              <div
                style={{
                  marginBottom: "10px",
                  fontSize: "11px",
                  color: "var(--muted-foreground)",
                }}
              >
                示例问题：
              </div>
              {[
                "查近30天北新桥街道、共享单车占道、核查退回过一次且处置时长超4小时的已结案事件",
                "对比朝阳门街道与东直门街道近两周同类事件的平均处置时长",
                "查所有结案后出现复发关联的事件，按时间排序",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setAiQuery(q)}
                  className="data-row bg-card"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    marginBottom: "6px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: "11px",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    lineHeight: 1.4,
                    transition: "background-color 0.15s, box-shadow 0.15s",
                    boxShadow:
                      "0 0 20px rgba(50,109,255,0.08), inset 0 1px 0 rgba(50,109,255,0.1)",
                  }}
                >
                  {q}
                </button>
              ))}
              {aiQuery && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    border: "1px solid rgba(36,214,210,0.3)",
                    borderRadius: "7px",
                    backgroundColor: "rgba(36,214,210,0.05)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--accent)",
                      marginBottom: "5px",
                      fontWeight: 600,
                    }}
                  >
                    AI查档结果
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--foreground)",
                      lineHeight: 1.5,
                      marginBottom: "8px",
                    }}
                  >
                    找到 <strong>3</strong>{" "}
                    件符合条件的已结案事件。已在左侧列表高亮显示，点击可查看完整档案。
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    数据范围：已闭环事件 · 2026-07-20 至今
                  </div>
                </div>
              )}
            </div>
            <div
              style={{
                padding: "10px 12px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: "6px",
                flexShrink: 0,
              }}
            >
              <input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="输入查档条件..."
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  backgroundColor: "var(--secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "5px",
                  color: "var(--foreground)",
                  fontSize: "12px",
                }}
              />
              <button
                onMouseEnter={() => setHoverSearch(true)}
                onMouseLeave={() => setHoverSearch(false)}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "12px",
                  boxShadow: hoverSearch
                    ? "0 0 18px rgba(50,109,255,0.35)"
                    : "0 0 12px rgba(50,109,255,0.25)",
                  transition: "box-shadow 0.15s",
                }}
              >
                查
              </button>
            </div>
          </div>
        ) : selectedEvent ? (
          <div
            style={{
              width: "380px",
              borderLeft: "1px solid var(--border)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ArchiveDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
