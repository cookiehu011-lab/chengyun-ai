import { useState, createContext, useContext } from "react"
import EchartsBar from "../components/EchartsBar"
import EchartsFunnel from "../components/EchartsFunnel"
import EchartsLine from "../components/EchartsLine"
import EchartsPie from "../components/EchartsPie"
import EchartsRank from "../components/EchartsRank"
import KpiIcon from "../components/KpiIcon"
import RankList from "../components/RankList"
import { RuleChips } from "../data/dashboardRules"
import { STATS_USER_RULES, STATS_RULES } from "../data/statsRules"

// Modern light glassmorphism · 政务分析台配色
const C = {
  primary: "var(--primary)",
  primaryLight: "var(--primary-light)",
  success: "var(--green)",
  warning: "var(--amber)",
  danger: "var(--red)",
  purple: "var(--purple)",
  cyan: "var(--accent)",
  text: "var(--foreground)",
  muted: "var(--muted-foreground)",
  border: "var(--border)",
  borderLight: "var(--glass-border)",
  card: "var(--card)",
  cardSolid: "#FFFFFF",
  bg: "var(--background)",
  bgSoft: "var(--background-soft)",
  glass: "var(--glass-bg)",
  glassStrong: "var(--glass-bg-strong)",
  shadow: "var(--glass-shadow)",
  shadowStrong: "var(--glass-shadow-strong)",
  glow: "var(--shadow-glow)",
}

type StatCat = "overview" | "events" | "process" | "efficiency" | "quality" | "ai" | "topics"
type StatTime = "today" | "7d" | "30d"
type GroupByLevel = "街道" | "网格" | "街巷"

const statCategories: { id: StatCat; label: string }[] = [
  { id: "overview", label: "综合态势" },
  { id: "events", label: "事件发生" },
  { id: "process", label: "流程运行" },
  { id: "efficiency", label: "作业效能" },
  { id: "quality", label: "治理质量" },
  { id: "ai", label: "AI作用成效" },
  { id: "topics", label: "专题统计" },
]

const districtPolygons = [
  { name: "和平里街道" },
  { name: "东直门街道" },
  { name: "安定门街道" },
  { name: "北新桥街道" },
  { name: "交道口街道" },
  { name: "景山街道" },
  { name: "东四街道" },
  { name: "朝阳门街道" },
  { name: "东华门街道" },
  { name: "建国门街道" },
  { name: "前门街道" },
  { name: "崇文门外街道" },
  { name: "东花市街道" },
  { name: "体育馆路街道" },
  { name: "龙潭街道" },
  { name: "天坛街道" },
  { name: "永定门外街道" },
]

