import { useState } from "react"

type WorkbenchTab = "dialogs" | "files" | "tasks"

interface DialogItem {
  id: string
  title: string
  preview: string
  time: string
  hasFile: boolean
  hasTask: boolean
}

interface FileItem {
  id: string
  name: string
  type: string
  version: string
  source: string
  created: string
  size: string
}

interface TaskItem {
  id: string
  title: string
  type: "定时执行" | "条件监控"
  status: "运行中" | "已触发" | "已暂停"
  schedule: string
  lastRun: string
  nextRun: string
}

const dialogs: DialogItem[] = [
  {
    id: "d-001",
    title: "本周治理周报生成",
    preview:
      "已生成包含综合态势、事件发生、流程运行三部分的周报，PDF版本可下载...",
    time: "今日 09:32",
    hasFile: true,
    hasTask: false,
  },
  {
    id: "d-002",
    title: "朝阳门街道8月专项分析",
    preview:
      "分析了近30天朝阳门街道共享单车事件的分布规律、处置时效和复发情况...",
    time: "昨日 16:45",
    hasFile: true,
    hasTask: false,
  },
  {
    id: "d-003",
    title: "待处置超时事件查询",
    preview:
      "找到当前超时的待处置事件 11 件，主要集中在朝阳门南小街和东直门内大街...",
    time: "昨日 10:12",
    hasFile: false,
    hasTask: false,
  },
  {
    id: "d-004",
    title: "月度AI效能监控任务",
    preview:
      "已设置每月1日自动生成AI作用成效月报，并监控发现有效率低于75%时触发提醒...",
    time: "08-15",
    hasFile: false,
    hasTask: true,
  },
]

const files: FileItem[] = [
  {
    id: "f-001",
    name: "东城城运AI治理周报_2026-W33.pdf",
    type: "PDF报告",
    version: "V1",
    source: "对话：本周治理周报生成",
    created: "今日 09:34",
    size: "1.2 MB",
  },
  {
    id: "f-002",
    name: "朝阳门街道8月专项分析报告.pdf",
    type: "PDF报告",
    version: "V2",
    source: "对话：朝阳门街道8月专项分析",
    created: "昨日 17:02",
    size: "0.8 MB",
  },
  {
    id: "f-003",
    name: "8月前两周AI效能数据表.xlsx",
    type: "Excel表格",
    version: "V1",
    source: "对话：月度AI效能监控任务",
    created: "08-15",
    size: "245 KB",
  },
]

const tasks: TaskItem[] = [
  {
    id: "t-001",
    title: "每周治理周报生成",
    type: "定时执行",
    status: "运行中",
    schedule: "每周一 08:00",
    lastRun: "2026-08-18 08:02",
    nextRun: "2026-08-25 08:00",
  },
  {
    id: "t-002",
    title: "AI发现有效率监控",
    type: "条件监控",
    status: "运行中",
    schedule: "发现有效率 < 75% 触发",
    lastRun: "2026-08-15 12:30",
    nextRun: "持续监控中",
  },
  {
    id: "t-003",
    title: "月度综合统计报告",
    type: "定时执行",
    status: "运行中",
    schedule: "每月1日 09:00",
    lastRun: "2026-08-01 09:03",
    nextRun: "2026-09-01 09:00",
  },
  {
    id: "t-004",
    title: "待处置事件超时预警",
    type: "条件监控",
    status: "已触发",
    schedule: "待处置超时率 > 10% 触发",
    lastRun: "今日 08:45",
    nextRun: "已触发，恢复后重新布防",
  },
]

const operationPreviewExample = {
  type: "受控业务操作",
  title: "重新激活事件 DC-2026-07082",
  steps: [
    {
      label: "操作预检",
      status: "通过",
      detail: "事件已终态（已结案），具备重新激活条件",
    },
    {
      label: "操作预览",
      status: "待确认",
      detail: "事件将从已结案进入待立案，历史终态记录保留，通知立案审核角色",
    },
    { label: "人工确认", status: "等待", detail: "" },
  ],
}

