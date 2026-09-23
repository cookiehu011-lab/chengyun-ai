import { useState, useContext, createContext, useEffect, useReducer, useRef } from "react"
import { assetUrl } from "./assetUrl"
import DongchengHeatmapMap from "./components/DongchengHeatmapMap?v=cr37"
import AIConclusion from "./components/AIConclusion?v=cr7"
import EventCarousel from "./components/EventCarousel?v=cr50"
import AIStatisticsModule from "./modules/AIStatistics"
import GovernanceConfigNative from "./modules/gc/GovernanceConfigNative"
import {
  DAYS,
  DAY_HEAT,
  PLAY_DAYS,
  PLAY_HEAT,
  PREDICT_INDEX,
  TOMORROW_LABEL,
  TOP_GRIDS,
  GRIDS,
  gridById,
  streetById,
  streetByName,
  type HeatMetric,
} from "./data/dongchengMapData?v=fc1"

// ─── shared light-theme tokens (modules only; sidebar uses its own dark vars) ─

// 皮肤令牌：值全部指向 index.css 的语义变量（清爽=:root 默认，科技=html[data-skin="tech"] 覆盖）
const T = {
  bg: "var(--background)",
  bgSoft: "var(--background-soft)",
  bgPanel: "var(--background-panel)",
  card: "var(--card)",
  cardSolid: "#FFFFFF", // 仅用于主色/渐变底上的文字与图标（双皮肤恒白）
  panelSolid: "var(--panel-solid)", // 实底面板（科技皮肤下转深色）
  card2: "var(--card-2)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",
  shadow: "var(--shadow)",
  shadowMd: "var(--shadow-md)",
  shadowLg: "var(--shadow-lg)",
  glow: "var(--shadow-glow)",
  glowStrong: "var(--shadow-glow-strong)",
  text: "var(--foreground)",
  textSub: "var(--text-sub)",
  textMuted: "var(--muted-foreground)",
  primary: "var(--primary)",
  accent: "var(--accent)",
  green: "var(--green)",
  red: "var(--red)",
  amber: "var(--amber)",
  purple: "var(--purple)",
  orange: "var(--amber)",
  cyan: "var(--accent)",
  mono: "JetBrains Mono, monospace",
  primaryRGB: "50,109,255",
  accentRGB: "36,214,210",
  greenRGB: "53,185,133",
  redRGB: "228,94,88",
  amberRGB: "255,122,66",
  orangeRGB: "255,122,66",
  purpleRGB: "117,104,216",
  textRGB: "22,45,77",
  mutedRGB: "110,129,151",
  sidebarBg: "var(--sidebar-bg)",
  sidebarBg2: "var(--sidebar-bg2)",
  sidebarBorder: "var(--sidebar-border)",
  sidebarText: "var(--sidebar-text)",
  sidebarMuted: "var(--sidebar-muted)",
  sidebarActiveText: "var(--sidebar-active-text)",
  sidebarActiveBg: "var(--sidebar-active-bg)",
  glassBg: "var(--glass-bg)",
  glassBorder: "var(--glass-border)",
  glassShadow: "var(--glass-shadow)",
}

function eventImage(
  type: string,
  state: string = "during",
) {
  const t = type.toLowerCase()
  let prefix = "work"
  if (t.includes("施工") || t.includes("建筑")) prefix = "work"
  else if (t.includes("单车")) prefix = "bike"
  else if (
    t.includes("生活垃圾") ||
    t.includes("暴露垃圾") ||
    t.includes("垃圾") ||
    t.includes("杂物")
  )
    prefix = "trash"
  else if (
    t.includes("弃物") ||
    t.includes("堆物") ||
    t.includes("废弃家具") ||
    t.includes("家具")
  )
    prefix = "furniture"
  else if (
    t.includes("占道经营") ||
    t.includes("游摊") ||
    t.includes("小贩") ||
    t.includes("无照经营") ||
    t.includes("户外广告") ||
    t.includes("店外经营") ||
    t.includes("占道")
  )
    prefix = "stall"
  else if (t.includes("非机动车") || t.includes("机动车")) prefix = "nonmotor"
  return assetUrl(`/event-images/${prefix}-${state}.png`)
}

export type ModuleId =
  | "dashboard"
  | "realtime"
  | "archive"
  | "statistics"
  | "workbench"
  | "config"
  // 自定义菜单项（菜单管理创建的占位模块）：保留内置 6 项的自动补全，同时放行任意字符串 id
  | (string & {})

