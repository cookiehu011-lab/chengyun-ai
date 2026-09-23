import { useState } from "react"

type ConfigGroup = "治理基础" | "流程运行" | "持续治理" | "配置管理"

interface ConfigModule {
  id: string
  group: ConfigGroup
  name: string
  desc: string
  version: string
  lastModified: string
  modifier: string
  status: "已发布" | "草稿" | "待审批"
  itemCount?: number
}

const configModules: ConfigModule[] = [
  {
    id: "cm-01",
    group: "治理基础",
    name: "组织、账号与权限",
    desc: "组织架构、角色定义、数据可见范围、操作权限与升级可见关系",
    version: "V2.3.1",
    lastModified: "2026-08-10",
    modifier: "管理员 · 王志远",
    status: "已发布",
    itemCount: 47,
  },
  {
    id: "cm-02",
    group: "治理基础",
    name: "空间与责任关系",
    desc: "街道、社区、网格边界、相机位置与网格责任人关系",
    version: "V2.3.0",
    lastModified: "2026-07-28",
    modifier: "管理员 · 王志远",
    status: "已发布",
    itemCount: 312,
  },
  {
    id: "cm-03",
    group: "治理基础",
    name: "事件标准",
    desc: "问题分类字典、成立规则、字段配置、证据要求与原因字典",
    version: "V2.3.2",
    lastModified: "2026-08-15",
    modifier: "产品负责人 · 李明",
    status: "已发布",
    itemCount: 89,
  },
  {
    id: "cm-04",
    group: "流程运行",
    name: "生命周期与处置规则",
    desc: "退回、转派、核查、作废、重新激活、升级与自动结案规则",
    version: "V2.3.0",
    lastModified: "2026-07-01",
    modifier: "产品负责人 · 李明",
    status: "已发布",
  },
  {
    id: "cm-05",
    group: "流程运行",
    name: "时限与异常监控",
    desc: "各事件类型、等级、区域的时限配置、提醒节点和升级规则",
    version: "V2.3.0",
    lastModified: "2026-07-01",
    modifier: "管理员 · 王志远",
    status: "已发布",
    itemCount: 28,
  },
  {
    id: "cm-06",
    group: "流程运行",
    name: "Agent派工与认领",
    desc: "批次数量、优先级权重、软分配、回收时长、紧急事件置顶规则",
    version: "V2.3.1",
    lastModified: "2026-08-12",
    modifier: "管理员 · 王志远",
    status: "草稿",
  },
  {
    id: "cm-07",
    group: "持续治理",
    name: "查重与复发治理",
    desc: "判重时间窗口、复发识别阈值、候选专题规则和观察期配置",
    version: "V2.3.0",
    lastModified: "2026-07-01",
    modifier: "产品负责人 · 李明",
    status: "已发布",
  },
  {
    id: "cm-08",
    group: "持续治理",
    name: "治理评价标准",
    desc: "管理基线指标、质量考核口径、难度校正因子、监督员工作量口径",
    version: "V2.3.0",
    lastModified: "2026-07-01",
    modifier: "管理员 · 王志远",
    status: "已发布",
  },
  {
    id: "cm-09",
    group: "配置管理",
    name: "发布与审计",
    desc: "配置草稿、影响预览、版本差异、生效时间、历史回溯与回滚",
    version: "—",
    lastModified: "—",
    modifier: "—",
    status: "已发布",
  },
]

const groups: ConfigGroup[] = ["治理基础", "流程运行", "持续治理", "配置管理"]

const groupColors: Record<ConfigGroup, string> = {
  治理基础: "#326DFF",
  流程运行: "#FF7A42",
  持续治理: "#35B985",
  配置管理: "#7568D8",
}

