import { Fragment } from "react"
import { SLOTS, WEEK, type PlaceSignature } from "../data/dongchengMapData"

const T = {
  bg: "#F3FAFF",
  card: "#FFFFFF",
  text: "#162D4D",
  muted: "#6E8197",
  primary: "#326DFF",
  accent: "#24D6D2",
  green: "#35B985",
  amber: "#FF7A42",
  red: "#E45E58",
  purple: "#7568D8",
  border: "#DDEDF8",
  shadow: "0 8px 24px rgba(22,45,77,0.07)",
}

function cellColor(v: number) {
  if (v < 0.2) return "rgba(50,109,255,0.10)"
  if (v < 0.4) return "rgba(50,109,255,0.28)"
  if (v < 0.65) return "rgba(255,122,66,0.45)"
  return "rgba(228,94,88,0.75)"
}

function Section({
  title,
  tag,
  icon,
  children,
}: {
  title: string
  tag?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        borderRadius: 14,
        overflow: "hidden",
        background: T.card,
        boxShadow: T.shadow,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "11px 14px",
          background: "linear-gradient(90deg, #EDF7FF 0%, #F3FAFF 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon && (
            <span style={{ display: "flex", color: T.primary }}>{icon}</span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
            {title}
          </span>
        </div>
        {tag && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.muted,
              background: "#FFFFFF",
              padding: "2px 7px",
              borderRadius: 10,
              boxShadow: "0 1px 2px rgba(22,45,77,0.06)",
            }}
          >
            {tag}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  color = T.primary,
}: {
  label: string
  value: React.ReactNode
  color?: string
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "12px 14px",
        background: T.card,
        boxShadow: T.shadow,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: color,
        }}
      />
      <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ marginTop: 6 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            color,
            fontFamily: "JetBrains Mono, monospace",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

