import { useRef, useState } from "react"
import { createPortal } from "react-dom"

// 治理大屏「算法口径」：按块拆分的规则文案。
// 来源：《2026-10-10-模块说明-治理大屏.md》，文字与文档保持同一段。
// 交互：鼠标悬停「算法」小圆标即弹出浮层说明（不展开、不挤压原页面），
// 移开即收起；同一时刻只读当前块的算法。
export interface DashRule {
  title: string
  lines: string[]
}

export const DASH_RULES: Record<string, DashRule> = {
  page: {
    title: "本页口径",
    lines: [
      "这一页只读。看的是识别事件落在哪里、现在办到哪一步。不在这里立案、派发、处置、核查、作废，也不把筛选结果写进待办。",
      "整页每一块数、每一个热力点，都同时满足两道过滤：数据范围——当前登录账号被配置的范围（全区，或若干街道，或若干网格）；事件类型——该账号负责的事件类型。范围外、类型外的识别事件不出现在三卡、脉冲、TOP 5、热力、回放和左下研判条里。SeeTime 账号先落在被授权的客户上，再按该账号的数据范围和事件类型过滤。",
      "点地图、下钻街道、切换热力样式、播放回放，都不改顶部三张卡。点地图、研判条、脉冲、TOP 5 都不离开大屏。",
      "没有已定位事件时，地图空态写「当前范围暂无已定位事件」，不铺示例热力。",
      "这一期没有时限。不展示临近超时、已超时、超时预警，也不用超时去算办结率。",
      "换账号或换数据范围、事件类型之后，整页重算。",
    ],
  },
  kpi: {
    title: "顶部三卡",
    lines: [
      "三张卡用当前账号的数据范围和事件类型，不随地图下钻变小。归日用识别事件的发现时间；测试事件没有发现时间时用创建时间。",
      "今日接入：发现时间落在当天的识别事件件数，一件识别记一件，不把「当日新建」理解成另建一条档案。没有识别事件时为 0；昨日为 0 时环比显示「—」。",
      "AI 自主发现：这一版来源几乎都是相机，比率还不能算，显示「—」。",
      "按期办结率：这一期没有时限，显示「—」。",
    ],
  },
  pulse: {
    title: "生命周期脉冲",
    lines: [
      "五格是此刻各状态上的识别事件件数，不是今日新增。范围和事件类型与整页相同。",
      "待立案 / 待处置 / 待核查 / 待作废审核：截止此刻、状态等于该格的识别事件数。",
      "已结案（今）：当天结案的识别事件件数，不含已作废、已无效。",
      "没有事件时该格为 0。这一期不在待立案、待处置、待核查旁边再标临近超时、超时、待外场的时限提示，待核查格只显示该状态的件数。",
    ],
  },
  top5: {
    title: "高发网格 TOP 5",
    lines: [
      "按网格汇总识别事件件数，从高到低取 5 个。已结案的识别事件计入，已作废、已无效不计入。",
      "件数：该网格在当前数据范围、当前事件类型内的识别事件件数，含已结案。",
      "±N：该网格今日识别事件件数 − 昨日识别事件件数，同一套范围和类型。",
      "范围内没有识别事件时榜为空。",
    ],
  },
  heat: {
    title: "地图热力",
    lines: [
      "热力点是识别事件里已经落到网格上的那些。1 件 = 1。匹配不到网格的不打点，不编造坐标。已结案的、已经定位的识别事件同样打点。",
      "发生数量：当前地图视野内、且落在账号数据范围和事件类型内的已定位识别事件件数。",
      "复发：这一期不出现这个入口，地图上也不再画复发。",
      "经典 / 高斯 / 3D：只改画法，不改件数。地图全屏：只放大地图，不改三卡、不改脉冲。",
      "下钻到街道或网格：只把地图收窄到该范围。三卡、脉冲、TOP 5 仍按账号的数据范围，不跟着下钻改小；下钻不能超出账号的数据范围。",
    ],
  },
  replay: {
    title: "底部回放",
    lines: [
      "回放的事件集合与热力相同：账号数据范围 + 事件类型内的已定位识别事件。",
      "14 日柱：每一柱是当天这批识别事件的相对多少，和地图用同一套强弱，不是另设一套件数轴。",
      "播放 / 点某一天：地图切到那一天的发生数量，三卡不变。",
      "明日预测：入口保留。这一期不算预测件数，柱上不写示例数字。",
    ],
  },
  strip: {
    title: "左下研判条",
    lines: [
      "轮播已经存在的识别事件：类型、地点、严重标签、当前状态。只展示落在账号数据范围和事件类型内的事件。",
      "不新建事件，不改状态。点击留在大屏。",
    ],
  },
}

const POPOVER_WIDTH = 400
const CLOSE_DELAY = 180

/** 「算法/规则」小圆标：悬停弹出该块的规则浮层（portal 渲染，不影响版面）。
 * rules 缺省用治理大屏 DASH_RULES，AI 实时治理等页面传入各自的规则表。 */
export function RuleChip({
  id,
  label = "算法",
  rules = DASH_RULES,
}: {
  id: string
  label?: string
  rules?: Record<string, DashRule>
}) {
  const rule = rules[id]
  const btnRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<number | null>(null)
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(
    null,
  )

  if (!rule) return null

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  const openPopover = () => {
    cancelClose()
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(
      8,
      Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8),
    )
    setAnchor({ left, top: r.bottom + 6 })
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setAnchor(null), CLOSE_DELAY)
  }
  const closeNow = () => {
    cancelClose()
    setAnchor(null)
  }

  const active = anchor !== null
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`${rule.title}算法口径`}
        title={`${rule.title} · 算法口径`}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onFocus={openPopover}
        onBlur={closeNow}
        onClick={(e) => {
          e.preventDefault()
          if (active) closeNow()
          else openPopover()
        }}
        style={{
          flexShrink: 0,
          height: 17,
          padding: "0 7px",
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.05em",
          borderRadius: 9,
          cursor: "pointer",
          border: `1px solid ${active ? "rgba(50,109,255,0.45)" : "var(--border)"}`,
          background: active ? "rgba(50,109,255,0.12)" : "transparent",
          color: active ? "var(--primary)" : "var(--muted-foreground)",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </button>
      {anchor &&
        createPortal(
          <div
            role="note"
            aria-label={`${rule.title}算法口径`}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            style={{
              position: "fixed",
              left: anchor.left,
              top: anchor.top,
              width: POPOVER_WIDTH,
              maxWidth: "calc(100vw - 16px)",
              zIndex: 10000,
              background: "var(--panel-solid)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              boxShadow: "0 12px 36px rgba(22,45,77,0.18)",
              padding: "10px 13px 11px",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "var(--primary)",
                letterSpacing: "0.05em",
                marginBottom: 4,
              }}
            >
              算法口径 · {rule.title}
            </div>
            {rule.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 7,
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                  lineHeight: 1.75,
                }}
              >
                <span style={{ flexShrink: 0, opacity: 0.55 }}>·</span>
                <span>{line}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