function VersionHistory() {
  const entries = [
    {
      version: "V2.3.2",
      date: "2026-08-15",
      author: "李明",
      changes: '新增"乱堆杂物"微类3项，调整证据要求字段顺序',
      impact: "影响42个分类规则",
      status: "当前版本",
    },
    {
      version: "V2.3.1",
      date: "2026-08-10",
      author: "王志远",
      changes: "更新组织权限矩阵，新增全局协调角色升级权限",
      impact: "影响7个角色配置",
      status: "历史版本",
    },
    {
      version: "V2.3.0",
      date: "2026-07-01",
      author: "李明",
      changes: "V2.3基线发布，包含全量配置迁移",
      impact: "全部模块",
      status: "历史版本",
    },
  ]
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {entries.map((e) => (
        <div
          key={e.version}
          style={{
            padding: "10px 14px",
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
              gap: "10px",
              marginBottom: "5px",
            }}
          >
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "12px",
                fontWeight: 600,
                color:
                  e.status === "当前版本" ? "#35B985" : "var(--foreground)",
              }}
            >
              {e.version}
            </span>
            <span
              style={{ fontSize: "10px", color: "var(--muted-foreground)" }}
            >
              {e.date} · {e.author}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                padding: "1px 6px",
                borderRadius: "3px",
                backgroundColor:
                  e.status === "当前版本"
                    ? "rgba(53,185,133,0.12)"
                    : "rgba(110,129,151,0.08)",
                color:
                  e.status === "当前版本"
                    ? "#35B985"
                    : "var(--muted-foreground)",
              }}
            >
              {e.status}
            </span>
            {e.status !== "当前版本" && (
              <button
                style={{
                  fontSize: "10px",
                  color: "#FF7A42",
                  border: "1px solid rgba(255,122,66,0.3)",
                  backgroundColor: "transparent",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                回滚
              </button>
            )}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--foreground)",
              marginBottom: "3px",
            }}
          >
            {e.changes}
          </div>
          <div style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
            影响范围：{e.impact}
          </div>
        </div>
      ))}
    </div>
  )
}