export default function PlaceSignaturePanel({
  title,
  emerging,
  type,
  sig,
}: {
  title: string
  emerging: string
  type: string
  sig: PlaceSignature
}) {
  const delta =
    sig.weekNow > sig.weekBase
      ? `+${Math.round((sig.weekNow / sig.weekBase - 1) * 100)}%`
      : "持平"
  const isRising = sig.weekNow > sig.weekBase

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: T.bg,
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "14px 16px",
          background: "linear-gradient(135deg, #FFFFFF 0%, #F8FCFF 100%)",
          borderBottom: `1px solid ${T.border}`,
          boxShadow: "0 4px 12px rgba(22,45,77,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: T.accent,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="10" r="3" fill="currentColor" />
          </svg>
          地点签名
        </div>
        <div
          style={{
            marginTop: 5,
            fontSize: 17,
            fontWeight: 800,
            color: T.text,
            lineHeight: 1.35,
          }}
        >
          {title}
        </div>
        <div
          style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#FFFFFF",
              background: T.amber,
              padding: "3px 9px",
              borderRadius: 999,
            }}
          >
            {emerging}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: T.primary,
              background: "rgba(50,109,255,0.10)",
              padding: "3px 9px",
              borderRadius: 999,
            }}
          >
            {type}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="signature-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* AI insight */}
        <div
          style={{
            borderRadius: 14,
            padding: "16px 14px 16px 18px",
            background: "linear-gradient(135deg, #162D4D 0%, #1E3A66 100%)",
            boxShadow: "0 8px 24px rgba(22,45,77,0.18)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: "linear-gradient(90deg, #326DFF, #24D6D2)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              color: T.accent,
              letterSpacing: "0.06em",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            AI 规律判断
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              fontWeight: 750,
              color: "#FFFFFF",
              lineHeight: 1.55,
            }}
          >
            {sig.line}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.72)",
              lineHeight: 1.6,
              marginTop: 6,
            }}
          >
            {sig.why}
          </div>
        </div>

        {/* Week x Hour heat grid */}
        <Section
          title="星期 × 小时"
          tag="节律"
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        >
          <div
            style={{
              padding: 10,
              display: "grid",
              gridTemplateColumns: "24px repeat(6,1fr)",
              gap: 4,
            }}
          >
            <span />
            {SLOTS.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 9,
                  color: T.muted,
                  textAlign: "center",
                  fontWeight: 650,
                }}
              >
                {s}
              </span>
            ))}
            {WEEK.map((d, di) => (
              <Fragment key={d}>
                <span
                  style={{
                    fontSize: 9,
                    color: T.muted,
                    fontWeight: 650,
                    textAlign: "center",
                    alignSelf: "center",
                  }}
                >
                  {d}
                </span>
                {SLOTS.map((_, si) => {
                  const v = sig.punch(di, si)
                  return (
                    <span
                      key={`${d}-${si}`}
                      title={`${d}${SLOTS[si]}时 热度 ${(v * 100).toFixed(0)}%`}
                      style={{
                        height: 18,
                        borderRadius: 5,
                        background: cellColor(v),
                        cursor: "pointer",
                        transition: "transform 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "scale(1.12)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </Section>

        {/* Typical day bars */}
        <Section
          title="典型一日"
          tag="峰谷"
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        >
          <div style={{ padding: "10px 10px 8px", position: "relative" }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-end",
                gap: 1,
                height: 92,
                borderRadius: 6,
                background: "#F0F7FF",
                padding: "0 8px 0",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 8,
                  right: 8,
                  height: "100%",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "25%",
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "rgba(50,109,255,0.10)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "rgba(50,109,255,0.10)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "75%",
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "rgba(50,109,255,0.10)",
                  }}
                />
              </div>
              {sig.hour.map((v, i) => {
                const isPeak = v >= 0.8
                const h = 28 + v * 56
                return (
                  <span
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      height: "100%",
                      zIndex: 1,
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: "100%",
                        minWidth: 4,
                        height: `${h}px`,
                        borderRadius: "4px 4px 0 0",
                        background: isPeak ? "#FF7A42" : "#326DFF",
                        opacity: 1,
                      }}
                    />
                  </span>
                )
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
                fontSize: 9,
                color: T.muted,
              }}
            >
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </div>
        </Section>

        {/* Recurrence wave */}
        <Section
          title="结案后回潮"
          tag="近重复"
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        >
          <div style={{ padding: "10px 12px 10px" }}>
            <div
              style={{
                position: "relative",
                height: 60,
                borderRadius: 8,
                background:
                  "linear-gradient(180deg, rgba(50,109,255,0.04), rgba(36,214,210,0.04))",
                overflow: "hidden",
              }}
            >
              <svg
                viewBox="0 0 360 80"
                style={{ width: "100%", height: "100%", display: "block" }}
                preserveAspectRatio="none"
              >
                {(() => {
                  const w = 360,
                    h = 80
                  const baseline = h - 12
                  let d = `M 0 ${baseline}`
                  const peaks: { x: number y: number }[] = []
                  for (let i = 0; i < sig.waves; i++) {
                    const x0 = (i / sig.waves) * w
                    const x1 = ((i + 0.5) / sig.waves) * w
                    const x2 = ((i + 1) / sig.waves) * w
                    const peakY = 10 + (i % 3) * 8
                    d += ` C ${x0 + 24} ${baseline}, ${x1 - 18} ${peakY}, ${x1} ${peakY}`
                    d += ` C ${x1 + 18} ${peakY}, ${x2 - 24} ${baseline}, ${x2} ${baseline}`
                    peaks.push({ x: x1, y: peakY })
                  }
                  return (
                    <>
                      <defs>
                        <linearGradient
                          id="waveFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="rgba(50,109,255,0.28)" />
                          <stop
                            offset="100%"
                            stopColor="rgba(36,214,210,0.04)"
                          />
                        </linearGradient>
                      </defs>
                      <line
                        x1="0"
                        y1={baseline}
                        x2={w}
                        y2={baseline}
                        stroke="#DDEDF8"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <path
                        d={`${d} L ${w} ${h} L 0 ${h} Z`}
                        fill="url(#waveFill)"
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke="url(#waveStroke)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient
                          id="waveStroke"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#326DFF" />
                          <stop offset="100%" stopColor="#24D6D2" />
                        </linearGradient>
                      </defs>
                      {peaks.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r="3"
                          fill="#FFFFFF"
                          stroke="#326DFF"
                          strokeWidth="1.5"
                        />
                      ))}
                    </>
                  )
                })()}
              </svg>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <span style={{ fontSize: 12, color: T.muted }}>
                典型间隔{" "}
                <strong style={{ color: T.text, fontWeight: 700 }}>
                  {sig.interval}
                </strong>
              </span>
              <span style={{ fontSize: 12, color: T.muted }}>
                近 30 日成形{" "}
                <strong
                  style={{
                    color: T.primary,
                    fontWeight: 800,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {sig.waves}
                </strong>{" "}
                次
              </span>
            </div>
          </div>
        </Section>

        {/* Metrics */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <MetricCard label="本周强度" value={sig.weekNow} color={T.primary} />
          <MetricCard
            label="四周基线"
            value={delta}
            color={isRising ? T.red : T.green}
          />
        </div>

        {/* Currently watching */}
        <Section
          title="此刻仍在看"
          tag="识别中"
          icon={
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        >
          {sig.imgUrl && (
            <div
              style={{ height: 110, overflow: "hidden", position: "relative" }}
            >
              <img
                src={sig.imgUrl}
                alt=""
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
                  top: 8,
                  right: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "rgba(22,45,77,0.6)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span
                  className="pulse-dot"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: T.green,
                    display: "block",
                  }}
                />
                <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>
                  实时
                </span>
              </div>
            </div>
          )}
          <div style={{ padding: "10px 14px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 750, color: T.text }}>
              {type}仍在画面中
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: T.muted,
                lineHeight: 1.5,
              }}
            >
              同相机持续识别，不打开历史工单。
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