function Card({
  children,
  style,
  glass = true,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  glass?: boolean
}) {
  return (
    <div
      style={{
        backgroundColor: glass ? T.glassBg : T.panelSolid,
        backdropFilter: glass ? "blur(16px)" : undefined,
        WebkitBackdropFilter: glass ? "blur(16px)" : undefined,
        border: `1px solid ${glass ? T.glassBorder : T.border}`,
        borderRadius: 14,
        boxShadow: glass ? T.glassShadow : T.shadow,
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        fontSize: 11,
        color: T.textMuted,
        fontWeight: 600,
        letterSpacing: "0.06em",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── GovernanceDashboard ──────────────────────────────────────────────────────

// ─── 核心指标紧凑条（嵌入 AI 态势卡右侧，与结论融合为一行） ────────────────────
// 设计原则：少而硬的 5 个指标 + 语义色 delta + 地图联动下钻；细分隔线分区，不做卡片堆砌
// 口径与生命周期脉冲一致：在办 211（38+94+67+12）+ 今日闭环 71 = 282
const useCountUp = (target: number, decimals = 0, duration = 700) => {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVal(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      setVal(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val.toFixed(decimals)
}

function HeatSparkline({ data }: { data: number[] }) {
  const w = 56
  const h = 18
  const max = Math.max(...data)
  const step = w / (data.length - 1)
  const pts = data
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 5)).toFixed(1)}`,
    )
    .join(" ")
  const lx = (data.length - 1) * step
  const ly = h - 2 - (data[data.length - 1] / max) * (h - 5)
  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle cx={lx} cy={ly} r="2" fill="var(--primary)" />
    </svg>
  )
}

function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaColor,
  valueColor,
  trailing,
  onClick,
  active,
  title,
  plain,
}: {
  label: string
  value: string
  unit?: string
  delta?: string
  deltaColor?: string
  valueColor?: string
  trailing?: React.ReactNode
  onClick?: () => void
  active?: boolean
  title?: string
  /** 文本值（中文短语等）：不用等宽大数字样式 */
  plain?: boolean
}) {
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: active ? "var(--ai-deep)" : T.textMuted,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        {delta && (
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: deltaColor,
              fontFamily: T.mono,
            }}
          >
            {delta}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span
            style={
              plain
                ? {
                    fontSize: 13,
                    fontWeight: 800,
                    color: valueColor ?? T.text,
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                  }
                : {
                    fontSize: 16,
                    fontWeight: 800,
                    fontFamily: T.mono,
                    color: valueColor ?? T.text,
                    lineHeight: 1.25,
                  }
            }
          >
            {value}
          </span>
          {unit && (
            <span style={{ fontSize: 10, color: T.textMuted }}>{unit}</span>
          )}
        </div>
        {trailing}
      </div>
    </>
  )
  const boxStyle: React.CSSProperties = {
    padding: "3px 12px",
    borderRadius: 8,
    textAlign: "left",
    transition: "background-color 0.15s ease",
    background: active ? "var(--row-bg)" : "transparent",
  }
  if (!onClick) {
    return (
      <div style={boxStyle} title={title}>
        {inner}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        ...boxStyle,
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--row-bg)"
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent"
      }}
    >
      {inner}
    </button>
  )
}

function KpiStrip({
  activeLifecycle,
  onToggleTimeout,
  predict,
  activeDistrict,
}: {
  activeLifecycle: string | null
  onToggleTimeout: () => void
  /** 预测视图：切换为预测语义指标组（置信度/峰值时段/高发街道·重点网格/预置兵力） */
  predict?: boolean
  activeDistrict: string | null
}) {
    // hooks 一律顶部无条件调用（预测/实况两种渲染分支的 hook 数量必须一致）
    const confidence = useCountUp(82)
    const total = useCountUp(282)
    const aiShare = useCountUp(74)
    const rate = useCountUp(93)
    const hours = useCountUp(2.4, 1)
    const overtime = useCountUp(13)
    // ── 预测模式：与左列预测面板同构，遵守"不输出预测数量"口径 ──
    if (predict) {
      const street = activeDistrict ? streetByName(activeDistrict) : null
      const streetNames = ["朝阳门", "东直门", "安定门"]
      const streetGrids = street
        ? GRIDS.filter((g) => g.streetId === street.id)
            .sort((a, b) => b.events - a.events)
            .slice(0, 3)
        : []
      const cells = [
        <KpiCell
          key="conf"
          label="预测置信度"
          value={confidence}
          unit="%"
          title="由近14日走势外推 · 演示口径"
        />,
      <KpiCell
        key="peak"
        label="峰值时段"
        value="08–10 · 17–19"
        plain
        title="早晚双峰；夜间 22:00–06:00 低位运行"
      />,
      street ? (
        <KpiCell
          key="grids"
          label="该街道重点网格"
          value={`${streetGrids.length} 个`}
          title={streetGrids.map((g) => g.name).join("、")}
        />
      ) : (
        <KpiCell
          key="streets"
          label="高发街道"
          value={streetNames.join(" · ")}
          plain
          title="预测明日高发街道"
        />
      ),
      <KpiCell
        key="forces"
        label="预置兵力"
        value={`${FORECAST_SUGGESTIONS.length} 组`}
        title={FORECAST_SUGGESTIONS.join("；")}
      />,
    ]
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              borderLeft: i === 0 ? "none" : "1px solid var(--row-border)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {c}
          </div>
        ))}
      </div>
    )
  }
  const cells = [
    <KpiCell
      key="total"
      label="今日接入"
      value={total}
      unit="件"
      delta="▲12%"
      deltaColor={T.amber}
      title="在办 211 · 闭环 71 · 折线为近14日趋势"
      trailing={<HeatSparkline data={DAY_HEAT} />}
    />,
    <KpiCell
      key="ai"
      label="AI 自主发现"
      value={aiShare}
      unit="%"
      delta="▲6pt"
      deltaColor={T.green}
      title="AI 发现 209 / 共 282 件"
    />,
    <KpiCell
      key="rate"
      label="按期办结率"
      value={rate}
      unit="%"
      delta="▲1.8pt"
      deltaColor={T.green}
      title="按期办结 66 / 今日闭环 71"
    />,
    <KpiCell
      key="hours"
      label="平均处置时长"
      value={hours}
      unit="小时"
      delta="▼0.3h"
      deltaColor={T.green}
      title="较近7日均值下降 0.3 小时"
    />,
    <KpiCell
      key="overtime"
      label="超时预警"
      value={overtime}
      unit="件"
      valueColor={T.red}
      title="临近超时 2 · 已超时 11 · 点击联动筛选待处置池"
      onClick={onToggleTimeout}
      active={activeLifecycle === "待处置"}
    />,
  ]
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            borderLeft: i === 0 ? "none" : "1px solid var(--row-border)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {c}
        </div>
      ))}
    </div>
  )
}

const lifecycleData = [
  { label: "待立案", count: 38, color: T.primary, risk: "2件临近超时" },
  { label: "待处置", count: 94, color: T.amber, risk: "11件超时" },
  { label: "待核查", count: 67, color: T.purple, risk: "5件待外场核查" },
  { label: "待作废审核", count: 12, color: T.orange, risk: "" },
  { label: "已结案(今)", count: 71, color: T.green, risk: "" },
]
const aiAttentionEvents = [
  {
    id: "DC-2026-08201",
    type: "违规占道施工",
    level: "严重",
    location: "朝阳门南小街12号东侧",
    street: "朝阳门街道",
    gridId: "C02",
    gridName: "朝阳门南小街网格",
    date: "8/18",
    time: "08:23",
    status: "待核查",
    imgUrl: eventImage("违规占道施工", "during"),
    desc: "施工方封闭整条人行道，致使行人借道机动车道，已持续4小时",
  },
  {
    id: "DC-2026-08185",
    type: "大型垃圾堆积",
    level: "严重",
    location: "东直门内大街69号楼后巷",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    date: "8/18",
    time: "07:51",
    status: "待处置",
    imgUrl: eventImage("大型垃圾堆积", "during"),
    desc: "装修废料堆满整条小巷，已超时36小时，网格责任人首次处置被退回",
  },
  {
    id: "DC-2026-08162",
    type: "无证户外广告",
    level: "一般",
    location: "建国门内大街22号楼裙房顶部",
    street: "建国门街道",
    gridId: "J01",
    gridName: "建国门内大街网格",
    date: "8/18",
    time: "22:10",
    status: "待立案",
    imgUrl: eventImage("无证户外广告", "during"),
    desc: "AI识别到3块超规格广告牌，夜间灯光对周边居民造成影响",
  },
  {
    id: "DC-2026-08144",
    type: "共享单车违规堆放",
    level: "较重",
    location: "东直门内大街地铁口西侧",
    street: "东直门街道",
    gridId: "D02",
    gridName: "东直门北大街网格",
    date: "8/18",
    time: "06:40",
    status: "待处置",
    imgUrl: eventImage("共享单车违规堆放", "during"),
    desc: "早高峰前地铁站周边共享单车淤积，影响行人通行",
  },
  {
    id: "DC-2026-08130",
    type: "店外经营占道",
    level: "一般",
    location: "北新桥三条21号临街门市",
    street: "北新桥街道",
    gridId: "B01",
    gridName: "北新桥三条网格",
    date: "8/18",
    time: "19:15",
    status: "待立案",
    imgUrl: eventImage("店外经营占道", "during"),
    desc: "商户将桌椅摆至人行道，占用盲道约6米",
  },
  {
    id: "DC-2026-08112",
    type: "违规停放机动车",
    level: "一般",
    location: "朝阳门外大街工体西路路口",
    street: "朝阳门街道",
    gridId: "C03",
    gridName: "朝外大街网格",
    date: "8/17",
    time: "21:05",
    status: "已结案",
    imgUrl: eventImage("违规停放机动车", "during"),
    desc: "多辆机动车占用消防通道停放，已联系车主驶离",
  },
  {
    id: "DC-2026-08098",
    type: "违规施工扬尘",
    level: "严重",
    location: "建国门外大街16号在建项目",
    street: "建国门街道",
    gridId: "J02",
    gridName: "建外大街网格",
    date: "8/16",
    time: "14:30",
    status: "待核查",
    imgUrl: eventImage("违规施工扬尘", "during"),
    desc: "工地未采取降尘措施，周边道路能见度下降",
  },
  {
    id: "DC-2026-08076",
    type: "乱堆杂物（误报）",
    level: "一般",
    location: "北新桥三条胡同深处",
    street: "北新桥街道",
    gridId: "B02",
    gridName: "北新桥五条网格",
    date: "8/15",
    time: "11:20",
    status: "已无效",
    imgUrl: eventImage("乱堆杂物（误报）", "during"),
    desc: "AI识别为乱堆杂物，人工复核为居民临时堆放，已劝离",
  },
  {
    id: "DC-2026-08055",
    type: "无证户外广告",
    level: "较重",
    location: "东四南大街158号楼顶",
    street: "东四街道",
    gridId: "S01",
    gridName: "东四南大街网格",
    date: "8/14",
    time: "16:45",
    status: "待立案",
    imgUrl: eventImage("无证户外广告", "during"),
    desc: "楼顶新增大型灯箱广告，超出审批尺寸约30%",
  },
  {
    id: "DC-2026-08034",
    type: "共享单车违规停放",
    level: "一般",
    location: "交道口东大街公交站北侧",
    street: "交道口街道",
    gridId: "K01",
    gridName: "交道口东大街网格",
    date: "8/13",
    time: "08:10",
    status: "已结案",
    imgUrl: eventImage("共享单车违规停放", "during"),
    desc: "公交站周边共享单车停放超出电子围栏，已调度清理",
  },
  {
    id: "DC-2026-08021",
    type: "大型垃圾堆积",
    level: "严重",
    location: "龙潭路12号院门口",
    street: "龙潭街道",
    gridId: "L01",
    gridName: "龙潭路网格",
    date: "8/12",
    time: "09:50",
    status: "待处置",
    imgUrl: eventImage("大型垃圾堆积", "during"),
    desc: "装修垃圾占道堆放超过48小时，多次催办未清理",
  },
  {
    id: "DC-2026-08009",
    type: "店外经营占道",
    level: "较重",
    location: "崇文门外大街西花市口",
    street: "崇文门外街道",
    gridId: "W01",
    gridName: "崇外大街网格",
    date: "8/11",
    time: "18:30",
    status: "待处置",
    imgUrl: eventImage("店外经营占道", "during"),
    desc: "晚市期间多家商户出店经营，人行道通行宽度不足1米",
  },

  // 朝阳门街道（高热街道）补充数据
  {
    id: "DC-2026-08211",
    type: "施工围挡占道",
    level: "严重",
    location: "朝阳门内大街地铁F口",
    street: "朝阳门街道",
    gridId: "C07",
    gridName: "朝阳门内大街网格",
    date: "8/18",
    time: "09:15",
    status: "待核查",
    imgUrl: eventImage("施工围挡占道", "during"),
    desc: "地铁口施工围挡占压人行道约40米，早高峰行人被迫绕行非机动车道",
  },
  {
    id: "DC-2026-08212",
    type: "共享单车淤积",
    level: "较重",
    location: "朝外大街银河SOHO北侧",
    street: "朝阳门街道",
    gridId: "C03",
    gridName: "朝外大街网格",
    date: "8/18",
    time: "08:40",
    status: "待处置",
    imgUrl: eventImage("共享单车淤积", "during"),
    desc: "写字楼集中出入口单车停放超量，堵塞盲道与消防通道",
  },
  {
    id: "DC-2026-08213",
    type: "无证户外广告",
    level: "一般",
    location: "朝阳门南小街18号楼体",
    street: "朝阳门街道",
    gridId: "C02",
    gridName: "朝阳门南小街网格",
    date: "8/18",
    time: "14:20",
    status: "待立案",
    imgUrl: eventImage("无证户外广告", "during"),
    desc: "楼体侧墙新增一块约6㎡广告布，未见审批标识",
  },
  {
    id: "DC-2026-08214",
    type: "店外经营",
    level: "一般",
    location: "朝外大街东大桥路口",
    street: "朝阳门街道",
    gridId: "C03",
    gridName: "朝外大街网格",
    date: "8/18",
    time: "19:00",
    status: "待立案",
    imgUrl: eventImage("店外经营", "during"),
    desc: "夜间餐饮商户桌椅占道，影响行人正常通行",
  },
  {
    id: "DC-2026-08115",
    type: "违规占道施工",
    level: "严重",
    location: "朝阳门南小街20号门前",
    street: "朝阳门街道",
    gridId: "C02",
    gridName: "朝阳门南小街网格",
    date: "8/17",
    time: "10:30",
    status: "已结案",
    imgUrl: eventImage("违规占道施工", "during"),
    desc: "燃气抢修未设明显警示标志，已督促补办手续并恢复路面",
  },
  {
    id: "DC-2026-08116",
    type: "机动车乱停放",
    level: "较重",
    location: "朝阳门内大街81号院门口",
    street: "朝阳门街道",
    gridId: "C07",
    gridName: "朝阳门内大街网格",
    date: "8/17",
    time: "20:15",
    status: "待处置",
    imgUrl: eventImage("机动车乱停放", "during"),
    desc: "院门口消防通道被机动车占用，居民多次反映",
  },

  // 东直门街道（高热街道）补充数据
  {
    id: "DC-2026-08221",
    type: "大型垃圾堆积",
    level: "严重",
    location: "东直门南小街43号旁",
    street: "东直门街道",
    gridId: "D02",
    gridName: "东直门南小街网格",
    date: "8/18",
    time: "06:55",
    status: "待处置",
    imgUrl: eventImage("大型垃圾堆积", "during"),
    desc: "装修垃圾与生活垃圾混堆，散发异味，影响周边居民",
  },
  {
    id: "DC-2026-08222",
    type: "占道经营",
    level: "较重",
    location: "东直门内大街簋街西口",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    date: "8/18",
    time: "21:40",
    status: "待立案",
    imgUrl: eventImage("占道经营", "during"),
    desc: "夜间餐饮时段商户占用人行道摆桌，行人需绕行机动车道",
  },
  {
    id: "DC-2026-08223",
    type: "共享单车违规停放",
    level: "一般",
    location: "东直门交通枢纽北口",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    date: "8/18",
    time: "07:30",
    status: "已结案",
    imgUrl: eventImage("共享单车违规停放", "during"),
    desc: "枢纽换乘高峰单车淤积，已调度清运并加固电子围栏",
  },
  {
    id: "DC-2026-08224",
    type: "暴露垃圾",
    level: "一般",
    location: "东直门外大街48号楼下",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    date: "8/18",
    time: "15:10",
    status: "待处置",
    imgUrl: eventImage("暴露垃圾", "during"),
    desc: "垃圾桶满溢未及时清运，垃圾散落路面",
  },
  {
    id: "DC-2026-08125",
    type: "无证户外广告",
    level: "较重",
    location: "东直门内大街135号楼顶",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    date: "8/17",
    time: "16:00",
    status: "待立案",
    imgUrl: eventImage("无证户外广告", "during"),
    desc: "楼顶新增LED灯箱，亮度超标且未办理审批",
  },

  // 建国门街道（高热街道）补充数据
  {
    id: "DC-2026-08231",
    type: "违规施工扬尘",
    level: "严重",
    location: "建国门内大街18号在建楼宇",
    street: "建国门街道",
    gridId: "J01",
    gridName: "建国门内大街网格",
    date: "8/18",
    time: "11:00",
    status: "待核查",
    imgUrl: eventImage("违规施工扬尘", "during"),
    desc: "拆迁作业未洒水降尘，周边道路能见度明显下降",
  },
  {
    id: "DC-2026-08232",
    type: "机动车乱停放",
    level: "较重",
    location: "建国门外大街赛特购物中心西侧",
    street: "建国门街道",
    gridId: "J02",
    gridName: "建内大街南网格",
    date: "8/18",
    time: "17:45",
    status: "待处置",
    imgUrl: eventImage("机动车乱停放", "during"),
    desc: "商圈晚高峰非机动车道被机动车占用，长度约80米",
  },
  {
    id: "DC-2026-08233",
    type: "店外经营占道",
    level: "一般",
    location: "建国门内大街金宝街北口",
    street: "建国门街道",
    gridId: "J01",
    gridName: "建国门内大街网格",
    date: "8/18",
    time: "12:30",
    status: "待立案",
    imgUrl: eventImage("店外经营占道", "during"),
    desc: "午餐时段便利店货物堆放在人行道，影响通行",
  },
  {
    id: "DC-2026-08234",
    type: "共享单车淤积",
    level: "一般",
    location: "建国门地铁站A口",
    street: "建国门街道",
    gridId: "J01",
    gridName: "建国门内大街网格",
    date: "8/18",
    time: "08:20",
    status: "已结案",
    imgUrl: eventImage("共享单车淤积", "during"),
    desc: "地铁口早高峰单车停放超量，已调度至周边空闲点位",
  },
  {
    id: "DC-2026-08135",
    type: "无证户外广告",
    level: "较重",
    location: "建国门外大街22号国际饭店裙楼",
    street: "建国门街道",
    gridId: "J02",
    gridName: "建内大街南网格",
    date: "8/17",
    time: "09:50",
    status: "待立案",
    imgUrl: eventImage("无证户外广告", "during"),
    desc: "裙楼顶部新增一块约20㎡广告牌，超出原审批尺寸",
  },

  // 东四街道补充数据
  {
    id: "DC-2026-08241",
    type: "无证户外广告",
    level: "严重",
    location: "东四南大街220号楼顶",
    street: "东四街道",
    gridId: "E01",
    gridName: "东四十条网格",
    date: "8/18",
    time: "13:20",
    status: "待核查",
    imgUrl: eventImage("无证户外广告", "during"),
    desc: "楼顶广告牌钢架锈蚀严重，存在脱落风险",
  },
  {
    id: "DC-2026-08242",
    type: "占道经营",
    level: "较重",
    location: "东四北大街张自忠路口",
    street: "东四街道",
    gridId: "E02",
    gridName: "朝阳门北小街网格",
    date: "8/18",
    time: "18:50",
    status: "待处置",
    imgUrl: eventImage("占道经营", "during"),
    desc: "晚市流动摊贩占用人行道经营，阻碍通行",
  },
  {
    id: "DC-2026-08243",
    type: "共享单车违规停放",
    level: "一般",
    location: "东四地铁站C口",
    street: "东四街道",
    gridId: "E01",
    gridName: "东四十条网格",
    date: "8/18",
    time: "08:00",
    status: "已结案",
    imgUrl: eventImage("共享单车违规停放", "during"),
    desc: "地铁口单车停放超出电子围栏，已联系运维清运",
  },

  // 北新桥街道补充数据
  {
    id: "DC-2026-08251",
    type: "共享单车占道",
    level: "严重",
    location: "北新桥三条胡同口",
    street: "北新桥街道",
    gridId: "B03",
    gridName: "北新桥三条网格",
    date: "8/18",
    time: "07:15",
    status: "待处置",
    imgUrl: eventImage("共享单车占道", "during"),
    desc: "胡同口共享单车大量淤积，影响机动车与行人交汇",
  },
  {
    id: "DC-2026-08252",
    type: "施工占道",
    level: "较重",
    location: "北新桥头条13号门前",
    street: "北新桥街道",
    gridId: "B05",
    gridName: "北新桥头条网格",
    date: "8/18",
    time: "10:00",
    status: "待核查",
    imgUrl: eventImage("施工占道", "during"),
    desc: "电力抢修围挡占压人行道，未设置行人导行标识",
  },
  {
    id: "DC-2026-08253",
    type: "暴露垃圾",
    level: "一般",
    location: "民安街26号院墙外",
    street: "北新桥街道",
    gridId: "B08",
    gridName: "民安街网格",
    date: "8/18",
    time: "14:40",
    status: "待处置",
    imgUrl: eventImage("暴露垃圾", "during"),
    desc: "建筑垃圾临时堆放超过24小时，未覆盖防尘网",
  },

  // 东花市街道补充数据
  {
    id: "DC-2026-08261",
    type: "施工占道",
    level: "较重",
    location: "东花市大街北里西区段",
    street: "东花市街道",
    gridId: "H01",
    gridName: "东花市大街网格",
    date: "8/18",
    time: "09:30",
    status: "待核查",
    imgUrl: eventImage("施工占道", "during"),
    desc: "道路翻新施工围挡未设反光条，夜间存在安全隐患",
  },
  {
    id: "DC-2026-08262",
    type: "店外经营",
    level: "一般",
    location: "东花市南里市场东侧",
    street: "东花市街道",
    gridId: "H01",
    gridName: "东花市大街网格",
    date: "8/18",
    time: "17:20",
    status: "待立案",
    imgUrl: eventImage("店外经营", "during"),
    desc: "市场周边商户将货物摆至人行道，通行宽度不足1.5米",
  },

  // 安定门、崇文门外等补充数据
  {
    id: "DC-2026-08271",
    type: "施工占道",
    level: "较重",
    location: "安定门内大街路口",
    street: "安定门街道",
    gridId: "AD01",
    gridName: "安定门内大街网格",
    date: "8/18",
    time: "11:30",
    status: "待核查",
    imgUrl: eventImage("施工占道", "during"),
    desc: "道路养护作业占用半幅非机动车道，未设明显警示",
  },
  {
    id: "DC-2026-08272",
    type: "暴露垃圾",
    level: "一般",
    location: "崇文门外大街新世界百货南侧",
    street: "崇文门外街道",
    gridId: "CW01",
    gridName: "崇外大街网格",
    date: "8/18",
    time: "16:10",
    status: "待处置",
    imgUrl: eventImage("暴露垃圾", "during"),
    desc: "商圈周边垃圾桶满溢，地面散落餐盒与包装袋",
  },

  // 8/11 历史数据补充（北新桥等高热街道）
  {
    id: "DC-2026-08101",
    type: "共享单车占道",
    level: "严重",
    location: "北新桥三条胡同口",
    street: "北新桥街道",
    gridId: "B03",
    gridName: "北新桥三条网格",
    date: "8/11",
    time: "08:00",
    status: "待处置",
    imgUrl: eventImage("共享单车占道", "during"),
    desc: "早高峰共享单车大量淤积，机动车与行人交汇困难",
  },
  {
    id: "DC-2026-08102",
    type: "施工占道",
    level: "较重",
    location: "北新桥头条7号门前",
    street: "北新桥街道",
    gridId: "B05",
    gridName: "北新桥头条网格",
    date: "8/11",
    time: "10:20",
    status: "待核查",
    imgUrl: eventImage("施工占道", "during"),
    desc: "电力管线抢修围挡占压人行道，未设导行标识",
  },
  {
    id: "DC-2026-08103",
    type: "占道经营",
    level: "较重",
    location: "民安街早市段",
    street: "北新桥街道",
    gridId: "B08",
    gridName: "民安街网格",
    date: "8/11",
    time: "07:30",
    status: "待立案",
    imgUrl: eventImage("占道经营", "during"),
    desc: "早市摊贩占用人行道经营，影响周边居民出行",
  },
  {
    id: "DC-2026-08104",
    type: "暴露垃圾",
    level: "一般",
    location: "北新桥二条26号院外",
    street: "北新桥街道",
    gridId: "B03",
    gridName: "北新桥三条网格",
    date: "8/11",
    time: "14:00",
    status: "待处置",
    imgUrl: eventImage("暴露垃圾", "during"),
    desc: "建筑垃圾临时堆放未覆盖，风大时扬尘明显",
  },
  {
    id: "DC-2026-08105",
    type: "机动车乱停放",
    level: "一般",
    location: "雍和宫大街西侧",
    street: "北新桥街道",
    gridId: "B05",
    gridName: "北新桥头条网格",
    date: "8/11",
    time: "19:40",
    status: "待处置",
    imgUrl: eventImage("机动车乱停放", "during"),
    desc: "晚间旅游车辆占用非机动车道停放，长度约60米",
  },

  // 8/11 其他高热街道历史数据
  {
    id: "DC-2026-08106",
    type: "违规占道施工",
    level: "严重",
    location: "朝阳门南小街31号门前",
    street: "朝阳门街道",
    gridId: "C02",
    gridName: "朝阳门南小街网格",
    date: "8/11",
    time: "09:10",
    status: "待核查",
    imgUrl: eventImage("违规占道施工", "during"),
    desc: "道路翻新施工未办理占道许可，占压半幅人行道",
  },
  {
    id: "DC-2026-08107",
    type: "大型垃圾堆积",
    level: "较重",
    location: "东直门内大街185号楼后",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    date: "8/11",
    time: "11:00",
    status: "待处置",
    imgUrl: eventImage("大型垃圾堆积", "during"),
    desc: "餐饮商户厨余垃圾与装修废料混堆，散发异味",
  },
  {
    id: "DC-2026-08108",
    type: "无证户外广告",
    level: "较重",
    location: "建国门外大街18号写字楼顶",
    street: "建国门街道",
    gridId: "J02",
    gridName: "建内大街南网格",
    date: "8/11",
    time: "15:30",
    status: "待立案",
    imgUrl: eventImage("无证户外广告", "during"),
    desc: "楼顶新增大型广告牌，超出原审批尺寸约15㎡",
  },
  {
    id: "DC-2026-08109",
    type: "店外经营占道",
    level: "一般",
    location: "东四南大街90号商铺",
    street: "东四街道",
    gridId: "E01",
    gridName: "东四十条网格",
    date: "8/11",
    time: "18:00",
    status: "待立案",
    imgUrl: eventImage("店外经营占道", "during"),
    desc: "晚市时段商户将货架摆至人行道，通行受阻",
  },
  {
    id: "DC-2026-08110",
    type: "施工占道",
    level: "较重",
    location: "东花市大街北里东区段",
    street: "东花市街道",
    gridId: "H01",
    gridName: "东花市大街网格",
    date: "8/11",
    time: "08:45",
    status: "待核查",
    imgUrl: eventImage("施工占道", "during"),
    desc: "供热管网改造围挡占压非机动车道，早高峰通行缓慢",
  },
]

// ─── 历史回放补全 ────────────────────────────────────────────────────────
// 热力回放覆盖 8/05–8/19，但人工整理事件集中在 8/11 之后；
// 8/05–8/10 按确定性规则从基础事件池派生归档事件（已结案/已无效），
// 保证回放推进时「AI 实时研判事件」逐日联动、不再出现空档
const REPLAY_BACKFILL_DATES = ["8/05", "8/06", "8/07", "8/08", "8/09", "8/10"]
const REPLAY_BACKFILL_TIMES = ["07:40", "09:20", "14:05", "18:30"]
const historyReplayEvents = REPLAY_BACKFILL_DATES.flatMap((date, di) =>
  Array.from({ length: 4 }, (_, k) => {
    const src =
      aiAttentionEvents[(di * 11 + k * 9 + 3) % aiAttentionEvents.length]
    return {
      ...src,
      id: `DC-2026-H${di}${k}`,
      date,
      time: REPLAY_BACKFILL_TIMES[(di + k) % REPLAY_BACKFILL_TIMES.length],
      status: k % 3 === 1 ? "已无效" : "已结案",
    }
  }),
)
const replayableAttentionEvents = [
  ...aiAttentionEvents,
  ...historyReplayEvents,
]
const districtPolygons = [
  {
    name: "和平里街道",
    pts: "48,6 228,6 228,68 48,68",
    cx: 138,
    cy: 37,
    color: T.primary,
    events: 15,
  },
  {
    name: "东直门街道",
    pts: "228,6 274,6 274,150 228,150",
    cx: 251,
    cy: 78,
    color: "#E45E58",
    events: 38,
  },
  {
    name: "安定门街道",
    pts: "48,68 148,68 148,128 48,128",
    cx: 98,
    cy: 98,
    color: "#35B985",
    events: 22,
  },
  {
    name: "北新桥街道",
    pts: "148,68 228,68 228,150 148,150",
    cx: 188,
    cy: 109,
    color: "#FF7A42",
    events: 24,
  },
  {
    name: "交道口街道",
    pts: "48,128 110,128 110,178 48,178",
    cx: 79,
    cy: 153,
    color: "#7568D8",
    events: 18,
  },
  {
    name: "景山街道",
    pts: "18,178 110,178 110,272 18,272",
    cx: 64,
    cy: 225,
    color: "#24D6D2",
    events: 11,
  },
  {
    name: "东四街道",
    pts: "110,128 228,128 228,238 110,238",
    cx: 169,
    cy: 183,
    color: "#326DFF",
    events: 31,
  },
  {
    name: "朝阳门街道",
    pts: "228,150 274,150 274,238 228,238",
    cx: 251,
    cy: 194,
    color: "#E45E58",
    events: 47,
  },
  {
    name: "东华门街道",
    pts: "18,272 122,272 122,335 18,335",
    cx: 70,
    cy: 303,
    color: "#7568D8",
    events: 19,
  },
  {
    name: "建国门街道",
    pts: "122,238 274,238 274,310 122,310",
    cx: 198,
    cy: 274,
    color: "#326DFF",
    events: 29,
  },
  {
    name: "前门街道",
    pts: "18,335 108,335 108,402 18,402",
    cx: 63,
    cy: 368,
    color: "#24D6D2",
    events: 16,
  },
  {
    name: "崇文门外街道",
    pts: "108,310 192,310 192,382 108,382",
    cx: 150,
    cy: 346,
    color: "#FF7A42",
    events: 22,
  },
  {
    name: "东花市街道",
    pts: "192,310 274,310 274,382 192,382",
    cx: 233,
    cy: 346,
    color: "#7568D8",
    events: 25,
  },
  {
    name: "体育馆路街道",
    pts: "70,382 192,382 192,450 70,450",
    cx: 131,
    cy: 416,
    color: "#35B985",
    events: 14,
  },
  {
    name: "龙潭街道",
    pts: "192,382 274,382 274,450 192,450",
    cx: 233,
    cy: 416,
    color: "#FF7A42",
    events: 18,
  },
  {
    name: "天坛街道",
    pts: "18,402 70,402 70,450 18,450",
    cx: 44,
    cy: 426,
    color: "#326DFF",
    events: 12,
  },
  {
    name: "永定门外街道",
    pts: "18,450 274,450 274,490 18,490",
    cx: 146,
    cy: 470,
    color: "#35B985",
    events: 8,
  },
]

const levelOrder: Record<string, number> = { 严重: 3, 较重: 2, 一般: 1 }

// ─── 明日事件预测（AI 走势外推，仅预测视图） ──────────────────────────────
// 配色刻意走青色系 + 虚线描边，与历史/今日实况（蓝/红系、实线、照片卡）明确区分
// 全域五段：预测高发网格 / 类型 / 时段 / 24h 数量趋势 / 预置兵力建议
// 街道四段：该街道预测高发网格 / 类型 / 时段 / 该街道24h趋势（无兵力建议）
const FORECAST_TYPE_NAMES = [
  "占道经营",
  "共享单车乱停",
  "店外经营",
  "无证户外广告",
  "其他类型",
]
const FORECAST_SUGGESTIONS = [
  "早高峰在朝阳门南小街、东直门内大街网格预置巡查力量",
  "共享单车清运前置至 07:30，覆盖三处高发点位",
  "两处施工占道建议提前完成预审与围挡核验",
]
const FORECAST_PEAKS = [
  { label: "早高峰", range: "08:00–10:00" },
  { label: "晚高峰", range: "17:00–19:00" },
]

// 确定性 24 小时预测曲线：早晚双峰 + 午间小峰 + 种子抖动（同一街道每次刷新一致）
const seedHash = (s: string) => {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const hourlyForecast = (seedKey: string, scale: number) => {
  const seed = seedHash(seedKey)
  return Array.from({ length: 24 }, (_, h) => {
    const morning = Math.exp(-((h - 9) ** 2) / (2 * 1.8 ** 2))
    const evening = Math.exp(-((h - 18) ** 2) / (2 * 2.1 ** 2))
    const noon = 0.35 * Math.exp(-((h - 13) ** 2) / (2 * 1.6 ** 2))
    const jitter = ((seed >>> (h % 11)) % 5) / 10 - 0.2
    return Math.max(
      1,
      Math.round(
        (2 + 16 * morning + 12 * evening + 4.5 * noon) * scale * (1 + jitter),
      ),
    )
  })
}
const isPeakHour = (h: number) => (h >= 8 && h <= 10) || (h >= 17 && h <= 19)

// 预测面板小节：顶部细分隔线 + 编号标题（无框，靠留白分区）
function ForecastSection({
  no,
  title,
  first,
  children,
}: {
  no: string
  title: string
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        paddingTop: first ? 0 : 12,
        marginTop: 2,
        borderTop: first ? "none" : "1px solid var(--row-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            fontFamily: T.mono,
            color: "var(--ai-deep)",
          }}
        >
          {no}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.text,
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ marginTop: 9 }}>{children}</div>
    </div>
  )
}

function TomorrowForecast({ activeDistrict }: { activeDistrict: string | null }) {
  const street = activeDistrict ? streetByName(activeDistrict) : null
  // 01 高发网格：全域取 TOP_GRIDS 前四，街道取该街道事件基数前三
  const hotGrids: Array<{
    id: string
    name: string
    sub: string
    tag: string
  }> = street
    ? GRIDS.filter((g) => g.streetId === street.id)
        .sort((a, b) => b.events - a.events)
        .slice(0, 3)
        .map((g) => ({
          id: g.id,
          name: g.name,
          sub: `主发类型 ${g.type}`,
          tag: g.watch ? "重点关注" : "持续关注",
        }))
    : TOP_GRIDS.slice(0, 4).map((g) => ({
        id: g.grid,
        name: g.name,
        sub: streetById(g.streetId)?.name ?? "",
        tag: g.tag,
      }))
  // 02 高发类型：街道视图收敛前三
  const types = activeDistrict
    ? FORECAST_TYPE_NAMES.slice(0, 3)
    : FORECAST_TYPE_NAMES
  // 04 24h 趋势：全域全局曲线，街道按 0.34 缩放并注入街道种子
  const hourly = hourlyForecast(
    activeDistrict ?? "dongcheng-global",
    street ? 0.34 : 1,
  )
  const peakVal = Math.max(...hourly)
  const peakHour = hourly.indexOf(peakVal)

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 4px" }}>
        {/* 01 预测高发网格 */}
        <ForecastSection
          no="01"
          title={street ? "该街道预测高发网格" : "预测高发网格"}
          first
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {hotGrids.map((g, i) => (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 2px",
                  borderBottom:
                    i < hotGrids.length - 1
                      ? "1px solid var(--row-border)"
                      : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: T.mono,
                    color: i === 0 ? "var(--ai-deep)" : T.textMuted,
                    width: 16,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.name}
                  </div>
                  {g.sub && (
                    <div
                      style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}
                    >
                      {g.sub}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--ai-deep)",
                    backgroundColor: "rgba(36,214,210,0.10)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    flexShrink: 0,
                  }}
                >
                  {g.tag}
                </span>
              </div>
            ))}
          </div>
        </ForecastSection>

        {/* 02 预测高发类型 */}
        <ForecastSection no="02" title="预测高发类型">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {types.map((t) => (
              <span
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 11px",
                  borderRadius: 999,
                  backgroundColor: "var(--row-bg)",
                  fontSize: 11,
                  color: T.text,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: "var(--ai-deep)",
                  }}
                />
                {t}
              </span>
            ))}
          </div>
        </ForecastSection>

        {/* 03 预测高发时段 */}
        <ForecastSection no="03" title="预测高发时段">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FORECAST_PEAKS.map((p) => (
              <span
                key={p.label}
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                  padding: "5px 11px",
                  borderRadius: 8,
                  backgroundColor: "var(--row-bg)",
                  fontSize: 12,
                  color: T.text,
                  fontWeight: 700,
                  fontFamily: T.mono,
                }}
              >
                {p.range}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.textMuted,
                    fontFamily: "'Noto Sans SC', sans-serif",
                  }}
                >
                  {p.label}
                </span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 7 }}>
            夜间 22:00–06:00 低位运行
          </div>
        </ForecastSection>

        {/* 04 明日24小时预测趋势 */}
        <ForecastSection
          no="04"
          title={street ? "该街道明日24小时趋势" : "明日24小时趋势"}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 7,
              }}
            >
              <span style={{ fontSize: 10, color: T.textMuted }}>
                预测事件数量（件）
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: T.mono,
                  color: "var(--ai-deep)",
                }}
              >
                峰值 {peakVal} 件 · {String(peakHour).padStart(2, "0")} 时
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: 56,
              }}
            >
              {hourly.map((v, h) => (
                <div
                  key={h}
                  title={`${String(h).padStart(2, "0")}:00 约 ${v} 件`}
                  style={{
                    flex: 1,
                    height: `${Math.max(6, (v / peakVal) * 100)}%`,
                    borderRadius: 2,
                    backgroundColor: isPeakHour(h)
                      ? "var(--ai-deep)"
                      : "rgba(36,214,210,0.30)",
                    boxShadow: isPeakHour(h)
                      ? "0 0 6px rgba(36,214,210,0.45)"
                      : "none",
                    transition: "height 0.3s ease",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
              {hourly.map((_, h) => (
                <div
                  key={h}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 8,
                    fontFamily: T.mono,
                    color: T.textMuted,
                  }}
                >
                  {h % 6 === 0 || h === 23 ? String(h).padStart(2, "0") : ""}
                </div>
              ))}
            </div>
          </div>
        </ForecastSection>

        {/* 05 预置兵力建议（仅全域） */}
        {!activeDistrict && (
          <ForecastSection no="05" title="预置兵力建议">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {FORECAST_SUGGESTIONS.map((s, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: T.text,
                    lineHeight: 1.6,
                    display: "flex",
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      color: "var(--ai-deep)",
                      fontWeight: 800,
                      fontFamily: T.mono,
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          </ForecastSection>
        )}
        <div
          style={{
            marginTop: 12,
            fontSize: 10,
            color: T.textMuted,
            lineHeight: 1.6,
          }}
        >
          预测结果由近14日走势外推生成，仅供调度预置参考，不生成正式工单。
        </div>
      </div>
    </>
  )
}

function AttentionPanel({
  activeDistrict,
  dayIndex,
  metric,
  onSelectEvent,
}: {
  activeDistrict: string | null
  dayIndex: number
  metric: HeatMetric
  onSelectEvent: (street: string, gridId: string) => void
}) {
  const isCurrent = dayIndex === DAYS.length - 1
  const isPredict = dayIndex >= PREDICT_INDEX
  const selectedDate = isPredict ? TOMORROW_LABEL : DAYS[dayIndex]

  // 明日预测视图：发生数量口径下展示 AI 预测面板（区别于历史/今日实况）
  if (metric === "severe" && isPredict) {
    return <TomorrowForecast activeDistrict={activeDistrict} />
  }

  if (metric !== "severe") {
    return (
      <>
        <div style={{ padding: "10px 12px 0" }}>
          <div
            style={{
              border: `1px solid ${T.border}`,
              background: T.panelSolid,
              borderRadius: 10,
              padding: 10,
              borderLeft: `3px solid ${T.accent}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: T.accent,
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              {isPredict ? "AI 预测研判" : "AI 实时研判"}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 750,
                color: T.text,
                lineHeight: 1.45,
              }}
            >
              {isPredict
                ? "明日复发热点预计仍在朝阳门南小街与东直门，建议提前布防。"
                : "相机正在扫过东城，高热落在朝阳门、东直门。"}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
              点街道看网格；点网格看这块地的节律，不是工单列表。
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {aiAttentionEvents.slice(0, 6).map((evt) => (
            <EventCard
              key={evt.id}
              evt={evt}
              onClick={() => onSelectEvent(evt.street, evt.gridId)}
            />
          ))}
        </div>
      </>
    )
  }

  let filtered = aiAttentionEvents.filter((e) => e.date === selectedDate)
  if (activeDistrict) {
    filtered = filtered.filter((e) => e.street === activeDistrict)
  }

  // Sort by severity, then by time
  const sorted = filtered
    .sort((a, b) => {
      const levelDiff = (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0)
      if (levelDiff !== 0) return levelDiff
      return a.time.localeCompare(b.time)
    })
    .slice(0, 6)

  // Compute top grids for selected street
  const topGrids = activeDistrict
    ? Object.values(
        filtered.reduce<Record<string, {
          name: string
          count: number
          gridId: string
        }>>((acc, e) => {
          if (!acc[e.gridId])
            acc[e.gridId] = { name: e.gridName, count: 0, gridId: e.gridId }
          acc[e.gridId].count += 1
          return acc
        }, {}),
      )
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
    : []

  // Compute top streets for district-wide view
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
        .slice(0, 5)
    : []

  const titleLine = activeDistrict
    ? `${activeDistrict}${isCurrent ? " · 当前" : ` · ${selectedDate}`}`
    : isCurrent
      ? "东城区 · 当前"
      : `东城区 · ${selectedDate}`

  const subtitleLine = activeDistrict
    ? `中/较重/严重事件，共 ${sorted.length} 条`
    : `高热街道与中/较重/严重事件，共 ${sorted.length} 条`

  const hotTags = activeDistrict ? topGrids : topStreets

  return (
    <>
      <div style={{ padding: "10px 12px 0" }}>
        <div
          style={{
            border: `1px solid ${T.border}`,
            background: T.panelSolid,
            borderRadius: 10,
            padding: 10,
            borderLeft: `3px solid ${T.red}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: T.red,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: T.red,
                letterSpacing: "0.06em",
              }}
            >
              发生数量口径 · AI 实时研判
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 750,
              color: T.text,
              lineHeight: 1.45,
            }}
          >
            {titleLine}
          </div>
          {hotTags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {hotTags.map((tag: any) => (
                <span
                  key={(tag as any).gridId || (tag as any).name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 4,
                    backgroundColor: "rgba(228,94,88,0.08)",
                    border: `1px solid rgba(228,94,88,0.18)`,
                    color: T.text,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: T.red,
                    }}
                  />
                  {activeDistrict
                    ? (tag as any).name
                    : (tag as any).name.replace("街道", "")}
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
            {subtitleLine}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {sorted.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: T.textMuted,
              fontSize: 12,
              border: `1px dashed ${T.border}`,
              borderRadius: 8,
              backgroundColor: T.panelSolid,
            }}
          >
            该范围/日期下暂无事件
          </div>
        ) : (
          sorted.map((evt) => (
            <EventCard
              key={evt.id}
              evt={evt}
              onClick={() => onSelectEvent(evt.street, evt.gridId)}
            />
          ))
        )}
      </div>
    </>
  )
}

function EventCard({
  evt,
  onClick,
}: {
  evt: typeof aiAttentionEvents[number]
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: 10,
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        overflow: "hidden",
        backgroundColor: T.card,
        cursor: "pointer",
        boxShadow: T.shadow,
      }}
    >
      <div style={{ height: 108, position: "relative", overflow: "hidden" }}>
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
              "linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <span
            style={{
              backgroundColor:
                evt.level === "严重"
                  ? T.red
                  : evt.level === "较重"
                    ? T.amber
                    : T.primary,
              color: T.cardSolid,
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 3,
            }}
          >
            {evt.level}
          </span>
          <span style={{ fontSize: 10, color: "var(--glass-bg-strong)" }}>
            {evt.time}
          </span>
        </div>
      </div>
      <div style={{ padding: "9px 10px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
            {evt.type}
          </span>
          <span
            style={{
              fontSize: 10,
              color: T.purple,
              backgroundColor: "rgba(117,104,216,0.08)",
              padding: "1px 6px",
              borderRadius: 3,
              border: "1px solid rgba(117,104,216,0.18)",
            }}
          >
            {evt.status}
          </span>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
          {evt.location}
        </div>
        <p
          style={{ fontSize: 11, color: T.textSub, lineHeight: 1.5, margin: 0 }}
        >
          {evt.desc}
        </p>
        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: T.textMuted,
            fontFamily: T.mono,
          }}
        >
          #{evt.id}
        </div>
      </div>
    </div>
  )
}

function GovernanceDashboard({
  presentationMode,
  setPresentationMode,
}: {
  presentationMode: boolean
  setPresentationMode: (v: boolean) => void
}) {
  const [activeLifecycle, setActiveLifecycle] = useState<string | null>(null)
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null)
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null)
  const [activeGridId, setActiveGridId] = useState<string | null>(null)
  const [metric, setMetric] = useState<HeatMetric>("severe")
  const [dayIndex, setDayIndex] = useState(13)
  const [playing, setPlaying] = useState(false)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  // 地图当前热力样式（由 DongchengHeatmapMap 上报，驱动图例渐变联动）
  const [mapHeatMode, setMapHeatMode] = useState<"classic" | "gaussian">(
    "classic",
  )

  useEffect(() => {
    if (!playing) return
    // 回放轴含明日预测槽：历史14日 → 今日 → 明日预测
    const t = setInterval(() => setDayIndex((d) => (d + 1) % PLAY_DAYS.length), 520)
    return () => clearInterval(t)
  }, [playing])

  // 实况新事件接入（演示）：仅实况视图生效，每 18s 注入一条新事件到轮播，
  // 卡片红光脉冲 + NEW 徽标持续 6s；进入预测视图自动清空
  const [liveFeed, setLiveFeed] = useState<
    (typeof aiAttentionEvents)[number][]
  >([])
  const [arrivingId, setArrivingId] = useState<string | null>(null)
  const liveSeqRef = useRef(0)
  const isLiveView = dayIndex < PREDICT_INDEX
  useEffect(() => {
    if (!isLiveView) return
    const injectLiveEvent = () => {
      const pool = aiAttentionEvents
        .filter((e) => e.date === DAYS[13])
        .slice(0, 6)
      if (pool.length === 0) return
      const tpl = pool[liveSeqRef.current % pool.length]
      liveSeqRef.current += 1
      const ev = {
        ...tpl,
        id: `LIVE-${Date.now()}`,
        time: "刚刚",
        status: "待处置",
      }
      setLiveFeed((prev) => [ev, ...prev].slice(0, 6))
      setArrivingId(ev.id)
      window.setTimeout(() => {
        setArrivingId((cur) => (cur === ev.id ? null : cur))
      }, 6000)
    }
    // 演示/验证钩子：控制台可手动触发一次新事件接入
    ;(window as unknown as { __liveInject?: () => void }).__liveInject =
      injectLiveEvent
    const t = setInterval(injectLiveEvent, 18000)
    return () => {
      clearInterval(t)
      delete (window as unknown as { __liveInject?: () => void }).__liveInject
      setLiveFeed([])
      setArrivingId(null)
    }
  }, [isLiveView])

  const street = streetByName(activeDistrict)
  const grid = gridById(activeGridId)

  const selectedDate =
    dayIndex >= PREDICT_INDEX ? TOMORROW_LABEL : DAYS[dayIndex]
  // 回放联动：用补全后的历史事件池按回放日期过滤，
  // 使「AI 实时研判事件」随热力回放时间轴逐日切换
  const selectedDateEvents = replayableAttentionEvents.filter(
    (e) => e.date === selectedDate,
  )
  const districtEvents = activeDistrict
    ? selectedDateEvents.filter((e) => e.street === activeDistrict)
    : selectedDateEvents

  const lifecycleToEventStatus = (label: string): string[] => {
    switch (label) {
      case "已结案(今)":
        return ["已结案"]
      case "待作废审核":
        return ["待作废审核"]
      default:
        return [label]
    }
  }

  const baseCarouselEvents = districtEvents
    .filter((e) =>
      activeLifecycle
        ? lifecycleToEventStatus(activeLifecycle).includes(e.status)
        : true,
    )
    .sort((a, b) => {
      const levelDiff = (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0)
      if (levelDiff !== 0) return levelDiff
      return a.time.localeCompare(b.time)
    })
    .slice(0, 6)
  // 新接入事件置顶轮播（按当前范围/口径过滤），随后是既有事件
  const liveVisible = isLiveView
    ? liveFeed.filter(
        (e) =>
          (!activeDistrict || e.street === activeDistrict) &&
          (!activeLifecycle ||
            lifecycleToEventStatus(activeLifecycle).includes(e.status)),
      )
    : []
  const carouselEvents = [...liveVisible, ...baseCarouselEvents].slice(0, 8)

  const lifecycleRatio =
    selectedDateEvents.length > 0
      ? districtEvents.length / selectedDateEvents.length
      : 1
  const lifecycleDataDynamic = lifecycleData.map((item) => ({
    ...item,
    count: Math.max(0, Math.round(item.count * lifecycleRatio)),
    risk: lifecycleRatio < 1 ? "" : item.risk,
  }))

  const activeStreetId = street?.id
  const filteredTopGrids = activeStreetId
    ? TOP_GRIDS.filter((g) => g.streetId === activeStreetId).slice(0, 5)
    : TOP_GRIDS.slice(0, 5)

  const goAll = () => {
    setActiveDistrict(null)
    setActiveGridId(null)
    setPlaying(false)
    setDayIndex(13)
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          padding: "10px 16px 12px",
          flexShrink: 0,
        }}
      >
        <AIConclusion
          activeDistrict={activeDistrict}
          metric={metric}
          dayIndex={dayIndex}
          events={aiAttentionEvents}
          presentationMode={presentationMode}
          setPresentationMode={setPresentationMode}
          kpiSlot={
            <KpiStrip
              activeLifecycle={activeLifecycle}
              predict={dayIndex >= PREDICT_INDEX}
              activeDistrict={activeDistrict}
              onToggleTimeout={() =>
                setActiveLifecycle(activeLifecycle === "待处置" ? null : "待处置")
              }
            />
          }
        />
      </div>
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: mapFullscreen ? "1fr" : "248px 1fr",
          gridTemplateRows: "1fr",
          gap: mapFullscreen ? 0 : 12,
          padding: mapFullscreen ? "0 0 12px" : "0 16px 12px",
          overflow: "hidden",
          minHeight: 0,
          transition:
            "grid-template-columns 0.25s ease, gap 0.25s ease, padding 0.25s ease",
        }}
      >
        {!mapFullscreen &&
          (dayIndex >= PREDICT_INDEX ? (
            /* 明日预测视图：左列单格替换为 AI 预测面板（保持 Grid 结构，地图格不受影响） */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              <TomorrowForecast activeDistrict={activeDistrict} />
            </div>
          ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflow: "hidden",
            }}
          >
            <Card
              style={{
                padding: "10px 14px",
                flex: "0 0 220px",
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "0 0 8px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: T.red,
                      boxShadow: `0 0 10px ${T.red}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: T.text,
                      letterSpacing: "0.02em",
                    }}
                  >
                    生命周期脉冲
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  gap: 4,
                }}
              >
                {lifecycleDataDynamic.map((item) => {
                  const isActive = activeLifecycle === item.label
                  const pct = Math.min(100, Math.round((item.count / 94) * 100))
                  return (
                    <button
                      key={item.label}
                      onClick={() =>
                        setActiveLifecycle(isActive ? null : item.label)
                      }
                      style={{
                        background: isActive
                          ? `${item.color}12`
                          : "var(--row-bg)",
                        border: `1px solid ${
                          isActive ? `${item.color}40` : "transparent"
                        }`,
                        borderRadius: 8,
                        padding: "5px 8px",
                        cursor: "pointer",
                        textAlign: "left",
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                        boxShadow: isActive
                          ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px ${item.color}18`
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "var(--control-bg-hover)"
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(22,45,77,0.06)"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "var(--row-bg)"
                          e.currentTarget.style.boxShadow = "none"
                        }
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isActive ? item.color : T.text,
                          }}
                        >
                          {item.label}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {item.risk && (
                            <span
                              style={{
                                fontSize: 9,
                                color: T.amber,
                                fontWeight: 500,
                              }}
                            >
                              {item.risk}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: item.color,
                              fontFamily: T.mono,
                            }}
                          >
                            {item.count}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 4,
                          backgroundColor: T.border,
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: `linear-gradient(90deg, ${item.color}, ${item.color}DD)`,
                            borderRadius: 3,
                            boxShadow: `0 0 8px ${item.color}50`,
                          }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>
            <Card
              style={{
                padding: "12px 14px",
                flex: 1,
                minHeight: 220,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "0 0 8px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: T.amber,
                      boxShadow: `0 0 10px ${T.amber}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: T.text,
                      letterSpacing: "0.02em",
                    }}
                  >
                    高发网格 TOP 5
                  </span>
                </div>
              </div>
              {filteredTopGrids.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {filteredTopGrids.map((row, i) => {
                    const on = activeGridId === row.grid
                    return (
                      <button
                        key={row.name}
                        type="button"
                        onClick={() => {
                          setActiveDistrict(streetById(row.streetId)?.name ?? null)
                          setActiveGridId(row.grid)
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 6px",
                          border: `1px solid ${
                            on ? "rgba(91,141,255,0.30)" : "transparent"
                          }`,
                          borderRadius: 8,
                          background: on
                            ? "rgba(50,109,255,0.10)"
                            : "var(--row-bg)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.2s ease",
                          boxShadow: on
                            ? "inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px rgba(50,109,255,0.12)"
                            : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!on) {
                            e.currentTarget.style.background = "var(--control-bg-hover)"
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(22,45,77,0.06)"
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!on) {
                            e.currentTarget.style.background = "var(--row-bg)"
                            e.currentTarget.style.boxShadow = "none"
                          }
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 5,
                            flexShrink: 0,
                            background:
                              i === 0
                                ? `linear-gradient(135deg, ${T.red}, ${T.amber})`
                                : i === 1
                                  ? `linear-gradient(135deg, ${T.amber}, #FFC107)`
                                  : T.card2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 800,
                            color: i < 2 ? T.cardSolid : T.textMuted,
                            border: i >= 2 ? `1px solid ${T.border}` : "none",
                            boxShadow:
                              i < 2 ? "0 2px 8px rgba(22,45,77,0.12)" : "none",
                          }}
                        >
                          {i + 1}
                        </span>
                        <span style={{ flex: 1 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              color: T.text,
                              fontWeight: 600,
                            }}
                          >
                            {row.name}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: T.text,
                            fontFamily: T.mono,
                          }}
                        >
                          {row.count}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: row.trend.startsWith("+")
                              ? T.red
                              : row.trend === "0"
                                ? T.textMuted
                                : T.green,
                          }}
                        >
                          {row.trend}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: "16px 4px",
                    textAlign: "center",
                    fontSize: 12,
                    color: T.textMuted,
                  }}
                >
                  该街道暂无高发网格数据
                </div>
              )}
            </Card>
            <div style={{ flex: "0 0 210px", minHeight: 0 }}>
              <EventCarousel
                events={carouselEvents}
                arrivingId={arrivingId}
                onSelect={(street, gridId) => {
                  setActiveDistrict(street)
                  setActiveGridId(gridId)
                }}
              />
            </div>
          </div>
          ))}
        <Card
          style={{
            position: "relative",
            overflow: "hidden",
            padding: 0,
            background: T.bg,
          }}
        >
          {/* Map header overlay：宽度按内容自适应，不通栏铺满 */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 10,
              width: "fit-content",
              maxWidth: "calc(100% - 24px)",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "space-between",
              background: "var(--glass-bg-strong)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid var(--glass-border)",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(22,45,77,0.08)",
              pointerEvents: "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  className="pulse-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: T.primary,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: T.text,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                  }}
                >
                  识别中 · 扫描圈 = AI 当前关注
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  pointerEvents: "auto",
                }}
              >
                <button
                  type="button"
                  onClick={goAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: activeDistrict ? T.primary : T.text,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 11,
                  }}
                >
                  东城区
                </button>
                {street && (
                  <>
                    <span style={{ margin: "0 4px", color: T.textMuted }}>
                      /
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGridId(null)}
                      style={{
                        background: "none",
                        border: "none",
                        color: activeGridId ? T.primary : T.text,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        fontSize: 11,
                      }}
                    >
                      {street.name.replace("街道", "")}
                    </button>
                  </>
                )}
                {grid && (
                  <>
                    <span style={{ margin: "0 4px", color: T.textMuted }}>
                      /
                    </span>
                    <span style={{ fontWeight: 800 }}>{grid.name}</span>
                  </>
                )}
                {!street && (
                  <span style={{ marginLeft: 6, color: T.textMuted }}>
                    · 17街道事件热力
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
              {activeDistrict && (
                <button
                  type="button"
                  onClick={goAll}
                  style={{
                    fontSize: 10,
                    color: T.primary,
                    backgroundColor: "rgba(50,109,255,0.12)",
                    padding: "2px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(50,109,255,0.35)",
                    cursor: "pointer",
                  }}
                >
                  回到全域
                </button>
              )}
            </div>
          </div>

          {/* Map fullscreen toggle */}
          <button
            onClick={() => setMapFullscreen(!mapFullscreen)}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 20,
              width: 34,
              height: 34,
              fontSize: 11,
              fontWeight: 600,
              color: T.primary,
              border: "1px solid rgba(50,109,255,0.25)",
              backgroundColor: "var(--glass-bg-strong)",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: "0 4px 14px rgba(22,45,77,0.08)",
              transition: "all 0.2s ease",
            }}
            title={mapFullscreen ? "退出全屏" : "地图全屏"}
          >
            {mapFullscreen ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>

          {/* Real map with heatmap layer */}
          <DongchengHeatmapMap
            activeDistrict={activeDistrict}
            hoveredDistrict={hoveredDistrict}
            activeGridId={activeGridId}
            metric={metric}
            dayIndex={dayIndex}
            lifecycle={activeLifecycle}
            onDistrictClick={(name) => {
              setActiveDistrict(name)
              setActiveGridId(null)
            }}
            onDistrictHover={setHoveredDistrict}
            onGridClick={setActiveGridId}
          />

          {/* Playback + hover tooltip：宽度撑满地图，左右各留 12px 等距 */}
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              pointerEvents: "none",
            }}
          >
            {hoveredDistrict &&
              (() => {
                const d = streetByName(hoveredDistrict)
                if (!d) return null
                return (
                  <div
                    style={{
                      alignSelf: "center",
                      backgroundColor: "var(--glass-bg-strong)",
                      border: "1px solid rgba(50,109,255,0.35)",
                      borderRadius: 6,
                      padding: "6px 14px",
                      whiteSpace: "nowrap",
                      boxShadow: "0 4px 12px rgba(22,45,77,0.12)",
                    }}
                  >
                    <span
                      style={{ fontSize: 12, color: T.text, fontWeight: 600 }}
                    >
                      {d.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.textMuted,
                        margin: "0 6px",
                      }}
                    >
                      ·
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: T.red,
                        fontWeight: 700,
                        fontFamily: T.mono,
                      }}
                    >
                      {d.events}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        marginLeft: 3,
                      }}
                    >
                      件待处置
                    </span>
                  </div>
                )
              })()}
            <div
              style={{
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: "var(--glass-bg-strong)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: `1px solid var(--glass-border)`,
                borderRadius: 10,
                padding: "8px 10px",
                boxShadow: "0 6px 22px rgba(22,45,77,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{ fontSize: 11, color: T.text, fontWeight: 700 }}
                >
                  热力回放与预测
                </span>
                <div style={{ display: "flex", gap: 5 }}>
                  {[
                    ["severe", "发生数量"],
                    ["repeat", "复发"],
                  ].map(([id, lab]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMetric(id)}
                      style={{
                        height: 20,
                        padding: "0 9px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 10,
                        fontWeight: 600,
                        border: `1px solid ${
                          metric === id ? T.borderStrong : T.border
                        }`,
                        background:
                          metric === id ? "rgba(50,109,255,0.12)" : T.panelSolid,
                        color: metric === id ? T.primary : T.textMuted,
                      }}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: `1px solid ${T.borderStrong}`,
                    background: playing ? "rgba(50,109,255,0.12)" : T.panelSolid,
                    color: T.primary,
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                  }}
                  aria-label="回放14日热力与明日预测"
                >
                  {playing ? "❚❚" : "▶"}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                      fontSize: 10,
                      color: T.textMuted,
                      fontWeight: 700,
                    }}
                  >
                    <span>历史14日 / 今日 / 明日预测</span>
                    <span>
                      {PLAY_DAYS[dayIndex]}
                      {dayIndex === 13
                        ? " · 今日"
                        : dayIndex === PREDICT_INDEX
                          ? " · 明日预测"
                          : " · 历史窗"}{" "}
                      · {metric === "repeat" ? "复发" : "发生数量"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 3,
                      height: 24,
                    }}
                  >
                    {PLAY_HEAT.map((v, i) => (
                      <button
                        key={PLAY_DAYS[i]}
                        type="button"
                        onClick={() => {
                          setPlaying(false)
                          setDayIndex(i)
                        }}
                        style={{
                          flex: 1,
                          height: "100%",
                          padding: "0 2px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          marginLeft: i === PREDICT_INDEX ? 6 : 0,
                          position: "relative",
                        }}
                        title={
                          i === PREDICT_INDEX
                            ? `${TOMORROW_LABEL} · 明日预测`
                            : PLAY_DAYS[i]
                        }
                      >
                        <i
                          style={{
                            pointerEvents: "none",
                            display: "block",
                            width: "100%",
                            maxWidth: 8,
                            height: `${6 + v * 18}px`,
                            borderRadius: 3,
                            // 预测槽：紫色斜纹 + 虚线描边 + 辉光，明确区别于历史/今日实心蓝柱
                            background:
                              i === PREDICT_INDEX
                                ? i === dayIndex
                                  ? "repeating-linear-gradient(135deg,#1FC7C2 0 3px,#8CE8E4 3px 6px)"
                                  : "repeating-linear-gradient(135deg,rgba(36,214,210,0.55) 0 3px,rgba(36,214,210,0.22) 3px 6px)"
                                : i === dayIndex
                                  ? T.primary
                                  : "rgba(50,109,255,0.28)",
                            outline:
                              i === PREDICT_INDEX
                                ? "1px dashed rgba(36,214,210,0.85)"
                                : "none",
                            outlineOffset: 1,
                            boxShadow:
                              i === PREDICT_INDEX && i === dayIndex
                                ? "0 0 10px rgba(36,214,210,0.60)"
                                : "none",
                            transition: "background-color 0.2s",
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── RealtimeGovernance ───────────────────────────────────────────────────────

type RtView = "overview" | "case-decision" | "inspect-decision" | "void-decision" | "agent-pool"
type RtSituationType = "normal" | "warning" | "info" | "readonly"
interface BatchEvent {
  id: string
  type: string
  location: string
  level: "严重" | "较重" | "一般"
  time: string
  camera: string
  agentStatus: string
  imgUrls: string[]
  hasRisk?: boolean
  overtime?: boolean
  suggestedGrid?: string
  situation: { text: string; type: RtSituationType }
  aiReview?: {
    conclusion: "正常结案" | "建议退回" | "待人工判断"
    basis: string
  }
}

const pendingCaseEvents: BatchEvent[] = [
  {
    id: "DC-2026-20555",
    type: "占道经营",
    level: "一般",
    location: "东华门街道-网格A11",
    time: "08-18 14:26",
    camera: "CAM-CYM-047",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "朝阳门南小街网格",
    imgUrls: [eventImage("占道经营", "during")],
    situation: { text: "正常立案", type: "normal" },
  },
  {
    id: "DC-2026-20558",
    type: "施工占道",
    level: "一般",
    location: "安定门街道-网格A07",
    time: "08-18 13:10",
    camera: "CAM-DZM-023",
    agentStatus: "已完成查重",
    suggestedGrid: "东直门街道网格",
    hasRisk: true,
    imgUrls: [eventImage("施工占道", "during")],
    situation: { text: "空间匹配失败", type: "warning" },
  },
  {
    id: "DC-2026-20560",
    type: "共享单车占道",
    level: "较重",
    location: "北新桥街道-网格B03",
    time: "08-18 11:05",
    camera: "CAM-JGM-011",
    agentStatus: "置信度较低，需确认位置",
    suggestedGrid: "建国门街道网格",
    hasRisk: true,
    imgUrls: [eventImage("共享单车占道", "during")],
    situation: { text: "规则预告：派发后将自动结案", type: "info" },
  },
  {
    id: "DC-2026-20561",
    type: "占道经营",
    level: "一般",
    location: "东华门街道-网格A11",
    time: "08-18 16:08",
    camera: "CAM-BXQ-006",
    agentStatus: "已完成查重、空间匹配、取证",
    suggestedGrid: "北新桥街道网格",
    imgUrls: [eventImage("占道经营", "during")],
    situation: { text: "重复上报：不新建", type: "warning" },
  },
  {
    id: "DC-2026-20559",
    type: "疑似堆物",
    level: "一般",
    location: "东直门街道-网格F02",
    time: "08-18 12:40",
    camera: "CAM-DST-019",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "东四街道网格",
    imgUrls: [eventImage("疑似堆物", "during")],
    situation: { text: "自然消散：只读", type: "readonly" },
  },
]
const pendingInspectEvents: BatchEvent[] = [
  {
    id: "DC-2026-20562",
    type: "违规施工扬尘",
    level: "严重",
    location: "朝阳门外大街工地",
    time: "08-18 07:30",
    camera: "CAM-CYM-031",
    agentStatus: "处置后图已获取，建议结案",
    suggestedGrid: "朝阳门南小街网格",
    overtime: true,
    imgUrls: [eventImage("违规施工扬尘", "during")],
    situation: { text: "正常立案", type: "normal" },
    aiReview: {
      conclusion: "正常结案",
      basis: "处置后图与发生中图对比，施工围挡已拆除、裸土已覆盖、洒水设备到位，扬尘迹象消除",
    },
  },
  {
    id: "DC-2026-20563",
    type: "乱堆垃圾",
    level: "较重",
    location: "东直门内二条胡同入口",
    time: "08-17 16:20",
    camera: "CAM-DZM-008",
    agentStatus: "处置后图质量不足，建议外场核查",
    suggestedGrid: "东直门街道网格",
    hasRisk: true,
    imgUrls: [eventImage("乱堆垃圾", "during")],
    situation: { text: "空间匹配失败", type: "warning" },
    aiReview: {
      conclusion: "建议退回",
      basis: "处置后图拍摄角度偏移较大，无法确认原堆放点位已清理，需重新上传同机位照片",
    },
  },
  {
    id: "DC-2026-20564",
    type: "无照经营",
    level: "一般",
    location: "建国门南大街路口东南角",
    time: "08-17 11:45",
    camera: "CAM-JGM-044",
    agentStatus: "发现图与处置后图对比明显，建议结案",
    suggestedGrid: "建国门街道网格",
    imgUrls: [eventImage("无照经营", "during")],
    situation: { text: "正常立案", type: "normal" },
    aiReview: {
      conclusion: "待人工判断",
      basis: "处置后图显示摊位已撤离，但画面右下角出现新的疑似占道物品，需人工确认是否属于同一事件",
    },
  },
]

// Grid map data for the interactive picker
const gridMapData = [
  { id: "CYM-001", name: "朝阳门南小街网格", x: 62, y: 32, events: 23 },
  { id: "DZM-001", name: "东直门街道网格", x: 75, y: 20, events: 19 },
  { id: "JGM-001", name: "建国门街道网格", x: 60, y: 52, events: 16 },
  { id: "BXQ-001", name: "北新桥街道网格", x: 44, y: 26, events: 14 },
  { id: "DST-001", name: "东四街道网格", x: 40, y: 46, events: 11 },
  { id: "LT-001", name: "龙潭街道网格", x: 54, y: 68, events: 9 },
  { id: "CW-001", name: "崇外街道网格", x: 70, y: 64, events: 7 },
  { id: "JS-001", name: "景山街道网格", x: 28, y: 36, events: 6 },
  { id: "JDK-001", name: "交道口街道网格", x: 38, y: 18, events: 8 },
]

function ImageGallery({ urls, compact }: { urls: string[] compact?: boolean }) {
  const [active, setActive] = useState(0)
  const safeUrls = urls ?? []
  if (safeUrls.length === 0)
    return (
      <div
        style={{
          aspectRatio: "16/9",
          maxHeight: compact ? 260 : undefined,
          backgroundColor: T.card2,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: T.textMuted,
          fontSize: 12,
        }}
      >
        暂无图片
      </div>
    )
  return (
    <div style={{ maxHeight: compact ? 280 : undefined }}>
      <div
        style={{
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#000",
          position: "relative",
          maxHeight: compact ? 280 : undefined,
        }}
      >
        <img
          src={safeUrls[active]}
          alt=""
          style={{
            width: "100%",
            aspectRatio: "16/9",
            maxHeight: compact ? 280 : undefined,
            objectFit: "cover",
            display: "block",
          }}
        />
        {safeUrls.length > 1 && (
          <>
            <button
              onClick={() =>
                setActive((i) => (i - 1 + safeUrls.length) % safeUrls.length)
              }
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.5)",
                border: "none",
                color: T.cardSolid,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ‹
            </button>
            <button
              onClick={() => setActive((i) => (i + 1) % safeUrls.length)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.5)",
                border: "none",
                color: T.cardSolid,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ›
            </button>
            <div
              style={{
                position: "absolute",
                bottom: 8,
                right: 10,
                fontSize: 10,
                backgroundColor: "rgba(0,0,0,0.5)",
                color: T.cardSolid,
                padding: "2px 7px",
                borderRadius: 10,
              }}
            >
              {active + 1} / {safeUrls.length}
            </div>
          </>
        )}
      </div>
      {safeUrls.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {safeUrls.map((u, i) => (
            <div
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: 56,
                height: 36,
                borderRadius: 5,
                overflow: "hidden",
                cursor: "pointer",
                border: `2px solid ${i === active ? T.primary : "transparent"}`,
                flexShrink: 0,
              }}
            >
              <img
                src={u}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GridMap({
  suggested,
  selected,
  onSelect,
}: {
  suggested: string
  selected: string
  onSelect: (name: string) => void
}) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          backgroundColor: T.card2,
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.primary}
          strokeWidth="2"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
          选择所属网格
        </span>
        {suggested && (
          <span style={{ fontSize: 10, color: T.accent, marginLeft: "auto" }}>
            AI推荐: {suggested}
          </span>
        )}
      </div>
      <div
        style={{
          position: "relative",
          height: 180,
          background: "var(--grad-page)",
        }}
      >
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.12,
          }}
        >
          <defs>
            <pattern
              id="gmap"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="#2C68F5"
                strokeWidth="0.6"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gmap)" />
        </svg>
        {gridMapData.map((g) => {
          const isSel = selected === g.name
          const isSug = suggested === g.name
          return (
            <button
              key={g.id}
              onClick={() => onSelect(g.name)}
              style={{
                position: "absolute",
                left: `${g.x}%`,
                top: `${g.y}%`,
                transform: "translate(-50%,-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: 0,
              }}
            >
              <div
                style={{
                  width: isSel ? 14 : 10,
                  height: isSel ? 14 : 10,
                  borderRadius: "50%",
                  backgroundColor: isSel
                    ? T.primary
                    : isSug
                      ? T.accent
                      : "rgba(110,129,151,0.5)",
                  border: isSel
                    ? `2px solid ${T.primary}`
                    : isSug
                      ? `2px solid ${T.accent}`
                      : "1.5px solid rgba(110,129,151,0.6)",
                  boxShadow: isSel ? `0 0 0 3px rgba(50,109,255,0.2)` : "none",
                  transition: "all 0.15s",
                }}
              />
              {(isSel || isSug) && (
                <div
                  style={{
                    fontSize: 9,
                    color: isSel ? T.primary : T.accent,
                    backgroundColor: "var(--glass-bg-strong)",
                    padding: "1px 4px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  {g.name.replace("网格", "")}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div
        style={{
          padding: "6px 10px",
          borderTop: `1px solid ${T.border}`,
          fontSize: 11,
          color: selected ? T.primary : T.textMuted,
          fontWeight: selected ? 500 : 400,
        }}
      >
        {selected || "点击地图选择网格"}
      </div>
    </div>
  )
}
const pendingVoidEvents: BatchEvent[] = [
  {
    id: "DC-2026-20565",
    type: "违规停放机动车",
    level: "一般",
    location: "朝阳门南小街3号楼前",
    time: "08-18 08:20",
    camera: "CAM-CYM-047",
    agentStatus: "外场责任人申请作废",
    suggestedGrid: "北新桥街道网格",
    imgUrls: [eventImage("违规停放机动车", "during")],
    situation: { text: "正常立案", type: "normal" },
  },
  {
    id: "DC-2026-20566",
    type: "店外经营占道",
    level: "一般",
    location: "东四十条甲22号",
    time: "08-18 08:05",
    camera: "CAM-DST-031",
    agentStatus: "监督员提交复核建议作废",
    suggestedGrid: "东四街道网格",
    imgUrls: [eventImage("店外经营占道", "during")],
    situation: { text: "重复上报：不新建", type: "warning" },
  },
  {
    id: "DC-2026-20567",
    type: "无证户外广告",
    level: "较重",
    location: "建国门外大街16号",
    time: "08-18 07:48",
    camera: "CAM-JGM-023",
    agentStatus: "处置方申请重复事件作废",
    suggestedGrid: "景山街道网格",
    hasRisk: true,
    imgUrls: [eventImage("无证户外广告", "during")],
    situation: { text: "重复上报：不新建", type: "warning" },
  },
]

// ─── Agent 处理池：固定四态（对存续事件的按需追溯视图，非人工待办）────────────
type PoolStateId = "unassigned" | "feedback" | "inspection" | "watching"

interface PoolStateMeta {
  id: PoolStateId
  label: string
  count: number
  color: string
  rgb: string
  hint: string
  firstScreen: string
  // Agent 在该态承担的流程劳动（人不再自己推进流程）
  agentAction: string
  // 该态尚未完成、且只能由人承担的终局决定（AI 不替代最终责任）
  humanDecision: string
  riskNote?: string
}

const agentPoolStats: PoolStateMeta[] = [
  {
    id: "unassigned",
    label: "待分配",
    count: 12,
    color: T.primary,
    rgb: T.primaryRGB,
    hint: "已具备进入下一责任方的条件，责任分配尚未完成",
    firstScreen: "当前卡点、缺什么条件、待分配给谁或何种角色",
    agentAction: "查重比对、类型与描述预填、空间与责任候选匹配、生成行动草案",
    humanDecision: "责任主体是否采纳 Agent 候选，或改由人工指派",
  },
  {
    id: "feedback",
    label: "等待处置反馈",
    count: 94,
    color: T.amber,
    rgb: T.amberRGB,
    hint: "已派给网格责任人，等待现场处置结果",
    firstScreen: "当前责任人、已等待多久、时限风险、下一触发条件",
    agentAction: "派单衔接、时限监测、接近时限自动催办、归集外部反馈",
    humanDecision: "处置结果是否成立，是否升级为外场核查",
    riskNote: "已超时 11 件 · 临近超时 2 件",
  },
  {
    id: "inspection",
    label: "等待外场核查",
    count: 7,
    color: T.purple,
    rgb: T.purpleRGB,
    hint: "已向监督员派发外场核查，等待反馈",
    firstScreen: "监督员、辖区匹配、已等待多久、需要的证据",
    agentAction: "处置前后影像对照、证据充分性比对、整理外场核查要求",
    humanDecision: "外场证据是否充分，是否确认闭环",
  },
  {
    id: "watching",
    label: "持续监控",
    count: 348,
    color: T.green,
    rgb: T.greenRGB,
    hint: "事件已终态，或进入规则要求的持续观察",
    firstScreen: "观察对象、监控规则、何种条件会形成后续动作",
    agentAction: "订阅复发识别规则、盯同点位复发、观察期留痕与归档预告",
    humanDecision: "是否中止观察，是否触发结案复核",
  },
]

// 人机分工：Agent 拿走流程劳动，人保留治理责任判断（处理池只读呈现这条分界）
const AGENT_LABOR = [
  "查重与合并判断",
  "类型、描述预填",
  "空间与责任候选匹配",
  "证据包整理与前后对照",
  "时限监测与自动催办",
  "衔接外部反馈与外场",
  "持续监控与复发识别",
]

const HUMAN_HOLDS = [
  "是否立案",
  "责任主体确认",
  "是否派发与升级",
  "是否外场核查",
  "责任确认与结案",
  "是否中止 / 争议接管",
]

// 组织长期价值：把流程劳动变成可追溯的治理资产
const AGENT_EFFECT = [
  {
    label: "预填准确率",
    value: "94.2%",
    note: "类型 / 描述预填被人工采纳",
    color: T.primary,
    rgb: T.primaryRGB,
  },
  {
    label: "建议一致率",
    value: "88.6%",
    note: "行动草案与人工判断一致",
    color: T.accent,
    rgb: T.accentRGB,
  },
  {
    label: "流程减负",
    value: "62%",
    note: "流程劳动由 Agent 承担占比",
    color: T.purple,
    rgb: T.purpleRGB,
  },
  {
    label: "衔接提速",
    value: "3.4h",
    note: "平均每件衔接耗时缩短",
    color: T.green,
    rgb: T.greenRGB,
  },
]

// 本态 Agent 已备齐的交付物：人只在准备好的材料上做决定
const poolPrepared = (id: PoolStateId): string[] =>
  id === "unassigned"
    ? [
        "查重结论",
        "类型与描述预填",
        "空间与责任候选",
        "证据包（发生中）",
        "风险提示",
        "可审查行动草案",
      ]
    : id === "feedback"
      ? ["派单与责任人记录", "发生中影像", "时限与催办规则", "下一触发条件"]
      : id === "inspection"
        ? ["处置后影像", "处置前后对照", "证据充分性比对结论", "外场核查要求"]
        : ["结案留痕", "复发识别规则订阅", "观察期运行记录"]

interface PoolTrailStep {
  t: string
  actor: string
  text: string
}

interface PoolEvent {
  id: string
  state: PoolStateId
  type: string
  level: "严重" | "较重" | "一般"
  location: string
  grid: string
  time: string
  waitedH: number
  deadlineH: number
  risk: "overtime" | "near" | null
  blocker: string
  owner: string
  ownerRole: string
  nextTrigger: string
  needEvidence?: string
  monitorTarget?: string
  monitorRule?: string
  evidence: { during: string; after?: string }
  trail: PoolTrailStep[]
}

type PoolSeed = Omit<
  PoolEvent,
  "id" | "state" | "risk" | "evidence" | "trail"
>

const poolSeeds: Record<PoolStateId, PoolSeed[]> = {
  unassigned: [
    {
      type: "违规户外广告",
      level: "一般",
      location: "建国门内大街8号",
      grid: "建国门街道-网格E02",
      time: "08-18 15:42",
      waitedH: 1.3,
      deadlineH: 8,
      blocker: "空间匹配命中两个相邻网格，责任主体待确认",
      owner: "待分配",
      ownerRole: "候选：街道值守岗 / 城管执法队",
      nextTrigger: "责任主体确认后自动派发；超时未确认则升级至街道值守岗",
    },
    {
      type: "暴露垃圾",
      level: "一般",
      location: "东直门内大街212号",
      grid: "东直门街道-网格F05",
      time: "08-18 14:08",
      waitedH: 2.9,
      deadlineH: 8,
      blocker: "查重结果待人工确认（疑似与 DC-2026-20588 相近）",
      owner: "待分配",
      ownerRole: "候选：网格责任人",
      nextTrigger: "确认非重复上报后进入派发",
    },
    {
      type: "共享单车占道",
      level: "较重",
      location: "朝阳门南小街地铁口",
      grid: "朝阳门街道-网格C03",
      time: "08-18 12:35",
      waitedH: 4.4,
      deadlineH: 8,
      blocker: "处置力量排班未覆盖该点位，等待责任方认领",
      owner: "待分配",
      ownerRole: "候选：共享单车运维 / 街道值守岗",
      nextTrigger: "责任方认领；或超时后按规则指派",
    },
    {
      type: "店外经营占道",
      level: "一般",
      location: "和平里西街12号",
      grid: "和平里街道-网格H01",
      time: "08-18 11:20",
      waitedH: 5.7,
      deadlineH: 8,
      blocker: "事件等级为一般，按规则进入批次派发而非即时派发",
      owner: "待分配",
      ownerRole: "候选：城管执法队",
      nextTrigger: "批次生成后随批次派发",
    },
    {
      type: "施工围挡破损",
      level: "严重",
      location: "北新桥三条18号",
      grid: "北新桥街道-网格B06",
      time: "08-18 09:15",
      waitedH: 7.8,
      deadlineH: 8,
      blocker: "严重等级已置顶，但施工方责任人信息缺失",
      owner: "待分配",
      ownerRole: "候选：施工方 / 住建专责",
      nextTrigger: "补齐责任人信息后即时派发",
    },
    {
      type: "道路遗撒",
      level: "一般",
      location: "安定门外大街46号",
      grid: "安定门街道-网格A04",
      time: "08-17 22:40",
      waitedH: 18.3,
      deadlineH: 8,
      blocker: "夜间事件，责任主体信息需次日核验",
      owner: "待分配",
      ownerRole: "候选：环卫作业队",
      nextTrigger: "转日核验后派发",
    },
  ],
  feedback: [
    {
      type: "违规施工扬尘",
      level: "严重",
      location: "朝阳门外大街工地",
      grid: "朝阳门街道-网格C07",
      time: "08-18 07:30",
      waitedH: 9.5,
      deadlineH: 24,
      blocker: "责任人已到场处置，处置后图尚未回传",
      owner: "张伟",
      ownerRole: "朝阳门街道网格责任人",
      nextTrigger: "处置后图回传后自动进入核查；超 24h 自动催办",
    },
    {
      type: "乱堆垃圾",
      level: "较重",
      location: "东直门内二条胡同入口",
      grid: "东直门街道-网格F03",
      time: "08-18 08:12",
      waitedH: 8.8,
      deadlineH: 24,
      blocker: "首次处置被核查退回，等待重新处置",
      owner: "李建",
      ownerRole: "东直门街道网格责任人",
      nextTrigger: "重新上传处置后图后进入核查",
    },
    {
      type: "占道经营",
      level: "一般",
      location: "东华门大街35号",
      grid: "东华门街道-网格A11",
      time: "08-17 16:20",
      waitedH: 24.6,
      deadlineH: 24,
      blocker: "已处置，但处置说明缺整改依据，责任未闭环",
      owner: "王磊",
      ownerRole: "东华门街道网格责任人",
      nextTrigger: "补充整改说明；已超时，触发二次催办",
    },
    {
      type: "共享单车占道",
      level: "较重",
      location: "北新桥路口东北角",
      grid: "北新桥街道-网格B03",
      time: "08-17 19:05",
      waitedH: 21.9,
      deadlineH: 24,
      blocker: "运维方已清运，责任人尚未确认闭环",
      owner: "赵鹏",
      ownerRole: "北新桥街道网格责任人",
      nextTrigger: "责任人确认后进入核查",
    },
    {
      type: "装修废料堆放",
      level: "较重",
      location: "安定门内大街77号巷内",
      grid: "安定门街道-网格A07",
      time: "08-17 06:40",
      waitedH: 34.3,
      deadlineH: 24,
      blocker: "责任人两次未接单，已超时 10.3 小时",
      owner: "陈昊",
      ownerRole: "安定门街道网格责任人",
      nextTrigger: "超时升级至街道值守岗，必要时改派",
    },
    {
      type: "无证户外广告",
      level: "一般",
      location: "建国门外大街16号",
      grid: "建国门街道-网格E04",
      time: "08-17 21:30",
      waitedH: 19.5,
      deadlineH: 24,
      blocker: "已联系广告产权方，等待拆除排期",
      owner: "孙倩",
      ownerRole: "建国门街道网格责任人",
      nextTrigger: "拆除完成后上传处置后图",
    },
    {
      type: "违规停放机动车",
      level: "一般",
      location: "和平里北街3号",
      grid: "和平里街道-网格H05",
      time: "08-17 11:15",
      waitedH: 29.8,
      deadlineH: 24,
      blocker: "车主未联系上，现场处置停滞",
      owner: "周涛",
      ownerRole: "和平里街道网格责任人",
      nextTrigger: "超时升级，转交交管协同处置",
    },
    {
      type: "暴露垃圾",
      level: "一般",
      location: "交道口南大街甲2号",
      grid: "交道口街道-网格D02",
      time: "08-18 13:05",
      waitedH: 3.9,
      deadlineH: 24,
      blocker: "责任人已到场，现场处置中",
      owner: "刘洋",
      ownerRole: "交道口街道网格责任人",
      nextTrigger: "处置完成后回传处置后图",
    },
  ],
  inspection: [
    {
      type: "违规施工扬尘",
      level: "严重",
      location: "朝阳门外大街工地",
      grid: "朝阳门街道-网格C07",
      time: "08-17 07:30",
      waitedH: 33.5,
      deadlineH: 24,
      blocker: "处置后图拍摄角度偏移，无法确认整改效果",
      owner: "赵磊",
      ownerRole: "朝阳门街道监督员（外场）",
      nextTrigger: "监督员回传同机位照片后由 Agent 复核",
      needEvidence: "需同机位处置后图 1 张，含围挡整体与裸土区域",
    },
    {
      type: "乱堆垃圾",
      level: "较重",
      location: "东直门内二条胡同入口",
      grid: "东直门街道-网格F03",
      time: "08-17 16:20",
      waitedH: 24.6,
      deadlineH: 24,
      blocker: "处置后有新堆放迹象，需实地确认是否为同一事件",
      owner: "孙立",
      ownerRole: "东直门街道监督员（外场）",
      nextTrigger: "核查结论回传后决定结案或新建事件",
      needEvidence: "需清理后全景与近景各 1 张",
    },
    {
      type: "共享单车占道",
      level: "一般",
      location: "朝阳门南小街地铁口",
      grid: "朝阳门街道-网格C03",
      time: "08-18 06:50",
      waitedH: 10.2,
      deadlineH: 24,
      blocker: "需确认清运范围是否覆盖人行道盲道",
      owner: "周敏",
      ownerRole: "朝阳门街道监督员（外场）",
      nextTrigger: "监督员反馈后由 Agent 复核结案",
      needEvidence: "需人行道与盲道同框照片",
    },
    {
      type: "施工围挡破损",
      level: "较重",
      location: "北新桥三条18号",
      grid: "北新桥街道-网格B06",
      time: "08-18 09:05",
      waitedH: 7.9,
      deadlineH: 24,
      blocker: "围挡已更换，需确认是否与备案样式一致",
      owner: "郑凯",
      ownerRole: "北新桥街道监督员（外场）",
      nextTrigger: "核查结论回传后结案",
      needEvidence: "需围挡整体照与破损点位近景",
    },
    {
      type: "店外经营占道",
      level: "一般",
      location: "东四北大街128号",
      grid: "东四街道-网格G02",
      time: "08-17 18:40",
      waitedH: 22.3,
      deadlineH: 24,
      blocker: "需确认店外摆放是否已全部收回店内",
      owner: "吴楠",
      ownerRole: "东四街道监督员（外场）",
      nextTrigger: "监督员反馈后由 Agent 复核结案",
      needEvidence: "需店门前完整范围照片",
    },
    {
      type: "道路遗撒",
      level: "一般",
      location: "安定门外大街46号",
      grid: "安定门街道-网格A04",
      time: "08-17 20:10",
      waitedH: 20.8,
      deadlineH: 24,
      blocker: "需确认路面遗撒是否清扫干净，含边沟",
      owner: "何静",
      ownerRole: "安定门街道监督员（外场）",
      nextTrigger: "监督员反馈后由 Agent 复核结案",
      needEvidence: "需路面全景与边沟近景",
    },
    {
      type: "废弃家具堆放",
      level: "一般",
      location: "景山前街9号",
      grid: "景山街道-网格J01",
      time: "08-18 10:30",
      waitedH: 6.5,
      deadlineH: 24,
      blocker: "需确认家具已清运离场、地面无残留",
      owner: "马超",
      ownerRole: "景山街道监督员（外场）",
      nextTrigger: "监督员反馈后由 Agent 复核结案",
      needEvidence: "需清运后地面照片",
    },
  ],
  watching: [
    {
      type: "占道经营",
      level: "一般",
      location: "东四北大街128号",
      grid: "东四街道-网格G02",
      time: "08-15 10:20",
      waitedH: 74,
      deadlineH: 0,
      blocker: "监控中：同一店铺每周三、周五出摊",
      owner: "—",
      ownerRole: "无人工责任主体（Agent 自动监控）",
      nextTrigger: "规则命中后自动创建新事件并派发",
      monitorTarget: "东四北大街128号店外经营点位",
      monitorRule: "同点位 7 日内再次识别到店外经营即触发回访",
    },
    {
      type: "乱堆垃圾",
      level: "一般",
      location: "交道口南大街甲2号",
      grid: "交道口街道-网格D02",
      time: "08-15 08:05",
      waitedH: 77,
      deadlineH: 0,
      blocker: "监控中：楼道口堆物清零后每周复发",
      owner: "—",
      ownerRole: "无人工责任主体（Agent 自动监控）",
      nextTrigger: "3 日内复发即创建新事件",
      monitorTarget: "交道口南大街甲2号楼道口",
      monitorRule: "同点位 3 日内再次识别到堆物即触发回访",
    },
    {
      type: "共享单车占道",
      level: "一般",
      location: "朝阳门南小街地铁口",
      grid: "朝阳门街道-网格C03",
      time: "08-14 18:30",
      waitedH: 90,
      deadlineH: 0,
      blocker: "监控中：早晚高峰潮汐性堆积",
      owner: "—",
      ownerRole: "无人工责任主体（Agent 自动监控）",
      nextTrigger: "早高峰命中即通知运维清运",
      monitorTarget: "朝阳门南小街地铁口 A 口外",
      monitorRule: "工作日 8:00-9:00 识别到堆积即触发回访",
    },
    {
      type: "违规户外广告",
      level: "一般",
      location: "建国门内大街8号",
      grid: "建国门街道-网格E02",
      time: "08-16 09:40",
      waitedH: 55,
      deadlineH: 0,
      blocker: "监控中：已拆除点位是否存在重挂",
      owner: "—",
      ownerRole: "无人工责任主体（Agent 自动监控）",
      nextTrigger: "识别到同类广告即创建新事件",
      monitorTarget: "建国门内大街8号外墙",
      monitorRule: "同点位出现同类户外广告即触发回访",
    },
    {
      type: "施工围挡破损",
      level: "较重",
      location: "北新桥三条18号",
      grid: "北新桥街道-网格B06",
      time: "08-16 14:15",
      waitedH: 47,
      deadlineH: 0,
      blocker: "监控中：围挡整改后是否再次破损",
      owner: "—",
      ownerRole: "无人工责任主体（Agent 自动监控）",
      nextTrigger: "再次破损即直接派发",
      monitorTarget: "北新桥三条18号施工围挡",
      monitorRule: "识别到围挡再次破损即触发派发",
    },
    {
      type: "暴露垃圾",
      level: "一般",
      location: "东直门内大街212号",
      grid: "东直门街道-网格F05",
      time: "08-15 21:10",
      waitedH: 68,
      deadlineH: 0,
      blocker: "监控中：夜间固定投放点位",
      owner: "—",
      ownerRole: "无人工责任主体（Agent 自动监控）",
      nextTrigger: "连续命中即升级为定点值守",
      monitorTarget: "东直门内大街212号门前",
      monitorRule: "连续 2 日出现暴露垃圾即触发回访",
    },
  ],
}

const poolTrails: Record<
  PoolStateId,
  { dh: number; actor: string; text: string }[]
> = {
  unassigned: [
    { dh: 0, actor: "Agent", text: "完成查重、空间匹配与取证，事件具备进入下一责任方的条件" },
    { dh: 0.3, actor: "Agent", text: "责任匹配出现冲突，转入待分配并保留候选责任主体" },
    { dh: 1, actor: "系统", text: "等待责任主体确认，超时按规则升级至街道值守岗" },
  ],
  feedback: [
    { dh: 0, actor: "Agent", text: "自动派发至网格责任人，附发生中图与定位" },
    { dh: 0.4, actor: "网格责任人", text: "已接单并到场，现场处置中" },
    { dh: 1.2, actor: "Agent", text: "等待处置后图回传，接近时限时自动催办" },
  ],
  inspection: [
    { dh: 0, actor: "网格责任人", text: "提交处置反馈，上传处置后图" },
    { dh: 0.5, actor: "Agent", text: "复核比对发现证据不足，建议外场核查" },
    { dh: 1.5, actor: "Agent", text: "已派发监督员外场核查，等待回传同机位照片" },
  ],
  watching: [
    { dh: 0, actor: "Agent", text: "事件已结案，按规则进入持续观察" },
    { dh: 6, actor: "系统", text: "已订阅同点位复发识别规则，命中将自动创建新事件" },
    { dh: 30, actor: "Agent", text: "观察期内未命中复发条件，继续监控" },
  ],
}

// 处理池为按需追溯视图：列表默认加载最近更新的事件，可用搜索与筛选定位
const POOL_LIST_LIMIT = 6

// 入口驱动：Agent 已备好、等人拍板的件数 vs Agent 仍在推进监控的件数
const poolCount = (id: PoolStateId) =>
  agentPoolStats.find((s) => s.id === id)?.count || 0
const POOL_READY = poolCount("unassigned") + poolCount("inspection")
const POOL_AGENT_RUNNING = poolCount("feedback") + poolCount("watching")

// 池内四态 → 对应的人工办理队列（处理池只做去向指引，写操作一律在待办队列）
const POOL_DISPATCH: Record<
  PoolStateId,
  { tab: "case" | "inspect" | "void"; label: string } | null
> = {
  // 待分配：责任主体确认在「待立案」队列完成
  unassigned: { tab: "case", label: "去「待立案」队列办理" },
  // 等待处置反馈 / 等待外场核查：结论确认与证据核验都在「待核查」队列完成
  feedback: { tab: "inspect", label: "去「待核查」队列办理" },
  inspection: { tab: "inspect", label: "去「待核查」队列办理" },
  // 持续监控：本态无人工办理入口，由 Agent 盯复发
  watching: null,
}

// Agent 依据已完成的流程劳动给出的建议动作（只作草案，采纳与否由人决定）
const poolSuggestion = (e: PoolEvent): string => {
  if (e.state === "unassigned")
    return `建议采纳候选责任主体「${e.owner}」；采纳后由 Agent 自动派发并衔接责任人`
  if (e.state === "feedback")
    return "建议按其归集的处置反馈确认结果是否成立；证据不足再升级为外场核查"
  if (e.state === "inspection")
    return "建议核对处置前后同机位影像；证据充分即确认闭环"
  return "建议维持观察；命中复发条件会自动创建新事件并回流处理池"
}

const poolDayShift = (ts: string, hours: number) => {
  const [d, hm] = ts.split(" ")
  const [mm, dd] = d.split("-").map(Number)
  const [h, mi] = hm.split(":").map(Number)
  const base = 17
  const mins =
    (dd - base) * 1440 + h * 60 + mi + Math.round(hours * 60)
  const day = base + Math.floor(mins / 1440)
  const rest = ((mins % 1440) + 1440) % 1440
  return `${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(
    Math.floor(rest / 60),
  ).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`
}

const poolTimeKey = (ts: string) => {
  const [d, hm] = ts.split(" ")
  const [mm, dd] = d.split("-").map(Number)
  const [h, mi] = hm.split(":").map(Number)
  return mm * 1000000 + dd * 10000 + h * 100 + mi
}

const POOL_ID_BASE: Record<PoolStateId, number> = {
  unassigned: 20600,
  feedback: 20640,
  inspection: 20700,
  watching: 20760,
}

function buildPoolEvents(): PoolEvent[] {
  const out: PoolEvent[] = []
  agentPoolStats.forEach((st) => {
    poolSeeds[st.id].forEach((s, i) => {
      const overtime = s.deadlineH > 0 && s.waitedH >= s.deadlineH
      out.push({
        ...s,
        id: `DC-2026-${POOL_ID_BASE[st.id] + i}`,
        state: st.id,
        risk:
          st.id === "watching"
            ? null
            : overtime
              ? "overtime"
              : s.waitedH >= s.deadlineH * 0.8
                ? "near"
                : null,
        evidence: {
          during: eventImage(s.type, "during"),
          after: st.id === "unassigned" ? undefined : eventImage(s.type, "after"),
        },
        trail: poolTrails[st.id].map((step) => ({
          t: poolDayShift(s.time, step.dh),
          actor: step.actor,
          text: step.text,
        })),
      })
    })
  })
  return out
}

function AgentJudgment() {
  const [exp, setExp] = useState(false)
  return (
    <div
      style={{
        border: "1px solid rgba(36,214,210,0.2)",
        borderRadius: 8,
        backgroundColor: "rgba(36,214,210,0.04)",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          padding: "9px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{ fontSize: 12, fontWeight: 600, color: T.accent, flex: 1 }}
        >
          Agent 可审查判断
        </span>
        <button
          onClick={() => setExp(!exp)}
          style={{
            fontSize: 10,
            color: T.textMuted,
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
        >
          {exp ? "收起" : "展开"}
        </button>
      </div>
      <div style={{ padding: "0 12px 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.green }}>
          {!exp && "建议立案并派发至朝阳门南小街网格"}
        </div>
        {exp && (
          <div style={{ fontSize: 11, color: T.text, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 500, color: T.green, marginBottom: 4 }}>
              建议立案并派发至朝阳门南小街网格
            </div>
            · 相机帧清晰识别到3辆机动车违停，置信度 94%
            <br />· 事件点坐标已匹配至朝阳门南小街网格（精度 ±5m）
            <br />· 查重结果：无同位置存续事件
            <br />
            <span style={{ color: T.amber }}>
              · 相机视角较远，车牌不可读，需人工判断
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function CaseDecisionPage({
  event,
  onBack,
}: {
  event: BatchEvent
  onBack: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const [selectedGrid, setSelectedGrid] = useState(event.suggestedGrid || "")
  const [editLevel, setEditLevel] = useState(event.level)
  const [editLocation, setEditLocation] = useState(event.location)
  if (submitted)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: T.bg,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            backgroundColor: "rgba(53,185,133,0.1)",
            border: `2px solid ${T.green}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.green}
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.green,
              marginBottom: 6,
            }}
          >
            已确认立案并派发
          </div>
          <div style={{ fontSize: 12, color: T.textMuted }}>
            事件 {event.id} 已派至{selectedGrid} · 责任人：李建国
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: "8px 24px",
            backgroundColor: T.primary,
            color: T.cardSolid,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          返回工作列表
        </button>
      </div>
    )
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: T.bg,
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: T.card,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          boxShadow: T.shadow,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: T.textMuted,
            fontSize: 12,
          }}
        >
          ← 返回
        </button>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>
          #{event.id}
        </span>
        <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>
          {event.type}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 4,
            backgroundColor:
              event.level === "严重"
                ? "rgba(228,94,88,0.08)"
                : event.level === "较重"
                  ? "rgba(255,122,66,0.08)"
                  : "rgba(50,109,255,0.08)",
            color:
              event.level === "严重"
                ? T.red
                : event.level === "较重"
                  ? T.amber
                  : T.primary,
          }}
        >
          {event.level}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted }}>
          待立案 · 第 2 / 10 件
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          overflow: "hidden",
          gap: 12,
          padding: 12,
          minHeight: 0,
        }}
      >
        <div
          style={{
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Card style={{ padding: 12 }}>
            <ImageGallery urls={event.imgUrls} compact />
          </Card>
          <Card style={{ padding: 14 }}>
            <GridMap
              suggested={event.suggestedGrid || ""}
              selected={selectedGrid}
              onSelect={setSelectedGrid}
            />
          </Card>
          <Card style={{ padding: 14 }}>
            <AgentJudgment />
            {/* 问题类型 — 只读 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  width: 80,
                  flexShrink: 0,
                }}
              >
                问题类型
              </span>
              <span style={{ flex: 1, fontSize: 12, color: T.text }}>
                {event.type}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  backgroundColor: "rgba(50,109,255,0.07)",
                  color: T.primary,
                }}
              >
                Agent预填
              </span>
            </div>
            {/* 事件等级 — 可编辑下拉 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  width: 80,
                  flexShrink: 0,
                }}
              >
                事件等级
              </span>
              <select
                value={editLevel}
                onChange={(e) =>
                  setEditLevel(e.target.value as typeof editLevel)
                }
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  border: `1px solid ${
                    editLevel !== event.level ? T.amber : T.border
                  }`,
                  borderRadius: 5,
                  fontSize: 12,
                  color: T.text,
                  backgroundColor: T.card,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="严重">严重</option>
                <option value="较重">较重</option>
                <option value="一般">一般</option>
              </select>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  backgroundColor:
                    editLevel !== event.level
                      ? "rgba(255,122,66,0.08)"
                      : "rgba(50,109,255,0.07)",
                  color: editLevel !== event.level ? T.amber : T.primary,
                }}
              >
                {editLevel !== event.level ? "已修改" : "Agent预填"}
              </span>
            </div>
            {/* 位置描述 — 可编辑输入 */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "9px 0",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  width: 80,
                  flexShrink: 0,
                  paddingTop: 4,
                }}
              >
                位置描述
              </span>
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  border: `1px solid ${
                    editLocation !== event.location ? T.amber : T.border
                  }`,
                  borderRadius: 5,
                  fontSize: 12,
                  color: T.text,
                  backgroundColor: T.card,
                  outline: "none",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  backgroundColor:
                    editLocation !== event.location
                      ? "rgba(255,122,66,0.08)"
                      : "rgba(50,109,255,0.07)",
                  color: editLocation !== event.location ? T.amber : T.primary,
                  flexShrink: 0,
                  marginTop: 4,
                }}
              >
                {editLocation !== event.location ? "已修改" : "Agent预填"}
              </span>
            </div>
            {/* 所属网格 — 由地图联动 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  width: 80,
                  flexShrink: 0,
                }}
              >
                所属网格
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: selectedGrid ? T.text : T.textMuted,
                }}
              >
                {selectedGrid || "请在上方地图选择"}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  backgroundColor:
                    selectedGrid !== event.suggestedGrid
                      ? "rgba(255,122,66,0.08)"
                      : "rgba(50,109,255,0.07)",
                  color:
                    selectedGrid !== event.suggestedGrid ? T.amber : T.primary,
                }}
              >
                {selectedGrid !== event.suggestedGrid
                  ? "已手动修改"
                  : "自动匹配"}
              </span>
            </div>
            {/* 网格责任人 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: T.textMuted,
                  width: 80,
                  flexShrink: 0,
                }}
              >
                网格责任人
              </span>
              <span style={{ flex: 1, fontSize: 12, color: T.text }}>
                李建国
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  backgroundColor: "rgba(255,122,66,0.08)",
                  color: T.amber,
                }}
              >
                需确认
              </span>
            </div>
          </Card>
        </div>
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            padding: 16,
          }}
        >
          <div
            style={{
              padding: 12,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              backgroundColor: T.card2,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: T.text,
                marginBottom: 5,
              }}
            >
              这是否属于需要立案的城市治理事件？
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
              若是，请确认字段后立案。若否，选择"不属于事件范围"，事件进入已无效档案。
            </div>
          </div>
          <textarea
            style={{
              width: "100%",
              padding: "8px 10px",
              backgroundColor: T.card2,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              color: T.text,
              fontSize: 12,
              resize: "none",
              height: 70,
              fontFamily: "inherit",
              marginBottom: 12,
              boxSizing: "border-box",
            }}
            placeholder="添加说明或备注..."
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: "auto",
            }}
          >
            <button
              onClick={() => setSubmitted(true)}
              disabled={!selectedGrid}
              style={{
                width: "100%",
                padding: 11,
                backgroundColor: selectedGrid ? T.primary : T.border,
                color: T.cardSolid,
                border: "none",
                borderRadius: 6,
                cursor: selectedGrid ? "pointer" : "not-allowed",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              确认立案并派发
            </button>
            <button
              style={{
                width: "100%",
                padding: 10,
                backgroundColor: "transparent",
                color: T.red,
                border: "1px solid rgba(228,94,88,0.25)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              不属于事件范围（无效）
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// AI 识别框在各类型事件图片中的大致位置（百分比）
const AI_BOX_MAP: Record<string, { x: number; y: number; w: number; h: number }> = {
  work: { x: 20, y: 36, w: 54, h: 38 },
  bike: { x: 48, y: 30, w: 40, h: 42 },
  trash: { x: 20, y: 44, w: 42, h: 34 },
  furniture: { x: 16, y: 40, w: 38, h: 34 },
  stall: { x: 24, y: 46, w: 48, h: 36 },
  nonmotor: { x: 26, y: 44, w: 44, h: 32 },
}

function eventPrefixOf(type: string) {
  const t = type.toLowerCase()
  if (t.includes("施工") || t.includes("建筑")) return "work"
  if (t.includes("单车")) return "bike"
  if (t.includes("垃圾") || t.includes("杂物")) return "trash"
  if (t.includes("弃物") || t.includes("堆物") || t.includes("家具")) return "furniture"
  if (
    t.includes("占道") ||
    t.includes("游摊") ||
    t.includes("小贩") ||
    t.includes("无照") ||
    t.includes("广告") ||
    t.includes("店外")
  )
    return "stall"
  if (t.includes("机动车")) return "nonmotor"
  return "work"
}

// 对照放大层 — 不跳页、不打断审核流程的浮层组件
function CompareLayer({
  mode,
  leftUrl,
  rightUrls = [],
  rightLabels = [],
  initialRightIdx = 0,
  overlayBottomUrl,
  overlayTopUrl,
  aiBox,
  onClose,
}: {
  mode: "side" | "overlay"
  leftUrl?: string
  rightUrls?: string[]
  rightLabels?: string[]
  initialRightIdx?: number
  overlayBottomUrl?: string
  overlayTopUrl?: string
  aiBox?: { x: number; y: number; w: number; h: number }
  onClose: () => void
}) {
  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // 右侧图片索引（关闭后再打开保持上次位置，per spec 4.2）
  const [rightIdx, setRightIdx] = useState(initialRightIdx)
  // 左右独立缩放
  const [zoomL, setZoomL] = useState(1)
  const [zoomR, setZoomR] = useState(1)
  // 叠图分割线位置
  const [divider, setDivider] = useState(50)
  const overlayRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const selectRight = (i: number) => {
    setRightIdx(i)
    setZoomR(1)
  }

  const updateDividerFromEvent = (e: React.PointerEvent) => {
    if (!overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setDivider(Math.max(8, Math.min(92, pct)))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 忽略
    }
    // 点击立即跳转到该位置
    updateDividerFromEvent(e)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    updateDividerFromEvent(e)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // 忽略
    }
  }

  const zoomBtnStyle: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: "none",
    backgroundColor: "rgba(0,0,0,0.55)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15,23,42,0.48)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--panel-solid)",
          borderRadius: 16,
          maxWidth: 1180,
          maxHeight: "94vh",
          width: "92vw",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              {mode === "overlay"
                ? "对照放大层 · 发生中 vs 相机最新"
                : "对照放大层 · 发生中 vs 处置后"}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>
              {mode === "overlay"
                ? "同机位才能叠图。左右拖动分割线：左侧看发生中，右侧看现在；虚线框为识别框映射到最新帧同一位置。"
                : "左右并排，各自放大。处置后为现场拍摄，视角不同，不能叠图；胶片条只切换右侧。"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "none",
              backgroundColor: T.card2,
              color: T.textMuted,
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {mode === "overlay" ? (
            // 模式二：同机位叠图
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                ref={overlayRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 980,
                  aspectRatio: "16 / 10",
                  maxHeight: "72vh",
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "ew-resize",
                  userSelect: "none",
                  touchAction: "none",
                  backgroundColor: "#000",
                }}
              >
                {/* 底层：相机最新 */}
                {overlayBottomUrl && (
                  <img
                    src={overlayBottomUrl}
                    alt="相机最新"
                    draggable={false}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      WebkitUserDrag: "none",
                    }}
                  />
                )}
                {/* 上层：发生中（被裁切，只显示分割线左侧） */}
                {overlayTopUrl && (
                  <img
                    src={overlayTopUrl}
                    alt="发生中"
                    draggable={false}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      clipPath: `inset(0 ${100 - divider}% 0 0)`,
                      WebkitUserDrag: "none",
                    }}
                  />
                )}
                {/* AI 识别框映射（虚线框） */}
                {aiBox && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${aiBox.x}%`,
                      top: `${aiBox.y}%`,
                      width: `${aiBox.w}%`,
                      height: `${aiBox.h}%`,
                      border: `2px dashed rgba(228,94,88,0.85)`,
                      borderRadius: 4,
                      pointerEvents: "none",
                      boxShadow: "0 0 0 1px rgba(228,94,88,0.15)",
                    }}
                  />
                )}
                {/* 分割线 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${divider}%`,
                    width: 2,
                    backgroundColor: "#fff",
                    boxShadow: "0 0 6px rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                  }}
                />
                {/* 拖拽热区条 — 增大可拖拽范围 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `calc(${divider}% - 18px)`,
                    width: 36,
                    cursor: "ew-resize",
                    pointerEvents: "none",
                  }}
                />
                {/* 拖拽手柄 */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${divider}%`,
                    transform: "translate(-50%, -50%)",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    fontSize: 18,
                    color: T.primary,
                    fontWeight: 700,
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                >
                  ⇄
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                <span>分割线位置 {Math.round(divider)}%</span>
                <span style={{ color: T.textMuted, opacity: 0.6 }}>·</span>
                <span>在图片上左右拖动对比</span>
              </div>
            </div>
          ) : (
            // 模式一：并排对照
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                justifyContent: "center",
              }}
            >
              {/* 左图：发生中（固定不可切换） */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                  maxWidth: 460,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.textMuted,
                    letterSpacing: "0.02em",
                  }}
                >
                  发生中
                </div>
                <div
                  style={{
                    position: "relative",
                    borderRadius: 8,
                    overflow: "hidden",
                    height: 420,
                    backgroundColor: "#000",
                  }}
                >
                  <img
                    src={leftUrl}
                    alt="发生中"
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: `scale(${zoomL})`,
                      WebkitUserDrag: "none",
                      transformOrigin: "center center",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      display: "flex",
                      gap: 4,
                    }}
                  >
                    <button
                      aria-label="缩小左图"
                      onClick={() => setZoomL((z) => Math.max(1, z - 0.25))}
                      style={zoomBtnStyle}
                    >
                      −
                    </button>
                    <button
                      aria-label="放大左图"
                      onClick={() => setZoomL((z) => Math.min(3, z + 0.25))}
                      style={zoomBtnStyle}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    textAlign: "center",
                  }}
                >
                  {Math.round(zoomL * 100)}%
                </div>
              </div>

              {/* 右图：处置后/附件（可切换） */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                  maxWidth: 560,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.green,
                    letterSpacing: "0.02em",
                  }}
                >
                  {rightLabels[rightIdx] || "处置后"}
                </div>
                {rightUrls.length > 0 ? (
                  <>
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 8,
                        overflow: "hidden",
                        height: 420,
                        backgroundColor: "#000",
                      }}
                    >
                      <img
                        src={rightUrls[rightIdx]}
                        alt={rightLabels[rightIdx] || "处置后"}
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          transform: `scale(${zoomR})`,
                          transformOrigin: "center center",
                          WebkitUserDrag: "none",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          display: "flex",
                          gap: 4,
                        }}
                      >
                        <button
                          aria-label="缩小右图"
                          onClick={() => setZoomR((z) => Math.max(1, z - 0.25))}
                          style={zoomBtnStyle}
                        >
                          −
                        </button>
                        <button
                          aria-label="放大右图"
                          onClick={() => setZoomR((z) => Math.min(3, z + 0.25))}
                          style={zoomBtnStyle}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: T.textMuted,
                        textAlign: "center",
                      }}
                    >
                      {Math.round(zoomR * 100)}%
                    </div>
                    {/* 胶片条 */}
                    {rightUrls.length > 1 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          justifyContent: "center",
                        }}
                      >
                        {rightUrls.map((u, i) => (
                          <div
                            key={i}
                            onClick={() => selectRight(i)}
                            style={{
                              width: 72,
                              height: 48,
                              borderRadius: 8,
                              overflow: "hidden",
                              cursor: "pointer",
                              border: `2px solid ${
                                i === rightIdx ? T.primary : "transparent"
                              }`,
                              backgroundColor: "#000",
                              flexShrink: 0,
                              transition: "border-color 0.2s ease",
                            }}
                          >
                            <img
                              src={u}
                              alt={rightLabels[i] || `附件 ${i}`}
                              draggable={false}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                                WebkitUserDrag: "none",
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  // 空状态
                  <div
                    style={{
                      height: 420,
                      borderRadius: 8,
                      backgroundColor: T.card2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.textMuted,
                      fontSize: 13,
                    }}
                  >
                    未回传处置照片
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InspectDecisionPage({
  event,
  onBack,
}: {
  event: BatchEvent
  onBack: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const [cmpMode, setCmpMode] = useState<"side" | "overlay" | null>(null)
  const [cmpRightIdx, setCmpRightIdx] = useState(0)
  const prefix = eventPrefixOf(event.type)
  const occurringUrl = eventImage(event.type, "during")
  const latestUrl = eventImage(event.type, "after")
  const afterUrls = [
    eventImage(event.type, "after2"),
    eventImage(event.type, "after3"),
  ]
  const afterLabels = ["处置后", "附件 1"]
  const aiBox = AI_BOX_MAP[prefix]
  if (submitted)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          backgroundColor: T.bg,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            backgroundColor: "rgba(53,185,133,0.1)",
            border: `2px solid ${T.green}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.green}
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.green,
              marginBottom: 6,
            }}
          >
            已确认结案
          </div>
          <div style={{ fontSize: 12, color: T.textMuted }}>
            事件 {event.id} 已归入事件档案
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: "8px 24px",
            backgroundColor: T.primary,
            color: T.cardSolid,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          返回工作列表
        </button>
      </div>
    )
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: T.bg,
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: T.card,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          boxShadow: T.shadow,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: T.textMuted,
            fontSize: 12,
          }}
        >
          ← 返回
        </button>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>
          #{event.id}
        </span>
        <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>
          {event.type}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted }}>
          待核查 · 第 1 / 10 件
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          overflow: "hidden",
          gap: 12,
          padding: 12,
          minHeight: 0,
        }}
      >
        <div
          style={{
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* 监控图片区 — 发生中 + 相机最新，并排可点击进入叠图模式 */}
          <Card style={{ padding: 12 }}>
            <div
              style={{
                fontSize: 10,
                color: T.textMuted,
                fontWeight: 700,
                letterSpacing: "0.04em",
                marginBottom: 8,
              }}
            >
              监控图片
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {/* 发生中 */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCmpRightIdx(0)
                  setCmpMode("overlay")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setCmpRightIdx(0)
                    setCmpMode("overlay")
                  }
                }}
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                  cursor: "pointer",
                  transition: "transform 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.03)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)"
                }}
              >
                <img
                  src={occurringUrl}
                  alt="发生中"
                  style={{
                    width: "100%",
                    height: 160,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    fontSize: 9,
                    backgroundColor: "rgba(15,23,42,0.65)",
                    color: "#fff",
                    padding: "2px 7px",
                    borderRadius: 3,
                    fontWeight: 600,
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                  }}
                >
                  发生中 · {event.time}
                </div>
              </div>
              {/* 相机最新 */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCmpRightIdx(0)
                  setCmpMode("overlay")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setCmpRightIdx(0)
                    setCmpMode("overlay")
                  }
                }}
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                  cursor: "pointer",
                  transition: "transform 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.03)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)"
                }}
              >
                <img
                  src={latestUrl}
                  alt="相机最新"
                  style={{
                    width: "100%",
                    height: 160,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    fontSize: 9,
                    backgroundColor: "rgba(15,23,42,0.65)",
                    color: "#fff",
                    padding: "2px 7px",
                    borderRadius: 3,
                    fontWeight: 600,
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                  }}
                >
                  相机最新 · {event.time}
                </div>
              </div>
            </div>
          </Card>

          {/* 处置图片区 — 处置后主图 + 附件缩略图，点击进入并排对照模式 */}
          <Card style={{ padding: 12 }}>
            <div
              style={{
                fontSize: 10,
                color: T.green,
                fontWeight: 700,
                letterSpacing: "0.04em",
                marginBottom: 8,
              }}
            >
              处置图片
            </div>
            {/* 处置后主图 */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setCmpRightIdx(0)
                setCmpMode("side")
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setCmpRightIdx(0)
                  setCmpMode("side")
                }
              }}
              style={{
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
                cursor: "pointer",
                transition: "transform 0.18s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.03)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)"
              }}
            >
              <img
                src={afterUrls[0]}
                alt="处置后"
                style={{
                  width: "100%",
                  height: 160,
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  fontSize: 9,
                  backgroundColor: "rgba(53,185,133,0.9)",
                  color: T.cardSolid,
                  padding: "2px 6px",
                  borderRadius: 3,
                  fontWeight: 600,
                }}
              >
                处置后 · {event.time}
              </div>
            </div>
            {/* 附件缩略图 */}
            {afterUrls.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {afterUrls.map((u, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setCmpRightIdx(i)
                      setCmpMode("side")
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setCmpRightIdx(i)
                        setCmpMode("side")
                      }
                    }}
                    style={{
                      width: 96,
                      height: 64,
                      borderRadius: 6,
                      overflow: "hidden",
                      border: `1px solid ${T.border}`,
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "border-color 0.18s ease, transform 0.18s ease",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.primary
                      e.currentTarget.style.transform = "scale(1.04)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border
                      e.currentTarget.style.transform = "scale(1)"
                    }}
                  >
                    <img
                      src={u}
                      alt={afterLabels[i] || `附件 ${i}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                backgroundColor: "rgba(53,185,133,0.05)",
                border: "1px solid rgba(53,185,133,0.15)",
                borderRadius: 6,
                fontSize: 11,
                color: T.green,
              }}
            >
              · AI核查：原违规情况已消除，现场整洁，画面内无异常迹象
            </div>
          </Card>
          {/* 事件信息 */}
          <Card style={{ padding: 14 }}>
            <SectionLabel>事件信息</SectionLabel>
            {[
              { label: "事件编号", value: event.id },
              { label: "问题类型", value: event.type },
              { label: "事件等级", value: event.level },
              { label: "位置描述", value: event.location },
              { label: "所属网格", value: event.suggestedGrid || "—" },
              { label: "发现时间", value: event.time },
              { label: "采集相机", value: event.camera },
            ].map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    width: 76,
                    flexShrink: 0,
                  }}
                >
                  {f.label}
                </span>
                <span style={{ fontSize: 12, color: T.text }}>{f.value}</span>
              </div>
            ))}
          </Card>
          {/* 处置信息 */}
          <Card style={{ padding: 14 }}>
            <SectionLabel>处置记录</SectionLabel>
            {[
              { label: "派发网格员", value: "李建国" },
              { label: "派发时间", value: "2026-08-20 07:45" },
              { label: "首次反馈", value: "2026-08-20 08:30 · 已到场处置" },
              {
                label: "处置说明",
                value: "已联系相关方，现场违规情况已清除，采集处置后图2张",
              },
            ].map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    width: 76,
                    flexShrink: 0,
                    paddingTop: 1,
                  }}
                >
                  {f.label}
                </span>
                <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                  {f.value}
                </span>
              </div>
            ))}
          </Card>
        </div>
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            padding: 16,
          }}
        >
          {/* AI 复审结论 */}
          {event.aiReview && (
            <div
              style={{
                marginBottom: 16,
                padding: 14,
                borderRadius: 10,
                backgroundColor:
                  event.aiReview.conclusion === "正常结案"
                    ? "rgba(53,185,133,0.06)"
                    : event.aiReview.conclusion === "建议退回"
                      ? "rgba(228,94,88,0.06)"
                      : "rgba(232,155,58,0.06)",
                border: `1px solid ${
                  event.aiReview.conclusion === "正常结案"
                    ? "rgba(53,185,133,0.20)"
                    : event.aiReview.conclusion === "建议退回"
                      ? "rgba(228,94,88,0.20)"
                      : "rgba(232,155,58,0.20)"
                }`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor:
                      event.aiReview.conclusion === "正常结案"
                        ? "rgba(53,185,133,0.12)"
                        : event.aiReview.conclusion === "建议退回"
                          ? "rgba(228,94,88,0.12)"
                          : "rgba(232,155,58,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L13.5 5.5L17 6L14.5 9L15 13L12 11L9 13L9.5 9L7 6L10.5 5.5L12 2Z"
                      fill={
                        event.aiReview.conclusion === "正常结案"
                          ? T.green
                          : event.aiReview.conclusion === "建议退回"
                            ? "#E45A52"
                            : "#E89B3A"
                      }
                    />
                    <path
                      d="M5 14L7 18M19 14L17 18M12 14V19"
                      stroke={
                        event.aiReview.conclusion === "正常结案"
                          ? T.green
                          : event.aiReview.conclusion === "建议退回"
                            ? "#E45A52"
                            : "#E89B3A"
                      }
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: T.textMuted,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                    }}
                  >
                    AI 复核
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color:
                        event.aiReview.conclusion === "正常结案"
                          ? T.green
                          : event.aiReview.conclusion === "建议退回"
                            ? "#E45A52"
                            : "#E89B3A",
                    }}
                  >
                    {event.aiReview.conclusion}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.text,
                  lineHeight: 1.6,
                  padding: "8px 10px",
                  backgroundColor: "rgba(255,255,255,0.60)",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: T.textMuted,
                    fontWeight: 600,
                    letterSpacing: "0.03em",
                  }}
                >
                  依据
                </span>
                <div style={{ marginTop: 4 }}>{event.aiReview.basis}</div>
              </div>
            </div>
          )}
          <AgentJudgment />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: "auto",
            }}
          >
            <button
              onClick={() => setSubmitted(true)}
              style={{
                width: "100%",
                padding: 11,
                backgroundColor: T.green,
                color: T.cardSolid,
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              确认完成并结案
            </button>
            <button
              style={{
                width: "100%",
                padding: 10,
                backgroundColor: "transparent",
                color: T.amber,
                border: "1px solid rgba(255,122,66,0.25)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              未完成，退回处置
            </button>
            <button
              style={{
                width: "100%",
                padding: 10,
                backgroundColor: "transparent",
                color: T.purple,
                border: "1px solid rgba(117,104,216,0.25)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              证据不足，发送监督员核查
            </button>
          </div>
        </Card>
      </div>
      {cmpMode && (
        <CompareLayer
          mode={cmpMode}
          leftUrl={occurringUrl}
          rightUrls={afterUrls}
          rightLabels={afterLabels}
          initialRightIdx={cmpRightIdx}
          overlayBottomUrl={latestUrl}
          overlayTopUrl={occurringUrl}
          aiBox={aiBox}
          onClose={() => setCmpMode(null)}
        />
      )}
    </div>
  )
}

function VoidDecisionPage({
  event,
  onBack,
}: {
  event: BatchEvent
  onBack: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  if (submitted)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: T.bg,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            backgroundColor: "rgba(53,185,133,0.1)",
            border: `2px solid ${T.green}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.green}
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: T.green,
              marginBottom: 6,
            }}
          >
            已批准作废
          </div>
          <div style={{ fontSize: 12, color: T.textMuted }}>
            事件 {event.id} 已归入已无效档案
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: "8px 24px",
            backgroundColor: T.primary,
            color: T.cardSolid,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          返回工作列表
        </button>
      </div>
    )
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: T.bg,
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: T.card,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          boxShadow: T.shadow,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: T.textMuted,
            fontSize: 12,
          }}
        >
          ← 返回
        </button>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.orange }}>
          #{event.id}
        </span>
        <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>
          {event.type}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 4,
            backgroundColor: "rgba(255,122,66,0.08)",
            color: T.orange,
          }}
        >
          待作废审核
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted }}>
          作废审核 · 第 1 / 3 件
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          overflow: "hidden",
          gap: 12,
          padding: 12,
          minHeight: 0,
        }}
      >
        <div
          style={{
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Card style={{ padding: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: T.textMuted,
                marginBottom: 8,
              }}
            >
              现场图片（{event.imgUrls.length} 张）
            </div>
            <ImageGallery urls={event.imgUrls} />
          </Card>
          <Card style={{ padding: 14 }}>
            <SectionLabel>事件信息</SectionLabel>
            {[
              { label: "事件编号", value: event.id },
              { label: "问题类型", value: event.type },
              { label: "事件等级", value: event.level },
              { label: "位置描述", value: event.location },
              { label: "所属网格", value: event.suggestedGrid || "—" },
              { label: "发现时间", value: event.time },
            ].map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    width: 76,
                    flexShrink: 0,
                  }}
                >
                  {f.label}
                </span>
                <span style={{ fontSize: 12, color: T.text }}>{f.value}</span>
              </div>
            ))}
          </Card>
          <Card style={{ padding: 14 }}>
            <SectionLabel>网格员作废申请</SectionLabel>
            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "rgba(255,122,66,0.04)",
                border: "1px solid rgba(255,122,66,0.18)",
                borderRadius: 7,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg,${T.primary},${T.accent})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.cardSolid,
                    flexShrink: 0,
                  }}
                >
                  李
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.text }}>
                  李建国
                </span>
                <span style={{ fontSize: 10, color: T.textMuted }}>
                  · 网格员 · {event.time}
                </span>
              </div>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>
                {event.agentStatus.replace("网格员申请作废：", "")}
              </div>
            </div>
          </Card>
        </div>
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            padding: 16,
          }}
        >
          <div
            style={{
              padding: 12,
              border: `1px solid rgba(255,122,66,0.2)`,
              borderRadius: 8,
              backgroundColor: "rgba(255,122,66,0.04)",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: T.orange,
                marginBottom: 5,
              }}
            >
              作废审核
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
              若批准，事件进入已无效档案。若驳回，事件继续流转至下一处置步骤。
            </div>
          </div>
          <textarea
            style={{
              width: "100%",
              padding: "8px 10px",
              backgroundColor: T.card2,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              color: T.text,
              fontSize: 12,
              resize: "none",
              height: 80,
              fontFamily: "inherit",
              marginBottom: 12,
              boxSizing: "border-box",
            }}
            placeholder="填写审核意见（可选）..."
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: "auto",
            }}
          >
            <button
              onClick={() => setSubmitted(true)}
              style={{
                width: "100%",
                padding: 11,
                backgroundColor: T.orange,
                color: T.cardSolid,
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              批准作废
            </button>
            <button
              style={{
                width: "100%",
                padding: 10,
                backgroundColor: "transparent",
                color: T.primary,
                border: `1px solid rgba(22,119,255,0.25)`,
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              驳回，继续处置流程
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── 全量识别（立案前的相机识别全量清单） ─────────────────────────────────────

type RecognitionStatus = "待立案" | "已立案" | "重复过滤" | "待人工复核"

interface RecognitionEvent extends BatchEvent {
  status: RecognitionStatus
}

const REC_STATUS_META: Record<
  RecognitionStatus,
  { color: string; bg: string; border: string }
> = {
  待立案: {
    color: "var(--primary)",
    bg: "rgba(50,109,255,0.10)",
    border: "rgba(50,109,255,0.30)",
  },
  已立案: {
    color: "var(--green)",
    bg: "rgba(53,185,133,0.10)",
    border: "rgba(53,185,133,0.30)",
  },
  重复过滤: {
    color: "var(--amber)",
    bg: "rgba(255,122,66,0.10)",
    border: "rgba(255,122,66,0.30)",
  },
  待人工复核: {
    color: "var(--purple)",
    bg: "rgba(117,104,216,0.10)",
    border: "rgba(117,104,216,0.30)",
  },
}

const REC_TYPE_OPTIONS = [
  "占道经营",
  "施工占道",
  "共享单车占道",
  "店外经营占道",
  "无证户外广告",
  "乱堆垃圾",
  "违规停放机动车",
  "无照经营",
]

const recognitionEvents: RecognitionEvent[] = [
  {
    id: "DC-2026-20401",
    type: "占道经营",
    level: "一般",
    location: "朝阳门街道-南小街网格",
    time: "08-18 09:12",
    camera: "CAM-CYM-047",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "朝阳门南小街网格",
    imgUrls: [eventImage("占道经营", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20402",
    type: "乱堆垃圾",
    level: "一般",
    location: "东华门街道-网格A11",
    time: "08-18 10:05",
    camera: "CAM-DHM-012",
    agentStatus: "已完成查重、空间匹配、取证",
    suggestedGrid: "东华门街道网格",
    imgUrls: [eventImage("乱堆垃圾", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20403",
    type: "共享单车占道",
    level: "较重",
    location: "建国门街道-网格C02",
    time: "08-18 11:40",
    camera: "CAM-JGM-021",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "建国门街道网格",
    imgUrls: [eventImage("共享单车占道", "during")],
    situation: { text: "已进入处置流程", type: "info" },
    status: "已立案",
  },
  {
    id: "DC-2026-20404",
    type: "店外经营占道",
    level: "一般",
    location: "安定门街道-网格A07",
    time: "08-18 13:26",
    camera: "CAM-ADM-008",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "安定门街道网格",
    imgUrls: [eventImage("店外经营占道", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20405",
    type: "无证户外广告",
    level: "一般",
    location: "北新桥街道-网格B03",
    time: "08-18 14:52",
    camera: "CAM-BXQ-015",
    agentStatus: "已完成查重（命中主事件 DC-2026-20561）",
    suggestedGrid: "北新桥街道网格",
    imgUrls: [eventImage("无证户外广告", "during")],
    situation: { text: "重复上报：不新建", type: "warning" },
    status: "重复过滤",
  },
  {
    id: "DC-2026-20406",
    type: "违规停放机动车",
    level: "一般",
    location: "东直门街道-网格F02",
    time: "08-18 15:31",
    camera: "CAM-DZM-033",
    agentStatus: "置信度 0.68，待人工复核",
    suggestedGrid: "东直门街道网格",
    hasRisk: true,
    imgUrls: [eventImage("违规停放机动车", "during")],
    situation: { text: "AI置信度较低，需人工确认", type: "info" },
    status: "待人工复核",
  },
  {
    id: "DC-2026-20419",
    type: "共享单车占道",
    level: "一般",
    location: "景山街道-五四大街",
    time: "08-18 08:31",
    camera: "CAM-JSJ-002",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "景山街道网格",
    imgUrls: [eventImage("共享单车占道", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20407",
    type: "占道经营",
    level: "一般",
    location: "朝阳门街道-朝外市场街",
    time: "08-17 08:44",
    camera: "CAM-CYM-052",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "朝阳门南小街网格",
    imgUrls: [eventImage("占道经营", "during")],
    situation: { text: "已进入处置流程", type: "info" },
    status: "已立案",
  },
  {
    id: "DC-2026-20408",
    type: "乱堆垃圾",
    level: "较重",
    location: "东四街道-网格D05",
    time: "08-17 10:17",
    camera: "CAM-DSJ-002",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "东四街道网格",
    imgUrls: [eventImage("乱堆垃圾", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20409",
    type: "无照经营",
    level: "一般",
    location: "景山街道-五四大街",
    time: "08-17 11:58",
    camera: "CAM-JSJ-007",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "景山街道网格",
    imgUrls: [eventImage("无照经营", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20410",
    type: "施工占道",
    level: "较重",
    location: "建国门街道-网格C02",
    time: "08-17 13:22",
    camera: "CAM-JGM-021",
    agentStatus: "已完成查重、空间匹配、取证",
    suggestedGrid: "建国门街道网格",
    hasRisk: true,
    imgUrls: [eventImage("施工占道", "during")],
    situation: { text: "已进入处置流程", type: "info" },
    status: "已立案",
  },
  {
    id: "DC-2026-20411",
    type: "共享单车占道",
    level: "一般",
    location: "安定门街道-网格A07",
    time: "08-17 15:09",
    camera: "CAM-ADM-011",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "安定门街道网格",
    imgUrls: [eventImage("共享单车占道", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20412",
    type: "店外经营占道",
    level: "一般",
    location: "东华门街道-金鱼胡同",
    time: "08-17 16:45",
    camera: "CAM-DHM-019",
    agentStatus: "已完成查重（命中主事件 DC-2026-20555）",
    suggestedGrid: "东华门街道网格",
    imgUrls: [eventImage("店外经营占道", "during")],
    situation: { text: "重复上报：不新建", type: "warning" },
    status: "重复过滤",
  },
  {
    id: "DC-2026-20413",
    type: "违规停放机动车",
    level: "较重",
    location: "朝阳门街道-南小街网格",
    time: "08-16 09:03",
    camera: "CAM-CYM-047",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "朝阳门南小街网格",
    imgUrls: [eventImage("违规停放机动车", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20414",
    type: "乱堆垃圾",
    level: "一般",
    location: "北新桥街道-网格B03",
    time: "08-16 10:38",
    camera: "CAM-BXQ-006",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "北新桥街道网格",
    imgUrls: [eventImage("乱堆垃圾", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20415",
    type: "占道经营",
    level: "一般",
    location: "东直门街道-网格F02",
    time: "08-16 12:14",
    camera: "CAM-DZM-008",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "东直门街道网格",
    imgUrls: [eventImage("占道经营", "during")],
    situation: { text: "已进入处置流程", type: "info" },
    status: "已立案",
  },
  {
    id: "DC-2026-20416",
    type: "无证户外广告",
    level: "一般",
    location: "东四街道-网格D05",
    time: "08-16 14:27",
    camera: "CAM-DSJ-004",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "东四街道网格",
    imgUrls: [eventImage("无证户外广告", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20417",
    type: "施工占道",
    level: "一般",
    location: "朝阳门街道-朝外市场街",
    time: "08-16 15:52",
    camera: "CAM-CYM-031",
    agentStatus: "置信度 0.71，待人工复核",
    suggestedGrid: "朝阳门南小街网格",
    hasRisk: true,
    imgUrls: [eventImage("施工占道", "during")],
    situation: { text: "AI置信度较低，需人工确认", type: "info" },
    status: "待人工复核",
  },
  {
    id: "DC-2026-20418",
    type: "无照经营",
    level: "一般",
    location: "安定门街道-网格A07",
    time: "08-16 17:16",
    camera: "CAM-ADM-008",
    agentStatus: "已完成查重（命中主事件 DC-2026-20404）",
    suggestedGrid: "安定门街道网格",
    imgUrls: [eventImage("无照经营", "during")],
    situation: { text: "重复上报：不新建", type: "warning" },
    status: "重复过滤",
  },
  {
    id: "DC-2026-20420",
    type: "店外经营占道",
    level: "较重",
    location: "建国门街道-西裱褙胡同",
    time: "08-16 11:26",
    camera: "CAM-JGM-037",
    agentStatus: "已完成查重、空间匹配、取证",
    suggestedGrid: "建国门街道网格",
    imgUrls: [eventImage("店外经营占道", "during")],
    situation: { text: "已进入处置流程", type: "info" },
    status: "已立案",
  },
  {
    id: "DC-2026-20421",
    type: "占道经营",
    level: "一般",
    location: "东华门街道-网格A11",
    time: "08-15 09:41",
    camera: "CAM-DHM-012",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "东华门街道网格",
    imgUrls: [eventImage("占道经营", "during")],
    situation: { text: "已进入处置流程", type: "info" },
    status: "已立案",
  },
  {
    id: "DC-2026-20422",
    type: "乱堆垃圾",
    level: "一般",
    location: "景山街道-五四大街",
    time: "08-15 14:03",
    camera: "CAM-JSJ-002",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "景山街道网格",
    imgUrls: [eventImage("乱堆垃圾", "during")],
    situation: { text: "正常立案", type: "normal" },
    status: "待立案",
  },
  {
    id: "DC-2026-20423",
    type: "无照经营",
    level: "一般",
    location: "北新桥街道-网格B03",
    time: "08-14 10:22",
    camera: "CAM-BXQ-006",
    agentStatus: "已完成查重、空间匹配",
    suggestedGrid: "北新桥街道网格",
    imgUrls: [eventImage("无照经营", "during")],
    situation: { text: "已进入处置流程", type: "info" },
    status: "已立案",
  },
  {
    id: "DC-2026-20424",
    type: "共享单车占道",
    level: "一般",
    location: "东四街道-网格D05",
    time: "08-13 16:37",
    camera: "CAM-DSJ-002",
    agentStatus: "已完成查重（命中主事件 DC-2026-20408）",
    suggestedGrid: "东四街道网格",
    imgUrls: [eventImage("共享单车占道", "during")],
    situation: { text: "重复上报：不新建", type: "warning" },
    status: "重复过滤",
  },
]

// ─── 全量识别 · 人工审核与详情 ────────────────────────────────────────────────
// 审核结果只有「有效 / 无效」两项；判无效必须手填原因。
// 审核记录按事件编号累积，最新一条决定该事件当前的审核结果；无记录 = 待审核。
// （演示环境：审核记录保存在会话内，刷新后回到种子状态）

type ReviewResult = "有效" | "无效"

interface ReviewRecord {
  result: ReviewResult
  by: string
  at: string
  reason?: string
}

const reviewLogs: Record<string, ReviewRecord[]> = {
  "DC-2026-20403": [{ result: "有效", by: "赵敏", at: "08-18 11:55" }],
  "DC-2026-20405": [
    {
      result: "无效",
      by: "张晓琳",
      at: "08-18 15:02",
      reason: "重复上报：与主事件 DC-2026-20561 为同一现场，无需重复立案",
    },
  ],
  "DC-2026-20410": [{ result: "有效", by: "赵敏", at: "08-17 13:40" }],
}

function latestReview(id: string): ReviewRecord | undefined {
  const log = reviewLogs[id]
  return log && log.length > 0 ? log[log.length - 1] : undefined
}

function ReviewChip({ id }: { id: string }) {
  const rev = latestReview(id)
  const meta = rev
    ? rev.result === "有效"
      ? { color: T.green, bg: "rgba(53,185,133,0.10)", border: "rgba(53,185,133,0.32)" }
      : { color: T.red, bg: "rgba(228,94,88,0.10)", border: "rgba(228,94,88,0.32)" }
    : { color: T.textMuted, bg: "transparent", border: T.border }
  return (
    <span
      title={rev ? `${rev.result} · 审核人 ${rev.by} · ${rev.at}${rev.reason ? ` · ${rev.reason}` : ""}` : "待审核"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 5,
        color: meta.color,
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: meta.color }} />
      {rev ? rev.result : "待审核"}
    </span>
  )
}

/** 多选下拉（checkbox 面板）：selected 为空 = 全部 */
function MultiDropdown({
  label,
  options,
  selected,
  onToggle,
  width = 158,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (opt: string) => void
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const text =
    selected.length === 0
      ? `${label}：全部`
      : selected.length <= 2
        ? `${label}：${selected.join("、")}`
        : `${label}：已选 ${selected.length} 项`
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 30,
          padding: "0 10px",
          borderRadius: 7,
          border: `1px solid ${open ? T.primary : T.border}`,
          backgroundColor: open ? "rgba(50,109,255,0.06)" : "transparent",
          color: T.text,
          fontSize: 12,
          outline: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width,
        }}
      >
        <span
          style={{
            flex: 1,
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
        <span style={{ fontSize: 9, color: T.textMuted, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute",
              top: 36,
              left: 0,
              zIndex: 61,
              minWidth: width,
              border: `1px solid ${T.border}`,
              borderRadius: 9,
              backgroundColor: "var(--panel-solid, var(--card))",
              boxShadow: T.shadowLg,
              padding: 6,
              maxHeight: 264,
              overflowY: "auto",
            }}
          >
            {options.map((opt) => {
              const on = opt === "全部" ? selected.length === 0 : selected.includes(opt)
              return (
                <div
                  key={opt}
                  onClick={() => onToggle(opt)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    color: T.text,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--control-bg-hover)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent"
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      border: `1px solid ${on ? T.primary : T.borderStrong}`,
                      backgroundColor: on ? T.primary : "transparent",
                      color: T.cardSolid,
                      fontSize: 10,
                      lineHeight: "12px",
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                  {opt}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewModal({
  evt,
  onClose,
  onSubmit,
}: {
  evt: RecognitionEvent
  onClose: () => void
  onSubmit: (result: ReviewResult, reason: string) => void
}) {
  const [result, setResult] = useState<ReviewResult>("有效")
  const [reason, setReason] = useState("")
  const [err, setErr] = useState("")
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 92,
        backgroundColor: "rgba(10,22,40,0.45)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxHeight: "84vh",
          overflow: "auto",
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          backgroundColor: "var(--panel-solid, var(--card))",
          boxShadow: T.shadowLg,
          padding: "18px 20px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>事件审核</span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "none",
              color: T.textMuted,
              fontSize: 16,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 10,
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            backgroundColor: "var(--card-2)",
            marginBottom: 14,
          }}
        >
          <img
            src={evt.imgUrls[0]}
            alt={evt.type}
            style={{ width: 88, height: 60, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 800, color: T.text }}>{evt.id}</span>
            <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{evt.type}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              {evt.location} · {evt.time}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>审核结果</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["有效", "无效"] as ReviewResult[]).map((r) => {
            const on = result === r
            const c = r === "有效" ? T.green : T.red
            return (
              <button
                key={r}
                onClick={() => {
                  setResult(r)
                  setErr("")
                }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 9,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  color: on ? T.cardSolid : c,
                  backgroundColor: on ? c : "transparent",
                  border: `1px solid ${on ? c : T.border}`,
                  transition: "all 0.15s ease",
                }}
              >
                {r === "有效" ? "✓ " : "✕ "}
                {r}
              </button>
            )
          })}
        </div>

        {result === "无效" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              无效原因<span style={{ color: T.red }}>（必填）</span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setErr("")
              }}
              placeholder={"如：重复上报，与主事件为同一现场\n如：非事件，光线反射造成误识别"}
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${err ? T.red : T.border}`,
                backgroundColor: "transparent",
                color: T.text,
                fontSize: 12,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.7, marginBottom: 6 }}>
          审核保存后立即生效：结果回显在列表与事件详情；判「无效」的事件不进入立案与派发。
        </div>
        {err && <div style={{ fontSize: 11, color: T.red, marginBottom: 6 }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              backgroundColor: "transparent",
              color: T.textSub,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            onClick={() => {
              if (result === "无效" && reason.trim() === "") {
                setErr("判「无效」必须填写无效原因")
                return
              }
              onSubmit(result, reason.trim())
            }}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${T.primary} 0%, #5A8BFF 100%)`,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(50,109,255,0.25)",
            }}
          >
            提交审核
          </button>
        </div>
      </div>
    </div>
  )
}

function RecDetailDrawer({
  evt,
  onClose,
  onReview,
  onViewImg,
}: {
  evt: RecognitionEvent
  onClose: () => void
  onReview: () => void
  onViewImg: (img: string) => void
}) {
  const log = [...(reviewLogs[evt.id] ?? [])].reverse()
  const info: [string, string][] = [
    ["事件编号", evt.id],
    ["事件类型", evt.type],
    ["事件等级", evt.level],
    ["发生位置", evt.location],
    ["发生时间", evt.time],
    ["识别相机", evt.camera],
    ["AI 处理状态", evt.agentStatus],
    ["建议网格", evt.suggestedGrid || "—"],
    ["当前情况", evt.situation.text],
  ]
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 91,
        backgroundColor: "rgba(10,22,40,0.45)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: 480,
          maxWidth: "94vw",
          backgroundColor: "var(--panel-solid, var(--card))",
          borderLeft: `1px solid ${T.border}`,
          boxShadow: T.shadowLg,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 20px",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>事件详情</span>
          <ReviewChip id={evt.id} />
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "none",
              color: T.textMuted,
              fontSize: 16,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>基础信息</div>
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              backgroundColor: "var(--card-2)",
              padding: "4px 14px",
              marginBottom: 16,
            }}
          >
            {info.map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "7px 0",
                  borderBottom: `1px dashed ${T.border}`,
                  fontSize: 12,
                  alignItems: "baseline",
                }}
              >
                <span style={{ width: 84, flexShrink: 0, color: T.textMuted }}>{k}</span>
                <span style={{ color: T.text, fontWeight: 500, lineHeight: 1.5 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>现场图片</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {evt.imgUrls.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`${evt.type} 现场图 ${i + 1}`}
                onClick={() => onViewImg(img)}
                title="点击查看大图"
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
            审核记录（{log.length}）
          </div>
          {log.length === 0 ? (
            <div
              style={{
                padding: "18px 0",
                textAlign: "center",
                fontSize: 12,
                color: T.textMuted,
                border: `1px dashed ${T.border}`,
                borderRadius: 10,
              }}
            >
              暂无审核记录 —— 点击下方「去审核」提交第一条审核
            </div>
          ) : (
            log.map((r, idx) => {
              const c = r.result === "有效" ? T.green : T.red
              const no = (reviewLogs[evt.id]?.length ?? 0) - idx
              return (
                <div
                  key={idx}
                  style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 8,
                    backgroundColor: "var(--card-2)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>#{no}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: c,
                        backgroundColor: r.result === "有效" ? "rgba(53,185,133,0.10)" : "rgba(228,94,88,0.10)",
                        border: `1px solid ${r.result === "有效" ? "rgba(53,185,133,0.32)" : "rgba(228,94,88,0.32)"}`,
                        padding: "2px 8px",
                        borderRadius: 5,
                      }}
                    >
                      {r.result}
                    </span>
                    <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto", fontFamily: T.mono }}>
                      审核人 {r.by} · {r.at}
                    </span>
                  </div>
                  {r.reason && (
                    <div style={{ fontSize: 12, color: T.text, marginTop: 7, lineHeight: 1.6 }}>
                      无效原因：{r.reason}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 20px",
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              backgroundColor: "transparent",
              color: T.textSub,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            关闭
          </button>
          <button
            onClick={onReview}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${T.primary} 0%, #5A8BFF 100%)`,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(50,109,255,0.25)",
            }}
          >
            去审核
          </button>
        </div>
      </div>
    </div>
  )
}

function RecognitionInbox({
  onView,
}: {
  onView: (img: string) => void
}) {
  const [query, setQuery] = useState("")
  const [typeSel, setTypeSel] = useState<string[]>([])
  const [reviewSel, setReviewSel] = useState<string[]>([])
  const [range, setRange] = useState("all")
  const [reviewEvt, setReviewEvt] = useState<RecognitionEvent | null>(null)
  const [detailEvt, setDetailEvt] = useState<RecognitionEvent | null>(null)
  const [toast, setToast] = useState("")
  const [, tick] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(""), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const filtered = recognitionEvents
    .filter((e) => (typeSel.length === 0 ? true : typeSel.includes(e.type)))
    .filter((e) => {
      if (reviewSel.length === 0) return true
      const r = latestReview(e.id)
      return reviewSel.includes(r ? r.result : "待审核")
    })
    .filter((e) => {
      if (range === "all") return true
      const d = e.time.slice(0, 5)
      if (range === "today") return d === "08-18"
      if (range === "3d") return d >= "08-16"
      return d >= "08-12"
    })
    .filter((e) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (
        e.location.toLowerCase().includes(q) ||
        e.camera.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      )
    })

  const hasFilter =
    query.trim() !== "" || typeSel.length > 0 || reviewSel.length > 0 || range !== "all"
  const REC_COLS = "72px 114px 104px 1.1fr 100px 92px 96px 132px"

  function toggleTypeSel(t: string) {
    setTypeSel((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
  // 审核结果多选：「全部」独占，勾选任一具体项即取消「全部」
  function toggleReviewSel(o: string) {
    if (o === "全部") {
      setReviewSel([])
      return
    }
    setReviewSel((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]))
  }
  function submitReview(result: ReviewResult, reason: string) {
    if (!reviewEvt) return
    const log = reviewLogs[reviewEvt.id] ?? (reviewLogs[reviewEvt.id] = [])
    const now = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    log.push({
      result,
      by: "张晓琳",
      at: `${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`,
      ...(result === "无效" ? { reason } : {}),
    })
    tick()
    setToast(`已提交审核：${reviewEvt.id} 判定为「${result}」，立即生效`)
    setDetailEvt(null)
    setReviewEvt(null)
  }

  const controlStyle: React.CSSProperties = {
    height: 30,
    padding: "0 10px",
    borderRadius: 7,
    border: `1px solid ${T.border}`,
    backgroundColor: "transparent",
    color: T.text,
    fontSize: 12,
    outline: "none",
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: T.text }}>
          当前相机识别共 {recognitionEvents.length} 条，筛选命中{" "}
          <span
            style={{
              fontFamily: T.mono,
              fontWeight: 800,
              color: T.primary,
            }}
          >
            {filtered.length}
          </span>{" "}
          条。
        </span>
        <span style={{ fontSize: 11, color: T.textMuted }}>
          Agent 已完成查重与空间匹配 · 立案决定由人工确认
        </span>
      </div>

      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="模糊检索：位置 / 相机 / 事件编号"
          style={{ ...controlStyle, width: 240 }}
        />
        <MultiDropdown
          label="审核结果"
          options={["全部", "有效", "无效", "待审核"]}
          selected={reviewSel}
          onToggle={toggleReviewSel}
          width={150}
        />
        <MultiDropdown
          label="事件类型"
          options={["全部", ...REC_TYPE_OPTIONS]}
          selected={typeSel}
          onToggle={toggleTypeSel}
          width={150}
        />
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{ ...controlStyle, minWidth: 110 }}
        >
          <option value="all">全部时间</option>
          <option value="today">今日</option>
          <option value="3d">近3日</option>
          <option value="7d">近7日</option>
        </select>
        {hasFilter && (
          <button
            onClick={() => {
              setQuery("")
              setTypeSel([])
              setReviewSel([])
              setRange("all")
            }}
            style={{
              height: 30,
              padding: "0 12px",
              borderRadius: 7,
              border: "none",
              backgroundColor: T.card2,
              color: T.textMuted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            重置
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: "var(--row-bg)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 8px 24px rgba(22,45,77,0.06)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: REC_COLS,
              padding: "12px 16px",
              backgroundColor: "var(--card-2)",
              borderBottom: `1px solid ${T.border}`,
              fontSize: 12,
              color: T.textMuted,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            <span>相机缩略图</span>
            <span>事件编号</span>
            <span>事件类型</span>
            <span>发生位置</span>
            <span>审核结果</span>
            <span>事件状态</span>
            <span>发生时间</span>
            <span style={{ textAlign: "center" }}>操作</span>
          </div>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "48px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: T.textMuted,
                fontSize: 12,
              }}
            >
              <span>未命中检索条件的事件</span>
              {hasFilter && (
                <button
                  onClick={() => {
                    setQuery("")
                    setTypeSel([])
                    setReviewSel([])
                    setRange("all")
                  }}
                  style={{
                    fontSize: 12,
                    color: T.primary,
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  清除筛选条件
                </button>
              )}
            </div>
          ) : (
            filtered.map((evt) => {
              const meta = REC_STATUS_META[evt.status]
              return (
                <div
                  key={evt.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: REC_COLS,
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: `1px solid ${T.border}`,
                    transition: "all 0.2s ease",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--control-bg-hover)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent"
                  }}
                >
                  <button
                    onClick={() => onView(evt.imgUrls[0])}
                    title={`相机 ${evt.camera}`}
                    style={{
                      width: 56,
                      height: 38,
                      borderRadius: 6,
                      overflow: "hidden",
                      flexShrink: 0,
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      background: "transparent",
                      display: "block",
                      boxShadow: "0 2px 8px rgba(22,45,77,0.08)",
                      transition: "transform 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)"
                    }}
                  >
                    <img
                      src={evt.imgUrls[0]}
                      alt={evt.type}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </button>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 12,
                      color: T.text,
                      fontWeight: 700,
                    }}
                  >
                    {evt.id}
                  </span>
                  <span
                    style={{ fontSize: 12, color: T.text, fontWeight: 600 }}
                  >
                    {evt.type}
                  </span>
                  <span style={{ fontSize: 12, color: T.textMuted }}>
                    {evt.location}
                  </span>
                  <div>
                    <ReviewChip id={evt.id} />
                  </div>
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        padding: "3px 9px",
                        borderRadius: 5,
                        color: meta.color,
                        backgroundColor: meta.bg,
                        border: `1px solid ${meta.border}`,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          backgroundColor: meta.color,
                        }}
                      />
                      {evt.status}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: T.textMuted,
                      fontFamily: T.mono,
                      fontWeight: 500,
                    }}
                  >
                    {evt.time}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <button
                      onClick={() => setDetailEvt(evt)}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.textMuted,
                        border: `1px solid ${T.border}`,
                        backgroundColor: "transparent",
                        borderRadius: 6,
                        padding: "4px 12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = T.text
                        e.currentTarget.style.borderColor = T.borderStrong
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = T.textMuted
                        e.currentTarget.style.borderColor = T.border
                      }}
                    >
                      详情
                    </button>
                    <button
                      onClick={() => setReviewEvt(evt)}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.primary,
                        border: "1px solid rgba(50,109,255,0.40)",
                        backgroundColor: "rgba(50,109,255,0.06)",
                        borderRadius: 6,
                        padding: "4px 12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(50,109,255,0.14)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(50,109,255,0.06)"
                      }}
                    >
                      审核
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div
          style={{
            paddingTop: 10,
            fontSize: 11,
            color: T.textMuted,
            textAlign: "center",
          }}
        >
          已加载全部 {recognitionEvents.length} 条相机识别记录
        </div>
      </div>

      {reviewEvt && (
        <ReviewModal
          evt={reviewEvt}
          onClose={() => setReviewEvt(null)}
          onSubmit={submitReview}
        />
      )}
      {detailEvt && (
        <RecDetailDrawer
          evt={detailEvt}
          onClose={() => setDetailEvt(null)}
          onReview={() => setReviewEvt(detailEvt)}
          onViewImg={onView}
        />
      )}
      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 48,
            transform: "translateX(-50%)",
            zIndex: 95,
            padding: "9px 18px",
            borderRadius: 9,
            backgroundColor: "rgba(15,32,54,0.92)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(10,22,40,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function RealtimeGovernance() {
  const [view, setView] = useState<RtView>("overview")
  const [selectedEvent, setSelectedEvent] = useState<BatchEvent | null>(null)
  const [activeTab, setActiveTab] = useState<
    "recognition" | "case" | "inspect" | "void"
  >("case")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [extraCaseEvents, setExtraCaseEvents] = useState<BatchEvent[]>([])
  const [extraInspectEvents, setExtraInspectEvents] = useState<BatchEvent[]>(
    [],
  )
  const [extraVoidEvents, setExtraVoidEvents] = useState<BatchEvent[]>([])
  const [isDealing, setIsDealing] = useState(false)
  // Agent 处理池：默认进入「待你决定」决策流（unassigned + inspection）
  // 完整追溯模式才按四态展示事件列表
  const [poolStateId, setPoolStateId] = useState<PoolStateId>("unassigned")
  const [poolViewMode, setPoolViewMode] = useState<"decision" | "trace">(
    "decision",
  )
  const [poolEvent, setPoolEvent] = useState<PoolEvent | null>(null)
  const [poolQuery, setPoolQuery] = useState("")
  const [poolTypeFilter, setPoolTypeFilter] = useState("all")
  const [poolRiskOnly, setPoolRiskOnly] = useState(false)
  const [poolVisible, setPoolVisible] = useState(POOL_LIST_LIMIT)

  // 处理池详情按 Escape 返回列表
  useEffect(() => {
    if (view !== "agent-pool") return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && poolEvent) {
        e.preventDefault()
        setPoolEvent(null)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [view, poolEvent])

  const baseEvents =
    activeTab === "case"
      ? pendingCaseEvents
      : activeTab === "inspect"
        ? pendingInspectEvents
        : pendingVoidEvents
  const extraEvents =
    activeTab === "case"
      ? extraCaseEvents
      : activeTab === "inspect"
        ? extraInspectEvents
        : extraVoidEvents
  const events = [...baseEvents, ...extraEvents]

  function generateBatchEvents(
    type: "case" | "inspect" | "void",
    count: number,
    startIdx: number,
  ): BatchEvent[] {
    const types = [
      "占道经营",
      "施工占道",
      "共享单车占道",
      "店外经营占道",
      "无证户外广告",
      "乱堆垃圾",
      "违规停放机动车",
      "无照经营",
    ]
    const grids = [
      "东华门街道-网格A11",
      "安定门街道-网格A07",
      "北新桥街道-网格B03",
      "东直门街道-网格F02",
      "朝阳门南小街网格",
      "建国门内大街网格",
    ]
    const situations: Record<
      "case" | "inspect" | "void",
      { text: string; type: RtSituationType }
    > = {
      case: { text: "正常立案", type: "normal" },
      inspect: { text: "正常立案", type: "normal" },
      void: { text: "重复上报：不新建", type: "warning" },
    }
    const inspectReviews = [
      { conclusion: "正常结案" as const, basis: "处置后图与发生中图同机位对比，原违规情况已消除" },
      { conclusion: "建议退回" as const, basis: "处置后图清晰度不足，无法确认整改效果" },
      { conclusion: "待人工判断" as const, basis: "AI置信度 0.72，存在边缘 case，需人工复核" },
    ]
    return Array.from({ length: count }, (_, i) => {
      const idx = startIdx + i
      const t = types[idx % types.length]
      return {
        id: `DC-2026-${30000 + idx}`,
        type: t,
        level: idx % 5 === 0 ? "较重" : "一般",
        location: grids[idx % grids.length],
        time: `08-18 ${String(8 + (idx % 10)).padStart(2, "0")}:${String((idx * 7) % 60).padStart(2, "0")}`,
        camera: `CAM-${String.fromCharCode(65 + (idx % 26))}${String(idx).padStart(3, "0")}`,
        agentStatus: "Agent自动派发",
        suggestedGrid: grids[idx % grids.length],
        imgUrls: [eventImage(t, "during")],
        situation: situations[type],
        aiReview: type === "inspect" ? inspectReviews[idx % inspectReviews.length] : undefined,
      }
    })
  }

  function handleFetchEvents() {
    if (isDealing) return
    setIsDealing(true)
    setTimeout(() => {
      const startIdx =
        activeTab === "case"
          ? pendingCaseEvents.length + extraCaseEvents.length
          : activeTab === "inspect"
            ? pendingInspectEvents.length + extraInspectEvents.length
            : pendingVoidEvents.length + extraVoidEvents.length
      const newEvents = generateBatchEvents(
        activeTab as "case" | "inspect" | "void",
        10,
        startIdx,
      )
      if (activeTab === "case") {
        setExtraCaseEvents((prev) => [...prev, ...newEvents])
      } else if (activeTab === "inspect") {
        setExtraInspectEvents((prev) => [...prev, ...newEvents])
      } else {
        setExtraVoidEvents((prev) => [...prev, ...newEvents])
      }
      setIsDealing(false)
    }, 700)
  }

  // 影像灯箱：各视图共用。处理池视图为提前 return，必须一并挂载，否则缩略图点击无响应
  const previewOverlay = previewImage ? (
    <div
      onClick={() => setPreviewImage(null)}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(22,45,77,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: "80vw",
          maxHeight: "80vh",
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        <button
          onClick={() => setPreviewImage(null)}
          aria-label="关闭预览"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "none",
            backgroundColor: "rgba(0,0,0,0.5)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          ×
        </button>
        <img
          src={previewImage}
          alt="预览"
          style={{
            maxWidth: "80vw",
            maxHeight: "80vh",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>
    </div>
  ) : null

  if (view === "case-decision" && selectedEvent)
    return (
      <CaseDecisionPage
        event={selectedEvent}
        onBack={() => setView("overview")}
      />
    )
  if (view === "inspect-decision" && selectedEvent)
    return (
      <InspectDecisionPage
        event={selectedEvent}
        onBack={() => setView("overview")}
      />
    )
  if (view === "void-decision" && selectedEvent)
    return (
      <VoidDecisionPage
        event={selectedEvent}
        onBack={() => setView("overview")}
      />
    )

  if (view === "agent-pool") {
    const poolAll = buildPoolEvents()
    const poolTotal = agentPoolStats.reduce((sum, s) => sum + s.count, 0)
    // 决策流：只呈现需要人拍板的两种状态（unassigned + inspection）
    const decisionEvents = poolAll
      .filter((e) => e.state === "unassigned" || e.state === "inspection")
      .sort((a, b) => b.waitedH - a.waitedH)
    const decisionMeta = {
      id: "decision" as const,
      label: "待你决定",
      count: decisionEvents.length,
      color: T.primary,
      rgb: T.primaryRGB,
      hint: "Agent 已备好证据与草案，等你做关键治理决定",
      firstScreen: "",
      agentAction: "",
      humanDecision: "",
    }
    const activePool = poolEvent
      ? agentPoolStats.find((s) => s.id === poolEvent.state) || null
      : poolViewMode === "decision"
        ? decisionMeta
        : poolStateId
          ? agentPoolStats.find((s) => s.id === poolStateId) || null
          : null
    const stateEvents =
      poolViewMode === "decision"
        ? decisionEvents
        : activePool && activePool.id !== "decision"
          ? poolAll.filter((e) => e.state === activePool.id)
          : []
    const poolTypes = Array.from(new Set(stateEvents.map((e) => e.type)))
    const q = poolQuery.trim().toLowerCase()
    const matched = stateEvents
      .filter((e) => (poolTypeFilter === "all" ? true : e.type === poolTypeFilter))
      .filter((e) => (poolRiskOnly ? e.risk !== null : true))
      .filter((e) =>
        q === ""
          ? true
          : e.id.toLowerCase().includes(q) ||
            e.type.toLowerCase().includes(q) ||
            e.location.toLowerCase().includes(q) ||
            e.grid.toLowerCase().includes(q) ||
            e.blocker.toLowerCase().includes(q) ||
            e.owner.toLowerCase().includes(q),
      )
      .sort((a, b) => b.waitedH - a.waitedH)
    const poolShown = matched.slice(0, poolVisible)
    const POOL_COLS = "64px 112px 104px 1.4fr 78px 80px 1.6fr 60px"
    const riskMeta = (r: PoolEvent["risk"]) =>
      r === "overtime"
        ? {
            label: "已超时",
            color: "var(--red)",
            bg: "rgba(228,94,88,0.10)",
            border: "rgba(228,94,88,0.28)",
          }
        : r === "near"
          ? {
              label: "临近超时",
              color: "var(--amber)",
              bg: "rgba(255,122,66,0.10)",
              border: "rgba(255,122,66,0.28)",
            }
          : {
              label: activePool?.id === "watching" ? "无时限" : "时限内",
              color: "var(--muted-foreground)",
              bg: "transparent",
              border: T.border,
            }
    const waitedText = (h: number) =>
      h >= 1 ? `${h.toFixed(1)} 小时` : `${Math.round(h * 60)} 分钟`
    // 点击任一状态卡：自动进入完整追溯并定位该态（默认模式也能直接查看明细）
    const goList = (id: PoolStateId) => {
      setPoolViewMode("trace")
      setPoolStateId(id)
      setPoolEvent(null)
      setPoolQuery("")
      setPoolTypeFilter("all")
      setPoolRiskOnly(false)
      setPoolVisible(POOL_LIST_LIMIT)
    }
    // 详情内连续追溯：在当前筛选结果中切换上一条 / 下一条
    const detailIndex = poolEvent
      ? matched.findIndex((e) => e.id === poolEvent.id)
      : -1
    const goSibling = (dir: number) => {
      if (detailIndex < 0) return
      const next = matched[detailIndex + dir]
      if (next) setPoolEvent(next)
    }
    const detailFields = poolEvent
      ? poolEvent.state === "unassigned"
        ? [
            { k: "当前卡点", v: poolEvent.blocker },
            { k: "缺什么条件", v: `责任主体未定：${poolEvent.ownerRole}` },
            { k: "待分配给谁", v: poolEvent.owner },
            { k: "下一触发条件", v: poolEvent.nextTrigger },
          ]
        : poolEvent.state === "feedback"
          ? [
              { k: "当前卡点", v: poolEvent.blocker },
              {
                k: "当前责任人",
                v: `${poolEvent.owner} · ${poolEvent.ownerRole}`,
              },
              { k: "已等待多久", v: waitedText(poolEvent.waitedH) },
              {
                k: "时限风险",
                v: `${riskMeta(poolEvent.risk).label} · 时限 ${poolEvent.deadlineH} 小时`,
              },
              { k: "下一触发条件", v: poolEvent.nextTrigger },
            ]
          : poolEvent.state === "inspection"
            ? [
                { k: "当前卡点", v: poolEvent.blocker },
                {
                  k: "监督员",
                  v: `${poolEvent.owner} · ${poolEvent.ownerRole}`,
                },
                { k: "辖区匹配", v: poolEvent.grid },
                { k: "已等待多久", v: waitedText(poolEvent.waitedH) },
                {
                  k: "需要的证据",
                  v: poolEvent.needEvidence || "需同机位处置后图 1 张",
                },
              ]
            : [
                {
                  k: "观察对象",
                  v: poolEvent.monitorTarget || poolEvent.grid,
                },
                {
                  k: "监控规则",
                  v: poolEvent.monitorRule || "命中复发识别条件即创建新事件",
                },
                { k: "后续动作条件", v: poolEvent.nextTrigger },
                { k: "已观察时长", v: waitedText(poolEvent.waitedH) },
              ]
      : []

    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: T.bg,
        }}
      >
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${T.border}`,
            backgroundColor: T.card,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
            boxShadow: T.shadow,
          }}
        >
          <button
            onClick={() => setView("overview")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.textMuted,
              fontSize: 12,
            }}
          >
            ← 返回
          </button>
          <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>
            Agent 处理池
          </span>
          <span style={{ fontSize: 11, color: T.textMuted }}>
            · Agent 备好证据与草案，你只做关键治理决定 · 非人工待办
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: T.textMuted,
              fontFamily: T.mono,
            }}
          >
            存续事件合计 {poolTotal} 件
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            overflow: "hidden",
            gap: 12,
            padding: 12,
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflow: "auto",
              paddingRight: 2,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: T.textMuted,
                fontWeight: 600,
                letterSpacing: "0.02em",
                padding: "2px 2px 0",
              }}
            >
              Agent 工作分布 · 点击任一状态查看该态明细
            </div>
            {agentPoolStats.map((pool) => {
              const active = poolViewMode === "trace" && poolStateId === pool.id
              return (
                <div
                  key={pool.id}
                  onClick={() => goList(pool.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${pool.label}，存续 ${pool.count} 件，查看该态事件明细`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      goList(pool.id)
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid rgba(${pool.rgb},0.55)`
                    e.currentTarget.style.outlineOffset = "2px"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none"
                  }}
                  style={{
                    position: "relative",
                    padding: "13px 16px 12px",
                    borderRadius: 14,
                    cursor: "pointer",
                    backgroundColor: active
                      ? `rgba(${pool.rgb},0.07)`
                      : T.glassBg,
                    border: `1px solid ${
                      active ? `rgba(${pool.rgb},0.45)` : T.glassBorder
                    }`,
                    boxShadow: active
                      ? `0 10px 26px rgba(${pool.rgb},0.16), inset 0 1px 0 rgba(255,255,255,0.5)`
                      : T.glassShadow,
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    transition: "all 0.22s ease",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)"
                    e.currentTarget.style.boxShadow = `0 12px 28px rgba(${pool.rgb},0.16), inset 0 1px 0 rgba(255,255,255,0.5)`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)"
                    e.currentTarget.style.boxShadow = active
                      ? `0 10px 26px rgba(${pool.rgb},0.16), inset 0 1px 0 rgba(255,255,255,0.5)`
                      : T.glassShadow
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 12,
                      bottom: 12,
                      width: 3,
                      borderRadius: 3,
                      backgroundColor: pool.color,
                      opacity: active ? 1 : 0.3,
                      boxShadow: active ? `0 0 10px ${pool.color}` : "none",
                      transition: "all 0.22s ease",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: active ? pool.color : T.text,
                        transition: "color 0.22s ease",
                      }}
                    >
                      {pool.label}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: T.mono,
                        fontSize: 20,
                        fontWeight: 800,
                        color: pool.color,
                        lineHeight: 1,
                      }}
                    >
                      {pool.count}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: T.textMuted,
                      lineHeight: 1.55,
                      marginTop: 6,
                    }}
                  >
                    {pool.hint}
                  </div>
                  {pool.riskNote && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 6,
                        padding: "2px 8px 2px 6px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        color: "var(--red)",
                        backgroundColor: "rgba(228,94,88,0.08)",
                        border: "1px solid rgba(228,94,88,0.22)",
                        fontFamily: T.mono,
                        alignSelf: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          backgroundColor: "var(--red)",
                          flexShrink: 0,
                        }}
                      />
                      {pool.riskNote}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 7,
                      paddingTop: 7,
                      borderTop: `1px dashed ${T.border}`,
                      display: "grid",
                      gridTemplateColumns: "46px 1fr",
                      rowGap: 4,
                      columnGap: 7,
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        color: T.accent,
                      }}
                    >
                      AGENT
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        lineHeight: 1.55,
                      }}
                    >
                      {pool.agentAction}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        color: T.primary,
                      }}
                    >
                      人
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: T.text,
                        fontWeight: 600,
                        lineHeight: 1.55,
                      }}
                    >
                      {pool.humanDecision}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 4,
                      marginTop: 7,
                      fontSize: 10,
                      fontWeight: 600,
                      color: active ? pool.color : T.textMuted,
                      transition: "color 0.22s ease",
                    }}
                  >
                    {active ? "正在查看该态明细" : "查看明细"}
                    <span style={{ fontSize: 12, lineHeight: 1 }}>›</span>
                  </div>
                </div>
              )
            })}
            <div
              style={{
                padding: "11px 12px",
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                backgroundColor: T.card2,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: T.text,
                  letterSpacing: "0.01em",
                }}
              >
                Agent 持续成效
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3 }}>
                把流程劳动沉淀成可追溯的治理资产
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginTop: 9,
                }}
              >
                {AGENT_EFFECT.map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: "7px 8px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      backgroundColor: "var(--row-bg)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9.5,
                        color: T.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 15,
                        fontWeight: 800,
                        color: m.color,
                        lineHeight: 1.2,
                        marginTop: 2,
                      }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: T.textMuted,
                lineHeight: 1.65,
                padding: "2px 2px 6px",
              }}
            >
              标 <span style={{ color: T.accent, fontWeight: 700 }}>AGENT</span> 的行为 Agent 正在承担的流程劳动，标{" "}
              <span style={{ color: T.primary, fontWeight: 700 }}>人</span> 的一行是留给你承担的治理判断。
              <span style={{ fontWeight: 800, color: T.text }}> 原则：AI 不替代最终责任。</span>
              右侧默认只展示需你决定的事件；点击左列任一状态或“完整追溯”，可按四态查看全部 Agent 监控事件。
            </div>
          </div>
          {poolEvent ? (
            <Card
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => setPoolEvent(null)}
                  style={{
                    fontSize: 12,
                    color: activePool?.color || T.primary,
                    border: `1px solid ${activePool?.color || T.primary}`,
                    backgroundColor: "transparent",
                    padding: "4px 10px",
                    borderRadius: 7,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ← 返回
                </button>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: T.text,
                  }}
                >
                  {poolEvent.id}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                  {poolEvent.type}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: "2px 7px",
                    borderRadius: 5,
                    color: T.textMuted,
                    border: `1px solid ${T.border}`,
                    backgroundColor: T.card2,
                  }}
                >
                  {poolEvent.level}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: "2px 8px",
                    borderRadius: 5,
                    fontWeight: 700,
                    color: poolEvent.state === "watching" ? T.green : activePool?.color,
                    backgroundColor: activePool ? `rgba(${activePool.rgb},0.10)` : T.card2,
                    border: `1px solid ${
                      activePool ? `rgba(${activePool.rgb},0.30)` : T.border
                    }`,
                  }}
                >
                  {activePool?.label}
                </span>
                <span
                  style={{ marginLeft: "auto", fontSize: 10.5, color: T.textMuted }}
                >
                  只读运行详情 · 办理在待办队列
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    paddingLeft: 10,
                    borderLeft: `1px solid ${T.border}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.textMuted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {detailIndex < 0
                      ? "—"
                      : `第 ${detailIndex + 1} / 共 ${matched.length} 条`}
                  </span>
                  {[
                    { dir: -1, label: "‹ 上一条", disabled: detailIndex <= 0 },
                    {
                      dir: 1,
                      label: "下一条 ›",
                      disabled: detailIndex < 0 || detailIndex >= matched.length - 1,
                    },
                  ].map((nav) => (
                    <button
                      key={nav.dir}
                      onClick={() => goSibling(nav.dir)}
                      disabled={nav.disabled}
                      title={
                        nav.disabled
                          ? "已到当前筛选结果的边界"
                          : `${nav.label.replace(/[‹›\s]/g, "")}（按已等待时长倒序）`
                      }
                      style={{
                        fontSize: 11.5,
                        padding: "4px 9px",
                        borderRadius: 7,
                        cursor: nav.disabled ? "not-allowed" : "pointer",
                        opacity: nav.disabled ? 0.35 : 1,
                        border: `1px solid ${
                          nav.disabled ? T.border : activePool?.color || T.primary
                        }`,
                        backgroundColor: "transparent",
                        color: nav.disabled
                          ? T.textMuted
                          : activePool?.color || T.primary,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {nav.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  {[
                    { k: "位置", v: poolEvent.location },
                    { k: "所属网格", v: poolEvent.grid },
                    { k: "发生时间", v: poolEvent.time },
                  ].map((f) => (
                    <div
                      key={f.k}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 9,
                        backgroundColor: T.card2,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <div style={{ fontSize: 10, color: T.textMuted }}>
                        {f.k}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: T.text,
                          marginTop: 3,
                          fontWeight: 600,
                        }}
                      >
                        {f.v}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.textMuted,
                    }}
                  >
                    首屏关键信息
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: T.textMuted,
                      marginTop: 3,
                      marginBottom: 8,
                    }}
                  >
                    {activePool?.firstScreen}
                  </div>
                  <div
                    style={{
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      overflow: "hidden",
                      backgroundColor: "var(--row-bg)",
                    }}
                  >
                    {detailFields.map((f, i) => (
                      <div
                        key={f.k}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "96px 1fr",
                          gap: 10,
                          padding: "9px 12px",
                          borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: T.textMuted,
                            fontWeight: 600,
                          }}
                        >
                          {f.k}
                        </span>
                        <span
                          style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}
                        >
                          {f.v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid rgba(${T.accentRGB},0.30)`,
                      backgroundColor: `rgba(${T.accentRGB},0.06)`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: T.accent,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Agent 已备齐
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 5,
                        marginTop: 8,
                      }}
                    >
                      {poolPrepared(poolEvent.state).map((p) => (
                        <span
                          key={p}
                          style={{
                            fontSize: 10,
                            color: T.text,
                            padding: "2px 7px",
                            borderRadius: 5,
                            backgroundColor: "var(--row-bg)",
                            border: `1px solid ${T.border}`,
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid rgba(${T.primaryRGB},0.30)`,
                      backgroundColor: `rgba(${T.primaryRGB},0.06)`,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: T.primary,
                        letterSpacing: "0.02em",
                      }}
                    >
                      待你决定
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: T.text,
                        fontWeight: 600,
                        lineHeight: 1.6,
                        marginTop: 8,
                      }}
                    >
                      {agentPoolStats.find((s) => s.id === poolEvent.state)
                        ?.humanDecision}
                    </div>
                    <div
                      style={{
                        marginTop: 9,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px dashed rgba(${T.accentRGB},0.38)`,
                        backgroundColor: `rgba(${T.accentRGB},0.05)`,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          color: T.accent,
                        }}
                      >
                        AGENT 建议动作
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: T.text,
                          lineHeight: 1.55,
                          marginTop: 4,
                        }}
                      >
                        {poolSuggestion(poolEvent)}
                      </div>
                    </div>
                    {POOL_DISPATCH[poolEvent.state] ? (
                      <button
                        onClick={() => {
                          const d = POOL_DISPATCH[poolEvent.state]
                          if (!d) return
                          setPoolEvent(null)
                          setActiveTab(d.tab)
                          setView("overview")
                        }}
                        style={{
                          marginTop: 9,
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "#fff",
                          backgroundColor: T.primary,
                          border: "none",
                          borderRadius: 8,
                          padding: "7px 10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "0.88"
                          e.currentTarget.style.boxShadow = `0 6px 16px rgba(${T.primaryRGB},0.30)`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "1"
                          e.currentTarget.style.boxShadow = "none"
                        }}
                      >
                        {POOL_DISPATCH[poolEvent.state]?.label}
                        <span style={{ fontFamily: T.mono, fontSize: 12 }}>›</span>
                      </button>
                    ) : (
                      <div
                        style={{
                          marginTop: 9,
                          fontSize: 10,
                          color: T.textMuted,
                          lineHeight: 1.55,
                          padding: "7px 9px",
                          borderRadius: 8,
                          backgroundColor: T.card2,
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        本态无人工办理入口：Agent 按规则盯复发，命中即自动创建新事件回流处理池。
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        lineHeight: 1.6,
                        marginTop: 9,
                        paddingTop: 8,
                        borderTop: `1px dashed ${T.border}`,
                      }}
                    >
                      AI 不替代最终责任：写操作只在待办队列完成，本页只做证据与去向指引。
                    </div>
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.textMuted,
                      marginBottom: 8,
                    }}
                  >
                    接力轨迹
                  </div>
                  {poolEvent.trail.map((step, i) => {
                    const last = i === poolEvent.trail.length - 1
                    const actorColor =
                      step.actor === "Agent"
                        ? T.accent
                        : step.actor === "系统"
                          ? T.purple
                          : T.primary
                    return (
                      <div
                        key={`${step.t}-${i}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "12px 1fr",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: "50%",
                              marginTop: 4,
                              backgroundColor: last ? actorColor : "transparent",
                              border: `1.5px solid ${
                                last ? actorColor : T.borderStrong
                              }`,
                              boxShadow: last ? `0 0 8px ${actorColor}` : "none",
                              flexShrink: 0,
                            }}
                          />
                          {!last && (
                            <span
                              style={{
                                width: 1,
                                flex: 1,
                                backgroundColor: T.border,
                                minHeight: 16,
                              }}
                            />
                          )}
                        </div>
                        <div style={{ paddingBottom: last ? 0 : 12 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: T.mono,
                                color: T.textMuted,
                              }}
                            >
                              {step.t}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: actorColor,
                              }}
                            >
                              {step.actor}
                            </span>
                            {last && (
                              <span style={{ fontSize: 10, color: T.textMuted }}>
                                · 当前停在此处
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: T.text,
                              marginTop: 3,
                              lineHeight: 1.6,
                            }}
                          >
                            {step.text}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.textMuted,
                      marginBottom: 8,
                    }}
                  >
                    证据影像
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "发生中", src: poolEvent.evidence.during },
                      ...(poolEvent.evidence.after
                        ? [{ label: "处置后", src: poolEvent.evidence.after }]
                        : []),
                    ].map((img) => (
                      <div key={img.label} style={{ width: 186 }}>
                        <button
                          onClick={() => setPreviewImage(img.src)}
                          style={{
                            width: "100%",
                            height: 106,
                            borderRadius: 9,
                            overflow: "hidden",
                            border: `1px solid ${T.border}`,
                            padding: 0,
                            cursor: "pointer",
                            background: "transparent",
                            display: "block",
                            boxShadow: "0 4px 14px rgba(22,45,77,0.08)",
                            transition: "transform 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.02)"
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)"
                          }}
                        >
                          <img
                            src={img.src}
                            alt={img.label}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </button>
                        <div
                          style={{
                            fontSize: 10.5,
                            color: T.textMuted,
                            marginTop: 5,
                            textAlign: "center",
                          }}
                        >
                          {img.label}
                        </div>
                      </div>
                    ))}
                    {!poolEvent.evidence.after && (
                      <div
                        style={{
                          width: 186,
                          height: 106,
                          borderRadius: 9,
                          border: `1px dashed ${T.borderStrong}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10.5,
                          color: T.textMuted,
                          textAlign: "center",
                          padding: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        处置尚未发生
                        <br />
                        暂无处置后影像
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  flexShrink: 0,
                  flexWrap: "wrap",
                }}
              >
                {poolViewMode === "decision" ? (
                  <>
                    <span
                      style={{
                        width: 3,
                        height: 16,
                        borderRadius: 3,
                        backgroundColor: T.primary,
                        boxShadow: `0 0 8px ${T.primary}`,
                      }}
                    />
                    <span
                      style={{ fontSize: 13, fontWeight: 700, color: T.text }}
                    >
                      待你决定
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 13,
                        fontWeight: 800,
                        color: T.primary,
                      }}
                    >
                      {POOL_READY}
                    </span>
                    <span style={{ fontSize: 10.5, color: T.textMuted }}>
                      Agent 已备好证据与草案，等你做关键治理决定
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        width: 3,
                        height: 16,
                        borderRadius: 3,
                        backgroundColor: activePool.color,
                        boxShadow: `0 0 8px ${activePool.color}`,
                      }}
                    />
                    <span
                      style={{ fontSize: 13, fontWeight: 700, color: T.text }}
                    >
                      {activePool.label}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 13,
                        fontWeight: 800,
                        color: activePool.color,
                      }}
                    >
                      {activePool.count}
                    </span>
                    <span style={{ fontSize: 10.5, color: T.textMuted }}>
                      {activePool.hint}
                    </span>
                  </>
                )}
                <span style={{ marginLeft: "auto" }} />
                <button
                  onClick={() => {
                    if (poolViewMode === "decision") {
                      setPoolViewMode("trace")
                      setPoolStateId("unassigned")
                      setPoolEvent(null)
                      setPoolQuery("")
                      setPoolTypeFilter("all")
                      setPoolRiskOnly(false)
                      setPoolVisible(POOL_LIST_LIMIT)
                    } else {
                      setPoolViewMode("decision")
                      setPoolStateId("unassigned")
                      setPoolEvent(null)
                      setPoolQuery("")
                      setPoolTypeFilter("all")
                      setPoolRiskOnly(false)
                      setPoolVisible(POOL_LIST_LIMIT)
                    }
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "5px 11px",
                    borderRadius: 7,
                    cursor: "pointer",
                    border: `1px solid ${
                      poolViewMode === "decision" ? T.border : T.primary
                    }`,
                    backgroundColor:
                      poolViewMode === "decision"
                        ? "transparent"
                        : "rgba(22,119,255,0.08)",
                    color:
                      poolViewMode === "decision" ? T.textMuted : T.primary,
                    whiteSpace: "nowrap",
                  }}
                >
                  {poolViewMode === "decision"
                    ? `完整追溯（其余 ${POOL_AGENT_RUNNING} 件 Agent 监控中）`
                    : "只看需我决定"}
                </button>
                <span
                  style={{
                    fontSize: 10.5,
                    color: T.textMuted,
                    whiteSpace: "nowrap",
                  }}
                >
                  按已等待时长排序
                </span>
              </div>
              <div
                style={{
                  padding: "8px 14px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                  flexWrap: "wrap",
                }}
              >
                <input
                  value={poolQuery}
                  onChange={(e) => setPoolQuery(e.target.value)}
                  placeholder="搜索编号 / 类型 / 位置 / 卡点 / 责任人"
                  style={{
                    flex: "1 1 220px",
                    minWidth: 170,
                    padding: "5px 9px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: T.text,
                    backgroundColor: T.card,
                    outline: "none",
                  }}
                />
                <select
                  value={poolTypeFilter}
                  onChange={(e) => setPoolTypeFilter(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: T.text,
                    backgroundColor: T.card,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="all">全部事件类型</option>
                  {poolTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setPoolRiskOnly(!poolRiskOnly)}
                  style={{
                    fontSize: 11.5,
                    padding: "5px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    color: poolRiskOnly ? "var(--red)" : T.textMuted,
                    border: `1px solid ${
                      poolRiskOnly ? "rgba(228,94,88,0.35)" : T.border
                    }`,
                    backgroundColor: poolRiskOnly
                      ? "rgba(228,94,88,0.08)"
                      : "transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  仅看时限风险
                </button>
                {(poolQuery !== "" ||
                  poolTypeFilter !== "all" ||
                  poolRiskOnly) && (
                  <button
                    onClick={() => {
                      setPoolQuery("")
                      setPoolTypeFilter("all")
                      setPoolRiskOnly(false)
                    }}
                    style={{
                      fontSize: 11.5,
                      padding: "5px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      border: `1px solid ${T.border}`,
                      backgroundColor: "transparent",
                      color: T.textMuted,
                    }}
                  >
                    重置
                  </button>
                )}
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                {poolShown.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 220,
                      gap: 8,
                      color: T.textMuted,
                    }}
                  >
                    <div
                      style={{ fontSize: 13, fontWeight: 600, color: T.text }}
                    >
                      没有匹配的事件
                    </div>
                    <div style={{ fontSize: 11 }}>
                      当前条件下无结果，可放宽事件类型或时限风险条件
                    </div>
                  </div>
                ) : poolViewMode === "decision" ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 10,
                      alignContent: "start",
                    }}
                  >
                    {poolShown.map((evt) => {
                      const r = riskMeta(evt.risk)
                      const stateMeta = agentPoolStats.find(
                        (s) => s.id === evt.state,
                      )!
                      const dispatch = POOL_DISPATCH[evt.state]
                      return (
                        <div
                          key={evt.id}
                          onClick={() => setPoolEvent(evt)}
                          role="button"
                          tabIndex={0}
                          aria-label={`${evt.id} ${evt.type}，进入只读运行详情`}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setPoolEvent(evt)
                            }
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.outline = `2px solid rgba(${stateMeta.rgb},0.5)`
                            e.currentTarget.style.outlineOffset = "-2px"
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.outline = "none"
                          }}
                          style={{
                            border: `1px solid ${T.border}`,
                            borderRadius: 12,
                            padding: 12,
                            backgroundColor: "var(--row-bg)",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = `rgba(${stateMeta.rgb},0.45)`
                            e.currentTarget.style.boxShadow = `0 8px 22px rgba(${stateMeta.rgb},0.12)`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = T.border
                            e.currentTarget.style.boxShadow = "none"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: T.mono,
                                fontSize: 12,
                                fontWeight: 700,
                                color: T.text,
                              }}
                            >
                              {evt.id}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.text,
                              }}
                            >
                              {evt.type}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                padding: "2px 7px",
                                borderRadius: 5,
                                color: T.textMuted,
                                border: `1px solid ${T.border}`,
                                backgroundColor: T.card2,
                              }}
                            >
                              {evt.level}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                padding: "2px 7px",
                                borderRadius: 5,
                                fontWeight: 700,
                                color: stateMeta.color,
                                backgroundColor: `rgba(${stateMeta.rgb},0.10)`,
                                border: `1px solid rgba(${stateMeta.rgb},0.30)`,
                              }}
                            >
                              {stateMeta.label}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                            }}
                          >
                            {[
                              { k: "位置", v: evt.location },
                              { k: "网格", v: evt.grid },
                              { k: "发生时间", v: evt.time },
                              { k: "已等待", v: waitedText(evt.waitedH) },
                            ].map((f) => (
                              <div key={f.k}>
                                <div
                                  style={{ fontSize: 10, color: T.textMuted }}
                                >
                                  {f.k}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: T.text,
                                    marginTop: 2,
                                    fontWeight: 600,
                                  }}
                                >
                                  {f.v}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: T.textSub,
                              lineHeight: 1.55,
                            }}
                          >
                            {evt.blocker}
                          </div>
                          <div
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              backgroundColor: `rgba(${T.accentRGB},0.05)`,
                              border: `1px dashed rgba(${T.accentRGB},0.35)`,
                            }}
                          >
                            <div
                              style={{
                                fontFamily: T.mono,
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: "0.06em",
                                color: T.accent,
                              }}
                            >
                              AGENT 建议动作
                            </div>
                            <div
                              style={{
                                fontSize: 10.5,
                                color: T.text,
                                lineHeight: 1.55,
                                marginTop: 3,
                              }}
                            >
                              {poolSuggestion(evt)}
                            </div>
                          </div>
                          <div
                            style={{
                              marginTop: "auto",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                padding: "3px 9px",
                                borderRadius: 5,
                                color: r.color,
                                backgroundColor: r.bg,
                                border: `1px solid ${r.border}`,
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  backgroundColor: r.color,
                                }}
                              />
                              {r.label}
                            </span>
                            {dispatch ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPoolEvent(null)
                                  setActiveTab(dispatch.tab)
                                  setView("overview")
                                }}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#fff",
                                  backgroundColor: T.primary,
                                  border: "none",
                                  borderRadius: 7,
                                  padding: "5px 10px",
                                  cursor: "pointer",
                                }}
                              >
                                {dispatch.label}
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: T.textMuted,
                                }}
                              >
                                无人工入口
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      border: `1px solid ${T.border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: "var(--row-bg)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      boxShadow: "0 8px 24px rgba(22,45,77,0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: POOL_COLS,
                        padding: "11px 16px",
                        backgroundColor: "var(--card-2)",
                        borderBottom: `1px solid ${T.border}`,
                        fontSize: 12,
                        color: T.textMuted,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      <span>缩略图</span>
                      <span>事件编号</span>
                      <span>类型</span>
                      <span>位置</span>
                      <span>已等待</span>
                      <span>时限风险</span>
                      <span>当前卡点</span>
                      <span style={{ textAlign: "center" }}>追溯</span>
                    </div>
                    {poolShown.map((evt) => {
                      const r = riskMeta(evt.risk)
                      return (
                        <div
                          key={evt.id}
                          onClick={() => setPoolEvent(evt)}
                          role="button"
                          tabIndex={0}
                          aria-label={`${evt.id} ${evt.type}，进入只读运行详情`}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setPoolEvent(evt)
                            }
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.outline = `2px solid rgba(${activePool.rgb},0.5)`
                            e.currentTarget.style.outlineOffset = "-2px"
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.outline = "none"
                          }}
                          style={{
                            display: "grid",
                            gridTemplateColumns: POOL_COLS,
                            alignItems: "center",
                            padding: "10px 16px",
                            borderBottom: `1px solid ${T.border}`,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            backgroundColor: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "var(--control-bg-hover)"
                            e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(${activePool.rgb},0.14)`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent"
                            e.currentTarget.style.boxShadow = "none"
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewImage(evt.evidence.during)
                            }}
                            style={{
                              width: 48,
                              height: 36,
                              borderRadius: 6,
                              overflow: "hidden",
                              flexShrink: 0,
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              background: "transparent",
                              display: "block",
                              boxShadow: "0 2px 8px rgba(22,45,77,0.08)",
                              transition: "transform 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.05)"
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)"
                            }}
                          >
                            <img
                              src={evt.evidence.during}
                              alt={evt.type}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </button>
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: 12,
                              color: T.text,
                              fontWeight: 700,
                            }}
                          >
                            {evt.id}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: T.text,
                              fontWeight: 600,
                            }}
                          >
                            {evt.type}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: T.textMuted,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={evt.location}
                          >
                            {evt.location}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: evt.risk === "overtime" ? "var(--red)" : T.text,
                              fontFamily: T.mono,
                              fontWeight: 600,
                            }}
                          >
                            {waitedText(evt.waitedH)}
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11,
                              padding: "3px 9px",
                              borderRadius: 5,
                              color: r.color,
                              backgroundColor: r.bg,
                              border: `1px solid ${r.border}`,
                              fontWeight: 600,
                              justifySelf: "start",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                backgroundColor: r.color,
                                flexShrink: 0,
                              }}
                            />
                            {r.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: T.textSub,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={evt.blocker}
                          >
                            {evt.blocker}
                          </span>
                          <div style={{ textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: activePool.color,
                                border: `1px solid ${activePool.color}`,
                                borderRadius: 7,
                                padding: "3px 9px",
                                display: "inline-block",
                              }}
                            >
                              查看
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: "8px 14px",
                  borderTop: `1px solid ${T.border}`,
                  flexShrink: 0,
                  fontSize: 10.5,
                  color: T.textMuted,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <span>匹配 {matched.length} 件</span>
                <span>
                  已展示 {poolShown.length} / {matched.length} 件
                </span>
                <span>
                  {poolViewMode === "decision"
                    ? `待你决定总量 ${POOL_READY} 件`
                    : `该态存续总量 ${activePool.count} 件`}
                </span>
                <span
                  style={{
                    paddingLeft: 12,
                    borderLeft: `1px solid ${T.border}`,
                  }}
                >
                  {poolViewMode === "decision"
                    ? "决策流只含待分配与待外场核查"
                    : "列表为按需追溯样本，与四态总量口径不同"}
                </span>
                {poolVisible < matched.length ? (
                  <button
                    onClick={() =>
                      setPoolVisible(poolVisible + POOL_LIST_LIMIT)
                    }
                    style={{
                      marginLeft: "auto",
                      fontSize: 11.5,
                      padding: "5px 12px",
                      borderRadius: 7,
                      cursor: "pointer",
                      fontWeight: 600,
                      color: activePool.color,
                      border: `1px solid ${activePool.color}`,
                      backgroundColor: "transparent",
                      whiteSpace: "nowrap",
                    }}
                  >
                    加载更多（还有 {matched.length - poolVisible} 件）
                  </button>
                ) : (
                  <span style={{ marginLeft: "auto" }}>
                    {matched.length > POOL_LIST_LIMIT
                      ? "已显示全部匹配事件"
                      : ""}
                  </span>
                )}
              </div>
            </Card>
          )}
          {previewOverlay}
        </div>
      </div>
    )
  }

  const tabMeta = {
    recognition: {
      label: "全量识别",
      color: T.accent,
      desc: "相机识别全量事件",
    },
    case: { label: "待立案", color: T.primary, desc: "待立案当前批次还有" },
    inspect: { label: "待核查", color: T.purple, desc: "待核查当前批次还有" },
    void: { label: "待作废审核", color: T.orange, desc: "待作废审核当前批次还有" },
  }
  const activeMeta = tabMeta[activeTab]

  const situationStyle = (type: RtSituationType) => {
    switch (type) {
      case "warning":
        return { color: "var(--red)", bg: "rgba(228,94,88,0.12)", border: "rgba(228,94,88,0.28)" }
      case "info":
        return { color: "var(--primary)", bg: "rgba(50,109,255,0.12)", border: "rgba(50,109,255,0.28)" }
      case "readonly":
        return { color: "var(--muted-foreground)", bg: "transparent", border: "transparent" }
      default:
        return { color: T.text, bg: "transparent", border: "transparent" }
    }
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: T.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          height: 56,
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: "var(--glass-bg-strong)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          flexShrink: 0,
          boxShadow: "0 8px 28px rgba(22,45,77,0.07)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: T.text, letterSpacing: "0.02em" }}>
            {activeTab === "recognition" ? "全量识别" : "我的待办"}
          </span>
          <span style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
            {activeTab === "recognition"
              ? "相机实时识别全量事件 · 支持位置 / 事件类型 / 时间段检索"
              : "兼岗可办理 待立案、待核查、待作废审核"}
          </span>
        </div>
        <button
          onClick={() => setView("agent-pool")}
          title="Agent 处理池：Agent 已备好证据与草案的存续事件，只读追溯"
          style={{
            color: T.accent,
            border: "1px solid rgba(36,214,210,0.30)",
            backgroundColor: "rgba(36,214,210,0.08)",
            padding: "6px 14px",
            borderRadius: 9,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 9,
            textAlign: "left",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 14px rgba(36,214,210,0.10)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(36,214,210,0.14)"
            e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 18px rgba(36,214,210,0.16)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(36,214,210,0.08)"
            e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 14px rgba(36,214,210,0.10)"
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: T.accent,
              display: "block",
              boxShadow: `0 0 8px ${T.accent}`,
              flexShrink: 0,
            }}
          />
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 5,
                fontSize: 12,
                fontWeight: 800,
                color: T.text,
                whiteSpace: "nowrap",
              }}
            >
              Agent 已备齐
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 14,
                  fontWeight: 800,
                  color: T.accent,
                  lineHeight: 1.1,
                }}
              >
                {POOL_READY}
              </span>
              件待你决定
            </span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 9.5,
                fontWeight: 600,
                color: T.textMuted,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}
            >
              待你决定 {POOL_READY} 件 · 其余 {POOL_AGENT_RUNNING} 件 Agent 监控中
            </span>
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.accent,
              lineHeight: 1,
            }}
          >
            ›
          </span>
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr",
          overflow: "hidden",
          gap: 12,
          padding: 12,
          minHeight: 0,
        }}
      >
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
              padding: "0 8px",
              gap: 4,
            }}
          >
            {[
              {
                id: "recognition" as const,
                label: "全量识别",
                count: recognitionEvents.length,
                color: T.accent,
              },
              {
                id: "case" as const,
                label: "待立案",
                count: pendingCaseEvents.length,
                color: T.primary,
              },
              {
                id: "inspect" as const,
                label: "待核查",
                count: pendingInspectEvents.length,
                color: T.purple,
              },
              {
                id: "void" as const,
                label: "待作废审核",
                count: pendingVoidEvents.length,
                color: T.orange,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "11px 18px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    activeTab === tab.id
                      ? `${tab.color}10`
                      : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  borderBottom:
                    activeTab === tab.id
                      ? `2.5px solid ${tab.color}`
                      : "2.5px solid transparent",
                  color: activeTab === tab.id ? tab.color : T.textMuted,
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  borderRadius: "8px 8px 0 0",
                  transition: "all 0.2s ease",
                  boxShadow:
                    activeTab === tab.id
                      ? "inset 0 1px 0 rgba(255,255,255,0.5)"
                      : "none",
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 7px",
                    borderRadius: 10,
                    backgroundColor:
                      activeTab === tab.id ? `${tab.color}14` : T.card2,
                    color: activeTab === tab.id ? tab.color : T.textMuted,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    boxShadow:
                      activeTab === tab.id
                        ? `0 0 10px ${tab.color}30`
                        : "none",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeTab !== "recognition" && (
            <div
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, color: T.text }}>
                {activeMeta.desc} {events.length} 件待审核。
              </span>
            </div>
          )}

          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {activeTab === "recognition" ? (
              <RecognitionInbox
                onView={(img) => setPreviewImage(img)}
              />
            ) : (
              <>
            {events.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 200,
                  gap: 8,
                  color: T.textMuted,
                }}
              >
                <div style={{ fontSize: 11 }}>该批次暂无待审核事件</div>
              </div>
            ) : (
              <div
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: "var(--row-bg)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  boxShadow: "0 8px 24px rgba(22,45,77,0.06)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 120px 1fr 1fr 120px 180px 80px",
                    padding: "12px 16px",
                    backgroundColor: "var(--card-2)",
                    borderBottom: `1px solid ${T.border}`,
                    fontSize: 12,
                    color: T.textMuted,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  <span>缩略图</span>
                  <span>事件编号</span>
                  <span>类型</span>
                  <span>位置</span>
                  <span>发生时间</span>
                  <span>{activeTab === "inspect" ? "AI复审" : "当前情况"}</span>
                  <span style={{ textAlign: "center" }}>操作</span>
                </div>
                {events.map((evt) => {
                  const s = situationStyle(evt.situation.type)
                  const actionText = evt.situation.type === "readonly" ? "查看" : "办理"
                  return (
                    <div
                      key={evt.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "72px 120px 1fr 1fr 120px 180px 80px",
                        alignItems: "center",
                        padding: "10px 16px",
                        borderBottom: `1px solid ${T.border}`,
                        transition: "all 0.2s ease",
                        backgroundColor: "transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--control-bg-hover)"
                        e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(50,109,255,0.10)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent"
                        e.currentTarget.style.boxShadow = "none"
                      }}
                    >
                      <button
                        onClick={() => setPreviewImage(evt.imgUrls[0])}
                        style={{
                          width: 48,
                          height: 36,
                          borderRadius: 6,
                          overflow: "hidden",
                          flexShrink: 0,
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          background: "transparent",
                          display: "block",
                          boxShadow: "0 2px 8px rgba(22,45,77,0.08)",
                          transition: "transform 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.05)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)"
                        }}
                      >
                        <img
                          src={evt.imgUrls[0]}
                          alt={evt.type}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </button>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 12,
                          color: T.text,
                          fontWeight: 700,
                        }}
                      >
                        {evt.id}
                      </span>
                      <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{evt.type}</span>
                      <span style={{ fontSize: 12, color: T.textMuted }}>{evt.location}</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: T.textMuted,
                          fontFamily: T.mono,
                          fontWeight: 500,
                        }}
                      >
                        {evt.time}
                      </span>
                      <div>
                        {activeTab === "inspect" && evt.aiReview ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11,
                              padding: "3px 9px",
                              borderRadius: 5,
                              fontWeight: 600,
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                              color:
                                evt.aiReview.conclusion === "正常结案"
                                  ? T.green
                                  : evt.aiReview.conclusion === "建议退回"
                                    ? "#E45A52"
                                    : "#E89B3A",
                              backgroundColor:
                                evt.aiReview.conclusion === "正常结案"
                                  ? "rgba(53,185,133,0.08)"
                                  : evt.aiReview.conclusion === "建议退回"
                                    ? "rgba(228,94,88,0.08)"
                                    : "rgba(232,155,58,0.08)",
                              border: `1px solid ${
                                evt.aiReview.conclusion === "正常结案"
                                  ? "rgba(53,185,133,0.25)"
                                  : evt.aiReview.conclusion === "建议退回"
                                    ? "rgba(228,94,88,0.25)"
                                    : "rgba(232,155,58,0.25)"
                              }`,
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                backgroundColor:
                                  evt.aiReview.conclusion === "正常结案"
                                    ? T.green
                                    : evt.aiReview.conclusion === "建议退回"
                                      ? "#E45A52"
                                      : "#E89B3A",
                              }}
                            />
                            {evt.aiReview.conclusion}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11,
                              padding: "3px 9px",
                              borderRadius: 5,
                              color: s.color,
                              backgroundColor: s.bg,
                              border: `1px solid ${s.border}`,
                              fontWeight: 600,
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                backgroundColor: s.color,
                              }}
                            />
                            {evt.situation.text}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <button
                          onClick={() => {
                            setSelectedEvent(evt)
                            setView(
                              activeTab === "case"
                                ? "case-decision"
                                : activeTab === "inspect"
                                  ? "inspect-decision"
                                  : "void-decision",
                            )
                          }}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: activeMeta.color,
                            border: `1px solid ${activeMeta.color}`,
                            backgroundColor: "transparent",
                            borderRadius: 6,
                            padding: "4px 14px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = activeMeta.color
                            e.currentTarget.style.color = "#fff"
                            e.currentTarget.style.boxShadow = `0 4px 14px ${activeMeta.color}40`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent"
                            e.currentTarget.style.color = activeMeta.color
                            e.currentTarget.style.boxShadow = "none"
                          }}
                        >
                          {actionText}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingTop: 12,
                flexShrink: 0,
              }}
            >
              <button
                onClick={handleFetchEvents}
                disabled={isDealing}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isDealing ? T.textMuted : "#fff",
                  border: "none",
                  background: isDealing
                    ? T.card2
                    : `linear-gradient(135deg, ${activeMeta.color} 0%, ${activeMeta.color}DD 100%)`,
                  borderRadius: 10,
                  padding: "8px 24px",
                  cursor: isDealing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: isDealing
                    ? "none"
                    : `0 4px 16px ${activeMeta.color}50`,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isDealing) {
                    e.currentTarget.style.transform = "translateY(-1px)"
                    e.currentTarget.style.boxShadow = `0 6px 22px ${activeMeta.color}65`
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDealing) {
                    e.currentTarget.style.transform = "translateY(0)"
                    e.currentTarget.style.boxShadow = `0 4px 16px ${activeMeta.color}50`
                  }
                }}
              >
                {isDealing && (
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      border: "2px solid rgba(255,255,255,0.35)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "deal-spin 0.8s linear infinite",
                    }}
                  />
                )}
                {isDealing ? "Agent 派发中..." : "获取事件"}
              </button>
            </div>
              </>
            )}
          </div>
        </Card>

        {isDealing && (
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998 }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = -20 + i * 4
              const spreadX = -80 - i * 35
              const spreadY = 120 + i * 28
              return (
                <div
                  key={i}
                  className="deal-card"
                  style={{
                    top: "52px",
                    right: "16px",
                    ["--deal-x" as string]: `${spreadX}px`,
                    ["--deal-y" as string]: `${spreadY}px`,
                    ["--deal-rotate" as string]: `${angle}deg`,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              )
            })}
          </div>
        )}

        {previewOverlay}
      </div>
    </div>
  )
}

// ─── EventArchive ─────────────────────────────────────────────────────────────

interface ArchiveEvent {
  id: string
  finalStatus: "已结案" | "已中止" | "已无效"
  type: string
  location: string
  happenTime: string
  endTime: string
  inspector: string
  duration: string
  hasRecurrence: boolean
  imgUrls: string[]
}
const archiveEvents: ArchiveEvent[] = [
  {
    id: "DC-2026-08155",
    finalStatus: "已结案",
    type: "共享单车违规停放",
    location: "朝阳门南小街地铁口",
    happenTime: "2026-08-18 14:22",
    endTime: "2026-08-19 09:15",
    inspector: "张晓琳",
    duration: "18小时53分",
    hasRecurrence: false,
    imgUrls: [
      eventImage("共享单车违规停放", "after"),
      eventImage("共享单车违规停放", "during"),
    ],
  },
  {
    id: "DC-2026-08147",
    finalStatus: "已结案",
    type: "无证户外广告",
    location: "东直门内大街32号楼南立面",
    happenTime: "2026-08-17 09:00",
    endTime: "2026-08-18 16:40",
    inspector: "陈明",
    duration: "31小时40分",
    hasRecurrence: true,
    imgUrls: [
      eventImage("无证户外广告", "after"),
      eventImage("无证户外广告", "during"),
    ],
  },
  {
    id: "DC-2026-08138",
    finalStatus: "已中止",
    type: "违规施工",
    location: "建国门外大街16号在建项目",
    happenTime: "2026-08-16 07:30",
    endTime: "2026-08-17 11:00",
    inspector: "张晓琳",
    duration: "27小时30分",
    hasRecurrence: false,
    imgUrls: [eventImage("违规施工", "after")],
  },
  {
    id: "DC-2026-08129",
    finalStatus: "已无效",
    type: "乱堆杂物（误报）",
    location: "北新桥三条胡同深处",
    happenTime: "2026-08-15 21:18",
    endTime: "2026-08-15 21:45",
    inspector: "陈明",
    duration: "27分钟",
    hasRecurrence: false,
    imgUrls: [eventImage("乱堆杂物（误报）", "during")],
  },
  {
    id: "DC-2026-08121",
    finalStatus: "已结案",
    type: "店外经营占道",
    location: "东四十条甲22号临街餐馆",
    happenTime: "2026-08-15 12:10",
    endTime: "2026-08-15 17:55",
    inspector: "张晓琳",
    duration: "5小时45分",
    hasRecurrence: true,
    imgUrls: [
      eventImage("店外经营占道", "after"),
      eventImage("店外经营占道", "during"),
    ],
  },
]
const stColor: Record<string, string> = {
  已结案: T.green,
  已中止: T.textMuted,
  已无效: T.red,
}
const stBg: Record<string, string> = {
  已结案: "rgba(53,185,133,0.08)",
  已中止: "rgba(110,129,151,0.08)",
  已无效: "rgba(228,94,88,0.08)",
}

// 时间线步骤（已结案事件专用）
const closedTimeline = [
  {
    time: "14:22",
    title: "AI摄像头识别",
    actor: "系统",
    color: T.primary,
    desc: "CAM-CYM-023 识别到地铁口西侧大量共享单车无序堆放，置信度 91%，触发自动上报",
  },
  {
    time: "14:23",
    title: "Agent自动处理",
    actor: "Agent",
    color: T.accent,
    desc: "完成查重（无存续重复事件）、坐标匹配（朝阳门南小街网格 ±4m）、证据打包，预填所有立案字段，AI建议立案",
  },
  {
    time: "14:31",
    title: "人工立案审核",
    actor: "张晓琳",
    color: T.primary,
    desc: '审核员确认立案，事件等级调整为"较重"，派发至朝阳门南小街网格，责任人：李建国',
  },
  {
    time: "14:45",
    title: "网格员接单",
    actor: "李建国",
    color: T.purple,
    desc: '网格员李建国接收任务，前往现场，反馈"已到达，正在联系运营方"',
  },
  {
    time: "16:10",
    title: "运营方介入",
    actor: "李建国",
    color: "T.purple",
    desc: "哈啰出行运营员到场整理，网格员监督清场。上传处置中图2张",
  },
  {
    time: "18:55",
    title: "处置后图采集",
    actor: "李建国",
    color: "T.purple",
    desc: "现场已全部清理完毕，上传处置后图2张。网格员填写处置报告，申请核查",
  },
  {
    time: "19:08",
    title: "AI核查",
    actor: "Agent",
    color: T.accent,
    desc: "AI对比发现图与处置后图，确认违规情况已消除，建议结案，置信度 96%",
  },
  {
    time: "2026-08-19 09:15",
    title: "人工核查结案",
    actor: "张晓琳",
    color: T.green,
    desc: "审核员确认结案，总处置时长 18小时53分，归档事件档案",
  },
]

function EventArchive() {
  const [selected, setSelected] = useState<ArchiveEvent | null>(null)
  const [filterStatus, setFilterStatus] = useState("全部")
  const [searchQuery, setSearchQuery] = useState("")
  const [showAIQuery, setShowAIQuery] = useState(false)
  const [aiQuery, setAiQuery] = useState("")
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const handleAiQuery = (q: string) => {
    setAiQuery(q)
    setAiLoading(true)
    setAiResult(null)
    setTimeout(() => {
      setAiLoading(false)
      if (q.includes("共享单车") || q.includes("北新桥"))
        setAiResult(
          "找到 2 件符合条件的已结案事件：DC-2026-08155（朝阳门南小街地铁口，处置时长 18h53m）、DC-2026-08147（东直门内大街，处置时长 31h40m）。其中 DC-2026-08147 曾发生1次核查退回。",
        )
      else if (q.includes("对比") || q.includes("平均"))
        setAiResult(
          "朝阳门街道近两周平均处置时长 19.2小时，东直门街道 24.6小时。东直门街道超时事件占比更高（37%），建议重点关注其处置链路。",
        )
      else if (q.includes("复发"))
        setAiResult(
          "共找到 2 件结案后出现复发关联的事件：DC-2026-08147（无证户外广告，2026-08-17）、DC-2026-08121（店外经营占道，2026-08-15）。两件均已生成复发专题观察记录。",
        )
      else setAiResult("根据您的查询条件，共找到 3 件符合条件的事件。")
    }, 900)
  }

  const filtered = archiveEvents.filter((e) => {
    if (filterStatus !== "全部" && e.finalStatus !== filterStatus) return false
    if (
      searchQuery &&
      !e.id.includes(searchQuery) &&
      !e.type.includes(searchQuery) &&
      !e.location.includes(searchQuery)
    )
      return false
    if (dateFrom && e.happenTime < dateFrom) return false
    if (dateTo && e.happenTime > dateTo + " 23:59") return false
    return true
  })

  const glassInput = (
    width?: number | string,
    pad?: string,
    fz?: number,
  ): React.CSSProperties => ({
    padding: pad ?? "6px 10px 6px 30px",
    backgroundColor: "var(--chip-bg)",
    border: `1px solid ${T.glassBorder}`,
    borderRadius: 8,
    color: T.text,
    fontSize: fz ?? 12,
    width: width ?? "auto",
    outline: "none",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    boxShadow: "inset 0 1px 2px rgba(22,45,77,0.04)",
    transition: "all 0.2s ease",
  })

  const statusPill = (status: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10,
    padding: "3px 8px",
    borderRadius: 10,
    backgroundColor: stBg[status],
    color: stColor[status],
    fontWeight: 600,
    whiteSpace: "nowrap",
    border: `1px solid ${stColor[status]}22`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
  })

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: T.bg,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          height: 56,
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: "var(--glass-bg-strong)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          flexShrink: 0,
          boxShadow: "0 8px 28px rgba(22,45,77,0.07)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: T.text, letterSpacing: "0.02em" }}>
            事件档案
          </span>
          <span style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
            历史事件归档与 AI 查档
          </span>
        </div>
        <button
          onClick={() => setShowAIQuery(!showAIQuery)}
          style={{
            fontSize: 12,
            color: "#fff",
            border: "none",
            background: showAIQuery
              ? `linear-gradient(135deg, #24D6D2 0%, #326DFF 100%)`
              : `linear-gradient(135deg, #326DFF 0%, #24D6D2 100%)`,
            padding: "6px 14px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: showAIQuery
              ? "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 16px rgba(36,214,210,0.35)"
              : "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 16px rgba(50,109,255,0.32)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)"
            e.currentTarget.style.boxShadow = showAIQuery
              ? "inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 22px rgba(36,214,210,0.45)"
              : "inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 22px rgba(50,109,255,0.42)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = showAIQuery
              ? "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 16px rgba(36,214,210,0.35)"
              : "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 16px rgba(50,109,255,0.32)"
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#fff",
              display: "block",
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
            }}
          />
          AI查档
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          gap: 12,
          padding: 12,
          minHeight: 0,
        }}
      >
        {/* 左侧列表 */}
        <Card
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
            position: "relative",
          }}
        >
          {/* 顶部渐变装饰线 */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 14,
              right: 14,
              height: 2,
              borderRadius: "0 0 2px 2px",
              backgroundImage: `linear-gradient(90deg, ${T.primary} 0%, ${T.accent} 100%)`,
              opacity: 0.75,
            }}
          />
          {/* Filter bar */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative" }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.textMuted}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索ID、类型或位置..."
                style={glassInput(170)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  ...glassInput(126, "5px 8px", 11),
                  paddingLeft: 8,
                  color: dateFrom ? T.text : T.textMuted,
                }}
              />
              <span style={{ fontSize: 11, color: T.textMuted }}>—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  ...glassInput(126, "5px 8px", 11),
                  paddingLeft: 8,
                  color: dateTo ? T.text : T.textMuted,
                }}
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom("")
                    setDateTo("")
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    fontSize: 13,
                    color: T.textMuted,
                    background: "var(--row-bg)",
                    border: `1px solid ${T.glassBorder}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(228,94,88,0.1)"
                    e.currentTarget.style.color = T.red
                    e.currentTarget.style.borderColor = "rgba(228,94,88,0.25)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--row-bg)"
                    e.currentTarget.style.color = T.textMuted
                    e.currentTarget.style.borderColor = T.glassBorder
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: 0,
                backgroundColor: "var(--row-bg)",
                borderRadius: 10,
                padding: 3,
                border: `1px solid ${T.glassBorder}`,
                boxShadow: "inset 0 1px 2px rgba(22,45,77,0.04)",
              }}
            >
              {["全部", "已结案", "已中止", "已无效"].map((s) => {
                const active = filterStatus === s
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 8,
                      fontSize: 11,
                      cursor: "pointer",
                      border: "none",
                      backgroundColor: active
                        ? "rgba(255,255,255,0.95)"
                        : "transparent",
                      color: active ? stColor[s] || T.primary : T.textMuted,
                      fontWeight: active ? 700 : 500,
                      boxShadow: active
                        ? `0 2px 8px ${stColor[s] || T.primary}25, inset 0 1px 0 rgba(255,255,255,0.8)`
                        : "none",
                      transition: "all 0.2s ease",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.color = stColor[s] || T.primary
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.color = T.textMuted
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: T.text,
                whiteSpace: "nowrap",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 10,
                backgroundColor: "rgba(50,109,255,0.08)",
                border: `1px solid rgba(50,109,255,0.15)`,
              }}
            >
              {filtered.length} 件
            </span>
          </div>

          {/* 表头 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "76px 120px 1fr 1fr 84px 64px 76px",
              gap: 10,
              padding: "10px 14px",
              borderBottom: `1px solid ${T.border}`,
              fontSize: 11,
              color: T.textMuted,
              fontWeight: 700,
              flexShrink: 0,
              backgroundColor: "var(--card-2)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              letterSpacing: "0.02em",
            }}
          >
            <span>缩略图</span>
            <span>事件编号</span>
            <span style={{ paddingLeft: 20 }}>问题类型</span>
            <span>事件位置</span>
            <span style={{ marginLeft: -20 }}>终态</span>
            <span>审核人</span>
            <span>总时长</span>
          </div>

          {/* Table rows */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.map((evt) => (
              <div
                key={evt.id}
                onClick={() =>
                  setSelected(selected?.id === evt.id ? null : evt)
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "76px 120px 1fr 1fr 84px 64px 76px",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom: `1px solid ${T.border}`,
                  borderLeft:
                    selected?.id === evt.id
                      ? `3px solid ${T.primary}`
                      : "3px solid transparent",
                  cursor: "pointer",
                  backgroundColor:
                    selected?.id === evt.id
                      ? "rgba(50,109,255,0.05)"
                      : "transparent",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (selected?.id !== evt.id) {
                    e.currentTarget.style.backgroundColor = "var(--control-bg)"
                    e.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(50,109,255,0.08)"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    selected?.id === evt.id ? "rgba(50,109,255,0.05)" : "transparent"
                  e.currentTarget.style.boxShadow = "none"
                }}
              >
                {/* 缩略图 */}
                <div
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 8,
                    overflow: "hidden",
                    position: "relative",
                    flexShrink: 0,
                    boxShadow: "0 3px 10px rgba(22,45,77,0.1)",
                    transition: "transform 0.25s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)"
                  }}
                >
                  <img
                    src={evt.imgUrls[0]}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {evt.imgUrls.length > 1 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        backgroundColor: "rgba(22,45,77,0.72)",
                        color: "#fff",
                        padding: "2px 5px",
                        borderRadius: 5,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                      }}
                    >
                      +{evt.imgUrls.length - 1}
                    </div>
                  )}
                </div>
                {/* 事件编号 */}
                <div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.primary,
                      fontWeight: 700,
                    }}
                  >
                    {evt.id}
                  </div>
                  {evt.hasRecurrence && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 8,
                        backgroundColor: "rgba(255,122,66,0.12)",
                        color: T.amber,
                        fontWeight: 700,
                        border: "1px solid rgba(255,122,66,0.2)",
                        marginTop: 2,
                      }}
                    >
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          backgroundColor: T.amber,
                        }}
                      />
                      复发
                    </span>
                  )}
                </div>
                {/* 问题类型 */}
                <span
                  style={{
                    fontSize: 12,
                    color: T.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 8,
                    paddingLeft: 20,
                    fontWeight: 600,
                  }}
                >
                  {evt.type}
                </span>
                {/* 事件位置 */}
                <span
                  style={{
                    fontSize: 11,
                    color: T.textSub,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 8,
                  }}
                >
                  {evt.location}
                </span>
                {/* 终态 */}
                <span
                  style={{
                    ...statusPill(evt.finalStatus),
                    justifySelf: "start",
                    marginLeft: -20,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: stColor[evt.finalStatus],
                    }}
                  />
                  {evt.finalStatus}
                </span>
                {/* 审核人 */}
                <span
                  style={{
                    fontSize: 11,
                    color: T.text,
                    fontWeight: 500,
                    justifySelf: "start",
                  }}
                >
                  {evt.inspector}
                </span>
                {/* 总时长 */}
                <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.mono }}>
                  {evt.duration}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* 右侧详情 / AI查档 */}
        {showAIQuery ? (
          <Card
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 14,
                right: 14,
                height: 2,
                borderRadius: "0 0 2px 2px",
                backgroundImage: `linear-gradient(90deg, ${T.accent} 0%, ${T.primary} 100%)`,
                opacity: 0.75,
              }}
            />
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: T.accent,
                  boxShadow: `0 0 10px ${T.accent}`,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                AI查档
              </span>
              <span style={{ fontSize: 11, color: T.textMuted }}>
                自然语言查询历史事件
              </span>
              <button
                onClick={() => setShowAIQuery(false)}
                style={{
                  marginLeft: "auto",
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--row-bg)",
                  border: `1px solid ${T.glassBorder}`,
                  cursor: "pointer",
                  color: T.textMuted,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(228,94,88,0.1)"
                  e.currentTarget.style.color = T.red
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--row-bg)"
                  e.currentTarget.style.color = T.textMuted
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  color: T.textMuted,
                  fontWeight: 700,
                  marginBottom: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                常用查询
              </div>
              {[
                "查近30天北新桥街道、共享单车占道、核查退回过一次且处置时长超4小时的已结案事件",
                "对比朝阳门街道与东直门街道近两周同类事件的平均处置时长",
                "查所有结案后出现复发关联的事件，按时间排序",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleAiQuery(q)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    marginBottom: 8,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 10,
                    backgroundColor: "var(--row-bg)",
                    fontSize: 12,
                    color: T.text,
                    cursor: "pointer",
                    lineHeight: 1.5,
                    boxShadow: "inset 0 1px 0 var(--glass-highlight), 0 2px 8px rgba(22,45,77,0.04)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--glass-bg-strong)"
                    e.currentTarget.style.borderColor = T.borderStrong
                    e.currentTarget.style.transform = "translateX(2px)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--row-bg)"
                    e.currentTarget.style.borderColor = T.glassBorder
                    e.currentTarget.style.transform = "translateX(0)"
                  }}
                >
                  <span style={{ color: T.accent, fontWeight: 700, marginRight: 6 }}>
                    ›
                  </span>
                  {q}
                </button>
              ))}
              {aiLoading && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 14px",
                    border: "1px solid rgba(36,214,210,0.25)",
                    borderRadius: 12,
                    backgroundColor: "rgba(36,214,210,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: `2px solid rgba(36,214,210,0.25)`,
                      borderTopColor: T.accent,
                      borderRadius: "50%",
                      animation: "deal-spin 0.8s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: T.textSub }}>
                    AI 正在检索历史档案，请稍候…
                  </span>
                </div>
              )}
              {!aiLoading && aiResult && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "14px 16px",
                    border: "1px solid rgba(36,214,210,0.25)",
                    borderRadius: 12,
                    backgroundColor: "rgba(36,214,210,0.05)",
                    fontSize: 12,
                    color: T.text,
                    lineHeight: 1.75,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: T.accent,
                      }}
                    />
                    <span style={{ fontSize: 11, color: T.accent, fontWeight: 800 }}>
                      AI 查档结果
                    </span>
                  </div>
                  {aiResult}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderTop: `1px solid ${T.border}`,
                display: "flex",
                gap: 8,
                flexShrink: 0,
                backgroundColor: "var(--row-bg)",
              }}
            >
              <input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && aiQuery.trim() && handleAiQuery(aiQuery)
                }
                placeholder="输入查档条件，例如：近7天共享单车违规停放事件…"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  backgroundColor: "var(--chip-bg)",
                  border: `1px solid ${T.glassBorder}`,
                  borderRadius: 10,
                  color: T.text,
                  fontSize: 12,
                  outline: "none",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  boxShadow: "inset 0 1px 2px rgba(22,45,77,0.04)",
                }}
              />
              <button
                onClick={() => aiQuery.trim() && handleAiQuery(aiQuery)}
                style={{
                  padding: "8px 16px",
                  background: `linear-gradient(135deg, #326DFF 0%, #24D6D2 100%)`,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 14px rgba(50,109,255,0.28)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)"
                  e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 18px rgba(50,109,255,0.38)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 14px rgba(50,109,255,0.28)"
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22 11 13 2 9 22 2Z" />
                </svg>
                发送
              </button>
            </div>
          </Card>
        ) : selected ? (
          <Card
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 14,
                right: 14,
                height: 2,
                borderRadius: "0 0 2px 2px",
                backgroundImage: `linear-gradient(90deg, ${T.primary} 0%, ${T.accent} 100%)`,
                opacity: 0.75,
              }}
            />
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 12,
                  color: T.primary,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: "rgba(50,109,255,0.08)",
                  border: `1px solid rgba(50,109,255,0.15)`,
                }}
              >
                #{selected.id}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {selected.type}
              </span>
              <span style={statusPill(selected.finalStatus)}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: stColor[selected.finalStatus],
                  }}
                />
                {selected.finalStatus}
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{
                  marginLeft: "auto",
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--row-bg)",
                  border: `1px solid ${T.glassBorder}`,
                  cursor: "pointer",
                  color: T.textMuted,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(228,94,88,0.1)"
                  e.currentTarget.style.color = T.red
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--row-bg)"
                  e.currentTarget.style.color = T.textMuted
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {/* 基本信息 */}
              <SectionLabel style={{ marginBottom: 10 }}>基础信息</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {[
                  { label: "发生时间", value: selected.happenTime },
                  { label: "结束时间", value: selected.endTime },
                  { label: "总时长", value: selected.duration },
                  { label: "审核人", value: selected.inspector },
                  { label: "位置", value: selected.location },
                  {
                    label: "复发标记",
                    value: selected.hasRecurrence ? "是（3次同类）" : "否",
                  },
                ].map((f) => (
                  <div
                    key={f.label}
                    style={{
                      padding: "10px 12px",
                      backgroundColor: "var(--row-bg)",
                      borderRadius: 10,
                      border: `1px solid ${T.glassBorder}`,
                      boxShadow: "inset 0 1px 0 var(--glass-highlight), 0 2px 8px rgba(22,45,77,0.03)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        marginBottom: 3,
                        fontWeight: 600,
                        letterSpacing: "0.03em",
                      }}
                    >
                      {f.label}
                    </div>
                    <div
                      style={{ fontSize: 12, color: T.text, fontWeight: 600, lineHeight: 1.4 }}
                    >
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* 图片 */}
              <SectionLabel style={{ marginBottom: 10 }}>关键图片</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.textMuted,
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    发现图（{selected.imgUrls.length}张）
                  </div>
                  <ImageGallery urls={selected.imgUrls} />
                </div>
                {selected.finalStatus === "已结案" && (
                  <div>
                    <div
                      style={{ fontSize: 11, color: T.green, marginBottom: 6, fontWeight: 600 }}
                    >
                      处置后图（1张）
                    </div>
                    <div
                      style={{
                        borderRadius: 10,
                        overflow: "hidden",
                        boxShadow: "0 4px 14px rgba(22,45,77,0.08)",
                        border: `1px solid ${T.glassBorder}`,
                      }}
                    >
                      <img
                        src={eventImage(selected.type, "after")}
                        alt="处置后图"
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {selected.hasRecurrence && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "10px 14px",
                    border: "1px solid rgba(255,122,66,0.22)",
                    borderRadius: 10,
                    backgroundColor: "rgba(255,122,66,0.05)",
                    fontSize: 12,
                    color: T.amber,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      backgroundColor: "rgba(255,122,66,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    !
                  </span>
                  该位置已出现 3 次同类事件，达到复发识别阈值候选条件。
                </div>
              )}

              {/* 已结案：完整时间线 */}
              {selected.finalStatus === "已结案" && (
                <>
                  <SectionLabel style={{ marginBottom: 10 }}>完整处置过程</SectionLabel>
                  <div style={{ position: "relative", paddingLeft: 22 }}>
                    <div
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 8,
                        bottom: 8,
                        width: 2,
                        borderRadius: 1,
                        backgroundColor: T.border,
                      }}
                    />
                    {closedTimeline.map((step, i) => (
                      <div
                        key={i}
                        style={{ position: "relative", marginBottom: 14 }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: -22,
                            top: 4,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: step.color,
                            border: `2px solid ${T.cardSolid}`,
                            boxShadow: `0 0 0 1px ${step.color}80, 0 0 10px ${step.color}50`,
                          }}
                        />
                        <div
                          style={{
                            padding: "10px 12px",
                            backgroundColor: "var(--control-bg)",
                            borderRadius: 10,
                            border: `1px solid ${T.glassBorder}`,
                            boxShadow: "inset 0 1px 0 var(--glass-highlight), 0 2px 8px rgba(22,45,77,0.03)",
                            backdropFilter: "blur(6px)",
                            WebkitBackdropFilter: "blur(6px)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 5,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: T.text,
                              }}
                            >
                              {step.title}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 7px",
                                borderRadius: 8,
                                backgroundColor: `${step.color}14`,
                                color: step.color,
                                fontWeight: 700,
                                border: `1px solid ${step.color}25`,
                              }}
                            >
                              {step.actor}
                            </span>
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: 11,
                                color: T.textMuted,
                                fontFamily: T.mono,
                                fontWeight: 600,
                              }}
                            >
                              {step.time}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: T.textSub,
                              lineHeight: 1.6,
                            }}
                          >
                            {step.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 非结案：简单说明 */}
              {selected.finalStatus !== "已结案" && (
                <div
                  style={{
                    padding: "12px 14px",
                    border: `1px solid ${stColor[selected.finalStatus]}30`,
                    borderRadius: 10,
                    backgroundColor: stBg[selected.finalStatus],
                    fontSize: 12,
                    color: stColor[selected.finalStatus],
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: stColor[selected.finalStatus],
                    }}
                  />
                  {selected.finalStatus === "已中止"
                    ? "该事件因不满足继续流转条件已由审核人中止。"
                    : "该事件经审核判定不属于治理事件范围，已标记为无效归档。"}
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

// ─── AIStatistics ─────────────────────────────────────────────────────────────

type StatCat = "overview" | "events" | "process" | "efficiency" | "quality" | "ai" | "topics"
const statCategories: { id: StatCat label: string }[] = [
  { id: "overview", label: "综合态势" },
  { id: "events", label: "事件发生" },
  { id: "process", label: "流程运行" },
  { id: "efficiency", label: "作业效能" },
  { id: "quality", label: "治理质量" },
  { id: "ai", label: "AI作用成效" },
  { id: "topics", label: "专题统计" },
]

function BarChart({
  data,
  color = T.primary,
  height = 80,
}: {
  data: { label: string value: number }[]
  color?: string
  height?: number
}) {
  const maxVal = Math.max(...data.map((d) => d.value))
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {data.map((d) => (
        <div
          key={d.label}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            height: "100%",
            justifyContent: "flex-end",
          }}
        >
          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.mono }}>
            {d.value}
          </div>
          <div
            style={{
              width: "100%",
              backgroundColor: color,
              borderRadius: "3px 3px 0 0",
              opacity: 0.8,
              height: Math.max(
                4,
                Math.round((d.value / maxVal) * (height - 28)),
              ),
            }}
          />
          <div
            style={{
              fontSize: 9,
              color: T.textMuted,
              textAlign: "center",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function HBarChart({
  data,
  labelWidth = 100,
}: {
  data: { label: string value: number color?: string }[]
  labelWidth?: number
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d) => {
        const color = d.color || T.primary
        return (
          <div
            key={d.label}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <div
              style={{
                width: labelWidth,
                fontSize: 11,
                color: T.textSub,
                textAlign: "right",
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </div>
            <div
              style={{
                flex: 1,
                height: 18,
                backgroundColor: "#F0F2F5",
                borderRadius: 9,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round((d.value / maxVal) * 100)}%`,
                  height: "100%",
                  backgroundImage: `linear-gradient(90deg, ${color} 0%, ${T.cyan} 100%)`,
                  borderRadius: 9,
                  boxShadow: `0 2px 8px ${color}40`,
                }}
              />
            </div>
            <div
              style={{
                width: 28,
                fontSize: 12,
                fontWeight: 600,
                color: T.text,
                fontFamily: T.mono,
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {d.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({
  segments,
  size = 100,
}: {
  segments: { label: string value: number color: string }[]
  size?: number
}) {
  const total = segments.reduce((s, d) => s + d.value, 0)
  let cumAngle = -90
  const r = 36
  const cx = size / 2
  const cy = size / 2
  const arcs = segments.map((seg) => {
    const angle = (seg.value / total) * 360
    const start = cumAngle
    cumAngle += angle
    const largeArc = angle > 180 ? 1 : 0
    const toRad = (a: number) => (a * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(start))
    const y1 = cy + r * Math.sin(toRad(start))
    const x2 = cx + r * Math.cos(toRad(start + angle - 0.5))
    const y2 = cy + r * Math.sin(toRad(start + angle - 0.5))
    return {
      ...seg,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      pct: Math.round((seg.value / total) * 100),
    }
  })
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={22} fill={T.panelSolid} />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill={T.text}
        >
          {total}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {arcs.map((a) => (
          <div
            key={a.label}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: a.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: T.textSub }}>{a.label}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: T.text,
                marginLeft: "auto",
                paddingLeft: 8,
              }}
            >
              {a.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 统计数据 ─────────────────────────────────────────────────────────────────
const statData = {
  weeklyTrend: [
    { label: "08-14", discover: 3, close: 1 },
    { label: "08-15", discover: 2, close: 1 },
    { label: "08-16", discover: 3, close: 2 },
    { label: "08-17", discover: 3, close: 2 },
    { label: "08-18", discover: 5, close: 0 },
  ],
  stagesPending: [
    { label: "发现", value: 7 },
    { label: "立案", value: 1 },
    { label: "处置", value: 1 },
    { label: "核查", value: 5 },
    { label: "结案", value: 4 },
  ],
  severeByStreet: [
    { label: "朝阳门街道", value: 2 },
    { label: "安定门街道", value: 1 },
    { label: "北新桥街道", value: 1 },
    { label: "东四街道", value: 1 },
    { label: "和平里街道", value: 1 },
    { label: "建国门街道", value: 1 },
  ],
  sustainedTypes: [
    { label: "共享单车占道", value: 4, color: T.primary },
    { label: "施工占道", value: 4, color: T.accent },
    { label: "占道经营", value: 4, color: T.amber },
    { label: "暴露垃圾", value: 2, color: T.green },
    { label: "疑似堆物", value: 1, color: T.red },
  ],
  eventTypes: [
    { label: "共享单车占道", value: 5, color: T.primary },
    { label: "施工占道", value: 5, color: T.accent },
    { label: "占道经营", value: 4, color: T.amber },
    { label: "暴露垃圾", value: 2, color: T.green },
    { label: "疑似堆物", value: 2, color: T.red },
  ],
  eventByStreet: [
    { label: "北新桥街道", value: 4 },
    { label: "朝阳门街道", value: 4 },
    { label: "东华门街道", value: 4 },
    { label: "东四街道", value: 2 },
    { label: "安定门街道", value: 1 },
    { label: "东直门街道", value: 1 },
    { label: "和平里街道", value: 1 },
    { label: "建国门街道", value: 1 },
  ],
  hourly: [
    0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  eventSources: [
    { label: "AI视频识别", value: 16, color: T.primary },
    { label: "人工上报", value: 1, color: T.green },
    { label: "重复识别", value: 1, color: T.amber },
  ],
  topCameras: [
    { rank: 1, name: "C-A11-03", value: 3 },
    { rank: 2, name: "C-C07-11", value: 3 },
    { rank: 3, name: "C-B03-02", value: 2 },
    { rank: 4, name: "C-E01-02", value: 2 },
    { rank: 5, name: "C-A02-08", value: 1 },
    { rank: 6, name: "C-A07-04", value: 1 },
  ],
  stagePending: [
    { label: "待立案", value: 7, color: T.primary },
    { label: "待处置/待反馈", value: 1, color: T.amber },
    { label: "待核查/外场", value: 3, color: T.purple },
    { label: "待作废审核", value: 2, color: T.orange },
  ],
  processPool: [
    { label: "待分配", value: 1 },
    { label: "等待处置反馈", value: 1 },
    { label: "等待外场核查", value: 1 },
    { label: "持续监控", value: 1 },
  ],
  timeoutDist: [
    { label: "未超时（示意）", value: 13, color: T.green },
    { label: "临近超时（示意）", value: 2, color: T.amber },
  ],
  returnAbort: [
    { label: "退回处置（待处置）", value: 1 },
    { label: "待作废审核", value: 2 },
    { label: "已中止", value: 1 },
    { label: "升级接管", value: 0 },
  ],
  gridPending: [
    { label: "A11 责任人", value: 3 },
    { label: "C07 责任人", value: 2 },
    { label: "E01 责任人", value: 2 },
    { label: "A07 责任人", value: 1 },
    { label: "B03 责任人", value: 1 },
    { label: "B05 责任人", value: 1 },
    { label: "B08 责任人", value: 1 },
    { label: "C02 责任人", value: 1 },
    { label: "D04 责任人", value: 1 },
    { label: "F02 责任人", value: 1 },
  ],
  durationBuckets: [
    { label: "<30m", value: 2 },
    { label: "30m~2h", value: 5 },
    { label: "2h~8h", value: 3 },
    { label: ">8h", value: 1 },
  ],
  passVsReturn: [
    { label: "一次核查通过", value: 5, color: T.primary },
    { label: "退回后再结", value: 2, color: T.amber },
    { label: "外场补证", value: 2, color: T.purple },
  ],
  gridSpeed: [
    { label: "A11 占道经营", value: 3 },
    { label: "B03 共享单车", value: 2 },
    { label: "C07 施工占道", value: 2 },
  ],
  aiByStage: [
    { label: "事件发现", value: 94, color: T.accent },
    { label: "信息补全", value: 91, color: T.primary },
    { label: "核查辅助", value: 88, color: T.purple },
    { label: "结案建议", value: 82, color: T.green },
  ],
  aiAccuracy: [
    { label: "乱堆垃圾", value: 93 },
    { label: "违规施工", value: 91 },
    { label: "无证广告", value: 89 },
    { label: "店外经营", value: 87 },
    { label: "违规停放", value: 78 },
    { label: "共享单车", value: 84 },
  ],
  aiWeekly: [
    { label: "8/14", value: 83 },
    { label: "8/15", value: 85 },
    { label: "8/16", value: 84 },
    { label: "8/17", value: 87 },
    { label: "8/18", value: 86 },
  ],
}

const agentBanners: Record<StatCat, string> = {
  overview:
    "存续 15 件、今日闭环 0 件、严重 7 件。发现多、闭环未跟上，先看严重件落在哪个街道。",
  events:
    "类型用构成看结构，空间用排序看热点，时段用柱状看峰谷，来源用构成看来路，用来改巡检、不办理单件。",
  process:
    "待立案和待核查是人工瓶颈。超时率为配置口径示意，退回/作废/升级用当前状态计数，用来改规则而不是订盘。",
  efficiency:
    '效能必须在同类问题下比网格。当前样本少，时长和一次通过用示意比率占位，避免把"谁件多"当成"谁干得好"。',
  quality:
    "治理质量指标含复发率、反弹周期、群众投诉量，当前周期数据采集中，预计近30日后可用。",
  ai: 'AI本周在发现、补全、核查三环节均有实质参与，整体覆盖率 94%。"违规停放"分类准确率偏低（78%），建议核查规则版本与相机角度。',
  topics:
    "当前有 3 个活跃复发治理专题，其中朝阳门南小街共享单车已进入第 2 个观察期。",
}

function LineChart({
  data,
  height = 110,
}: {
  data: { label: string discover: number close: number }[]
  height?: number
}) {
  if (data.length < 2) return null
  const maxV = Math.max(...data.flatMap((d) => [d.discover, d.close]), 1)
  const VW = 500
  const padT = 12
  const padB = 24
  const padH = 10
  const px = (i: number) => padH + (i / (data.length - 1)) * (VW - padH * 2)
  const py = (v: number) => padT + (1 - v / maxV) * (height - padT - padB)

  const smoothPath = (vals: number[]) => {
    const pts = vals.map((v, i) => ({ x: px(i), y: py(v) }))
    if (pts.length < 2) return ""
    if (pts.length === 2)
      return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] || p2
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  }

  const dp = smoothPath(data.map((d) => d.discover))
  const cp = smoothPath(data.map((d) => d.close))

  return (
    <div>
      <div style={{ height, position: "relative" }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VW} ${height}`}
          preserveAspectRatio="none"
          style={{ display: "block", overflow: "visible" }}
        >
          {/* horizontal guide lines */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padH}
              y1={py(maxV * f)}
              x2={VW - padH}
              y2={py(maxV * f)}
              stroke={T.border}
              strokeWidth="1"
            />
          ))}
          <path
            d={dp}
            fill="none"
            stroke={T.primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={cp}
            fill="none"
            stroke={T.green}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10,8"
          />
          {data.map((d, i) => (
            <g key={i}>
              <circle
                cx={px(i).toFixed(1)}
                cy={py(d.discover).toFixed(1)}
                r="5"
                fill={T.card}
                stroke={T.primary}
                strokeWidth="2.5"
              />
              <circle
                cx={px(i).toFixed(1)}
                cy={py(d.close).toFixed(1)}
                r="5"
                fill={T.card}
                stroke={T.green}
                strokeWidth="2.5"
              />
              <text
                x={px(i).toFixed(1)}
                y={height - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight={500}
                fill={T.textMuted}
              >
                {d.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div
        style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 16,
              height: 2,
              backgroundColor: T.primary,
              borderRadius: 1,
            }}
          />
          <span style={{ fontSize: 10, color: T.textMuted }}>发现</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 16,
              height: 2,
              background: `repeating-linear-gradient(to right,${T.green} 0,${T.green} 4px,transparent 4px,transparent 7px)`,
            }}
          />
          <span style={{ fontSize: 10, color: T.textMuted }}>闭环</span>
        </div>
        <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>
          核验 08-18 实算件
        </span>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  hint,
  children,
  extra,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  const { queryingChart, onQuery } = useContext(ChartQueryCtx)
  const isQuerying = queryingChart === title
  return (
    <Card
      style={{
        padding: "14px 16px",
        outline: isQuerying ? `2px solid ${T.primary}` : "none",
        outlineOffset: -2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: hint ? 2 : 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
            {title}
          </div>
          {hint && (
            <div
              style={{
                fontSize: 10,
                color: T.textMuted,
                marginTop: 2,
                marginBottom: 10,
              }}
            >
              {hint}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
            flexShrink: 0,
          }}
        >
          {extra}
          {isQuerying ? (
            <span
              style={{
                fontSize: 10,
                color: T.primary,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                className="pulse-dot"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  backgroundColor: T.primary,
                  display: "inline-block",
                }}
              />
              正在解读
            </span>
          ) : (
            <button
              onClick={() => onQuery(title)}
              style={{
                fontSize: 10,
                color: T.primary,
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 0,
                whiteSpace: "nowrap",
              }}
            >
              问这张图
            </button>
          )}
        </div>
      </div>
      {children}
    </Card>
  )
}

const StatDemoTag = () => (
  <span
    style={{
      fontSize: 10,
      color: T.primary,
      border: `1px solid rgba(22,119,255,0.2)`,
      borderRadius: 3,
      padding: "1px 6px",
      backgroundColor: "rgba(22,119,255,0.04)",
    }}
  >
    示意
  </span>
)

type GroupByLevel = "街道" | "网格" | "街巷"

// Data keyed by groupBy level — street-level uses named streets; grid/lane use synthetic labels
const groupByData: Record<GroupByLevel, {
  severeByStreet: { label: string value: number }[]
  eventByStreet: { label: string value: number }[]
}> = {
  街道: {
    severeByStreet: [
      { label: "朝阳门街道", value: 2 },
      { label: "安定门街道", value: 1 },
      { label: "北新桥街道", value: 1 },
      { label: "东四街道", value: 1 },
      { label: "和平里街道", value: 1 },
      { label: "建国门街道", value: 1 },
    ],
    eventByStreet: [
      { label: "北新桥街道", value: 4 },
      { label: "朝阳门街道", value: 4 },
      { label: "东华门街道", value: 4 },
      { label: "东四街道", value: 2 },
      { label: "安定门街道", value: 1 },
      { label: "东直门街道", value: 1 },
      { label: "和平里街道", value: 1 },
      { label: "建国门街道", value: 1 },
    ],
  },
  网格: {
    severeByStreet: [
      { label: "朝阳门-01网格", value: 2 },
      { label: "朝阳门-03网格", value: 1 },
      { label: "安定门-02网格", value: 1 },
      { label: "北新桥-04网格", value: 1 },
      { label: "东四-01网格", value: 1 },
      { label: "建国门-02网格", value: 1 },
    ],
    eventByStreet: [
      { label: "北新桥-04网格", value: 3 },
      { label: "朝阳门-01网格", value: 3 },
      { label: "东华门-02网格", value: 2 },
      { label: "朝阳门-03网格", value: 2 },
      { label: "东华门-01网格", value: 2 },
      { label: "东四-01网格", value: 2 },
      { label: "安定门-02网格", value: 1 },
      { label: "东直门-01网格", value: 1 },
    ],
  },
  街巷: {
    severeByStreet: [
      { label: "朝内大街", value: 2 },
      { label: "北新桥三条", value: 1 },
      { label: "东四北大街", value: 1 },
      { label: "安定门西大街", value: 1 },
      { label: "建国门内大街", value: 1 },
      { label: "东直门内大街", value: 1 },
    ],
    eventByStreet: [
      { label: "朝内大街", value: 4 },
      { label: "北新桥三条", value: 3 },
      { label: "王府井大街", value: 3 },
      { label: "东四北大街", value: 2 },
      { label: "安定门西大街", value: 2 },
      { label: "交道口南大街", value: 1 },
      { label: "东直门内大街", value: 1 },
      { label: "建国门内大街", value: 1 },
    ],
  },
}

// Available groupBy levels depend on the spatial filter selected
function getAvailableLevels(statSpace: string): GroupByLevel[] {
  if (statSpace === "东城全区") return ["街道", "网格", "街巷"]
  // A specific street is selected — can only drill down to grid or lane
  return ["网格", "街巷"]
}

function StatGroupSelect({
  value,
  onChange,
  available,
}: {
  value: GroupByLevel
  onChange: (v: GroupByLevel) => void
  available: GroupByLevel[]
}) {
  const labels: Record<GroupByLevel, string> = {
    街道: "按街道分组",
    网格: "按网格分组",
    街巷: "按街巷分组",
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as GroupByLevel)}
      style={{
        padding: "2px 8px",
        border: `1.5px solid ${T.primary}`,
        borderRadius: 4,
        fontSize: 10,
        color: T.primary,
        backgroundColor: "#EEF4FF",
        outline: "none",
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      {available.map((level) => (
        <option key={level} value={level}>
          {labels[level]}
        </option>
      ))}
    </select>
  )
}

// Chart query context — shared across all ChartCard instances without prop drilling
type ChartQueryCtxType = {
  queryingChart: string | null
  onQuery: (title: string) => void
}
const ChartQueryCtx = createContext<ChartQueryCtxType>({
  queryingChart: null,
  onQuery: () => {},
})

// Per-chart AI responses
const chartAnswers: Record<string, {
  conclusion: string
  evidence: string
  correlation: string
  followups: string[]
}> = {
  "发现 vs 闭环走势": {
    conclusion:
      "发现量持续上升但闭环未跟上，08-18 发现 5 件、闭环 0 件，当日积压明显。",
    evidence: "近5日发现量：3→2→3→3→5；闭环量：1→1→2→2→0。两条线差距在扩大。",
    correlation:
      "以上是趋势描述，不代表闭环能力下降，可能与当日事件复杂度相关。",
    followups: ["08-18 为什么闭环是 0？", "同期严重件有没有增加？"],
  },
  各阶段存量: {
    conclusion:
      "「发现」阶段积压最多（7件），「核查」阶段次之（5件），是当前主要瓶颈。",
    evidence: "发现 7，立案 1，处置 1，核查 5，结案 4。发现→立案转化堵塞明显。",
    correlation:
      "结案 4 件说明流程仍在流动，发现积压多可能是 AI 批量发现但人工复核未跟上。",
    followups: ["发现阶段的 7 件是什么类型？", "核查的 5 件超时了吗？"],
  },
  严重问题空间: {
    conclusion: "严重问题最集中的是朝阳门街道（2件），其余各街道均为 1 件。",
    evidence:
      "严重问题空间：朝阳门街道 2，安定门街道 1，北新桥街道 1，东四街道 1，和平里街道 1，建国门街道 1。",
    correlation: "以上是当前范围里的结构描述，不是因果结论。",
    followups: [
      "换成网格或街巷后高发点还在不在？",
      "朝阳门的 2 件是同类型吗？",
    ],
  },
  当前存续类型: {
    conclusion:
      "共享单车占道、施工占道、占道经营三类平均，各 4 件，是当前存续主力类型。",
    evidence:
      "共享单车占道 4，施工占道 4，占道经营 4，暴露垃圾 2，疑似堆物 1。",
    correlation: "三类平均不代表难度相同，占道经营处置时长通常更长。",
    followups: ["哪类处置时长最长？", "这些件分布在哪些街道？"],
  },
  类型结构: {
    conclusion:
      "共享单车占道与施工占道并列最多（各 5 件），两者合计占事件总量 55%。",
    evidence:
      "共享单车占道 5，施工占道 5，占道经营 4，暴露垃圾 2，疑似堆物 2。",
    correlation: "类型结构反映发现能力，不一定反映实际发生频率。",
    followups: ["这两类高发在哪个时段？", "来源主要是 AI 还是人工上报？"],
  },
  空间分布: {
    conclusion:
      "北新桥、朝阳门、东华门三个街道并列最高（各 4 件），东城北部是主要高发区。",
    evidence:
      "北新桥 4，朝阳门 4，东华门 4，东四 2，安定门 1，东直门 1，和平里 1，建国门 1。",
    correlation: "三街道高发可能与摄像头覆盖密度有关，建议对照相机分布图验证。",
    followups: [
      "切到网格维度高发点有没有更集中？",
      "三个街道事件类型是否相同？",
    ],
  },
  发生时段: {
    conclusion:
      "事件主要集中在 08 时（4件）和 09 时（3件），早高峰是明显高发窗口。",
    evidence: "08时 4件，09时 3件，10-11时各 1件，14时 1件，其余时段为 0。",
    correlation:
      "早高峰高发符合共享单车和占道经营的行为规律，建议加强该时段巡查。",
    followups: ["08时的 4 件是哪个街道？", "下午 14 时的 1 件是什么类型？"],
  },
}
const defaultChartAnswer = {
  conclusion: "当前图表数据在所选时间和空间范围内呈现正常分布。",
  evidence: "数据基于近7日、东城全区、全部类型的筛选条件汇总。",
  correlation:
    "以上为结构性描述，不代表趋势判断。如需趋势对比，可切换至近30日。",
  followups: ["切换到近30日看是否有变化？", "按街道/网格下钻看分布？"],
}

type StatTime = "today" | "7d" | "30d"

function AIStatistics({ skin }: { skin: "light" | "tech" }) {
  return <AIStatisticsModule skin={skin} />
}

type WbTab = "dialogs" | "files" | "tasks"
type WbDialogType = "qa" | "report"

interface WbDialog {
  id: string
  title: string
  time: string
  type: WbDialogType
  fileId?: string
}

interface WbFile {
  id: string
  name: string
  type: string
  version: string
  size: string
  created: string
  dialogId?: string
  scope?: string
}

interface WbSuggestion {
  kind: "writeIn" | "goQA" | "newReport"
  text: string
}

interface WbMsg {
  role: "user" | "ai" | "status"
  content: string
  suggestions?: WbSuggestion[]
  fileCard?: { fileId: string }
}

const WB_TYPE_META: Record<
  WbDialogType,
  { label: string; color: string; bg: string }
> = {
  qa: { label: "业务问答", color: "#326DFF", bg: "rgba(50,109,255,0.10)" },
  report: { label: "分析成稿", color: "#0D9488", bg: "rgba(36,214,210,0.14)" },
}

const initialWbDialogs: WbDialog[] = [
  { id: "d1", title: "第33周治理周报", time: "08-18 14:32", type: "report", fileId: "f1" },
  { id: "d2", title: "高发街道分布咨询", time: "08-18 11:05", type: "qa" },
  { id: "d3", title: "AI识别准确率分析", time: "08-17 16:48", type: "report", fileId: "f2" },
  { id: "d4", title: "超时事件催办咨询", time: "08-17 09:20", type: "qa" },
]

const initialWbFiles: WbFile[] = [
  { id: "f1", name: "2026年第33周治理周报.pdf", type: "PDF", version: "v1", size: "1.2MB", created: "08-18", dialogId: "d1", scope: "08-11 ~ 08-17 · 全区" },
  { id: "f2", name: "AI识别准确率分析.xlsx", type: "Excel", version: "v2", size: "0.8MB", created: "08-17", dialogId: "d3", scope: "近30日 · 全区" },
  { id: "f3", name: "高发街道热力图.png", type: "图片", version: "v1", size: "2.4MB", created: "08-16", scope: "近30日 · 全区" },
]

const wbTasks = [
  {
    id: "t1",
    title: "每日 09:00 生成治理晨报",
    status: "运行中",
    schedule: "每天 09:00",
  },
  {
    id: "t2",
    title: "超时事件自动催办",
    status: "已触发",
    schedule: "每 2 小时",
  },
  {
    id: "t3",
    title: "每周一 08:00 输出周报",
    status: "运行中",
    schedule: "每周一 08:00",
  },
]

const initialWbConversations: Record<string, WbMsg[]> = {
  d1: [
    { role: "user", content: "生成本周治理周报，包含综合态势、事件发生、流程运行三个部分。" },
    { role: "status", content: "正在生成《2026年第33周治理周报》，约 2–3 分钟，完成后可在文件记录查看" },
    { role: "ai", content: "《2026年第33周治理周报》已生成（V1）。\n\n主要发现：\n• 本周发现事件 312 件，较上周增加 12%\n• 闭环 265 件，闭环率 85%，处置时长降至 2.4h\n• 朝阳门、东直门街道为高发区域", fileCard: { fileId: "f1" } },
  ],
  d2: [
    { role: "ai", content: "您好，这里是业务问答。我会按当前口径直接给结论，通常几秒内回复。" },
    { role: "user", content: "本周哪类事件上升最快？按当前口径直接给结论。" },
    { role: "ai", content: "按当前口径，本周上升最快的是暴露垃圾类，环比 +18%。\n\n依据：近7日 · 全区 · 全部事件类型。" },
    { role: "user", content: "主要分布在哪些街道？" },
    { role: "ai", content: "朝阳门、东四、北新桥三条街道合计占 52%，其中朝阳门地铁站周边网格最集中。" },
  ],
  d3: [
    { role: "user", content: "分析近30日AI识别准确率变化。" },
    { role: "ai", content: "近30日AI识别准确率 91.2%，较上月 +1.8pct。误报主要集中在夜间低照度场景。", fileCard: { fileId: "f2" } },
  ],
  d4: [
    { role: "user", content: "超时事件怎么催办更有效？" },
    { role: "ai", content: "按当前口径，超时主要集中在待处置环节。建议对超 24h 事件自动催办，并优先推送至街道值守岗。" },
  ],
}

// 模块级演示状态：推荐问题轮换 / 已消费的建议 chip
let wbQaSeq = 0
const wbConsumed = new Set<string>()

function AIWorkbench() {
  const [activeTab, setActiveTab] = useState<WbTab>("dialogs")
  const [dialogs, setDialogs] = useState<WbDialog[]>(initialWbDialogs)
  const [files, setFiles] = useState<WbFile[]>(initialWbFiles)
  const [activeDialogId, setActiveDialogId] = useState(initialWbDialogs[0].id)
  const activeDialog = dialogs.find((d) => d.id === activeDialogId) || null
  const [conversations, setConversations] = useState<Record<string, WbMsg[]>>(
    initialWbConversations
  )
  const [chatInput, setChatInput] = useState("")
  const [showOpPreview, setShowOpPreview] = useState(false)
  // 新建对话：两档业务入口（业务问答 / 分析成稿）
  const [newEntry, setNewEntry] = useState<WbDialogType | null>(null)
  // 业务问答 → 整理为报告：确认页（标题 / 纳入轮次 / 意图）
  const [exportConfirm, setExportConfirm] = useState<{
    title: string
    questions: string[]
    checked: number[]
    useTemplate: boolean
  } | null>(null)
  // 文件生成进度（演示压缩为几秒）
  const [gen, setGen] = useState<{
    dialogId: string
    title: string
    fileId: string
    pct: number
    template: boolean
  } | null>(null)

  const activeConv = conversations[activeDialogId] || []
  const activeFile =
    (activeDialog?.fileId && files.find((f) => f.id === activeDialog.fileId)) ||
    null
  const qaQuestionCount = activeConv.filter((m) => m.role === "user").length

  function setMsgs(dialogId: string, fn: (prev: WbMsg[]) => WbMsg[]) {
    setConversations((prev) => ({ ...prev, [dialogId]: fn(prev[dialogId] || []) }))
  }

  function replaceLastStatus(
    dialogId: string,
    msg: WbMsg
  ) {
    setMsgs(dialogId, (prev) => {
      const next = [...prev]
      const si = next.map((m) => m.role).lastIndexOf("status")
      if (si >= 0) next[si] = msg
      return next
    })
  }

  function bumpVersion(fileId: string): string {
    let nv = "v1"
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f
        const num = parseInt((f.version || "v1").replace("v", ""), 10) + 1
        nv = `v${num}`
        return { ...f, version: nv, created: "08-31" }
      })
    )
    return nv
  }

  // 生成进度推进；到 100% 后回写结果消息
  useEffect(() => {
    if (!gen) return
    if (gen.pct >= 100) {
      const g = gen
      setGen(null)
      replaceLastStatus(g.dialogId, {
        role: "ai",
        content: g.template
          ? `《${g.title}》已生成，已按模板补全未问过的章节。文件已保存至文件记录，可继续围绕这份报告追问。`
          : `《${g.title}》已生成，内容边界等于所选问答轮次，未补查新数据。文件已保存至文件记录，可继续围绕这份报告追问。`,
        fileCard: { fileId: g.fileId },
      })
      return
    }
    const t = setTimeout(() => {
      setGen((cur) =>
        cur ? { ...cur, pct: Math.min(100, cur.pct + 7 + Math.random() * 9) } : cur
      )
    }, 260)
    return () => clearTimeout(t)
  }, [gen])

  const QA_ANSWERS = [
    "按当前口径查询完成。\n\n• 暴露垃圾类环比 +18%，为本周上升最快\n• 朝阳门、东四、北新桥合计占比 52%\n\n数据范围：近7日 · 全区 · 全部类型。",
    "按当前口径：闭环率 85%，平均处置时长 2.4h，较上周下降 0.3h。\n\n口径说明：闭环率 = 已结案 / (发现 - 无效)。",
    "已按当前口径统计：待立案 5 件、待处置 12 件、待核查 3 件。\n\n如需趋势对比，可继续追问环比变化。",
  ]

  function sendQA(dialogId: string, text: string) {
    setMsgs(dialogId, (prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "status", content: "正在按当前口径查询" },
    ])
    const isOp = text.includes("操作") || text.includes("激活")
    setTimeout(() => {
      replaceLastStatus(dialogId, {
        role: "ai",
        content: isOp
          ? "检测到您要执行业务操作。我已完成操作预检，请在右侧确认后执行。"
          : QA_ANSWERS[wbQaSeq++ % QA_ANSWERS.length],
      })
      if (isOp) setShowOpPreview(true)
    }, 1100)
  }

  function deriveReportTitle(text: string): string {
    if (text.includes("暴露")) return "暴露垃圾专题报告"
    if (text.includes("周报")) return "治理周报"
    if (text.includes("月报")) return "治理月报"
    if (text.includes("专题")) return "专题分析报告"
    if (text.includes("汇报")) return "汇报材料"
    return "治理分析报告"
  }

  function sendReport(dialogId: string, text: string) {
    // 范围外：引导跳转，不在本条硬答
    if (/另一份|第二份|换个专题|新的专题|无关/.test(text)) {
      setMsgs(dialogId, (prev) => [
        ...prev,
        { role: "user", content: text },
        {
          role: "ai",
          content: "当前报告未覆盖该范围。可前往业务问答，或按此问题新开一份成稿。",
          suggestions: [
            { kind: "goQA", text: "前往业务问答" },
            { kind: "newReport", text: "新开一份成稿" },
          ],
        },
      ])
      return
    }
    const isGen = /生成|写一|出一|周报|月报|汇报/.test(text)
    if (isGen) {
      const title = deriveReportTitle(text)
      const fileId = `f-${Date.now()}`
      setFiles((prev) => [
        { id: fileId, name: `${title}.pdf`, type: "PDF", version: "v1", size: "1.1MB", created: "08-31", dialogId, scope: "近7日 · 全区" },
        ...prev,
      ])
      setDialogs((prev) =>
        prev.map((d) => (d.id === dialogId ? { ...d, fileId } : d))
      )
      setMsgs(dialogId, (prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "status", content: `正在生成《${title}》，约 2–3 分钟，完成后可在文件记录查看` },
      ])
      setGen({ dialogId, title, fileId, pct: 0, template: false })
      return
    }
    // 范围内追问：默认先回答、不改稿
    setMsgs(dialogId, (prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "status", content: "正在按报告口径复核数据" },
    ])
    setTimeout(() => {
      const ans = /怎么来|来源|口径|解释/.test(text)
        ? "该数来自本报告第 2 节：本周发现事件 312 件，口径为「网格巡查 + AI 识别 + 市民上报」去重后的有效事件。"
        : /环比|同比|为啥|为什么|趋势|多少/.test(text)
        ? "环比 +12%：本周 312 件 vs 上周 279 件。主要增量来自暴露垃圾（+18%）与店外经营（+9%）。"
        : "围绕当前报告：闭环率 85%，处置时长 2.4h，朝阳门、东直门为高发区域。"
      replaceLastStatus(dialogId, {
        role: "ai",
        content: ans,
        suggestions: [{ kind: "writeIn", text: "是否将这段分析写入本报告？" }],
      })
    }, 1000)
  }

  function sendMessage() {
    if (!chatInput.trim() || !activeDialog || gen) return
    const text = chatInput.trim()
    setChatInput("")
    if (activeDialog.type === "qa") sendQA(activeDialog.id, text)
    else sendReport(activeDialog.id, text)
  }

  // 范围内追问后：写入本报告（出新版本）
  function applyWriteIn(dialogId: string, key: string) {
    if (wbConsumed.has(key) || gen) return
    wbConsumed.add(key)
    const d = dialogs.find((x) => x.id === dialogId)
    const file = files.find((f) => f.id === d?.fileId)
    if (!file || !d) return
    const nv = bumpVersion(file.id)
    setMsgs(dialogId, (prev) => [
      ...prev,
      { role: "status", content: `正在写入《${d.title}》…` },
    ])
    setTimeout(() => {
      replaceLastStatus(dialogId, {
        role: "ai",
        content: `已写入本报告，文件更新至 ${nv}。`,
        fileCard: { fileId: file.id },
      })
    }, 1400)
  }

  // 成稿 → 范围外问题：跳转业务问答（一次性拷贝意图，不共用上下文）
  function goQAFromReport() {
    const today = "08-31"
    const exist = dialogs.find((d) => d.type === "qa" && d.title === `业务问答 · ${today}`)
    if (exist) {
      setActiveDialogId(exist.id)
      return
    }
    const id = `d-${Date.now()}`
    setDialogs((prev) => [
      { id, title: `业务问答 · ${today}`, time: `${today} 16:20`, type: "qa" },
      ...prev,
    ])
    setConversations((prev) => ({
      ...prev,
      [id]: [
        {
          role: "ai",
          content:
            "已从成稿对话跳转。这里是业务问答，可按当前口径查询任意范围数据；与原成稿对话的上下文相互独立。",
        },
      ],
    }))
    setActiveDialogId(id)
  }

  // 新建对话：确认两档入口
  function confirmNewEntry() {
    if (!newEntry) return
    const id = `d-${Date.now()}`
    const isQA = newEntry === "qa"
    setDialogs((prev) => [
      {
        id,
        title: isQA ? "业务问答 · 08-31" : "分析成稿 · 08-31",
        time: "08-31 16:20",
        type: newEntry,
      },
      ...prev,
    ])
    setConversations((prev) => ({
      ...prev,
      [id]: isQA
        ? [
            {
              role: "ai",
              content: "您好，这里是业务问答。我会按当前口径直接给结论，通常几秒内回复。",
            },
          ]
        : [],
    }))
    setActiveDialogId(id)
    setActiveTab("dialogs")
    setNewEntry(null)
  }

  // 业务问答 → 整理为报告：打开确认页
  function openExportConfirm() {
    if (!activeDialog || activeDialog.type !== "qa" || !qaQuestionCount) return
    const questions = activeConv
      .filter((m) => m.role === "user")
      .map((m) => m.content)
    setExportConfirm({
      title: "分析摘要 · 问答纪要",
      questions,
      checked: questions.map((_, i) => i),
      useTemplate: false,
    })
  }

  // 确认后：新开一条分析成稿 + 新文件，原问答对话不变
  function confirmExport() {
    if (!exportConfirm) return
    const title = exportConfirm.title.trim() || "分析摘要 · 问答纪要"
    const id = `d-${Date.now()}`
    const fileId = `f-${Date.now()}`
    setDialogs((prev) => [
      { id, title, time: "08-31 16:25", type: "report", fileId },
      ...prev,
    ])
    setFiles((prev) => [
      {
        id: fileId,
        name: `${title}.pdf`,
        type: "PDF",
        version: "v1",
        size: "0.9MB",
        created: "08-31",
        dialogId: id,
        scope: exportConfirm.useTemplate
          ? `纳入 ${exportConfirm.checked.length} 轮问答 · 按模板补全`
          : `仅汇总 ${exportConfirm.checked.length} 轮问答 · 不新拉数`,
      },
      ...prev,
    ])
    setConversations((prev) => ({
      ...prev,
      [id]: [
        {
          role: "status",
          content: `正在生成《${title}》，约 2–3 分钟，完成后可在文件记录查看`,
        },
      ],
    }))
    setActiveDialogId(id)
    setActiveTab("dialogs")
    setExportConfirm(null)
    setGen({ dialogId: id, title, fileId, pct: 0, template: exportConfirm.useTemplate })
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: T.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          height: 48,
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: T.card,
          flexShrink: 0,
          boxShadow: T.shadow,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, color: T.text }}>
          AI 工作台
        </span>
        <span
          style={{
            marginLeft: 10,
            fontSize: 11,
            color: T.textMuted,
            padding: "2px 7px",
            border: `1px solid ${T.border}`,
            borderRadius: 4,
          }}
        >
          全量数据 · 账号权限内
        </span>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          gap: 12,
          padding: 12,
          minHeight: 0,
        }}
      >
        <Card
          style={{
            width: 248,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${T.border}`,
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
                style={{
                  flex: 1,
                  padding: "10px 6px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  fontSize: 11,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? T.primary : T.textMuted,
                  borderBottom:
                    activeTab === tab.id
                      ? `2px solid ${T.primary}`
                      : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {activeTab === "dialogs" && (
              <>
                <button
                  onClick={() => setNewEntry("qa")}
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    padding: "8px 10px",
                    background: `linear-gradient(135deg, ${T.primary} 0%, #5A8BFF 100%)`,
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(50,109,255,0.25)",
                  }}
                >
                  + 新建对话
                </button>
                {dialogs.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setActiveDialogId(d.id)}
                    style={{
                      padding: "9px 10px",
                      marginBottom: 3,
                      borderRadius: 8,
                      cursor: "pointer",
                      backgroundColor:
                        activeDialogId === d.id
                          ? "rgba(50,109,255,0.06)"
                          : "transparent",
                      border: `1px solid ${
                        activeDialogId === d.id
                          ? "rgba(50,109,255,0.2)"
                          : "transparent"
                      }`,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: T.text,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.title}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          backgroundColor: WB_TYPE_META[d.type].bg,
                          color: WB_TYPE_META[d.type].color,
                          padding: "1px 5px",
                          borderRadius: 4,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {WB_TYPE_META[d.type].label}
                      </span>
                      {d.fileId && (
                        <span
                          style={{
                            fontSize: 9,
                            backgroundColor: "rgba(50,109,255,0.1)",
                            color: T.primary,
                            padding: "1px 4px",
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        >
                          文件
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>
                      {d.time}
                    </div>
                  </div>
                ))}
              </>
            )}
            {activeTab === "files" &&
              files.map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: "9px 10px",
                    marginBottom: 5,
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    cursor: "pointer",
                    backgroundColor: "var(--chip-bg)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: T.text,
                      marginBottom: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.name}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted }}>
                    {f.type} · {f.version} · {f.size} · {f.created}
                  </div>
                  {f.scope && (
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                      数据范围：{f.scope}
                    </div>
                  )}
                  {f.dialogId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveDialogId(f.dialogId!)
                        setActiveTab("dialogs")
                      }}
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        color: T.primary,
                        backgroundColor: "rgba(50,109,255,0.08)",
                        border: "none",
                        padding: "3px 8px",
                        borderRadius: 5,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      来源对话 →
                    </button>
                  )}
                </div>
              ))}
            {activeTab === "tasks" && (
              <div
                style={{
                  fontSize: 10,
                  color: T.textMuted,
                  padding: "2px 4px 8px",
                  lineHeight: 1.5,
                }}
              >
                定时周报、指标监控属于调度任务，不进入新建对话选择器。
              </div>
            )}
            {activeTab === "tasks" &&
              wbTasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: "9px 10px",
                    marginBottom: 5,
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <div style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 3,
                        backgroundColor:
                          t.status === "已触发"
                            ? "rgba(255,122,66,0.1)"
                            : "rgba(53,185,133,0.08)",
                        color: t.status === "已触发" ? T.amber : T.green,
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: T.text,
                      marginBottom: 3,
                    }}
                  >
                    {t.title}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted }}>
                    {t.schedule}
                  </div>
                </div>
              ))}
          </div>
        </Card>
        <Card
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {activeDialog && (
            <div
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${T.border}`,
                backgroundColor: T.card2,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      backgroundColor: WB_TYPE_META[activeDialog.type].bg,
                      color: WB_TYPE_META[activeDialog.type].color,
                      padding: "1px 7px",
                      borderRadius: 5,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {WB_TYPE_META[activeDialog.type].label}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {activeDialog.title}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                  城运AI · {activeDialog.time} ·{" "}
                  {activeDialog.type === "qa"
                    ? "文字结论 · 几秒回复"
                    : "围绕当前报告 · 先答不改稿"}
                </div>
              </div>
              {activeDialog.type === "qa" ? (
                <button
                  onClick={openExportConfirm}
                  disabled={!qaQuestionCount}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: qaQuestionCount ? T.primary : T.textMuted,
                    backgroundColor: qaQuestionCount
                      ? "rgba(50,109,255,0.08)"
                      : "rgba(110,129,151,0.08)",
                    border: "none",
                    padding: "5px 10px",
                    borderRadius: 7,
                    cursor: qaQuestionCount ? "pointer" : "default",
                    flexShrink: 0,
                  }}
                >
                  整理为报告
                </button>
              ) : activeFile ? (
                <button
                  onClick={() => setActiveTab("files")}
                  style={{
                    fontSize: 10,
                    color: T.primary,
                    backgroundColor: "rgba(50,109,255,0.08)",
                    border: "none",
                    padding: "4px 9px",
                    borderRadius: 7,
                    cursor: "pointer",
                    fontWeight: 600,
                    flexShrink: 0,
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  当前报告 · {activeFile.name} · {activeFile.version}
                </button>
              ) : null}
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {activeConv.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: T.textMuted,
                  fontSize: 12,
                  marginTop: 48,
                  lineHeight: 1.9,
                }}
              >
                这是一条分析成稿对话。
                <br />
                描述要生成的报告，或围绕当前报告追问。
              </div>
            )}
            {activeConv.map((msg, i) => {
              const lastStatusIdx = activeConv.map((m) => m.role).lastIndexOf("status")
              const showProgress =
                msg.role === "status" &&
                i === lastStatusIdx &&
                gen &&
                gen.dialogId === activeDialogId
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 14,
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    alignItems:
                      msg.role === "status" ? "center" : "flex-start",
                  }}
                >
                  {msg.role === "ai" && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg,${T.primary},${T.accent})`,
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
                        stroke="white"
                        strokeWidth="2"
                      >
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                  )}
                  {msg.role === "status" ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        backgroundColor: "rgba(50,109,255,0.06)",
                        border: "1px solid rgba(50,109,255,0.15)",
                        borderRadius: 20,
                        margin: "0 auto",
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.primary}
                        strokeWidth="2.5"
                        style={{ animation: "wb-spin 1s linear infinite" }}
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <span style={{ fontSize: 11, color: T.primary, fontWeight: 500 }}>
                        {msg.content}
                      </span>
                      {showProgress && (
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: T.mono,
                            color: T.primary,
                            fontWeight: 700,
                            minWidth: 30,
                            textAlign: "right",
                          }}
                        >
                          {Math.round(gen!.pct)}%
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: "75%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        alignItems:
                          msg.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 13px",
                          borderRadius: 10,
                          backgroundColor:
                            msg.role === "user" ? T.primary : T.card2,
                          border:
                            msg.role === "ai" ? `1px solid ${T.border}` : "none",
                          fontSize: 12,
                          color: msg.role === "user" ? T.cardSolid : T.text,
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          boxShadow:
                            msg.role === "user"
                              ? "0 3px 10px rgba(50,109,255,0.2)"
                              : "0 2px 8px rgba(22,45,77,0.05)",
                        }}
                      >
                        {msg.content}
                      </div>
                      {msg.fileCard &&
                        (() => {
                          const f = files.find(
                            (x) => x.id === msg.fileCard!.fileId
                          )
                          if (!f) return null
                          return (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 11px",
                                backgroundColor: "var(--glass-bg-strong)",
                                border: `1px solid ${T.border}`,
                                borderRadius: 9,
                                boxShadow: "0 2px 8px rgba(22,45,77,0.05)",
                              }}
                            >
                              <span
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 6,
                                  background:
                                    "linear-gradient(135deg,#E45E58,#FF9A7B)",
                                  color: "#fff",
                                  fontSize: 8,
                                  fontWeight: 800,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {f.type}
                              </span>
                              <div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: T.text,
                                  }}
                                >
                                  {f.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: T.textMuted,
                                  }}
                                >
                                  {f.version} · {f.size}
                                </div>
                              </div>
                              <button
                                onClick={() => setActiveTab("files")}
                                style={{
                                  marginLeft: 4,
                                  fontSize: 10,
                                  color: T.primary,
                                  backgroundColor: "rgba(50,109,255,0.08)",
                                  border: "none",
                                  padding: "3px 8px",
                                  borderRadius: 5,
                                  cursor: "pointer",
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                在文件记录查看
                              </button>
                            </div>
                          )
                        })()}
                      {msg.suggestions &&
                        msg.suggestions.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {msg.suggestions.map((s) => {
                              const key = `${activeDialogId}-${i}-${s.kind}`
                              if (s.kind === "writeIn" && wbConsumed.has(key))
                                return null
                              return (
                                <button
                                  key={s.kind}
                                  onClick={() => {
                                    if (!activeDialog) return
                                    if (s.kind === "writeIn")
                                      applyWriteIn(activeDialog.id, key)
                                    else if (s.kind === "goQA") goQAFromReport()
                                    else if (s.kind === "newReport")
                                      setNewEntry("report")
                                  }}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: T.primary,
                                    backgroundColor: "var(--chip-bg)",
                                    border: `1px solid rgba(50,109,255,0.35)`,
                                    padding: "4px 11px",
                                    borderRadius: 14,
                                    cursor: "pointer",
                                    boxShadow:
                                      "0 2px 6px rgba(50,109,255,0.08)",
                                  }}
                                >
                                  {s.text}
                                </button>
                              )
                            })}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div
            style={{
              padding: "12px 16px",
              borderTop: `1px solid ${T.border}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={
                  activeDialog?.type === "report"
                    ? "描述要生成的报告，或围绕当前报告追问…（Enter发送）"
                    : "按当前口径查询治理数据，直接给结论…（Enter发送）"
                }
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  backgroundColor: T.card2,
                  border: `1px solid ${T.border}`,
                  borderRadius: 7,
                  color: T.text,
                  fontSize: 12,
                  resize: "none",
                  height: 56,
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  padding: "0 16px",
                  backgroundColor: T.primary,
                  color: T.cardSolid,
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                  flexShrink: 0,
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(activeDialog?.type === "report"
                ? [
                    "生成上周东城治理周报",
                    "生成暴露垃圾专题报告",
                    "这个数怎么来的？",
                    "环比变化是多少？",
                  ]
                : [
                    "本周哪类事件上升最快？按当前口径直接给结论。",
                    "解释闭环率的统计口径",
                    "按街道下钻暴露垃圾分布",
                    "重新激活事件 DC-2026-07082",
                  ]
              ).map((q) => (
                  <button
                    key={q}
                    onClick={() => setChatInput(q)}
                    style={{
                      fontSize: 11,
                      color: T.textMuted,
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.card2,
                      padding: "3px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {q}
                  </button>
                ))}
            </div>
          </div>
        </Card>
        {showOpPreview && (
          <Card
            style={{
              width: 290,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "11px 14px",
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: T.amber }}>
                ⚠ 操作预检与确认
              </span>
              <button
                onClick={() => setShowOpPreview(false)}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.textMuted,
                  fontSize: 14,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: T.text,
                  marginBottom: 12,
                }}
              >
                重新激活事件 DC-2026-07082
              </div>
              {[
                {
                  label: "操作预检",
                  status: "通过",
                  detail: "事件已终态（已结案），具备重新激活条件",
                  ok: true,
                },
                {
                  label: "操作预览",
                  status: "待确认",
                  detail: "事件将从已结案进入待立案，历史终态记录保留",
                  ok: false,
                },
              ].map((step, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    padding: "10px 12px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 7,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{ fontSize: 11, fontWeight: 600, color: T.text }}
                    >
                      {i + 1}. {step.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        marginLeft: "auto",
                        padding: "1px 6px",
                        borderRadius: 3,
                        backgroundColor: step.ok
                          ? "rgba(53,185,133,0.08)"
                          : "rgba(255,122,66,0.08)",
                        color: step.ok ? T.green : T.amber,
                      }}
                    >
                      {step.status}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: 11, color: T.textSub, lineHeight: 1.5 }}
                  >
                    {step.detail}
                  </div>
                </div>
              ))}
              <button
                style={{
                  width: "100%",
                  padding: 10,
                  backgroundColor: T.primary,
                  color: T.cardSolid,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                确认执行
              </button>
              <button
                onClick={() => setShowOpPreview(false)}
                style={{
                  width: "100%",
                  padding: 9,
                  backgroundColor: "transparent",
                  color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                取消
              </button>
            </div>
          </Card>
        )}
      </div>
      {/* 新建对话：两档业务入口选择器 */}
      {newEntry && (
        <div
          onClick={() => setNewEntry(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(22,45,77,0.35)",
            backdropFilter: "blur(4px)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 540,
              backgroundColor: T.panelSolid,
              borderRadius: 14,
              boxShadow: "0 24px 64px rgba(22,45,77,0.25)",
              padding: 20,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              新建对话
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
              先选择业务入口，用来锁定成果物和等待时长
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {(["qa", "report"] as WbDialogType[]).map((m) => {
                const meta = WB_TYPE_META[m]
                const selected = newEntry === m
                return (
                  <div
                    key={m}
                    onClick={() => setNewEntry(m)}
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      border: selected
                        ? `2px solid ${T.primary}`
                        : `1px solid ${T.border}`,
                      backgroundColor: selected
                        ? "rgba(50,109,255,0.04)"
                        : "var(--row-bg)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                      {m === "qa" && (
                        <span
                          style={{
                            fontSize: 9,
                            color: T.textMuted,
                            border: `1px solid ${T.border}`,
                            padding: "1px 5px",
                            borderRadius: 4,
                          }}
                        >
                          默认
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: T.textSub,
                        lineHeight: 1.7,
                      }}
                    >
                      {m === "qa"
                        ? "查数、看趋势、解释口径、追问某张图或某个范围。"
                        : "日报、周报、月报、年报、专题报告、汇报材料。"}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: T.textMuted,
                        lineHeight: 1.7,
                        marginTop: 6,
                      }}
                    >
                      成果物：
                      {m === "qa"
                        ? "文字结论（结论 → 数据/证据 → 可继续问）"
                        : "一份可预览、可改、可下载的文件"}
                      <br />
                      等待：
                      {m === "qa"
                        ? "通常几秒，可多轮"
                        : "约 2–3 分钟，先出进度再出文件"}
                    </div>
                  </div>
                )
              })}
            </div>
            <div
              style={{
                fontSize: 10,
                color: T.textMuted,
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>定时周报、指标监控不在这里，前往「任务中心」调度。</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setNewEntry(null)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                取消
              </button>
              <button
                onClick={confirmNewEntry}
                style={{
                  padding: "8px 18px",
                  background: `linear-gradient(135deg, ${T.primary} 0%, #5A8BFF 100%)`,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: "0 4px 12px rgba(50,109,255,0.25)",
                }}
              >
                开始对话
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 业务问答 → 整理为报告：确认页 */}
      {exportConfirm && (
        <div
          onClick={() => setExportConfirm(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(22,45,77,0.35)",
            backdropFilter: "blur(4px)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 540,
              maxHeight: "80vh",
              overflowY: "auto",
              backgroundColor: T.panelSolid,
              borderRadius: 14,
              boxShadow: "0 24px 64px rgba(22,45,77,0.25)",
              padding: 20,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              整理为报告
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
              确认后将新开一条分析成稿，原问答对话保持不变
            </div>
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: 6,
                }}
              >
                拟用标题
              </div>
              <input
                value={exportConfirm.title}
                onChange={(e) =>
                  setExportConfirm({ ...exportConfirm, title: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "8px 11px",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: T.text,
                  backgroundColor: "var(--chip-bg)",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: 6,
                }}
              >
                纳入哪几轮问答（默认只汇总，不新拉数）
              </div>
              {exportConfirm.questions.map((q, qi) => {
                const checked = exportConfirm.checked.includes(qi)
                return (
                  <label
                    key={qi}
                    onClick={() =>
                      setExportConfirm({
                        ...exportConfirm,
                        checked: checked
                          ? exportConfirm.checked.filter((x) => x !== qi)
                          : [...exportConfirm.checked, qi],
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: `1px solid ${checked ? "rgba(50,109,255,0.25)" : T.border}`,
                      backgroundColor: checked
                        ? "rgba(50,109,255,0.04)"
                        : "transparent",
                      marginBottom: 5,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        border: checked
                          ? "none"
                          : `1.5px solid ${T.border}`,
                        backgroundColor: checked ? T.primary : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {checked && (
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="3.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.text,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {q}
                    </span>
                  </label>
                )
              })}
            </div>
            <div
              style={{
                marginTop: 12,
                padding: "8px 11px",
                backgroundColor: "var(--card-2)",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                fontSize: 10,
                color: T.textMuted,
                lineHeight: 1.7,
              }}
            >
              数据范围：主时间 近7日 · 主范围 全区 · 全部类型
              <br />
              若轮次间存在多个时间窗，将选择一个主时间，其余作为对照附录；口径不一致将在报告内分节标明。
            </div>
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: 6,
                }}
              >
                成稿意图
              </div>
              {[
                {
                  v: false,
                  t: "仅汇总本对话已问内容",
                  d: "只用本对话已有结论，不新拉数，内容边界等于本对话",
                },
                {
                  v: true,
                  t: "按模板补全",
                  d: "将补查未问过的章节，按标准模板拉数补全",
                },
              ].map((opt) => {
                const selected = exportConfirm.useTemplate === opt.v
                return (
                  <div
                    key={String(opt.v)}
                    onClick={() =>
                      setExportConfirm({ ...exportConfirm, useTemplate: opt.v })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 11px",
                      borderRadius: 8,
                      border: `1px solid ${selected ? "rgba(50,109,255,0.3)" : T.border}`,
                      backgroundColor: selected
                        ? "rgba(50,109,255,0.04)"
                        : "transparent",
                      marginBottom: 5,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: "50%",
                        border: selected
                          ? `4px solid ${T.primary}`
                          : `1.5px solid ${T.border}`,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
                        {opt.t}
                      </div>
                      <div style={{ fontSize: 10, color: T.textMuted }}>
                        {opt.d}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setExportConfirm(null)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  color: T.textMuted,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                取消
              </button>
              <button
                onClick={confirmExport}
                style={{
                  padding: "8px 18px",
                  background: `linear-gradient(135deg, ${T.primary} 0%, #5A8BFF 100%)`,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: "0 4px 12px rgba(50,109,255,0.25)",
                }}
              >
                生成（新开分析成稿）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── GovernanceConfig ─────────────────────────────────────────────────────────

// ─── TopNav ───────────────────────────────────────────────────────────────────

// ─── 菜单管理（功能栏创建 / 编辑 / 删除） ─────────────────────────────────────
// 菜单以「名称 + 图标 key」持久化在 localStorage；内置 6 项对应真实模块，
// 自定义项在主区渲染占位页。所有改动即时生效，刷新后保留，可一键恢复默认。

const BUILTIN_MODULE_IDS: readonly string[] = [
  "dashboard",
  "realtime",
  "archive",
  "statistics",
  "workbench",
  "config",
]

// 图标池：新建 / 编辑菜单时从中选择（内置 6 枚 + 可选 6 枚）
const NAV_ICONS: Record<string, React.ReactNode> = {
  grid: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="2" width="9" height="9" rx="2" opacity="0.95" />
        <rect x="13" y="2" width="9" height="9" rx="2" opacity="0.7" />
        <rect x="2" y="13" width="9" height="9" rx="2" opacity="0.7" />
        <rect x="13" y="13" width="9" height="9" rx="2" opacity="0.95" />
      </svg>
    ),
  bolt: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.25 2.3a1.2 1.2 0 0 0-2.1.75l.35 4.2a.8.8 0 0 1-1.33.67l-3.3-2.9a1.2 1.2 0 0 0-1.75 1.55l4.4 9.8a.8.8 0 0 0 1.45-.1l2.1-5.6a.8.8 0 0 1 1.45-.05l2.8 6.6a1.2 1.2 0 0 0 2.2-.95l-3.4-10.6a1.2 1.2 0 0 0-2.2-.3l-1.2 2.2a.8.8 0 0 1-1.4-.55l.6-4.3Z" />
        <circle cx="17.5" cy="17.5" r="3.5" opacity="0.25" />
      </svg>
    ),
  archive: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3V4Z" opacity="0.7" />
        <path d="M2 8a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Z" />
        <rect
          x="9"
          y="12"
          width="6"
          height="2"
          rx="1"
          fill="#fff"
          opacity="0.9"
        />
      </svg>
    ),
  chart: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <rect x="16" y="9" width="5" height="13" rx="1.5" />
        <rect x="9.5" y="4" width="5" height="18" rx="1.5" opacity="0.85" />
        <rect x="3" y="13" width="5" height="9" rx="1.5" opacity="0.6" />
      </svg>
    ),
  workbench: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
        <path
          d="M5 16.5V19a1 1 0 0 0 1.6.8l2.5-1.9a1 1 0 0 1 .6-.2h4.6a1 1 0 0 1 .6.2l2.5 1.9A1 1 0 0 0 19 19v-2.5H5Z"
          opacity="0.85"
        />
        <circle cx="9" cy="10" r="1.3" fill="#fff" />
        <circle cx="12" cy="10" r="1.3" fill="#fff" />
        <circle cx="15" cy="10" r="1.3" fill="#fff" />
      </svg>
    ),
  gear: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path
          d="M20.6 10.3c.2-.7.2-1.4 0-2.1l-2.4-.6a7.5 7.5 0 0 0-.9-2.1l1.3-2.1a9.5 9.5 0 0 0-2.9-2.1l-1.8 1.7a7.8 7.8 0 0 0-2.2-.6l-.7-2.4A9.5 9.5 0 0 0 9.2 0l-.7 2.4c-.8.1-1.5.3-2.2.6L4.5 1.3A9.5 9.5 0 0 0 1.6 3.4l1.3 2.1a7.5 7.5 0 0 0-.9 2.1l-2.4.6a9.5 9.5 0 0 0 0 4.2l2.4.6c.2.7.5 1.4.9 2.1l-1.3 2.1a9.5 9.5 0 0 0 2.9 2.1l1.8-1.7c.7.3 1.4.5 2.2.6l.7 2.4a9.5 9.5 0 0 0 4.2 0l.7-2.4c.8-.1 1.5-.3 2.2-.6l1.8 1.7a9.5 9.5 0 0 0 2.9-2.1l-1.3-2.1c.4-.7.7-1.4.9-2.1l2.4-.6c.2-.7.2-1.4 0-2.1Z"
          opacity="0.9"
        />
      </svg>
    ),
  // 可选图标（自定义菜单用）
  link: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      <path d="M9.5 14.5l5-5" />
      <path d="M11.5 6l1.8-1.8a4.4 4.4 0 0 1 6.2 6.2L17.7 12" />
      <path d="M12.5 18l-1.8 1.8a4.4 4.4 0 0 1-6.2-6.2L6.3 12" />
    </svg>
  ),
  star: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  ),
  camera: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.5 7h2.7l1.5-2.2h6.6L16.8 7h2.7a1.8 1.8 0 0 1 1.8 1.8v10a1.8 1.8 0 0 1-1.8 1.8h-15a1.8 1.8 0 0 1-1.8-1.8v-10A1.8 1.8 0 0 1 4.5 7Z" />
      <circle cx="12" cy="13.5" r="3.6" fill="#fff" opacity="0.85" />
    </svg>
  ),
  pin: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a7.2 7.2 0 0 0-7.2 7.2C4.8 14.4 12 22 12 22s7.2-7.6 7.2-12.8A7.2 7.2 0 0 0 12 2Z" />
      <circle cx="12" cy="9.2" r="2.6" fill="#fff" opacity="0.9" />
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l8 3v6.2c0 5.2-3.4 9.5-8 11.1-4.6-1.6-8-5.9-8-11.1V5Z" />
    </svg>
  ),
  doc: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 2h8.5L19 6.5V22H6Z" />
      <path d="M14.5 2v4.5H19Z" fill="#fff" opacity="0.55" />
    </svg>
  ),
}

