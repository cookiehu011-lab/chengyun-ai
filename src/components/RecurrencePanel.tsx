import { RECURRENCE_EVENTS, type RecurrenceEvent } from "../data/recurrenceData"
import { DAYS, type PlaceSignature } from "../data/dongchengMapData"

const DEFAULT_SIGNATURE: PlaceSignature = {
  line: "东城区占道类事件最易回潮，主要集中在商圈、地铁口与胡同口。",
  why: "晚高峰与周末时段，流动摊贩、店外经营、共享单车淤积反复出现，处置后短期复发概率高。",
  hour: [0.12, 0.15, 0.18, 0.22, 0.28, 0.35, 0.42, 0.5, 0.4, 0.3, 0.22, 0.15],
  punch: (d, si) =>
    0.12 + (si > 2 ? 0.18 : 0) + (d === 4 || d === 5 ? 0.25 : 0),
  weekNow: 12,
  weekBase: 10,
  interval: "4-7天",
  waves: 8,
}

const T = {
  bg: "#F3FAFF",
  card: "#FFFFFF",
  text: "#162D4D",
  muted: "#6E8197",
  primary: "#326DFF",
  accent: "#24D6D2",
  amber: "#FF7A42",
  red: "#E45E58",
  border: "#DDEDF8",
  shadow: "0 8px 24px rgba(22,45,77,0.07)",
  mono: "JetBrains Mono, monospace",
}

function FrameImage({ src, label }: { src: string label: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          position: "relative",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--grad-page)",
          border: `1px solid ${T.border}`,
          aspectRatio: "4/3",
        }}
      >
        <img
          src={src}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "4px 8px",
            background:
              "linear-gradient(to top, rgba(22,45,77,0.7), transparent)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