export default function AIWorkbench() {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("dialogs")
  const [activeDialog, setActiveDialog] = useState<DialogItem | null>(
    dialogs[0],
  )
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<{
    role: "user" | "ai"
    content: string
  }[]>([
    {
      role: "ai",
      content:
        "您好，我是城运AI工作台助手。我可以帮您跨模块查询治理数据、生成分析报告、创建定时任务，或执行经确认的业务操作。\n\n当前数据范围：账号权限内全量治理数据（立案审核角色）。",
    },
    {
      role: "user",
      content:
        "帮我生成本周治理周报，包含综合态势、事件发生、流程运行三个部分。",
    },
    {
      role: "ai",
      content:
        "已为您生成本周治理周报（2026年第33周）。\n\n主要发现：\n• 本周发现事件 312 件，较上周增加 12%\n• 闭环 265 件，闭环率 85%，处置时长下降至 2.4h\n• 朝阳门和东直门街道为高发区域，占总量 58%\n• 流程运行：待处置超时率 11.7%，核查退回率 8.3%\n\n报告已生成 PDF 文件，可在「文件记录」中查看。如需修改某部分，告诉我即可。",
    },
  ])
  const [showOpPreview, setShowOpPreview] = useState(false)
  const [hoverSend, setHoverSend] = useState(false)
  const [hoverConfirm, setHoverConfirm] = useState(false)

  function sendMessage() {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput("")
    setMessages((prev) => [...prev, { role: "user", content: msg }])
    if (msg.includes("激活") || msg.includes("操作")) {
      setShowOpPreview(true)
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "检测到您要执行业务操作。我已进行操作预检，请查看右侧操作预览，确认后方可执行。所有步骤均会留痕。",
        },
      ])
    } else {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: `已在权限范围内查询相关数据。数据范围：全量治理事件 · ${new Date().toLocaleDateString("zh-CN")}。\n\n如需进一步分析或生成文件，请告诉我具体需求。`,
          },
        ])
      }, 800)
    }
  }

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
          padding: "0 20px",
          height: "48px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--card)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "15px" }}>AI 工作台</span>
        <span
          style={{
            marginLeft: "10px",
            fontSize: "11px",
            color: "var(--muted-foreground)",
            padding: "2px 7px",
            border: "1px solid var(--border)",
            borderRadius: "4px",
          }}
        >
          全量数据 · 账号权限内
        </span>
      </div>

      <div
        style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
      >
        {/* Left: 3-tab navigation + list */}
        <div
          style={{
            width: "260px",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            {[
              { id: "dialogs" as const, label: "对话记录" },
              { id: "files" as const, label: "文件记录" },
              { id: "tasks" as const, label: "任务中心" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="data-row"
                style={{
                  flex: 1,
                  padding: "10px 6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color:
                    activeTab === tab.id
                      ? "#326DFF"
                      : "var(--muted-foreground)",
                  borderBottom:
                    activeTab === tab.id
                      ? "2px solid #326DFF"
                      : "2px solid transparent",
                  transition: "background-color 0.15s, box-shadow 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {activeTab === "dialogs" && (
              <>
                <button
                  style={{
                    width: "100%",
                    marginBottom: "8px",
                    padding: "8px 10px",
                    backgroundColor: "rgba(50,109,255,0.1)",
                    border: "1px dashed rgba(50,109,255,0.4)",
                    borderRadius: "6px",
                    color: "#326DFF",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  + 新建对话
                </button>
                {dialogs.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setActiveDialog(d)}
                    className="data-row"
                    style={{
                      padding: "9px 10px",
                      marginBottom: "4px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor:
                        activeDialog?.id === d.id
                          ? "rgba(50,109,255,0.1)"
                          : undefined,
                      border: `1px solid ${
                        activeDialog?.id === d.id
                          ? "rgba(50,109,255,0.3)"
                          : "transparent"
                      }`,
                      transition: "background-color 0.15s, box-shadow 0.15s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "3px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "var(--foreground)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.title}
                      </span>
                      {d.hasFile && (
                        <span
                          style={{
                            fontSize: "9px",
                            backgroundColor: "rgba(50,109,255,0.12)",
                            color: "#326DFF",
                            padding: "1px 4px",
                            borderRadius: "2px",
                            flexShrink: 0,
                          }}
                        >
                          文件
                        </span>
                      )}
                      {d.hasTask && (
                        <span
                          style={{
                            fontSize: "9px",
                            backgroundColor: "rgba(53,185,133,0.12)",
                            color: "#35B985",
                            padding: "1px 4px",
                            borderRadius: "2px",
                            flexShrink: 0,
                          }}
                        >
                          任务
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--muted-foreground)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.preview}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--muted-foreground)",
                        marginTop: "4px",
                      }}
                    >
                      {d.time}
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeTab === "files" && (
              <>
                {files.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: "9px 10px",
                      marginBottom: "5px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      cursor: "pointer",
                      boxShadow:
                        "0 0 20px rgba(50,109,255,0.08), inset 0 1px 0 rgba(50,109,255,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "7px",
                        marginBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(50,109,255,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#326DFF"
                          strokeWidth="2"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "var(--foreground)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {f.name}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {f.type} · {f.version} · {f.size}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--muted-foreground)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      来源：{f.source}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--muted-foreground)",
                        marginTop: "2px",
                      }}
                    >
                      {f.created}
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeTab === "tasks" && (
              <>
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: "9px 10px",
                      marginBottom: "5px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      boxShadow:
                        "0 0 20px rgba(50,109,255,0.08), inset 0 1px 0 rgba(50,109,255,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          backgroundColor:
                            t.type === "定时执行"
                              ? "rgba(50,109,255,0.1)"
                              : "rgba(117,104,216,0.1)",
                          color: t.type === "定时执行" ? "#326DFF" : "#7568D8",
                          border: `1px solid ${
                            t.type === "定时执行"
                              ? "rgba(50,109,255,0.2)"
                              : "rgba(117,104,216,0.2)"
                          }`,
                        }}
                      >
                        {t.type}
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          backgroundColor:
                            t.status === "已触发"
                              ? "rgba(255,122,66,0.1)"
                              : t.status === "已暂停"
                                ? "rgba(110,129,151,0.1)"
                                : "rgba(53,185,133,0.1)",
                          color:
                            t.status === "已触发"
                              ? "#FF7A42"
                              : t.status === "已暂停"
                                ? "#6E8197"
                                : "#35B985",
                        }}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "var(--foreground)",
                        marginBottom: "3px",
                      }}
                    >
                      {t.title}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {t.schedule}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Center: Chat */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Chat header */}
          {activeDialog && (
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                backgroundColor: "rgba(50,109,255,0.04)",
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 500 }}>
                {activeDialog.title}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--muted-foreground)",
                  marginTop: "1px",
                }}
              >
                城运AI · 账号权限内全量数据 · {activeDialog.time}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "14px",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                }}
              >
                {msg.role === "ai" && (
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #326DFF, #24D6D2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path
                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        stroke="white"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 13px",
                    borderRadius: "10px",
                    backgroundColor:
                      msg.role === "user" ? "var(--primary)" : "var(--card)",
                    border:
                      msg.role === "ai" ? "1px solid var(--border)" : "none",
                    fontSize: "12px",
                    color: msg.role === "user" ? "#fff" : "var(--foreground)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="查询治理数据、生成报告、设置任务...（Enter发送，Shift+Enter换行）"
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  backgroundColor: "var(--secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  color: "var(--foreground)",
                  fontSize: "12px",
                  resize: "none",
                  height: "56px",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={sendMessage}
                onMouseEnter={() => setHoverSend(true)}
                onMouseLeave={() => setHoverSend(false)}
                style={{
                  padding: "0 16px",
                  backgroundColor: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "7px",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: hoverSend
                    ? "0 0 18px rgba(50,109,255,0.35)"
                    : "0 0 12px rgba(50,109,255,0.25)",
                  transition: "box-shadow 0.15s",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {["生成周报", "查询超时事件", "设置监控任务", "分析复发专题"].map(
                (q) => (
                  <button
                    key={q}
                    onClick={() => setChatInput(q)}
                    className="data-row"
                    style={{
                      fontSize: "11px",
                      color: "var(--muted-foreground)",
                      border: "1px solid var(--border)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      transition: "background-color 0.15s, box-shadow 0.15s",
                    }}
                  >
                    {q}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Right: Operation preview or File view */}
        {showOpPreview && (
          <div
            style={{
              width: "300px",
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
                style={{ fontSize: "12px", fontWeight: 600, color: "#FF7A42" }}
              >
                ⚠ 操作预检与确认
              </span>
              <button
                onClick={() => setShowOpPreview(false)}
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
            <div style={{ flex: 1, overflow: "auto", padding: "14px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  marginBottom: "12px",
                }}
              >
                {operationPreviewExample.title}
              </div>
              {operationPreviewExample.steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "10px",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "7px",
                    backgroundColor: "var(--card)",
                    boxShadow:
                      "0 0 20px rgba(50,109,255,0.08), inset 0 1px 0 rgba(50,109,255,0.1)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--foreground)",
                      }}
                    >
                      {i + 1}. {step.label}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        marginLeft: "auto",
                        padding: "1px 6px",
                        borderRadius: "3px",
                        backgroundColor:
                          step.status === "通过"
                            ? "rgba(53,185,133,0.1)"
                            : step.status === "等待"
                              ? "rgba(110,129,151,0.1)"
                              : "rgba(255,122,66,0.1)",
                        color:
                          step.status === "通过"
                            ? "#35B985"
                            : step.status === "等待"
                              ? "#6E8197"
                              : "#FF7A42",
                      }}
                    >
                      {step.status}
                    </span>
                  </div>
                  {step.detail && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--foreground)",
                        lineHeight: 1.4,
                      }}
                    >
                      {step.detail}
                    </div>
                  )}
                </div>
              ))}
              <div
                style={{
                  padding: "10px 12px",
                  backgroundColor: "rgba(255,122,66,0.05)",
                  border: "1px solid rgba(255,122,66,0.2)",
                  borderRadius: "7px",
                  fontSize: "11px",
                  color: "var(--muted-foreground)",
                  marginBottom: "12px",
                }}
              >
                执行后全程留痕，包括操作人、时间、操作前后状态和本次依据。
              </div>
              <button
                onMouseEnter={() => setHoverConfirm(true)}
                onMouseLeave={() => setHoverConfirm(false)}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "8px",
                  boxShadow: hoverConfirm
                    ? "0 0 18px rgba(50,109,255,0.35)"
                    : "0 0 12px rgba(50,109,255,0.25)",
                  transition: "box-shadow 0.15s",
                }}
              >
                确认执行
              </button>
              <button
                onClick={() => setShowOpPreview(false)}
                style={{
                  width: "100%",
                  padding: "9px",
                  backgroundColor: "transparent",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
