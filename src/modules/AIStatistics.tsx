import { useState, createContext, useContext } from "react"
import EchartsBar from "../components/EchartsBar"
import EchartsFunnel from "../components/EchartsFunnel"
import EchartsLine from "../components/EchartsLine"
import EchartsPie from "../components/EchartsPie"
import EchartsRank from "../components/EchartsRank"
import KpiIcon from "../components/KpiIcon"
import RankList from "../components/RankList"

// Modern light glassmorphism · 政务分析台配色
// 皮肤令牌：指向 index.css 语义变量，随 清爽/科技 皮肤自动适配
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

const statCategories: { id: StatCat label: string }[] = [
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
  eventSources: [
    { label: "AI识别", value: 16, color: C.primary },
    { label: "人工上报", value: 1, color: C.success },
    { label: "其他来源", value: 1, color: C.warning },
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
    { label: "待立案", value: 7, color: C.primary },
    { label: "待处置/待反馈", value: 1, color: C.warning },
    { label: "待核查/外场", value: 3, color: C.purple },
    { label: "待作废审核", value: 2, color: C.danger },
  ],
  processPool: [
    { label: "待分配", value: 1 },
    { label: "等待处置反馈", value: 1 },
    { label: "等待外场核查", value: 1 },
    { label: "持续监控", value: 1 },
  ],
  timeoutDist: [
    { label: "已超时", value: 13, color: C.success },
    { label: "临近超时", value: 2, color: C.warning },
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
    { label: "一次核查通过", value: 5, color: C.primary },
    { label: "退回后再结", value: 2, color: C.warning },
    { label: "外场补证", value: 2, color: C.purple },
  ],
  gridSpeed: [
    { label: "A11 占道经营", value: 3 },
    { label: "B03 共享单车", value: 2 },
    { label: "C07 施工占道", value: 2 },
  ],
  aiByStage: [
    { label: "事件发现", value: 94, color: C.cyan },
    { label: "信息补全", value: 91, color: C.primary },
    { label: "核查辅助", value: 88, color: C.purple },
    { label: "结案建议", value: 82, color: C.success },
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
  aiRisk: [
    { label: "空间匹配失败", value: 18, color: C.warning },
    { label: "处置后图不清", value: 12, color: C.danger },
    { label: "人工高频修正", value: 7, color: C.purple },
    { label: "接口失败", value: 3, color: C.cyan },
    { label: "规则冲突", value: 2, color: C.success },
  ],
}

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

const agentBanners: Record<StatCat, string> = {
  overview:
    "近5日发现 16 件、闭环 6 件，08-18 单日发现 5 件、闭环 0 件，积压集中在「发现」（7 件）与「核查」（5 件）。存续 15 件中严重 7 件，朝阳门街道以 2 件居首，平均处置时长 1h44m（较上周 -0.3h）。建议优先消化发现与核查积压，并复核朝阳门的严重件。",
  events:
    "本期 18 件事件覆盖 5 类、8 个空间单元，AI 视频识别贡献 16 件（占 89%）。共享单车占道与施工占道各 5 件、合计占 55%；北新桥、朝阳门、东华门各 4 件并列最高；08 时（4 件）、09 时（3 件）为高发窗口，高频点位 C-A11-03、C-C07-11 各 3 件。建议早高峰对上述两类、三个街道加密巡检。",
  process:
    "环节存量为待立案 7、待核查/外场 3、待作废审核 2、待处置/待反馈 1；已超时 13 件、临近超时 2 件，退回处置 1、作废审核 2、已中止 1、升级接管 0。待立案占环节积压约一半，是当前最大瓶颈，网格侧 A11 责任人在办 3 件最多。建议优先扩充立案审核力量，并核查超时件的时限配置。",
  efficiency:
    "示意口径下响应 18 分、处置 1h44m、超时率 8%、一次通过 72%；在办件 A11 责任人 3 件最多，处置时长集中在 30m~2h（5 件），核查结果为一次通过 5、退回后再结 2、外场补证 2，网格相对快慢榜 A11 占道经营居首。当前样本量小，建议扩大统计周期后再做网格排名，避免以件数论成效。",
  quality:
    "核查通过率 86.2%、二次返工率 7.4%、返工平均耗时 1.8h、群众满意度 4.2/5；复发率、反弹周期与投诉量处于数据积累期，预计近 30 日可用。当前 3 个复发专题中，朝阳门南小街共享单车已进入第 2 个观察期（剩余 14 天），东直门内大街乱堆垃圾第 1 观察期仅剩 4 天，建议优先复核即将到期的东直门专题。",
  ai:
    "AI 整体覆盖率 94%，分环节为发现 94%、信息补全 91%、核查辅助 88%、结案建议 82%，近5日有效率由 83 升至 86。分类准确率中违规停放（78%）与共享单车（84%）偏低，运行风险集中在空间匹配失败（18 次）与处置后图像不清（12 次）。建议优先修订违规停放核查规则，并复核相关点位相机角度。",
  topics:
    "当前 3 个复发治理专题：朝阳门南小街共享单车累计 7 件、进入第 2 观察期（剩余 14 天）；东直门内大街乱堆垃圾近 14 天 0 新增、第 1 观察期剩余 4 天；建国门内大街无证户外广告接近成立阈值待确认。建议优先复核即将到期的东直门专题，并确认建国门候选是否成立。",
}

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
  当前各阶段待处理: {
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
  来源结构: {
    conclusion:
      "来源以 AI 识别为主（16件，占89%），人工上报和其他来源各占 1 件。",
    evidence: "AI识别 16，人工上报 1，其他来源 1。",
    correlation: "高 AI 占比说明发现端高度自动化，需关注低置信与人工复核比例。",
    followups: ["AI 低置信事件有多少？", "人工上报的 1 件是什么类型？"],
  },
  高发相机: {
    conclusion:
      "高发相机集中在 C-A11-03 和 C-C07-11（各 3 次），其次是 C-B03-02 与 C-E01-02（各 2 次）。",
    evidence:
      "C-A11-03 3次，C-C07-11 3次，C-B03-02 2次，C-E01-02 2次，其余 1次。",
    correlation: "相机高发通常与点位人流、车流或遮挡变化相关。",
    followups: ["高发相机的时段分布如何？", "这些相机覆盖哪个街道？"],
  },
  环节存量: {
    conclusion:
      "待立案环节积压最多（7件），待核查/外场次之（3件），是当前人工瓶颈。",
    evidence: "待立案 7，待处置/待反馈 1，待核查/外场 3，待作废审核 2。",
    correlation: "立案审核是入口瓶颈，可能影响后续处置节奏。",
    followups: ["待立案的 7 件积压多久了？", "哪些类型需要额外证据？"],
  },
  处置池四态: {
    conclusion: "处置池四态当前样本较少，各状态均只有 1 件，尚未形成明显瓶颈。",
    evidence: "待分配 1，等待处置反馈 1，等待外场核查 1，持续监控 1。",
    correlation: "样本小，趋势判断需继续观察。",
    followups: ["近7日四态的变化趋势？", "哪个状态最容易超时？"],
  },
  "超时结构（示意）": {
    conclusion: "当前已超时占绝大多数（13件），临近超时 2 件，需关注超时原因。",
    evidence: "已超时 13，临近超时 2。",
    correlation: "超时结构为示意口径，需结合实际时限配置观察。",
    followups: ["临近超时的 2 件在哪个环节？", "超时率是否呈上升趋势？"],
  },
  "退回 / 作废 / 升级": {
    conclusion: "待作废审核 2 件最多，退回处置与已中止各 1 件，升级接管为 0。",
    evidence: "退回处置（待处置）1，待作废审核 2，已中止 1，升级接管 0。",
    correlation: "作废审核较多，需关注是否因规则边界不清导致。",
    followups: ["待作废审核的原因是什么？", "已中止的 1 件后续如何处理？"],
  },
  责任网格在办件数: {
    conclusion:
      "A11 责任人当前在办 3 件最多，C07、E01 各 2 件，其余责任人 1 件。",
    evidence: "A11 3件，C07 2件，E01 2件，A07/B03/B05/B08/C02/D04/F02 各1件。",
    correlation: "A11 网格负荷偏高，建议结合历史均值判断是否异常。",
    followups: ["A11 网格的件是什么类型？", "按人均负荷看是否均衡？"],
  },
  "处置时长分布（示意）": {
    conclusion:
      "处置时长主要集中在 30m~2h（5件），<30m 与 2h~8h 分别为 2、3 件，>8h 1 件。",
    evidence: "<30m 2，30m~2h 5，2h~8h 3，>8h 1。",
    correlation: "分布为示意口径，多数事件可在 2h 内处置。",
    followups: [">8h 的 1 件卡在哪个环节？", "不同事件类型的时长差异？"],
  },
  "一次通过 vs 退回（示意）": {
    conclusion: "一次核查通过 5 件最多，退回后再结与外场补证各 2 件。",
    evidence: "一次核查通过 5，退回后再结 2，外场补证 2。",
    correlation: "一次通过率约 56%，外场补证与退回原因需进一步拆解。",
    followups: ["退回后再结的主要原因？", "外场补证集中在哪些街道？"],
  },
  "网格相对快慢（示意）": {
    conclusion:
      "A11 占道经营处置 3 件最快，B03 共享单车与 C07 施工占道各 2 件。",
    evidence: "A11 占道经营 3，B03 共享单车 2，C07 施工占道 2。",
    correlation: "快慢需在同类型、同难度下比较，当前为示意样本。",
    followups: ["同类事件中平均时长差异？", "B03 与 C07 的差异原因？"],
  },
  AI各环节参与率: {
    conclusion:
      "事件发现参与率最高（94%），信息补全 91%，核查辅助 88%，结案建议 82%。",
    evidence: "事件发现 94%，信息补全 91%，核查辅助 88%，结案建议 82%。",
    correlation: "AI 在发现端渗透最深，结案建议仍有提升空间。",
    followups: ["结案建议采纳率低的原因是什么？", "哪些环节的人工修改最多？"],
  },
  "发现有效率趋势（近5日）": {
    conclusion: "发现有效率稳定在 83%-87% 之间，08-17 达到 87%。",
    evidence: "8/14 83%，8/15 85%，8/16 84%，8/17 87%，8/18 86%。",
    correlation: "有效率波动较小，整体处于健康区间。",
    followups: ["08-17 有效率最高的原因？", "低于 80% 的事件类型是哪些？"],
  },
  "各问题类型 AI 分类准确率（%）": {
    conclusion: "乱堆垃圾准确率最高（93%），违规停放最低（78%），需重点关注。",
    evidence:
      "乱堆垃圾 93，违规施工 91，无证广告 89，店外经营 87，共享单车 84，违规停放 78。",
    correlation: "违规停放场景复杂、角度多变，易导致分类混淆。",
    followups: ["违规停放主要混淆成哪类？", "哪些相机角度的准确率偏低？"],
  },
  AI运行风险: {
    conclusion:
      "本周 AI 运行风险共 42 件，空间匹配失败 18 件最多，处置后图不清 12 件次之。",
    evidence:
      "空间匹配失败 18，处置后图不清 12，人工高频修正 7，接口失败 3，规则冲突 2。",
    correlation: "空间匹配失败与处置后图不清合计占比 71%，是主要优化方向。",
    followups: [
      "空间匹配失败集中在哪些类型？",
      "接口失败的 3 次是否重复出现？",
    ],
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

function KpiCard({
  label,
  value,
  unit,
  sub,
  color = C.text,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  color?: string
  icon?: string
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
            fontSize: 12,
            color: C.muted,
            fontWeight: 600,
            marginBottom: 8,
            letterSpacing: "0.02em",
          }}
        >
          {label}
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
}: {
  title: string
  question: string
  children: React.ReactNode
  action?: React.ReactNode
  onAsk?: () => void
  querying?: boolean
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

function StatDemoTag() {
  return (
    <span
      style={{
        fontSize: 10,
        color: C.primary,
        border: `1px solid rgba(50,109,255,0.22)`,
        borderRadius: 9999,
        padding: "3px 10px",
        background: "linear-gradient(135deg, rgba(50,109,255,0.08) 0%, rgba(36,214,210,0.06) 100%)",
        fontWeight: 700,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
      }}
    >
      示意
    </span>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="存续事件"
          value="15"
          unit="件"
          sub="较上周 +12%"
          color={C.primary}
          icon="存"
        />
        <KpiCard
          label="今日闭环"
          value="0"
          unit="件"
          sub="结案 0"
          color={C.success}
          icon="闭"
        />
        <KpiCard
          label="严重事件"
          value="7"
          unit="件"
          sub="需优先关注"
          color={C.danger}
          icon="警"
        />
        <KpiCard
          label="平均处置时长"
          value="1h 44m"
          sub="较上周 -0.3h"
          color={C.purple}
          icon="效"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <ChartCard
          title="发现 vs 闭环走势"
          question="发现有没有被闭环跟上？"
          onAsk={() => onQuery("发现 vs 闭环走势")}
          querying={queryingChart === "发现 vs 闭环走势"}
        >
          <EchartsLine skin={skin}
            xAxis={statData.weeklyTrend.map((d) => d.label)}
            series={[
              {
                name: "发现",
                data: statData.weeklyTrend.map((d) => d.discover),
                color: C.primary,
              },
              {
                name: "闭环",
                data: statData.weeklyTrend.map((d) => d.close),
                color: C.success,
                dashed: true,
              },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="当前各阶段待处理"
          question="事件现在卡在哪个阶段？"
          onAsk={() => onQuery("当前各阶段待处理")}
          querying={queryingChart === "当前各阶段待处理"}
        >
          <EchartsFunnel skin={skin}
            data={statData.stagesPending.map((d) => ({
              name: d.label,
              value: d.value,
            }))}
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard
          title="严重问题空间"
          question="严重问题落在哪个街道？"
          action={
            <StatGroupSelect
              value={groupBy}
              onChange={setGroupBy}
              available={availableLevels}
            />
          }
          onAsk={() => onQuery("严重问题空间")}
          querying={queryingChart === "严重问题空间"}
        >
          <EchartsRank skin={skin}
            data={groupByData[groupBy].severeByStreet.map((d) => ({
              name: d.label,
              value: d.value,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="当前存续类型"
          question="现在还压着哪些类型？"
          onAsk={() => onQuery("当前存续类型")}
          querying={queryingChart === "当前存续类型"}
        >
          <EchartsPie skin={skin}
            data={statData.sustainedTypes}
            centerText="15"
            centerSub="存续"
          />
        </ChartCard>
      </div>
    </>
  )
}

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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="事件总数"
          value="18"
          unit="件"
          sub="较上周 +12%"
          color={C.primary}
          icon="总"
        />
        <KpiCard
          label="类型数"
          value="5"
          unit="类"
          sub="主要类型 2 类"
          color={C.warning}
          icon="类"
        />
        <KpiCard
          label="涉及空间"
          value="8"
          unit="个"
          sub="街道/网格"
          color={C.danger}
          icon="空"
        />
        <KpiCard
          label="主要来源"
          value="AI视频识别"
          sub="占比 89%"
          color={C.cyan}
          icon="源"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <ChartCard
          title="类型结构"
          question="什么多？"
          onAsk={() => onQuery("类型结构")}
          querying={queryingChart === "类型结构"}
        >
          <EchartsPie skin={skin}
            data={statData.eventTypes}
            centerText="18"
            centerSub="近7日"
          />
        </ChartCard>
        <ChartCard
          title="空间分布"
          question="哪里多？"
          action={
            <StatGroupSelect
              value={groupBy}
              onChange={setGroupBy}
              available={availableLevels}
            />
          }
          onAsk={() => onQuery("空间分布")}
          querying={queryingChart === "空间分布"}
        >
          <EchartsRank skin={skin}
            data={groupByData[groupBy].eventByStreet.map((d) => ({
              name: d.label,
              value: d.value,
            }))}
          />
        </ChartCard>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <ChartCard
          title="发生时段"
          question="何时多？"
          onAsk={() => onQuery("发生时段")}
          querying={queryingChart === "发生时段"}
        >
          <EchartsBar skin={skin}
            xAxis={hourLabels}
            data={statData.hourly}
            color={[C.primaryLight, C.primary]}
          />
        </ChartCard>
        <ChartCard
          title="来源结构"
          question="从哪来？"
          onAsk={() => onQuery("来源结构")}
          querying={queryingChart === "来源结构"}
        >
          <EchartsPie skin={skin}
            data={statData.eventSources}
            centerText="18"
            centerSub="来源"
          />
        </ChartCard>
      </div>
      <ChartCard
        title="高发相机"
        question="哪路相机更多？"
        onAsk={() => onQuery("高发相机")}
        querying={queryingChart === "高发相机"}
      >
        <RankList data={statData.topCameras} />
      </ChartCard>
    </>
  )
}

function ProcessCategory({ skin }: { skin: "light" | "tech" }) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.process}
      </AgentInsight>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="待立案"
          value="7"
          unit="件"
          sub="入口瓶颈"
          color={C.warning}
          icon="立"
        />
        <KpiCard
          label="待核查"
          value="2"
          unit="件"
          sub="含外场"
          color={C.purple}
          icon="核"
        />
        <KpiCard
          label="待作废审核"
          value="2"
          unit="件"
          sub="规则边界"
          color={C.danger}
          icon="废"
        />
        <KpiCard
          label="升级接管中"
          value="0"
          unit="件"
          sub="暂无"
          color={C.success}
          icon="升"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <ChartCard
          title="环节存量"
          question="哪个环节卡住了？"
          onAsk={() => onQuery("环节存量")}
          querying={queryingChart === "环节存量"}
        >
          <EchartsFunnel skin={skin}
            data={statData.stagePending.map((d) => ({
              name: d.label,
              value: d.value,
              color: d.color,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="处置池四态"
          question="Agent 接力现在卡在哪？"
          onAsk={() => onQuery("处置池四态")}
          querying={queryingChart === "处置池四态"}
        >
          <EchartsRank skin={skin}
            data={statData.processPool.map((d) => ({
              name: d.label,
              value: d.value,
            }))}
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard
          title="超时结构（示意）"
          question="超时是不是已经出现？"
          action={<StatDemoTag />}
          onAsk={() => onQuery("超时结构（示意）")}
          querying={queryingChart === "超时结构（示意）"}
        >
          <EchartsPie skin={skin}
            data={statData.timeoutDist}
            centerText="15"
            centerSub="超时"
          />
        </ChartCard>
        <ChartCard
          title="退回 / 作废 / 升级"
          question="流程是在退、停还是上交？"
          onAsk={() => onQuery("退回 / 作废 / 升级")}
          querying={queryingChart === "退回 / 作废 / 升级"}
        >
          <EchartsBar skin={skin}
            xAxis={statData.returnAbort.map((d) => d.label)}
            data={statData.returnAbort.map((d) => d.value)}
            color={[C.primaryLight, C.primary]}
            showLabel
          />
        </ChartCard>
      </div>
    </>
  )
}

function EfficiencyCategory({ skin }: { skin: "light" | "tech" }) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.efficiency}
      </AgentInsight>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="响应时长（示意）"
          value="18"
          unit="m"
          sub="全区平均"
          color={C.primary}
          icon="响"
        />
        <KpiCard
          label="处置时长（示意）"
          value="1h 44m"
          sub="中位水平"
          color={C.warning}
          icon="时"
        />
        <KpiCard
          label="超时率（示意）"
          value="8"
          unit="%"
          sub="较上周 -2%"
          color={C.danger}
          icon="超"
        />
        <KpiCard
          label="一次通过（示意）"
          value="72"
          unit="%"
          sub="较上周 +4%"
          color={C.success}
          icon="通"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <ChartCard
          title="责任网格在办件数"
          question="负荷在谁身上？"
          onAsk={() => onQuery("责任网格在办件数")}
          querying={queryingChart === "责任网格在办件数"}
        >
          <EchartsRank skin={skin}
            data={statData.gridPending.map((d) => ({
              name: d.label,
              value: d.value,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="处置时长分布（示意）"
          question="是不是普遍拖？"
          action={<StatDemoTag />}
          onAsk={() => onQuery("处置时长分布（示意）")}
          querying={queryingChart === "处置时长分布（示意）"}
        >
          <EchartsBar skin={skin}
            xAxis={statData.durationBuckets.map((d) => d.label)}
            data={statData.durationBuckets.map((d) => d.value)}
            color={[C.primaryLight, C.primary]}
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard
          title="一次通过 vs 退回（示意）"
          question="网格稳不稳？"
          action={<StatDemoTag />}
          onAsk={() => onQuery("一次通过 vs 退回（示意）")}
          querying={queryingChart === "一次通过 vs 退回（示意）"}
        >
          <EchartsPie skin={skin}
            data={statData.passVsReturn}
            centerText="9"
            centerSub="闭环"
          />
        </ChartCard>
        <ChartCard
          title="网格相对快慢（示意）"
          question="同类难度谁更快？"
          action={<StatDemoTag />}
          onAsk={() => onQuery("网格相对快慢（示意）")}
          querying={queryingChart === "网格相对快慢（示意）"}
        >
          <EchartsRank skin={skin}
            data={statData.gridSpeed.map((d) => ({
              name: d.label,
              value: d.value,
            }))}
          />
        </ChartCard>
      </div>
    </>
  )
}

function AICategory({ skin }: { skin: "light" | "tech" }) {
  const { onQuery, queryingChart } = useContext(ChartQueryCtx)
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.ai}
      </AgentInsight>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="AI整体覆盖率"
          value="94"
          unit="%"
          sub="有AI参与的环节"
          color={C.primary}
          icon="覆"
        />
        <KpiCard
          label="发现有效率"
          value="87"
          unit="%"
          sub="候选→确认立案"
          color={C.success}
          icon="效"
        />
        <KpiCard
          label="建议采纳率"
          value="82"
          unit="%"
          sub="Agent建议与人工一致"
          color={C.purple}
          icon="纳"
        />
        <KpiCard
          label="信息补全采纳率"
          value="91"
          unit="%"
          sub="Agent填充未被修改"
          color={C.cyan}
          icon="补"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <ChartCard
          title="AI各环节参与率"
          question="AI在哪些环节参与最深？"
          onAsk={() => onQuery("AI各环节参与率")}
          querying={queryingChart === "AI各环节参与率"}
        >
          <EchartsRank skin={skin}
            data={statData.aiByStage.map((d) => ({
              name: d.label,
              value: d.value,
              color: d.color,
            }))}
            valueSuffix="%"
          />
        </ChartCard>
        <ChartCard
          title="发现有效率趋势（近5日）"
          question="近5日有效率是否稳定？"
          onAsk={() => onQuery("发现有效率趋势（近5日）")}
          querying={queryingChart === "发现有效率趋势（近5日）"}
        >
          <EchartsBar skin={skin}
            xAxis={statData.aiWeekly.map((d) => d.label)}
            data={statData.aiWeekly.map((d) => d.value)}
            color={C.cyan}
            showLabel
            valueSuffix="%"
          />
        </ChartCard>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard
          title="各问题类型 AI 分类准确率（%）"
          question="哪类事件的AI分类最需要优化？"
          onAsk={() => onQuery("各问题类型 AI 分类准确率（%）")}
          querying={queryingChart === "各问题类型 AI 分类准确率（%）"}
        >
          <EchartsRank skin={skin}
            data={statData.aiAccuracy.map((d) => ({
              name: d.label,
              value: d.value,
            }))}
            valueSuffix="%"
            thresholds={[
              { max: 85, color: C.warning },
              { max: 90, color: C.primary },
              { color: C.success },
            ]}
            warningThreshold={85}
          />
        </ChartCard>
        <ChartCard
          title="AI运行风险"
          question="本周AI运行是否出现异常？"
          onAsk={() => onQuery("AI运行风险")}
          querying={queryingChart === "AI运行风险"}
        >
          <EchartsPie skin={skin} data={statData.aiRisk} centerText="42" centerSub="风险" />
        </ChartCard>
      </div>
    </>
  )
}

function QualityCategory({ skin }: { skin: "light" | "tech" }) {
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近7天">
        {agentBanners.quality}
      </AgentInsight>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="核查通过率"
          value="86.2"
          unit="%"
          sub="目标 90%"
          color={C.success}
          icon="通"
        />
        <KpiCard
          label="二次返工率"
          value="7.4"
          unit="%"
          sub="高于目标 2.4%"
          color={C.warning}
          icon="返"
        />
        <KpiCard
          label="返工平均耗时"
          value="1.8"
          unit="天"
          sub="从退回到重新闭环"
          color={C.danger}
          icon="耗"
        />
        <KpiCard
          label="群众满意度"
          value="4.2"
          unit="/5"
          sub="较上周 +0.1"
          color={C.primary}
          icon="满"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="核查结果趋势" question="近7日核查质量是否稳定？">
          <EchartsLine skin={skin}
            xAxis={["8/14", "8/15", "8/16", "8/17", "8/18", "8/19", "8/20"]}
            series={[
              {
                name: "通过率",
                data: [84, 85, 87, 86, 88, 86, 86],
                color: C.success,
              },
              { name: "返工率", data: [8, 7, 7, 8, 6, 7, 7], color: C.warning },
            ]}
            valueSuffix="%"
          />
        </ChartCard>
        <ChartCard title="返工原因" question="哪些问题导致二次返工？">
          <EchartsPie skin={skin}
            data={[
              { name: "证据不清晰", value: 18 },
              { name: "处置不到位", value: 14 },
              { name: "定责争议", value: 8 },
              { name: "超期未补", value: 5 },
            ]}
            centerText="45"
            centerSub="返工"
          />
        </ChartCard>
      </div>
    </>
  )
}

function TopicsCategory() {
  return (
    <>
      <AgentInsight meta="数据范围：全区 · 近14天">
        {agentBanners.topics}
      </AgentInsight>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          {
            id: "TOPIC-0048",
            title: "朝阳门南小街 · 共享单车违规停放",
            status: "观察期中",
            eventsTotal: 7,
            eventsRecent: 2,
            interval: "平均4天",
            lastEvent: "2026-08-18",
            observation: "第2个观察期，剩余14天",
            color: C.warning,
          },
          {
            id: "TOPIC-0039",
            title: "东直门内大街 · 乱堆垃圾",
            status: "观察期中",
            eventsTotal: 5,
            eventsRecent: 0,
            interval: "平均9天",
            lastEvent: "2026-08-06",
            observation: "第1个观察期，剩余4天",
            color: C.success,
          },
          {
            id: "TOPIC-0031",
            title: "建国门内大街 · 无证户外广告",
            status: "候选",
            eventsTotal: 4,
            eventsRecent: 1,
            interval: "平均12天",
            lastEvent: "2026-08-17",
            observation: "接近成立阈值，待确认",
            color: C.primary,
          },
        ].map((topic) => (
          <div
            key={topic.id}
            className="glass-card hover-lift"
            style={{
              borderRadius: 14,
              background: `linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--card) 100%)`,
              border: `1px solid ${C.borderLight}`,
              overflow: "hidden",
              boxShadow: C.shadow,
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  color: C.muted,
                  fontWeight: 600,
                  padding: "2px 8px",
                  background: "rgba(22,45,77,0.04)",
                  borderRadius: 5,
                }}
              >
                #{topic.id}
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.text,
                  flex: 1,
                  letterSpacing: "0.01em",
                }}
              >
                {topic.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: topic.color,
                  background: `linear-gradient(135deg, ${topic.color}15 0%, ${topic.color}08 100%)`,
                  border: `1px solid ${topic.color}40`,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                {topic.status}
              </span>
            </div>
            <div
              style={{
                padding: "14px 18px",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
                fontSize: 12,
              }}
            >
              <div>
                <div style={{ color: C.muted, marginBottom: 4, fontWeight: 600 }}>关联事件</div>
                <div style={{ fontWeight: 800, color: C.text, fontSize: 17, fontFamily: "JetBrains Mono, monospace" }}>
                  {topic.eventsTotal} 件
                </div>
              </div>
              <div>
                <div style={{ color: C.muted, marginBottom: 4, fontWeight: 600 }}>
                  近14天新增
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    color: topic.eventsRecent > 0 ? C.danger : C.success,
                    fontSize: 17,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {topic.eventsRecent} 件
                </div>
              </div>
              <div>
                <div style={{ color: C.muted, marginBottom: 4, fontWeight: 600 }}>复发间隔</div>
                <div style={{ fontWeight: 800, color: C.text, fontSize: 17, fontFamily: "JetBrains Mono, monospace" }}>
                  {topic.interval}
                </div>
              </div>
              <div>
                <div style={{ color: C.muted, marginBottom: 4, fontWeight: 600 }}>观察期</div>
                <div
                  style={{ fontWeight: 800, color: topic.color, fontSize: 17, fontFamily: "JetBrains Mono, monospace" }}
                >
                  {topic.observation}
                </div>
              </div>
            </div>
          </div>
        ))}
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
    <ChartQueryCtx.Provider
      value={{ queryingChart, onQuery: handleChartQuery }}
    >
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
              <span
                className="gradient-text"
                style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.02em" }}
              >
                AI 统计
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginLeft: 10,
                  fontWeight: 500,
                }}
              >
                全域治理数据洞察
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowInterpret(!showInterpret)}
            className="tech-btn-primary"
            style={{
              padding: "8px 18px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              boxShadow: showInterpret
                ? "0 0 22px rgba(50,109,255,0.55)"
                : undefined,
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
          <span
            style={{
              fontSize: 11,
              color: C.muted,
              flexShrink: 0,
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
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
                    boxShadow: active
                      ? "0 3px 12px rgba(50,109,255,0.32)"
                      : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <span
            style={{
              fontSize: 11,
              color: C.muted,
              flexShrink: 0,
              marginLeft: 4,
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
            空间
          </span>
          <select
            value={statSpace}
            onChange={(e) => handleSpaceChange(e.target.value)}
            className="stat-select"
            style={{
              minWidth: 120,
              padding: "6px 12px",
              borderRadius: 10,
              background: "var(--control-bg)",
            }}
          >
            <option>东城全区</option>
            {districtPolygons.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
          <span
            style={{
              fontSize: 11,
              color: C.muted,
              flexShrink: 0,
              marginLeft: 4,
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
            类型
          </span>
          <select
            value={statType}
            onChange={(e) => setStatType(e.target.value)}
            className="stat-select"
            style={{
              minWidth: 120,
              padding: "6px 12px",
              borderRadius: 10,
              background: "var(--control-bg)",
            }}
          >
            <option>全部类型</option>
            {statData.eventTypes.map((t) => (
              <option key={t.label}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Main */}
        <div
          style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
        >
          <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
            {activeCat === "overview" && (
              <OverviewCategory
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                availableLevels={availableLevels}
                skin={skin}
              />
            )}
            {activeCat === "events" && (
              <EventsCategory
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                availableLevels={availableLevels}
                skin={skin}
              />
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
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: C.primary }}
                >
                  AI 解读
                </span>
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
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      className="ai-bubble ai-bubble-primary"
                      style={{ borderRadius: 12 }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.primary,
                          marginBottom: 6,
                          letterSpacing: "0.04em",
                        }}
                      >
                        直接结论
                      </div>
                      <div
                        style={{ fontSize: 12, color: C.text, lineHeight: 1.75, fontWeight: 500 }}
                      >
                        {chartAnswer.conclusion}
                      </div>
                    </div>
                    <div
                      className="ai-bubble ai-bubble-soft"
                      style={{ borderRadius: 12 }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.text,
                          marginBottom: 6,
                          letterSpacing: "0.04em",
                        }}
                      >
                        数据直接证明
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          lineHeight: 1.75,
                          fontWeight: 500,
                        }}
                      >
                        {chartAnswer.evidence}
                      </div>
                    </div>
                    <div
                      className="ai-bubble ai-bubble-soft"
                      style={{ borderRadius: 12 }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.text,
                          marginBottom: 6,
                          letterSpacing: "0.04em",
                        }}
                      >
                        相关性线索（非因果）
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          lineHeight: 1.75,
                          fontWeight: 500,
                        }}
                      >
                        {chartAnswer.correlation}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: C.muted,
                          marginBottom: 8,
                          letterSpacing: "0.04em",
                        }}
                      >
                        下一步可问
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        {chartAnswer.followups.map((q) => (
                          <button
                            key={q}
                            onClick={() => setAiInput(q)}
                            className="followup-pill"
                          >
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
                    <span style={{ color: C.primary, fontWeight: 700 }}>
                      「问这张图」
                    </span>
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
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: chartAnswer ? 8 : 0,
                  }}
                >
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={
                      chartAnswer
                        ? `继续问「${chartAnswer.title}」或这一类…`
                        : "解读数据…"
                    }
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
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    问
                  </button>
                </div>
                {chartAnswer && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleChartQuery(chartAnswer.title)}
                      className="tech-btn-ghost"
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: 11,
                        color: C.primary,
                        borderRadius: 8,
                        fontWeight: 600,
                      }}
                    >
                      继续问这张图
                    </button>
                    <button
                      className="tech-btn-ghost"
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: 11,
                        color: C.muted,
                        borderRadius: 8,
                        fontWeight: 600,
                      }}
                    >
                      问这一类
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div
          className="glass"
          style={{
            padding: "8px 20px",
            borderTop: `1px solid ${C.borderLight}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 500, letterSpacing: "0.02em" }}>
            {statSpace} · {timeLabel} · {statType} ·{" "}
            {new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}{" "}
            {new Date().toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </ChartQueryCtx.Provider>
  )
}