function EventStandardDetail() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            事件标准配置
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--muted-foreground)",
              marginTop: "2px",
            }}
          >
            当前版本：V2.3.2 · 2026-08-15 生效
          </div>
        </div>
        <button
          style={{
            padding: "7px 16px",
            backgroundColor: "rgba(50,109,255,0.1)",
            color: "#326DFF",
            border: "1px solid rgba(50,109,255,0.3)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          新建草稿
        </button>
      </div>

      {/* Rule impact warning */}
      <div
        style={{
          padding: "10px 12px",
          backgroundColor: "rgba(255,122,66,0.06)",
          border: "1px solid rgba(255,122,66,0.25)",
          borderRadius: "7px",
          marginBottom: "14px",
          fontSize: "11px",
          color: "#FF7A42",
        }}
      >
        ⚠
        修改事件标准配置将影响所有新建事件的分类、等级判断与成立规则。历史事件仍引用当时规则版本。发布前请确认影响范围。
      </div>

      {/* Classification tree */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            padding: "9px 14px",
            backgroundColor: "rgba(50,109,255,0.04)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 500 }}>
            问题分类字典
          </span>
          <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
            共 89 个分类条目
          </span>
        </div>
        {[
          {
            category: "道路秩序",
            subcategories: [
              "违规停放机动车",
              "共享单车违规停放",
              "店外经营占道",
              "违规施工占道",
            ],
            count: 4,
          },
          {
            category: "环境卫生",
            subcategories: ["乱堆垃圾", "乱堆杂物", "非法倾倒", "违规堆放建材"],
            count: 4,
          },
          {
            category: "广告标识",
            subcategories: ["无证户外广告", "超规格广告牌", "违规灯箱"],
            count: 3,
          },
        ].map((cat) => (
          <div
            key={cat.category}
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div
              style={{
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                {cat.category}
              </span>
              <span
                style={{ fontSize: "10px", color: "var(--muted-foreground)" }}
              >
                {cat.count} 小类
              </span>
            </div>
            <div
              style={{
                paddingLeft: "28px",
                paddingBottom: "8px",
                display: "flex",
                flexWrap: "wrap",
                gap: "5px",
              }}
            >
              {cat.subcategories.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: "10px",
                    padding: "2px 7px",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    color: "var(--foreground)",
                    cursor: "pointer",
                    backgroundColor: "var(--secondary)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Time limits */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "9px 14px",
            backgroundColor: "rgba(50,109,255,0.04)",
            borderBottom: "1px solid var(--border)",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          时限配置（部分示例）
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px 80px",
            gap: "0",
            fontSize: "11px",
          }}
        >
          <div
            style={{
              padding: "7px 14px",
              backgroundColor: "rgba(50,109,255,0.04)",
              color: "var(--muted-foreground)",
              fontWeight: 500,
              borderBottom: "1px solid var(--border)",
            }}
          >
            事件类型
          </div>
          <div
            style={{
              padding: "7px 8px",
              backgroundColor: "rgba(50,109,255,0.04)",
              color: "var(--muted-foreground)",
              fontWeight: 500,
              borderBottom: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            一般
          </div>
          <div
            style={{
              padding: "7px 8px",
              backgroundColor: "rgba(50,109,255,0.04)",
              color: "var(--muted-foreground)",
              fontWeight: 500,
              borderBottom: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            较重
          </div>
          <div
            style={{
              padding: "7px 8px",
              backgroundColor: "rgba(50,109,255,0.04)",
              color: "var(--muted-foreground)",
              fontWeight: 500,
              borderBottom: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            严重
          </div>
          {[
            { type: "违规停放机动车", t1: "4h", t2: "2h", t3: "1h" },
            { type: "共享单车违规停放", t1: "6h", t2: "3h", t3: "1h" },
            { type: "乱堆垃圾", t1: "24h", t2: "12h", t3: "4h" },
            { type: "违规施工", t1: "8h", t2: "4h", t3: "2h" },
          ].map((row) => (
            <>
              <div
                key={row.type + "-label"}
                style={{
                  padding: "7px 14px",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                {row.type}
              </div>
              <div
                key={row.type + "-t1"}
                style={{
                  padding: "7px 8px",
                  borderBottom: "1px solid var(--border)",
                  textAlign: "center",
                  color: "var(--foreground)",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {row.t1}
              </div>
              <div
                key={row.type + "-t2"}
                style={{
                  padding: "7px 8px",
                  borderBottom: "1px solid var(--border)",
                  textAlign: "center",
                  color: "#FF7A42",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {row.t2}
              </div>
              <div
                key={row.type + "-t3"}
                style={{
                  padding: "7px 8px",
                  borderBottom: "1px solid var(--border)",
                  textAlign: "center",
                  color: "#E45E58",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {row.t3}
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GovernanceConfig() {
  const [activeModule, setActiveModule] = useState<ConfigModule>(
    configModules[2],
  )
  const [activeGroup, setActiveGroup] = useState<ConfigGroup | "all">("all")

  const filtered =
    activeGroup === "all"
      ? configModules
      : configModules.filter((m) => m.group === activeGroup)

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
        <span style={{ fontWeight: 600, fontSize: "15px" }}>治理配置</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "11px",
              color: "var(--muted-foreground)",
              padding: "3px 8px",
              border: "1px solid var(--border)",
              borderRadius: "4px",
            }}
          >
            当前基线：V2.3 · 2026-07-01 生效
          </span>
          <button
            style={{
              fontSize: "12px",
              color: "#FF7A42",
              border: "1px solid rgba(255,122,66,0.3)",
              backgroundColor: "rgba(255,122,66,0.07)",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            发布草稿
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left: Module list */}
        <div
          style={{
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Group filter */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              flexWrap: "wrap",
              gap: "5px",
              flexShrink: 0,
            }}
          >
            {(["all", ...groups] as const).map((g) => (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className="data-row"
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  cursor: "pointer",
                  border: `1px solid ${
                    activeGroup === g
                      ? g === "all"
                        ? "#326DFF"
                        : groupColors[(g as ConfigGroup)]
                      : "var(--border)"
                  }`,
                  backgroundColor:
                    activeGroup === g
                      ? g === "all"
                        ? "rgba(50,109,255,0.1)"
                        : `${groupColors[(g as ConfigGroup)]}15`
                      : undefined,
                  color:
                    activeGroup === g
                      ? g === "all"
                        ? "#326DFF"
                        : groupColors[(g as ConfigGroup)]
                      : "var(--muted-foreground)",
                  transition: "background-color 0.15s, box-shadow 0.15s",
                }}
              >
                {g === "all" ? "全部" : g}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {groups
              .filter((g) => activeGroup === "all" || g === activeGroup)
              .map((group) => (
                <div key={group}>
                  <div
                    style={{
                      fontSize: "10px",
                      color: groupColors[group],
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      padding: "6px 8px 4px",
                      marginTop: "4px",
                    }}
                  >
                    {group}
                  </div>
                  {filtered
                    .filter((m) => m.group === group)
                    .map((mod) => (
                      <button
                        key={mod.id}
                        onClick={() => setActiveModule(mod)}
                        className="data-row"
                        style={{
                          width: "100%",
                          padding: "9px 10px",
                          marginBottom: "3px",
                          borderRadius: "6px",
                          border: `1px solid ${
                            activeModule?.id === mod.id
                              ? groupColors[mod.group] + "50"
                              : "transparent"
                          }`,
                          backgroundColor:
                            activeModule?.id === mod.id
                              ? `${groupColors[mod.group]}12`
                              : undefined,
                          cursor: "pointer",
                          textAlign: "left",
                          transition:
                            "background-color 0.15s, box-shadow 0.15s",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight:
                                activeModule?.id === mod.id ? 500 : 400,
                              color:
                                activeModule?.id === mod.id
                                  ? "var(--foreground)"
                                  : "var(--secondary-foreground)",
                              flex: 1,
                            }}
                          >
                            {mod.name}
                          </span>
                          <span
                            style={{
                              fontSize: "9px",
                              padding: "1px 5px",
                              borderRadius: "3px",
                              backgroundColor:
                                mod.status === "草稿"
                                  ? "rgba(255,122,66,0.12)"
                                  : mod.status === "待审批"
                                    ? "rgba(117,104,216,0.1)"
                                    : "rgba(53,185,133,0.12)",
                              color:
                                mod.status === "草稿"
                                  ? "#FF7A42"
                                  : mod.status === "待审批"
                                    ? "#7568D8"
                                    : "#35B985",
                            }}
                          >
                            {mod.status}
                          </span>
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
                          {mod.version} ·{" "}
                          {mod.lastModified !== "—" ? mod.lastModified : "—"}
                        </div>
                      </button>
                    ))}
                </div>
              ))}
          </div>
        </div>

        {/* Right: Config detail */}
        <div style={{ overflow: "auto", padding: "20px 24px" }}>
          {activeModule ? (
            <>
              {/* Module header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        backgroundColor: `${groupColors[activeModule.group]}15`,
                        color: groupColors[activeModule.group],
                        border: `1px solid ${groupColors[activeModule.group]}30`,
                        fontWeight: 600,
                      }}
                    >
                      {activeModule.group}
                    </span>
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "11px",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {activeModule.version}
                    </span>
                  </div>
                  <h2
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      margin: 0,
                      marginBottom: "4px",
                    }}
                  >
                    {activeModule.name}
                  </h2>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {activeModule.desc}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexShrink: 0,
                    marginLeft: "16px",
                  }}
                >
                  {activeModule.status === "草稿" && (
                    <button
                      style={{
                        padding: "7px 14px",
                        backgroundColor: "rgba(255,122,66,0.1)",
                        color: "#FF7A42",
                        border: "1px solid rgba(255,122,66,0.3)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      提交审批
                    </button>
                  )}
                  <button
                    style={{
                      padding: "7px 14px",
                      backgroundColor: "rgba(50,109,255,0.1)",
                      color: "#326DFF",
                      border: "1px solid rgba(50,109,255,0.3)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    {activeModule.status === "草稿" ? "继续编辑" : "编辑"}
                  </button>
                </div>
              </div>

              {/* Module meta */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                  marginBottom: "16px",
                  padding: "12px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  backgroundColor: "var(--card)",
                  boxShadow:
                    "0 0 20px rgba(50,109,255,0.08), inset 0 1px 0 rgba(50,109,255,0.1)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--muted-foreground)",
                      marginBottom: "2px",
                    }}
                  >
                    最后修改
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--foreground)" }}>
                    {activeModule.lastModified}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--muted-foreground)",
                      marginBottom: "2px",
                    }}
                  >
                    修改人
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--foreground)" }}>
                    {activeModule.modifier}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--muted-foreground)",
                      marginBottom: "2px",
                    }}
                  >
                    条目数量
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--foreground)" }}>
                    {activeModule.itemCount
                      ? `${activeModule.itemCount} 项`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Content based on module */}
              {activeModule.id === "cm-03" && <EventStandardDetail />}
              {activeModule.id === "cm-09" && (
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "12px",
                    }}
                  >
                    版本历史与审计
                  </div>
                  <VersionHistory />
                </div>
              )}
              {activeModule.id !== "cm-03" && activeModule.id !== "cm-09" && (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "var(--muted-foreground)",
                    border: "1px dashed var(--border)",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      opacity: 0.3,
                      marginBottom: "10px",
                    }}
                  >
                    ⚙
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      marginBottom: "4px",
                    }}
                  >
                    {activeModule.name}
                  </div>
                  <div style={{ fontSize: "11px", lineHeight: 1.5 }}>
                    {activeModule.desc}
                  </div>
                  <button
                    style={{
                      marginTop: "14px",
                      padding: "7px 16px",
                      backgroundColor: "rgba(50,109,255,0.1)",
                      color: "#326DFF",
                      border: "1px solid rgba(50,109,255,0.3)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    进入配置编辑
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
                color: "var(--muted-foreground)",
                fontSize: "12px",
              }}
            >
              选择左侧配置模块开始编辑
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
