import { useEffect, useRef, useState } from "react"

// 颜色全部走 CSS 变量：科技皮肤（html[data-skin="tech"]）下自动切换深色玻璃
const T = {
  text: "var(--foreground)",
  textMuted: "var(--muted-foreground)",
  textSub: "var(--text-sub)",
  primary: "var(--primary)",
  purple: "var(--purple)",
  red: "var(--red)",
  amber: "var(--amber)",
  border: "var(--border)",
  shadow: "var(--glass-shadow)",
  mono: "JetBrains Mono, monospace",
}

interface CarouselEvent {
  id: string
  type: string
  level: string
  location: string
  street: string
  gridId: string
  gridName: string
  time: string
  status: string
  imgUrl: string
  desc: string
}

interface EventCarouselProps {
  events: CarouselEvent[]
  onSelect?: (street: string, gridId: string) => void
  autoPlay?: boolean
  interval?: number
  emptyText?: string
  /** 新事件接入中的事件 id：卡片红光脉冲 + 该事件挂 NEW 徽标 */
  arrivingId?: string | null
}

export default function EventCarousel({
  events,
  onSelect,
  autoPlay = true,
  interval = 5000,
  emptyText = "该范围/日期下暂无事件",
  arrivingId,
}: EventCarouselProps) {
  const [index, setIndex] = useState(0)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const safeEvents = events.length > 0 ? events : []
  const evt = safeEvents[index]

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoPlay && safeEvents.length > 1) {
      timerRef.current = setInterval(() => {
        setIndex((i) => (i + 1) % safeEvents.length)
      }, interval)
    }
  }

  useEffect(() => {
    setIndex(0)
    resetTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [events.length, autoPlay, interval])

  const goTo = (i: number) => {
    setIndex(((i % safeEvents.length) + safeEvents.length) % safeEvents.length)
    resetTimer()
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragStart(e.clientX)
    setDragOffset(0)
    if (containerRef.current)
      containerRef.current.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStart == null) return
    setDragOffset(e.clientX - dragStart)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStart == null) return
    const delta = e.clientX - dragStart
    if (delta < -40) goTo(index + 1)
    else if (delta > 40) goTo(index - 1)
    setDragStart(null)
    setDragOffset(0)
  }

  if (safeEvents.length === 0) {
    return (
      <div
        style={{
          border: `1px dashed ${T.border}`,
          borderRadius: 12,
          padding: 16,
          textAlign: "center",
          color: T.textMuted,
          fontSize: 12,
          background: "var(--control-bg)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {emptyText}
      </div>
    )
  }

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--glass-border)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "var(--glass-shadow)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        transition: "transform 0.25s ease",
        animation: arrivingId
          ? "event-arrive-flash 1.4s ease-out 3"
          : undefined,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)"
        e.currentTarget.style.boxShadow = "var(--glass-shadow-strong)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "var(--glass-shadow)"
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--row-bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
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
            AI 实时研判事件
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {arrivingId && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: "#fff",
                backgroundColor: "var(--red, #FF5A50)",
                padding: "2px 7px",
                borderRadius: 4,
                letterSpacing: "0.08em",
                animation:
                  "new-badge-pop 0.45s ease-out, new-badge-pulse 1.4s ease-out infinite",
              }}
            >
              新事件
            </span>
          )}
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
            {index + 1} / {safeEvents.length}
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1,
          overflow: "hidden",
          cursor: safeEvents.length > 1 ? "grab" : "default",
          touchAction: "pan-y",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            transform: `translateX(calc(-${index * 100}% + ${dragOffset}px))`,
            transition: dragStart == null ? "transform 0.25s ease" : "none",
            height: "100%",
          }}
        >
          {safeEvents.map((e) => (
            <div
              key={e.id}
              onClick={() => onSelect?.(e.street, e.gridId)}
              style={{
                minWidth: "100%",
                width: "100%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                cursor: onSelect ? "pointer" : "default",
              }}
            >
              <div
                style={{
                  height: 96,
                  position: "relative",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <img
                  src={e.imgUrl}
                  alt={e.type}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top,rgba(22,45,77,0.55) 0%,transparent 55%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 12,
                    display: "flex",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      background:
                        e.level === "严重"
                          ? `linear-gradient(135deg, ${T.red}, #FF7A70)`
                          : e.level === "较重"
                            ? `linear-gradient(135deg, ${T.amber}, #FFB347)`
                            : `linear-gradient(135deg, ${T.primary}, #5B8DFF)`,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 7px",
                      borderRadius: 5,
                      boxShadow: "0 4px 12px rgba(22,45,77,0.20)",
                    }}
                  >
                    {e.level}
                  </span>
                </div>
                {e.id === arrivingId && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 12,
                      animation: "new-badge-pop 0.45s ease-out",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "linear-gradient(135deg, #FF5A50, #FF8A70)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 999,
                        letterSpacing: "0.06em",
                        boxShadow: "0 4px 12px rgba(255,90,80,0.45)",
                        animation: "new-badge-pulse 1.4s ease-out infinite",
                      }}
                    >
                      <i
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          backgroundColor: "#fff",
                          display: "block",
                        }}
                      />
                      NEW
                    </span>
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: 12,
                    right: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.85)",
                      fontWeight: 500,
                    }}
                  >
                    {e.street} · {e.time}
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 12px" }}>
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
                      fontSize: 13,
                      fontWeight: 800,
                      color: T.text,
                    }}
                  >
                    {e.type}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: T.purple,
                      backgroundColor: "rgba(117,104,216,0.10)",
                      padding: "2px 7px",
                      borderRadius: 4,
                      border: "1px solid rgba(117,104,216,0.22)",
                      fontWeight: 600,
                    }}
                  >
                    {e.status}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textMuted,
                    lineHeight: 1.5,
                  }}
                >
                  {e.location}
                </div>
              </div>
            </div>
          ))}
        </div>

        {safeEvents.length > 1 && (
          <>
            <button
              onClick={() => goTo(index - 1)}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 26,
                height: 26,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.45)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.65)"
                e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.45)"
                e.currentTarget.style.transform = "translateY(-50%) scale(1)"
              }}
            >
              ‹
            </button>
            <button
              onClick={() => goTo(index + 1)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 26,
                height: 26,
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.45)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.65)"
                e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.45)"
                e.currentTarget.style.transform = "translateY(-50%) scale(1)"
              }}
            >
              ›
            </button>
          </>
        )}
      </div>

      {safeEvents.length > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 5,
            padding: "10px 0",
            borderTop: `1px solid ${T.border}`,
            background: "var(--row-bg)",
          }}
        >
          {safeEvents.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                border: "none",
                padding: 0,
                cursor: "pointer",
                backgroundColor:
                  i === index ? T.primary : "var(--primary-light)",
                transition: "all 0.2s ease",
                boxShadow: i === index ? `0 0 8px ${T.primary}` : "none",
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