interface MenuAdminItem {
  id: string
  label: string
  iconKey: string
  builtin: boolean
}

const DEFAULT_NAV_CONFIG: MenuAdminItem[] = [
  { id: "dashboard", label: "治理大屏", iconKey: "grid", builtin: true },
  { id: "realtime", label: "AI实时治理", iconKey: "bolt", builtin: true },
  { id: "archive", label: "事件档案", iconKey: "archive", builtin: true },
  { id: "statistics", label: "AI统计", iconKey: "chart", builtin: true },
  { id: "workbench", label: "AI工作台", iconKey: "workbench", builtin: true },
  { id: "config", label: "治理配置", iconKey: "gear", builtin: true },
]

const NAV_STORAGE_KEY = "app-nav-config-v1"

function loadNavConfig(): MenuAdminItem[] {
  try {
    const raw = localStorage.getItem(NAV_STORAGE_KEY)
    if (!raw) return DEFAULT_NAV_CONFIG
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_NAV_CONFIG
    const items = parsed
      .filter(
        (it): it is MenuAdminItem =>
          !!it &&
          typeof (it as MenuAdminItem).id === "string" &&
          typeof (it as MenuAdminItem).label === "string" &&
          typeof (it as MenuAdminItem).iconKey === "string" &&
          NAV_ICONS[(it as MenuAdminItem).iconKey] !== undefined,
      )
      .map((it) => ({
        id: it.id,
        label: it.label,
        iconKey: it.iconKey,
        builtin: it.builtin === true,
      }))
    // 配置为空或全部非法时回落默认，保证顶部导航永远不为空
    return items.length > 0 ? items : DEFAULT_NAV_CONFIG
  } catch {
    return DEFAULT_NAV_CONFIG
  }
}