function RecurrenceCard({
  evt,
  selectedDate,
}: {
  evt: RecurrenceEvent
  selectedDate: string
}) {
  const isToday = selectedDate === DAYS[DAYS.length - 1]
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 12,
        boxShadow: T.shadow,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${T.border}`,
          background: "linear-gradient(90deg, #FFF8F5 0%, #FFFFFF 100%)",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: T.amber,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
          {evt.type} · 第{evt.recurrenceCount}次
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: T.amber,
            fontWeight: 700,
            background: "rgba(255,122,66,0.10)",
            padding: "2px 7px",
            borderRadius: 10,
          }}
        >
          {evt.intervalDays}天后又起
        </span>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
          {evt.street} · {evt.location} · 同一相机
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <FrameImage
            src={evt.beforeImage}
            label={`${evt.lastClosedDate} 结案`}
          />
          <FrameImage src={evt.afterImage} label={`${selectedDate} 又出现`} />
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(50,109,255,0.05)",
            fontSize: 11,
            color: T.text,
            lineHeight: 1.5,
          }}
        >
          上次{evt.disposition}，{evt.intervalDays}天后又起来
          {isToday ? "（今日回潮）" : "（当日回潮）"}
        </div>
      </div>
    </div>
  )
}

export default function RecurrencePanel({
  activeDistrict,
  activeGridId,
  dayIndex,
  sig,
  title,
  emerging,
  type,
}: {
  activeDistrict: string | null
  activeGridId: string | null
  dayIndex: number
  sig: PlaceSignature | null
  title: string
  emerging: string
  type: string
}) {
  const selectedDate = DAYS[dayIndex]
  const isToday = dayIndex === DAYS.length - 1
  const activeSig = sig ?? DEFAULT_SIGNATURE

  const filtered = RECURRENCE_EVENTS.filter((evt) => {
    if (evt.currentDate !== selectedDate) return false
    if (activeGridId && evt.gridId !== activeGridId) return false
    if (activeDistrict && evt.street !== activeDistrict) return false
    return true
  }).sort((a, b) => {
    if (b.recurrenceCount !== a.recurrenceCount)
      return b.recurrenceCount - a.recurrenceCount
    return a.intervalDays - b.intervalDays
  })

  const topStreets = !activeDistrict
    ? Array.from(
        new Map(
          filtered.map((e) => [
            e.street,
            {
              name: e.street,
              count: filtered.filter((x) => x.street === e.street).length,
            },
          ]),
        ).values(),
      ).sort((a, b) => b.count - a.count)
    : []

  const topGrids = activeDistrict
    ? Array.from(
        new Map(
          filtered.map((e) => [
            e.gridId,
            {
              name: e.gridName,
              count: filtered.filter((x) => x.gridId === e.gridId).length,
            },
          ]),
        ).values(),
      ).sort((a, b) => b.count - a.count)
    : []

  const locationLabel = activeGridId
    ? `${activeDistrict} · ${topGrids[0]?.name ?? ""}`
    : activeDistrict
      ? activeDistrict
      : "东城区"

  const timeLabel = isToday ? "当前" : `${selectedDate} · 当时`

  function judgmentText(): string {
    if (filtered.length === 0) {
      if (activeGridId)
        return `${selectedDate} 该网格无回潮记录，点位治理效果稳定。`
      if (activeDistrict)
        return `${selectedDate} ${activeDistrict.replace("街道", "")}无新增回潮，近期治理保持有效。`
      return `${selectedDate} 东城区全域无新增回潮，近30日复发态势平稳。`
    }

    const total = filtered.length
    const top = activeDistrict ? topGrids : topStreets
    const topNames = top
      .slice(0, 2)
      .map((t) => t.name.replace("网格", "").replace("街道", ""))

    if (activeGridId) {
      return `${selectedDate} 该点位出现 ${total} 组回潮，为近期高发点，建议加强巡控。`
    }

    if (activeDistrict) {
      return `${selectedDate} ${activeDistrict.replace("街道", "")}有 ${total} 处结案后又起来，主要集中在 ${topNames.join("、")}。`
    }

    return `${selectedDate} 东城区 ${total} 处结案后又起来，高热在东华门、朝阳门等街道，${topNames[0] ?? ""}最典型。`
  }

  const subtitle = activeGridId
    ? `该网格回潮两帧流，共 ${filtered.length} 组`
    : activeDistrict
      ? `该街道回潮两帧流，共 ${filtered.length} 组`
      : `全区回潮两帧流，共 ${filtered.length} 组`

  const emptyText = isToday ? "近30日无回潮" : `${selectedDate} 当日无回潮`

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div style={{ padding: "10px 12px 0" }}>
        <div
          style={{
            border: `1px solid ${T.border}`,
            background: T.card,
            borderRadius: 10,
            padding: 10,
            borderLeft: `3px solid ${T.amber}`,
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
                backgroundColor: T.amber,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: T.amber,
                letterSpacing: "0.06em",
              }}
            >
              复发口径 · AI 实时研判
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
            {locationLabel} · {timeLabel}
          </div>
          {topStreets.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {topStreets.slice(0, 5).map((s) => (
                <span
                  key={s.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 4,
                    backgroundColor: "rgba(255,122,66,0.08)",
                    border: `1px solid rgba(255,122,66,0.18)`,
                    color: T.text,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: T.amber,
                    }}
                  />
                  {s.name.replace("街道", "")}
                </span>
              ))}
            </div>
          )}
          {topGrids.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {topGrids.slice(0, 3).map((g) => (
                <span
                  key={g.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 4,
                    backgroundColor: "rgba(255,122,66,0.08)",
                    border: `1px solid rgba(255,122,66,0.18)`,
                    color: T.text,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: T.amber,
                    }}
                  />
                  {g.name.replace("网格", "")}
                </span>
              ))}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: T.muted,
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {judgmentText()}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 10, minHeight: 0 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: T.muted,
              fontSize: 12,
              border: `1px dashed ${T.border}`,
              borderRadius: 12,
              backgroundColor: T.card,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
            {emptyText}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((evt) => (
              <RecurrenceCard
                key={evt.id}
                evt={evt}
                selectedDate={selectedDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* 地点性格 — 贴栏底，不随播放头变化 */}
      {activeSig && (
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${T.border}`,
            background: T.card,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderBottom: `1px solid ${T.border}`,
              background: "linear-gradient(90deg, #EDF7FF 0%, #F3FAFF 100%)",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" fill={T.accent} />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>
              地点性格 · {title}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 700,
                color: "#FFFFFF",
                background: T.amber,
                padding: "2px 7px",
                borderRadius: 999,
              }}
            >
              {emerging}
            </span>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.text,
                lineHeight: 1.5,
              }}
            >
              {activeSig.line}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  padding: "6px 4px",
                  borderRadius: 8,
                  background: "#F0F7FF",
                }}
              >
                <div style={{ fontSize: 10, color: T.muted }}>典型间隔</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: T.primary,
                    fontFamily: T.mono,
                  }}
                >
                  {activeSig.interval}
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: "6px 4px",
                  borderRadius: 8,
                  background: "#F0F7FF",
                }}
              >
                <div style={{ fontSize: 10, color: T.muted }}>近30日成形</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: T.primary,
                    fontFamily: T.mono,
                  }}
                >
                  {activeSig.waves}次
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: "6px 4px",
                  borderRadius: 8,
                  background: "#F0F7FF",
                }}
              >
                <div style={{ fontSize: 10, color: T.muted }}>本周强度</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: T.primary,
                    fontFamily: T.mono,
                  }}
                >
                  {activeSig.weekNow}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
              {activeSig.why}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