// 示例数据——页面上 15、18、86.2%、94% 等仅为示例
const statData = {
  weeklyTrend: [
    { label: "08-14", discover: 3, close: 1 },
    { label: "08-15", discover: 2, close: 1 },
    { label: "08-16", discover: 3, close: 2 },
    { label: "08-17", discover: 3, close: 2 },
    { label: "08-18", discover: 5, close: 0 },
  ],
  // 各阶段待处理：四柱，待立案不含自然消散
  stagesPending: [
    { label: "待立案", value: 7 },
    { label: "待处置", value: 1 },
    { label: "待核查", value: 5 },
    { label: "待作废审核", value: 2 },
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
    { label: "共享单车占道", value: 4, color: C.primary },
    { label: "施工占道", value: 4, color: C.cyan },
    { label: "占道经营", value: 4, color: C.warning },
    { label: "暴露垃圾", value: 2, color: C.success },
    { label: "疑似堆物", value: 1, color: C.danger },
  ],
  eventTypes: [
    { label: "共享单车占道", value: 5, color: C.primary },
    { label: "施工占道", value: 5, color: C.cyan },
    { label: "占道经营", value: 4, color: C.warning },
    { label: "暴露垃圾", value: 2, color: C.success },
    { label: "疑似堆物", value: 2, color: C.danger },
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
  topCameras: [
    { rank: 1, name: "C-A11-03", value: 3 },
    { rank: 2, name: "C-C07-11", value: 3 },
    { rank: 3, name: "C-B03-02", value: 2 },
    { rank: 4, name: "C-E01-02", value: 2 },
    { rank: 5, name: "C-A02-08", value: 1 },
    { rank: 6, name: "C-A07-04", value: 1 },
  ],
  // 环节存量：四柱，待立案不含自然消散
  stagePending: [
    { label: "待立案", value: 7, color: C.primary },
    { label: "待处置", value: 1, color: C.warning },
    { label: "待核查", value: 5, color: C.purple },
    { label: "待作废审核", value: 2, color: C.danger },
  ],
  // 处置池
  processPool: [
    { label: "等待处置", value: 1 },
    { label: "等待外场核查", value: 0 },
  ],
  // 退回 / 作废（转责任纠正不展示）
  returnAbort: [
    { label: "核查退回", value: 1 },
    { label: "待作废审核", value: 2 },
    { label: "当日已作废", value: 0 },
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
  // AI 运行风险：空间匹配失败 + 其他（其他不画）
  aiRisk: [
    { label: "空间匹配失败", value: 18, color: C.warning },
  ],
  // 治理质量：有效 vs 无效 vs 消散
  qualityComposition: [
    { label: "立案有效", value: 15, color: C.primary },
    { label: "无效", value: 2, color: C.danger },
    { label: "自然消散", value: 1, color: C.muted },
  ],
  // AI 分类/位置/网格准确率
  aiAccuracy: [
    { label: "分类准确率", value: 91 },
    { label: "位置准确率", value: 88 },
    { label: "网格准确率", value: 85 },
  ],
}

const groupByData: Record<GroupByLevel, {
  severeByStreet: { label: string; value: number }[]
  eventByStreet: { label: string; value: number }[]
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

const agentBanners: Record<StatCat, string> = {
  overview:
    "近5日发现 16 件、闭环 6 件，08-18 单日发现 5 件、闭环 0 件。存续 15 件中严重 7 件，朝阳门街道以 2 件居首。平均处置时长本版不计时限。建议优先消化待立案与待核查积压，并复核朝阳门的严重件。",
  events:
    "本期 18 件事件覆盖 5 类、8 个空间单元。本版来源仅为相机识别，不计算来源占比。共享单车占道与施工占道各 5 件、合计占 55%；北新桥、朝阳门、东华门各 4 件并列最高；08 时（4 件）、09 时（3 件）为高发窗口，高频点位 C-A11-03、C-C07-11 各 3 件。建议早高峰对上述两类、三个街道加密巡检。",
  process:
    "环节存量为待立案 7（不含自然消散）、待核查 5、待作废审核 2、待处置 1。待立案占环节积压约一半，是当前最大瓶颈，网格侧 A11 责任人在办 3 件最多。超时结构本版不计时限。建议优先扩充立案审核力量。",
  efficiency:
    "责任网格在办 A11 责任人 3 件最多。本版不计时限，响应时长、处置时长、超时率、一次通过暂不计算。处置时长分布、一次通过 vs 退回、网格相对快慢本版不展示。",
  quality:
    "立案有效 15 件、无效 2 件、自然消散 1 件。事件有效率 88.2%，一次核查通过率 —，退回率 7.4%。群众满意度、返工原因本版不展示。",
  ai:
    "本版来源几乎全是相机识别，AI 整体覆盖率暂不计算。发现有效率 87%，分类准确率 91%、位置准确率 88%、网格准确率 85%，信息补全采纳率 91%，建议一致率 82%。空间匹配失败 18 次。其他运行风险本版字段未齐，暂不计算。",
  topics:
    "当前范围无观察中专题。本版不配置复发规则，专题暂不计算。",
}

const chartAnswers: Record<
  string,
  { conclusion: string; evidence: string; correlation: string; followups: string[] }
> = {
  "发现 vs 闭环走势": {
    conclusion: "发现量持续上升但闭环未跟上，08-18 发现 5 件、闭环 0 件，当日积压明显。",
    evidence: "近5日发现量：3→2→3→3→5；闭环量：1→1→2→2→0。两条线差距在扩大。",
    correlation: "以上是趋势描述，不代表闭环能力下降，可能与当日事件复杂度相关。",
    followups: ["08-18 为什么闭环是 0？", "同期严重件有没有增加？"],
  },
  当前各阶段待处理: {
    conclusion: "「待立案」阶段积压最多（7件），「待核查」阶段次之（5件），是当前主要瓶颈。",
    evidence: "待立案 7，待处置 1，待核查 5，待作废审核 2。发现→立案转化堵塞明显。",
    correlation: "结案说明流程仍在流动，待立案积压多可能是 AI 批量发现但人工复核未跟上。",
    followups: ["待立案的 7 件是什么类型？", "待核查的 5 件是什么情况？"],
  },
  严重问题空间: {
    conclusion: "严重问题最集中的是朝阳门街道（2件），其余各街道均为 1 件。",
    evidence: "严重问题空间：朝阳门街道 2，安定门街道 1，北新桥街道 1，东四街道 1，和平里街道 1，建国门街道 1。",
    correlation: "以上是当前范围里的结构描述，不是因果结论。",
    followups: ["换成网格或街巷后高发点还在不在？", "朝阳门的 2 件是同类型吗？"],
  },
  当前存续类型: {
    conclusion: "共享单车占道、施工占道、占道经营三类平均，各 4 件，是当前存续主力类型。",
    evidence: "共享单车占道 4，施工占道 4，占道经营 4，暴露垃圾 2，疑似堆物 1。",
    correlation: "三类平均不代表难度相同，占道经营处置时长通常更长。",
    followups: ["哪类处置时长最长？", "这些件分布在哪些街道？"],
  },
  类型结构: {
    conclusion: "共享单车占道与施工占道并列最多（各 5 件），两者合计占事件总量 55%。",
    evidence: "共享单车占道 5，施工占道 5，占道经营 4，暴露垃圾 2，疑似堆物 2。",
    correlation: "类型结构反映发现能力，不一定反映实际发生频率。",
    followups: ["这两类高发在哪个时段？", "来源主要是相机识别吗？"],
  },
  空间分布: {
    conclusion: "北新桥、朝阳门、东华门三个街道并列最高（各 4 件），东城北部是主要高发区。",
    evidence: "北新桥 4，朝阳门 4，东华门 4，东四 2，安定门 1，东直门 1，和平里 1，建国门 1。",
    correlation: "三街道高发可能与摄像头覆盖密度有关，建议对照相机分布图验证。",
    followups: ["切到网格维度高发点有没有更集中？", "三个街道事件类型是否相同？"],
  },
  发生时段: {
    conclusion: "事件主要集中在 08 时（4件）和 09 时（3件），早高峰是明显高发窗口。",
    evidence: "08时 4件，09时 3件，10-11时各 1件，14时 1件，其余时段为 0。",
    correlation: "早高峰高发符合共享单车和占道经营的行为规律，建议加强该时段巡查。",
    followups: ["08时的 4 件是哪个街道？", "下午 14 时的 1 件是什么类型？"],
  },
  高发相机: {
    conclusion: "高发相机集中在 C-A11-03 和 C-C07-11（各 3 次），其次是 C-B03-02 与 C-E01-02（各 2 次）。",
    evidence: "C-A11-03 3次，C-C07-11 3次，C-B03-02 2次，C-E01-02 2次，其余 1次。",
    correlation: "相机高发通常与点位人流、车流或遮挡变化相关。",
    followups: ["高发相机的时段分布如何？", "这些相机覆盖哪个街道？"],
  },
  环节存量: {
    conclusion: "待立案环节积压最多（7件），待核查次之（5件），是当前人工瓶颈。",
    evidence: "待立案 7，待处置 1，待核查 5，待作废审核 2。",
    correlation: "立案审核是入口瓶颈，可能影响后续处置节奏。",
    followups: ["待立案的 7 件积压多久了？", "哪些类型需要额外证据？"],
  },
  处置池: {
    conclusion: "处置池当前等待处置 1 件，等待外场核查 0 件。",
    evidence: "等待处置 1，等待外场核查 0。",
    correlation: "样本小，趋势判断需继续观察。",
    followups: ["近7日处置池的变化趋势？", "等待外场核查什么时候有件？"],
  },
  责任网格在办件数: {
    conclusion: "A11 责任人当前在办 3 件最多，C07、E01 各 2 件，其余责任人 1 件。",
    evidence: "A11 3件，C07 2件，E01 2件，A07/B03/B05/B08/C02/D04/F02 各1件。",
    correlation: "A11 网格负荷偏高，建议结合历史均值判断是否异常。",
    followups: ["A11 网格的件是什么类型？", "按人均负荷看是否均衡？"],
  },
  "有效 vs 无效 vs 消散": {
    conclusion: "立案有效 15 件占绝大多数，无效 2 件，自然消散 1 件。",
    evidence: "立案有效 15，无效 2，自然消散 1。分母 18。",
    correlation: "消散不计入待立案存量，只出现在治理质量。",
    followups: ["自然消散的 1 件是什么情况？", "无效的 2 件原因是什么？"],
  },
  AI运行风险: {
    conclusion: "本周空间匹配失败 18 次，其他运行风险本版字段未齐暂不计算。",
    evidence: "空间匹配失败 18。",
    correlation: "空间匹配失败是主要优化方向。",
    followups: ["空间匹配失败集中在哪些类型？", "哪些相机角度匹配失败多？"],
  },
}

const defaultChartAnswer = {
  conclusion: "当前图表数据在所选时间和空间范围内呈现正常分布。",
  evidence: "数据基于当前筛选条件汇总。",
  correlation: "以上为结构性描述，不代表趋势判断。",
  followups: ["切换到更长周期看是否有变化？", "按街道/网格下钻看分布？"],
}

type ChartQueryCtxType = {
  queryingChart: string | null
  onQuery: (title: string) => void
}
const ChartQueryCtx = createContext<ChartQueryCtxType>({
  queryingChart: null,
  onQuery: () => {},
})

/** 图表空态：本版不展示 / 无样本 */
function ChartEmpty({ text }: { text: string }) {
  return (
    <div
      style={{
        height: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.muted,
        fontSize: 12,
        fontWeight: 500,
        textAlign: "center",
        padding: "0 20px",
        lineHeight: 1.8,
      }}
    >
      {text}
    </div>
  )
}

function KpiCard({
  label,
  value,
  unit,
  sub,
  color = C.text,
  ruleId,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  color?: string
  icon?: string
  ruleId?: string
}) {
  return (
    <div
      className="glass-card hover-lift"
      style={{
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        minHeight: 96,
        background: `linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
        border: `1px solid ${C.borderLight}`,
        boxShadow: C.shadow,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
          border: `1px solid ${color}30`,
          boxShadow: `0 0 0 4px ${color}0D, inset 0 1px 0 rgba(255,255,255,0.75)`,
        }}
      >
        <KpiIcon label={label} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
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
              fontSize: 12,
              color: C.muted,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            {label}
          </span>
          {ruleId && (
            <RuleChips id={ruleId} userRules={STATS_USER_RULES} algoRules={STATS_RULES} />
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            className="gradient-text"
            style={{
              fontSize: 32,
              fontWeight: 800,
              fontFamily: "JetBrains Mono, monospace",
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            {value}
          </span>
          {unit && <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{unit}</span>}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontWeight: 600 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

function AgentInsight({
  children,
  meta,
}: {
  children: React.ReactNode
  meta?: string
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: "16px 18px",
        marginBottom: 20,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        background: `linear-gradient(105deg, rgba(91,141,255,0.10) 0%, var(--card) 55%, rgba(46,230,224,0.06) 100%)`,
        border: `1px solid ${C.borderLight}`,
        borderLeft: `3px solid ${C.primary}`,
        boxShadow: C.shadow,
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        isolation: "isolate",
        transform: "translateZ(0)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.primary} 0%, ${C.cyan} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          boxShadow: "0 6px 18px rgba(50,109,255,0.38)",
        }}
      >
        AI
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: C.primary,
            fontWeight: 700,
            marginBottom: 6,
            letterSpacing: "0.03em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          AI 态势总结
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>
            · 基于本页统计数据
          </span>
          {meta && (
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>
              · {meta}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75, fontWeight: 500 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  question,
  children,
  action,
  onAsk,
  querying,
  ruleId,
}: {
  title: string
  question: string
  children: React.ReactNode
  action?: React.ReactNode
  onAsk?: () => void
  querying?: boolean
  ruleId?: string
}) {
  return (
    <div
      className="tech-card"
      style={{
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
        border: `1px solid ${C.borderLight}`,
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 5,
                height: 16,
                borderRadius: 4,
                background: `linear-gradient(180deg, ${C.primary}, ${C.cyan})`,
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(91,141,255,0.30)",
              }}
            />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "0.01em" }}>
              {title}
            </div>
            {ruleId && (
            <RuleChips id={ruleId} userRules={STATS_USER_RULES} algoRules={STATS_RULES} />
          )}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4, paddingLeft: 15, fontWeight: 500 }}>
            {question}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {action}
          {querying ? (
            <span
              style={{
                fontSize: 11,
                color: C.primary,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: `rgba(50,109,255,0.08)`,
                borderRadius: 9999,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: C.primary,
                  display: "inline-block",
                  animation: "pulse-dot 1.5s ease-in-out infinite",
                }}
              />
              正在解读
            </span>
          ) : (
            <button
              onClick={onAsk}
              className="tech-btn-ghost"
              style={{
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 8,
                whiteSpace: "nowrap",
              }}
            >
              问这张图
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: 16, flex: 1 }}>{children}</div>
    </div>
  )
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
    街道: "街道",
    网格: "网格",
    街巷: "街巷",
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "rgba(22,45,77,0.04)",
        borderRadius: 9999,
        padding: 3,
        border: `1px solid rgba(184,216,245,0.35)`,
      }}
    >
      {available.map((level) => {
        const active = value === level
        return (
          <button
            key={level}
            onClick={() => onChange(level)}
            style={{
              padding: "3px 10px",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              color: active ? "#fff" : C.muted,
              background: active
                ? `linear-gradient(135deg, ${C.primary} 0%, ${C.cyan} 100%)`
                : "transparent",
              boxShadow: active ? "0 3px 10px rgba(50,109,255,0.30)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {labels[level]}
          </button>
        )
      })}
    </div>
  )
}

function getAvailableLevels(statSpace: string): GroupByLevel[] {
  if (statSpace === "东城全区") return ["街道", "网格", "街巷"]
  return ["网格", "街巷"]
}

// ─── 4.1 综合态势 ─────────────────────────────────
function OverviewCategory({
  groupBy,
  setGroupBy,
  availableLevels,
  skin,
}: {
  groupBy: GroupByLevel
  setGroupBy: (v: GroupByLevel) => void
  availableLevels: GroupByLevel[]
  skin: "light" | "tech"
}) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天 · 截至 08:00">
        {agentBanners.overview}
      </AgentInsight>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <KpiCard label="存续事件" value="15" unit="件" sub="较上周 +12%" color={C.primary} ruleId="ov_sustained" />
        <KpiCard label="今日闭环" value="0" unit="件" sub="结案 0 · 非结案 0" color={C.success} ruleId="ov_closed" />
        <KpiCard label="严重事件" value="7" unit="件" sub="需优先关注" color={C.danger} ruleId="ov_severe" />
        <KpiCard label="平均处置时长" value="—" color={C.purple} ruleId="ov_duration" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <ChartCard title="发现 vs 闭环走势" question="发现有没有被闭环跟上？" ruleId="ov_trend"
          onAsk={() => onQuery("发现 vs 闭环走势")} querying={queryingChart === "发现 vs 闭环走势"}>
          <EchartsLine skin={skin}
            xAxis={statData.weeklyTrend.map((d) => d.label)}
            series={[
              { name: "发现", data: statData.weeklyTrend.map((d) => d.discover), color: C.primary },
              { name: "闭环", data: statData.weeklyTrend.map((d) => d.close), color: C.success, dashed: true },
            ]}
          />
        </ChartCard>
        <ChartCard title="当前各阶段待处理" question="事件现在卡在哪个阶段？" ruleId="ov_stages"
          onAsk={() => onQuery("当前各阶段待处理")} querying={queryingChart === "当前各阶段待处理"}>
          <EchartsFunnel skin={skin}
            data={statData.stagesPending.map((d) => ({ name: d.label, value: d.value }))}
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="严重问题空间" question="严重问题落在哪个街道？" ruleId="ov_severe_space"
          action={<StatGroupSelect value={groupBy} onChange={setGroupBy} available={availableLevels} />}
          onAsk={() => onQuery("严重问题空间")} querying={queryingChart === "严重问题空间"}>
          <EchartsRank skin={skin}
            data={groupByData[groupBy].severeByStreet.map((d) => ({ name: d.label, value: d.value }))}
          />
        </ChartCard>
        <ChartCard title="当前存续类型" question="现在还压着哪些类型？" ruleId="ov_sustained_types"
          onAsk={() => onQuery("当前存续类型")} querying={queryingChart === "当前存续类型"}>
          <EchartsPie skin={skin} data={statData.sustainedTypes} centerText="15" centerSub="存续" />
        </ChartCard>
      </div>
    </>
  )
}

// ─── 4.2 事件发生 ─────────────────────────────────
function EventsCategory({
  groupBy,
  setGroupBy,
  availableLevels,
  skin,
}: {
  groupBy: GroupByLevel
  setGroupBy: (v: GroupByLevel) => void
  availableLevels: GroupByLevel[]
  skin: "light" | "tech"
}) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  const hourLabels = statData.hourly.map((_, h) =>
    h % 3 === 0 ? `${String(h).padStart(2, "0")}时` : "",
  )
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.events}
      </AgentInsight>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <KpiCard label="事件总数" value="18" unit="件" sub="较上周 +12%" color={C.primary} ruleId="ev_total" />
        <KpiCard label="类型数" value="5" unit="类" color={C.warning} ruleId="ev_types" />
        <KpiCard label="涉及空间" value="8" unit="个" sub="街道/网格" color={C.danger} ruleId="ev_spaces" />
        <KpiCard label="主要来源" value="相机识别" color={C.cyan} ruleId="ev_source" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <ChartCard title="类型结构" question="什么多？" ruleId="ev_type_struct"
          onAsk={() => onQuery("类型结构")} querying={queryingChart === "类型结构"}>
          <EchartsPie skin={skin} data={statData.eventTypes} centerText="18" centerSub="近7日" />
        </ChartCard>
        <ChartCard title="空间分布" question="哪里多？" ruleId="ev_space_dist"
          action={<StatGroupSelect value={groupBy} onChange={setGroupBy} available={availableLevels} />}
          onAsk={() => onQuery("空间分布")} querying={queryingChart === "空间分布"}>
          <EchartsRank skin={skin}
            data={groupByData[groupBy].eventByStreet.map((d) => ({ name: d.label, value: d.value }))}
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <ChartCard title="发生时段" question="何时多？" ruleId="ev_hourly"
          onAsk={() => onQuery("发生时段")} querying={queryingChart === "发生时段"}>
          <EchartsBar skin={skin} xAxis={hourLabels} data={statData.hourly} color={[C.primaryLight, C.primary]} />
        </ChartCard>
        <ChartCard title="来源结构" question="从哪来？" ruleId="ev_source_struct"
          onAsk={() => onQuery("来源结构")} querying={queryingChart === "来源结构"}>
          <ChartEmpty text="本版来源仅为相机识别" />
        </ChartCard>
      </div>
      <ChartCard title="高发相机" question="哪路相机更多？" ruleId="ev_top_cameras"
        onAsk={() => onQuery("高发相机")} querying={queryingChart === "高发相机"}>
        <RankList data={statData.topCameras} />
      </ChartCard>
    </>
  )
}

// ─── 4.3 流程运行 ─────────────────────────────────
function ProcessCategory({ skin }: { skin: "light" | "tech" }) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.process}
      </AgentInsight>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <KpiCard label="待立案" value="7" unit="件" sub="不含自然消散" color={C.warning} ruleId="pr_pending" />
        <KpiCard label="待核查" value="5" unit="件" color={C.purple} ruleId="pr_inspect" />
        <KpiCard label="待作废审核" value="2" unit="件" color={C.danger} ruleId="pr_void" />
        <KpiCard label="转责任纠正中" value="0" unit="件" sub="本版无责任纠正环节" color={C.success} ruleId="pr_escalate" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <ChartCard title="环节存量" question="哪个环节卡住了？" ruleId="pr_stages"
          onAsk={() => onQuery("环节存量")} querying={queryingChart === "环节存量"}>
          <EchartsFunnel skin={skin}
            data={statData.stagePending.map((d) => ({ name: d.label, value: d.value, color: d.color }))}
          />
        </ChartCard>
        <ChartCard title="处置池" question="Agent 接力现在卡在哪？" ruleId="pr_pool"
          onAsk={() => onQuery("处置池")} querying={queryingChart === "处置池"}>
          <EchartsRank skin={skin}
            data={statData.processPool.map((d) => ({ name: d.label, value: d.value }))}
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="超时结构" question="超时是不是已经出现？" ruleId="pr_timeout">
          <ChartEmpty text="本图口径本版不展示" />
        </ChartCard>
        <ChartCard title="退回 / 作废" question="流程是在退、停还是上交？" ruleId="pr_return"
          onAsk={() => onQuery("退回 / 作废")} querying={queryingChart === "退回 / 作废"}>
          <EchartsBar skin={skin}
            xAxis={statData.returnAbort.map((d) => d.label)}
            data={statData.returnAbort.map((d) => d.value)}
            color={[C.primaryLight, C.primary]} showLabel
          />
        </ChartCard>
      </div>
    </>
  )
}

// ─── 4.4 作业效能 ─────────────────────────────────
function EfficiencyCategory({ skin }: { skin: "light" | "tech" }) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.efficiency}
      </AgentInsight>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <KpiCard label="响应时长" value="—" color={C.primary} ruleId="ef_response" />
        <KpiCard label="处置时长" value="—" color={C.warning} ruleId="ef_disposal" />
        <KpiCard label="超时率" value="—" color={C.danger} ruleId="ef_timeout_rate" />
        <KpiCard label="一次通过" value="—" color={C.success} ruleId="ef_first_pass" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <ChartCard title="责任网格在办件数" question="负荷在谁身上？" ruleId="ef_grid"
          onAsk={() => onQuery("责任网格在办件数")} querying={queryingChart === "责任网格在办件数"}>
          <EchartsRank skin={skin}
            data={statData.gridPending.map((d) => ({ name: d.label, value: d.value }))}
          />
        </ChartCard>
        <ChartCard title="处置时长分布" question="是不是普遍拖？" ruleId="ef_duration_dist">
          <ChartEmpty text="本图口径本版不展示" />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="一次通过 vs 退回" question="网格稳不稳？" ruleId="ef_pass_vs_return">
          <ChartEmpty text="本图口径本版不展示" />
        </ChartCard>
        <ChartCard title="网格相对快慢" question="同类难度谁更快？" ruleId="ef_grid_speed">
          <ChartEmpty text="本图口径本版不展示" />
        </ChartCard>
      </div>
    </>
  )
}

// ─── 4.5 治理质量 ─────────────────────────────────
function QualityCategory({ skin }: { skin: "light" | "tech" }) {
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.quality}
      </AgentInsight>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <KpiCard label="立案有效" value="15" unit="件" color={C.primary} ruleId="ql_valid" />
        <KpiCard label="无效" value="2" unit="件" color={C.danger} ruleId="ql_invalid" />
        <KpiCard label="自然消散" value="1" unit="件" sub="不计入待立案" color={C.muted} ruleId="ql_dissipated" />
        <KpiCard label="退回率" value="7.4" unit="%" color={C.warning} ruleId="ql_return_rate" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <KpiCard label="事件有效率" value="88.2" unit="%" color={C.success} ruleId="ql_effective_rate" />
        <KpiCard label="一次核查通过率" value="—" color={C.primary} ruleId="ql_first_pass_rate" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="有效 vs 无效 vs 消散" question="立案结论构成？" ruleId="ql_composition">
          <EchartsPie skin={skin} data={statData.qualityComposition} centerText="18" centerSub="构成" />
        </ChartCard>
        <ChartCard title="群众满意度 / 返工原因" question="哪些问题导致二次返工？" ruleId="ql_satisfaction">
          <ChartEmpty text="本图口径本版不展示" />
        </ChartCard>
      </div>
    </>
  )
}

// ─── 4.6 AI 作用成效 ──────────────────────────────
function AICategory({ skin }: { skin: "light" | "tech" }) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.ai}
      </AgentInsight>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <KpiCard label="AI 整体覆盖率" value="—" color={C.primary} ruleId="ai_coverage" />
        <KpiCard label="发现有效率" value="87" unit="%" color={C.success} ruleId="ai_discovery_rate" />
        <KpiCard label="信息补全采纳率" value="91" unit="%" color={C.cyan} ruleId="ai_adopt_rate" />
        <KpiCard label="建议一致率" value="82" unit="%" color={C.purple} ruleId="ai_suggest_match" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <ChartCard title="分类 / 位置 / 网格准确率" question="Agent 预填与人工最终一致率？" ruleId="ai_classify_acc"
          onAsk={() => onQuery("分类 / 位置 / 网格准确率")} querying={queryingChart === "分类 / 位置 / 网格准确率"}>
          <EchartsBar skin={skin}
            xAxis={statData.aiAccuracy.map((d) => d.label)}
            data={statData.aiAccuracy.map((d) => d.value)}
            color={C.cyan} showLabel valueSuffix="%"
          />
        </ChartCard>
        <ChartCard title="空间匹配失败次数" question="哪些事件曾匹配失败？" ruleId="ai_space_fail"
          onAsk={() => onQuery("空间匹配失败次数")} querying={queryingChart === "空间匹配失败次数"}>
          <EchartsRank skin={skin}
            data={[{ name: "空间匹配失败", value: 18 }]}
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <KpiCard label="建议采纳与省时" value="—" sub="本版无减负估算模型" color={C.warning} ruleId="ai_reduce" />
        <ChartCard title="其他运行风险" question="证据不足、接口失败、人工高频修正？" ruleId="ai_risk"
          onAsk={() => onQuery("AI运行风险")} querying={queryingChart === "AI运行风险"}>
          <ChartEmpty text="证据不足、接口失败、人工高频修正本版字段未齐，暂不计算" />
        </ChartCard>
      </div>
    </>
  )
}

// ─── 4.7 专题统计 ─────────────────────────────────
function TopicsCategory() {
  return (
    <>
      <AgentInsight meta="本版不配置复发规则">
        {agentBanners.topics}
      </AgentInsight>
      <div
        className="glass-card"
        style={{
          padding: "40px 24px",
          textAlign: "center",
          borderRadius: 14,
          background: `linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
          border: `1px solid ${C.borderLight}`,
          boxShadow: C.shadow,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>专题统计</span>
          <RuleChips id="tp_topics" userRules={STATS_USER_RULES} algoRules={STATS_RULES} />
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 500, lineHeight: 1.8 }}>
          当前范围无观察中专题
          <br />
          本版不配置复发规则，专题暂不计算
        </div>
      </div>
    </>
  )
}

export default function AIStatistics({ skin }: { skin: "light" | "tech" }) {
  const [activeCat, setActiveCat] = useState<StatCat>("overview")
  const [statTime, setStatTime] = useState<StatTime>("7d")
  const [statSpace, setStatSpace] = useState("东城全区")
  const [statType, setStatType] = useState("全部类型")
  const [groupBy, setGroupBy] = useState<GroupByLevel>("街道")
  const [showInterpret, setShowInterpret] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [queryingChart, setQueryingChart] = useState<string | null>(null)
  const [chartAnswer, setChartAnswer] = useState<{
    title: string
    conclusion: string
    evidence: string
    correlation: string
    followups: string[]
  } | null>(null)

  const timeLabel =
    statTime === "today" ? "今日" : statTime === "7d" ? "近7日" : "近30日"
  const availableLevels = getAvailableLevels(statSpace)

  function handleSpaceChange(space: string) {
    setStatSpace(space)
    const levels = getAvailableLevels(space)
    if (!levels.includes(groupBy)) setGroupBy(levels[0])
  }

  function handleChartQuery(title: string) {
    setShowInterpret(true)
    setQueryingChart(title)
    setChartAnswer(null)
    setTimeout(() => {
      const ans = chartAnswers[title] || defaultChartAnswer
      setChartAnswer({ title, ...ans })
      setQueryingChart(null)
    }, 1200)
  }

  return (
    <ChartQueryCtx.Provider value={{ queryingChart, onQuery: handleChartQuery }}>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "transparent",
        }}
      >
        {/* Header */}
        <div
          className="glass-strong"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            height: 56,
            flexShrink: 0,
            position: "relative",
            zIndex: 5,
            borderBottom: `1px solid ${C.borderLight}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                width: 6,
                height: 22,
                borderRadius: 4,
                background: `linear-gradient(180deg, ${C.primary}, ${C.cyan})`,
                boxShadow: "0 2px 10px rgba(91,141,255,0.30)",
              }}
            />
            <div>
              <span className="gradient-text" style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.02em" }}>
                AI 统计
              </span>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 10, fontWeight: 500 }}>
                全域治理数据洞察
              </span>
            </div>
            <RuleChips id="page" userRules={STATS_USER_RULES} algoRules={STATS_RULES} />
          </div>
          <button
            onClick={() => setShowInterpret(!showInterpret)}
            className="tech-btn-primary"
            style={{
              padding: "8px 18px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              boxShadow: showInterpret ? "0 0 22px rgba(50,109,255,0.55)" : undefined,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 0 8px rgba(255,255,255,0.8)",
              }}
            />
            AI 解读
          </button>
        </div>

        {/* Tab nav */}
        <div
          className="glass"
          style={{
            display: "flex",
            flexShrink: 0,
            overflowX: "auto",
            padding: "10px 16px",
            gap: 8,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {statCategories.map((cat) => {
            const active = activeCat === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: 9999,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  color: active ? "#fff" : C.muted,
                  background: active
                    ? `linear-gradient(135deg, ${C.primary} 0%, ${C.cyan} 100%)`
                    : "rgba(255,255,255,0.45)",
                  boxShadow: active
                    ? "0 4px 16px rgba(50,109,255,0.38)"
                    : "inset 0 1px 0 rgba(255,255,255,0.75), 0 2px 6px rgba(22,45,77,0.04)",
                  backdropFilter: active ? undefined : "blur(8px)",
                  WebkitBackdropFilter: active ? undefined : "blur(8px)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(50,109,255,0.10)"
                    e.currentTarget.style.color = C.primary
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(50,109,255,0.12)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.45)"
                    e.currentTarget.style.color = C.muted
                    e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.75), 0 2px 6px rgba(22,45,77,0.04)"
                  }
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Filter bar */}
        <div
          className="glass"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 20px",
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, fontWeight: 700, letterSpacing: "0.03em" }}>
            时间
          </span>
          <div
            style={{
              display: "flex",
              gap: 2,
              background: "rgba(22,45,77,0.04)",
              borderRadius: 9999,
              padding: 3,
              border: `1px solid rgba(184,216,245,0.35)`,
              boxShadow: "inset 0 1px 2px rgba(22,45,77,0.04)",
            }}
          >
            {([
              ["today", "今日"],
              ["7d", "近7日"],
              ["30d", "近30日"],
            ] as [StatTime, string][]).map(([v, label]) => {
              const active = statTime === v
              return (
                <button
                  key={v}
                  onClick={() => setStatTime(v)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 9999,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: active ? 700 : 600,
                    color: active ? "#fff" : C.muted,
                    background: active
                      ? `linear-gradient(135deg, ${C.primary} 0%, ${C.cyan} 100%)`
                      : "transparent",
                    boxShadow: active ? "0 3px 12px rgba(50,109,255,0.32)" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, marginLeft: 4, fontWeight: 700, letterSpacing: "0.03em" }}>
            空间
          </span>
          <select
            value={statSpace}
            onChange={(e) => handleSpaceChange(e.target.value)}
            className="stat-select"
            style={{ minWidth: 120, padding: "6px 12px", borderRadius: 10, background: "var(--control-bg)" }}
          >
            <option>东城全区</option>
            {districtPolygons.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, marginLeft: 4, fontWeight: 700, letterSpacing: "0.03em" }}>
            类型
          </span>
          <select
            value={statType}
            onChange={(e) => setStatType(e.target.value)}
            className="stat-select"
            style={{ minWidth: 120, padding: "6px 12px", borderRadius: 10, background: "var(--control-bg)" }}
          >
            <option>全部类型</option>
            {statData.eventTypes.map((t) => (
              <option key={t.label}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
            {activeCat === "overview" && (
              <OverviewCategory groupBy={groupBy} setGroupBy={setGroupBy} availableLevels={availableLevels} skin={skin} />
            )}
            {activeCat === "events" && (
              <EventsCategory groupBy={groupBy} setGroupBy={setGroupBy} availableLevels={availableLevels} skin={skin} />
            )}
            {activeCat === "process" && <ProcessCategory skin={skin} />}
            {activeCat === "efficiency" && <EfficiencyCategory skin={skin} />}
            {activeCat === "quality" && <QualityCategory skin={skin} />}
            {activeCat === "ai" && <AICategory skin={skin} />}
            {activeCat === "topics" && <TopicsCategory />}
          </div>

          {/* AI解读 panel */}
          {showInterpret && (
            <div
              className="glass-strong"
              style={{
                width: 360,
                borderLeft: `1px solid ${C.borderLight}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: `linear-gradient(180deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.cyan} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    boxShadow: "0 4px 12px rgba(50,109,255,0.32)",
                  }}
                >
                  AI
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>AI 解读</span>
                {chartAnswer && (
                  <span
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                    }}
                  >
                    — {chartAnswer.title}
                  </span>
                )}
                <button
                  onClick={() => setShowInterpret(false)}
                  className="tech-btn-ghost"
                  style={{
                    marginLeft: "auto",
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 7,
                    padding: 0,
                    color: C.muted,
                    fontSize: 16,
                  }}
                >
                  ×
                </button>
              </div>

              <div className="signature-scroll" style={{ flex: 1, overflow: "auto", padding: 16 }}>
                {queryingChart && !chartAnswer && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      padding: "40px 0",
                      color: C.muted,
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: `2px solid ${C.border}`,
                        borderTopColor: C.primary,
                        animation: "deal-spin 1s linear infinite",
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      正在解读「{queryingChart}」…
                    </span>
                  </div>
                )}
                {chartAnswer && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="ai-bubble ai-bubble-primary" style={{ borderRadius: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: C.primary, marginBottom: 6, letterSpacing: "0.04em" }}>
                        直接结论
                      </div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.75, fontWeight: 500 }}>
                        {chartAnswer.conclusion}
                      </div>
                    </div>
                    <div className="ai-bubble ai-bubble-soft" style={{ borderRadius: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 6, letterSpacing: "0.04em" }}>
                        数据直接证明
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.75, fontWeight: 500 }}>
                        {chartAnswer.evidence}
                      </div>
                    </div>
                    <div className="ai-bubble ai-bubble-soft" style={{ borderRadius: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 6, letterSpacing: "0.04em" }}>
                        相关性线索（非因果）
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.75, fontWeight: 500 }}>
                        {chartAnswer.correlation}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, marginBottom: 8, letterSpacing: "0.04em" }}>
                        下一步可问
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {chartAnswer.followups.map((q) => (
                          <button key={q} onClick={() => setAiInput(q)} className="followup-pill">
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {!queryingChart && !chartAnswer && (
                  <div
                    className="ai-bubble ai-bubble-soft"
                    style={{
                      color: C.muted,
                      fontSize: 12,
                      textAlign: "center",
                      padding: "40px 16px",
                      lineHeight: 1.9,
                      borderRadius: 14,
                    }}
                  >
                    点击任意图表的
                    <span style={{ color: C.primary, fontWeight: 700 }}>「问这张图」</span>
                    <br />
                    即可获得 AI 解读
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderTop: `1px solid ${C.border}`,
                  flexShrink: 0,
                  background: "var(--row-bg)",
                }}
              >
                <div style={{ display: "flex", gap: 8, marginBottom: chartAnswer ? 8 : 0 }}>
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={chartAnswer ? `继续问「${chartAnswer.title}」或这一类…` : "解读数据…"}
                    className="tech-input"
                    style={{
                      flex: 1,
                      padding: "9px 13px",
                      background: "var(--card)",
                      borderRadius: 10,
                      color: C.text,
                      fontSize: 12,
                      outline: "none",
                      border: `1px solid ${C.border}`,
                    }}
                  />
                  <button
                    className="tech-btn-primary"
                    style={{ padding: "8px 16px", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12 }}
                  >
                    发送
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ChartQueryCtx.Provider>
  )
}