function saveNavConfig(items: MenuAdminItem[]) {
  try {
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

function navIcon(key: string): React.ReactNode {
  return NAV_ICONS[key] ?? NAV_ICONS.grid
}

function TopNav({
  activeModule,
  onModuleChange,
  skin,
  onSkinChange,
  navList,
  onOpenMenuManager,
}: {
  activeModule: ModuleId
  onModuleChange: (id: ModuleId) => void
  skin: "light" | "tech"
  onSkinChange: (s: "light" | "tech") => void
  navList: MenuAdminItem[]
  onOpenMenuManager: () => void
}) {
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        background: "var(--topbar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid var(--topbar-border)`,
        boxShadow: "var(--topbar-shadow)",
        paddingLeft: 22,
        paddingRight: 22,
        gap: 0,
        zIndex: 10,
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginRight: 36,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `linear-gradient(135deg,${T.primary} 0%,${T.accent} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 20px rgba(50,109,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30)",
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.cardSolid}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 16,
              color: T.text,
              lineHeight: 1.2,
              letterSpacing: "0.02em",
            }}
          >
            城运AI
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500, letterSpacing: "0.03em" }}>东城城指中心</div>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 24,
          backgroundColor: T.border,
          marginRight: 24,
          flexShrink: 0,
        }}
      />

      {/* Nav items */}
      <nav style={{ display: "flex", alignItems: "center", gap: 3, flex: 1 }}>
        {navList.map((item) => {
          const isActive = activeModule === item.id
          return (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                position: "relative",
                backgroundColor: isActive
                  ? "var(--nav-active-bg)"
                  : "transparent",
                color: isActive ? T.primary : T.textSub,
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
                boxShadow: isActive ? "inset 0 1px 0 var(--inset-hi)" : "none",
              }}
            >
              <span
                style={{
                  opacity: isActive ? 1 : 0.65,
                  display: "flex",
                }}
              >
                {navIcon(item.iconKey)}
              </span>
              {item.label}
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: 12,
                    right: 12,
                    height: 3,
                    borderRadius: "2px 2px 0 0",
                    background: `linear-gradient(90deg,transparent,${T.primary},transparent)`,
                  boxShadow: "0 0 12px rgba(50,109,255,0.65)",
                }}
              />
              )}
            </button>
          )
        })}
        {/* 菜单管理入口：新建 / 编辑 / 删除顶部功能栏菜单 */}
        <button
          onClick={onOpenMenuManager}
          title="菜单管理：新建 / 编辑 / 删除导航菜单"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 10px",
            borderRadius: 9,
            border: `1px dashed ${T.border}`,
            cursor: "pointer",
            backgroundColor: "transparent",
            color: T.textMuted,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
            marginLeft: 6,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = T.primary
            e.currentTarget.style.borderColor = T.primary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = T.textMuted
            e.currentTarget.style.borderColor = T.border
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M4 12h16M4 18h10" />
            <path d="M19 16.5v5M16.5 19h5" />
          </svg>
          菜单
        </button>
      </nav>

      {/* Right: status + user */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 16,
            border: `1px solid rgba(53,185,133,0.25)`,
            backgroundColor: "rgba(53,185,133,0.08)",
            boxShadow: "inset 0 1px 0 var(--inset-hi)",
          }}
        >
          <span
            className="pulse-dot"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: T.green,
              display: "block",
            }}
          />
          <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>实时运行中</span>
        </div>
        <div style={{ width: 1, height: 18, backgroundColor: T.border }} />
        {/* 皮肤切换：清爽 / 科技 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: 2,
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            backgroundColor: "var(--chip-bg)",
          }}
          role="group"
          aria-label="皮肤配色切换"
        >
          {(
            [
              ["light", "清爽", (
                <svg key="sun" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              )],
              ["tech", "科技", (
                <svg key="moon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )],
            ] as const
          ).map(([value, label, icon]) => {
            const active = skin === value
            return (
              <button
                key={value}
                onClick={() => onSkinChange(value)}
                aria-pressed={active}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                  backgroundColor: active ? T.primary : "transparent",
                  color: active ? "#FFFFFF" : T.textMuted,
                  boxShadow: active ? "0 2px 8px rgba(50,109,255,0.35)" : "none",
                }}
              >
                {icon}
                {label}
              </button>
            )
          })}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            cursor: "pointer",
            padding: "3px 12px 3px 3px",
            borderRadius: 22,
            border: `1px solid ${T.border}`,
            backgroundColor: "var(--chip-bg)",
            boxShadow: "inset 0 1px 0 var(--inset-hi), 0 4px 14px rgba(22,45,77,0.04)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--chip-bg-hover)"
            e.currentTarget.style.boxShadow = "inset 0 1px 0 var(--inset-hi), 0 6px 18px rgba(22,45,77,0.08)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--chip-bg)"
            e.currentTarget.style.boxShadow = "inset 0 1px 0 var(--inset-hi), 0 4px 14px rgba(22,45,77,0.04)"
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: `linear-gradient(135deg,${T.primary} 0%,${T.accent} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: T.cardSolid,
              boxShadow: "0 2px 10px rgba(50,109,255,0.35)",
            }}
          >
            张
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
              张晓琳
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>立案审核</div>
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── 菜单管理弹层（新建 / 编辑 / 删除 / 排序 / 恢复默认） ─────────────────────
// 编辑规则：名称必填且不可重名；至少保留 1 个菜单；删除采用二次点击确认。
// 所有变更通过 onApply 即时回写 App 状态并持久化，弹层不单独保存。

function MenuManagerModal({
  items,
  onApply,
  onClose,
}: {
  items: MenuAdminItem[]
  onApply: (next: MenuAdminItem[]) => void
  onClose: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null) // "__new__" = 新建表单
  const [draftLabel, setDraftLabel] = useState("")
  const [draftIcon, setDraftIcon] = useState("star")
  const [err, setErr] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null) // 两段式删除确认

  const iconKeys = Object.keys(NAV_ICONS)

  function startCreate() {
    setEditingId("__new__")
    setDraftLabel("")
    setDraftIcon("star")
    setErr("")
    setDeletingId(null)
  }
  function startEdit(it: MenuAdminItem) {
    setEditingId(it.id)
    setDraftLabel(it.label)
    setDraftIcon(it.iconKey)
    setErr("")
    setDeletingId(null)
  }
  function cancelEdit() {
    setEditingId(null)
    setErr("")
  }
  function submitEdit() {
    const label = draftLabel.trim()
    if (!label) {
      setErr("请输入菜单名称")
      return
    }
    if (items.some((it) => it.id !== editingId && it.label === label)) {
      setErr("已存在同名菜单，请换一个名称")
      return
    }
    if (editingId === "__new__") {
      const id = `custom-${Date.now().toString(36)}`
      onApply([...items, { id, label, iconKey: draftIcon, builtin: false }])
    } else {
      onApply(
        items.map((it) =>
          it.id === editingId ? { ...it, label, iconKey: draftIcon } : it,
        ),
      )
    }
    setEditingId(null)
    setErr("")
  }
  function removeItem(id: string) {
    if (deletingId !== id) {
      setDeletingId(id)
      return
    }
    if (items.length <= 1) {
      setErr("至少保留 1 个菜单，无法删除")
      setDeletingId(null)
      return
    }
    onApply(items.filter((it) => it.id !== id))
    setDeletingId(null)
  }
  function move(idx: number, dir: -1 | 1) {
    const next = [...items]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    const tmp = next[idx]
    next[idx] = next[j]
    next[j] = tmp
    onApply(next)
  }
  function resetAll() {
    onApply(DEFAULT_NAV_CONFIG.map((it) => ({ ...it })))
    setEditingId(null)
    setDeletingId(null)
    setErr("")
  }

  const smallBtn = (
    disabled: boolean,
  ): React.CSSProperties => ({
    border: "none",
    backgroundColor: "transparent",
    color: disabled ? "rgba(120,140,165,0.35)" : T.textMuted,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "3px 6px",
    borderRadius: 5,
    lineHeight: 1.4,
  })

  const inputStyle: React.CSSProperties = {
    flex: 1,
    height: 30,
    padding: "0 10px",
    borderRadius: 7,
    border: `1px solid ${T.border}`,
    backgroundColor: "transparent",
    color: T.text,
    fontSize: 12,
    outline: "none",
    minWidth: 0,
  }

  // 行内编辑 / 新建表单：图标选择 + 名称输入
  const editForm = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0, width: 44 }}>
          {editingId === "__new__" ? "新菜单" : "编辑"}
        </span>
        <input
          autoFocus
          value={draftLabel}
          onChange={(e) => {
            setDraftLabel(e.target.value)
            setErr("")
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitEdit()
            if (e.key === "Escape") cancelEdit()
          }}
          placeholder="菜单名称，如：专项调度"
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0, width: 44 }}>
          图标
        </span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {iconKeys.map((k) => {
            const on = draftIcon === k
            return (
              <button
                key={k}
                onClick={() => setDraftIcon(k)}
                title={k}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: `1px solid ${on ? T.primary : T.border}`,
                  backgroundColor: on ? "rgba(50,109,255,0.10)" : "transparent",
                  color: on ? T.primary : T.textMuted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  transition: "all 0.15s ease",
                }}
              >
                {navIcon(k)}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          onClick={cancelEdit}
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            border: `1px solid ${T.border}`,
            backgroundColor: "transparent",
            color: T.textSub,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          取消
        </button>
        <button
          onClick={submitEdit}
          style={{
            padding: "6px 16px",
            borderRadius: 7,
            border: "none",
            background: `linear-gradient(135deg, ${T.primary} 0%, #5A8BFF 100%)`,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(50,109,255,0.25)",
          }}
        >
          {editingId === "__new__" ? "创建菜单" : "保存修改"}
        </button>
      </div>
    </div>
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 93,
        backgroundColor: "rgba(10,22,40,0.45)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 540,
          maxHeight: "84vh",
          overflow: "auto",
          borderRadius: 14,
          border: `1px solid ${T.border}`,
          backgroundColor: "var(--panel-solid, var(--card))",
          boxShadow: T.shadowLg,
          padding: "18px 20px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
            菜单管理
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "none",
              color: T.textMuted,
              fontSize: 16,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>
          支持顶部功能栏菜单的新建、编辑、删除与排序，保存后立即生效并本地记住；「恢复默认」可随时还原系统菜单。
        </div>

        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {items.map((it, idx) => {
            const editing = editingId === it.id
            const deleting = deletingId === it.id
            return (
              <div
                key={it.id}
                style={{
                  padding: editing ? "10px 12px" : "8px 12px",
                  borderBottom:
                    idx < items.length - 1 ? `1px solid ${T.border}` : "none",
                  backgroundColor: editing
                    ? "rgba(50,109,255,0.04)"
                    : "transparent",
                }}
              >
                {editing ? (
                  editForm
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        backgroundColor: "var(--card-2)",
                        color: T.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {navIcon(it.iconKey)}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: T.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 7px",
                        borderRadius: 5,
                        flexShrink: 0,
                        color: it.builtin ? T.textMuted : T.primary,
                        backgroundColor: it.builtin
                          ? "var(--card-2)"
                          : "rgba(50,109,255,0.08)",
                        border: `1px solid ${it.builtin ? T.border : "rgba(50,109,255,0.30)"}`,
                        fontWeight: 600,
                      }}
                    >
                      {it.builtin ? "系统" : "自定义"}
                    </span>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        title="上移"
                        style={smallBtn(idx === 0)}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => move(idx, 1)}
                        disabled={idx === items.length - 1}
                        title="下移"
                        style={smallBtn(idx === items.length - 1)}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => startEdit(it)}
                        style={smallBtn(false)}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => removeItem(it.id)}
                        onBlur={() => {
                          if (deletingId === it.id) setDeletingId(null)
                        }}
                        style={{
                          ...smallBtn(false),
                          color: deleting ? "#fff" : T.red,
                          backgroundColor: deleting ? T.red : "transparent",
                          fontWeight: deleting ? 700 : 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {deleting ? "确认删除" : "删除"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* 新建入口：未处于任何编辑态时显示 */}
          {editingId === "__new__" ? (
            <div style={{ padding: "10px 12px", backgroundColor: "rgba(50,109,255,0.04)" }}>
              {editForm}
            </div>
          ) : (
            editingId === null && (
              <button
                onClick={startCreate}
                style={{
                  width: "100%",
                  padding: "9px 0",
                  border: "none",
                  borderTop: `1px dashed ${T.border}`,
                  backgroundColor: "transparent",
                  color: T.primary,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ＋ 新建菜单
              </button>
            )
          )}
        </div>

        {err && (
          <div style={{ fontSize: 11, color: T.red, marginTop: 10 }}>{err}</div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <button
            onClick={resetAll}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              backgroundColor: "transparent",
              color: T.textSub,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            恢复默认
          </button>
          <span style={{ fontSize: 11, color: T.textMuted }}>
            共 {items.length} 个菜单 · 系统内置{" "}
            {items.filter((it) => it.builtin).length} 个
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── 自定义菜单占位页 ──────────────────────────────────────────────────────────

function CustomModulePlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: T.bg,
      }}
    >
      <div
        style={{
          width: 420,
          padding: "36px 32px",
          borderRadius: 16,
          border: `1px dashed ${T.borderStrong}`,
          textAlign: "center",
          backgroundColor: "var(--card)",
          boxShadow: "0 8px 24px rgba(22,45,77,0.06)",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            margin: "0 auto 14px",
            borderRadius: 14,
            background: `linear-gradient(135deg, ${T.primary} 0%, #5A8BFF 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: "0 6px 20px rgba(50,109,255,0.35)",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: T.text,
            marginBottom: 6,
          }}
        >
          自定义菜单「{label}」
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.8 }}>
          该菜单由「菜单管理」创建，当前为演示占位页。
          <br />
          实际项目中可在此挂载对应的业务模块页面。
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard")
  // 功能栏菜单配置（菜单管理创建/编辑/删除），localStorage 持久化
  const [navConfig, setNavConfig] = useState<MenuAdminItem[]>(loadNavConfig)
  const [menuMgrOpen, setMenuMgrOpen] = useState(false)
  useEffect(() => {
    saveNavConfig(navConfig)
  }, [navConfig])
  // 应用菜单变更；若当前激活的菜单被删除，回到治理大屏
  function applyNav(next: MenuAdminItem[]) {
    setNavConfig(next)
    setActiveModule((cur) =>
      next.some((n) => n.id === cur) ? cur : "dashboard",
    )
  }
  // 皮肤状态：清爽（浅色）/ 科技（深空蓝），持久化并同步 <html data-theme>
  const [skin, setSkin] = useState<"light" | "tech">(() => {
    try {
      const v = localStorage.getItem("app-skin")
      return v === "tech" ? "tech" : "light"
    } catch {
      return "light"
    }
  })
  useEffect(() => {
    // 用 data-skin 承载皮肤（宿主运行时会强制改写 data-theme，故与其解耦）
    document.documentElement.setAttribute("data-skin", skin)
    try {
      localStorage.setItem("app-skin", skin)
    } catch {
      /* ignore */
    }
  }, [skin])
  const [presentationMode, setPresentationMode] = useState(false)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        backgroundColor: T.bg,
        color: T.text,
        fontFamily: "'Noto Sans SC','Inter',system-ui,sans-serif",
      }}
    >
      {!presentationMode && (
        <TopNav
          activeModule={activeModule}
          skin={skin}
          onSkinChange={setSkin}
          navList={navConfig}
          onOpenMenuManager={() => setMenuMgrOpen(true)}
          onModuleChange={(id) => {
            setActiveModule(id)
            setPresentationMode(false)
          }}
        />
      )}
      <main
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeModule === "dashboard" && (
          <GovernanceDashboard
            presentationMode={presentationMode}
            setPresentationMode={setPresentationMode}
          />
        )}
        {activeModule === "realtime" && <RealtimeGovernance />}
        {activeModule === "archive" && <EventArchive />}
        {activeModule === "statistics" && <AIStatistics skin={skin} />}
        {activeModule === "workbench" && <AIWorkbench />}
        {activeModule === "config" && <GovernanceConfigNative />}
        {/* 自定义菜单（菜单管理创建）：渲染占位页 */}
        {(() => {
          const custom = navConfig.find(
            (n) => n.id === activeModule && !BUILTIN_MODULE_IDS.includes(n.id),
          )
          return custom ? <CustomModulePlaceholder label={custom.label} /> : null
        })()}
      </main>
      {menuMgrOpen && (
        <MenuManagerModal
          items={navConfig}
          onApply={applyNav}
          onClose={() => setMenuMgrOpen(false)}
        />
      )}
      {/*
        治理配置：绝对定位覆盖层，相对最外层容器定位而不参与 main 的正常流。
        目的：让这块盒子尺寸与 iframe 视口恒定，切断两处跳变/闪烁——
        - 进入 config 时 TopNav 卸载，若参与正常流则主区瞬时长高 56px，整页上移跳变；
        - display:none 会让 iframe 视口塌成 0，重新显示时文档二次排版，产生闪烁。
        因此用 inset:0 + visibility 切换；GC 页自带 56px 顶栏，正好接续此前 TopNav 的位置。
      */}

    </div>
  )
}
