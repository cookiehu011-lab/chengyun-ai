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
  border: "var(--control-border)",
  bgSoft: "var(--background-soft)",
}

const rankColors = [
  "linear-gradient(135deg, #E45E58 0%, #FF7A5C 100%)",
  "linear-gradient(135deg, #FF7A42 0%, #F5B04A 100%)",
  "linear-gradient(135deg, #326DFF 0%, #5B8DFF 100%)",
]

export default function RankList({
  data,
  max = 6,
}: {
  data: { rank: number; name: string; value: number }[]
  max?: number
}) {
  const top = data.slice(0, max)
  const maxValue = Math.max(...top.map((d) => d.value), 1)
  const total = top.reduce((sum, d) => sum + d.value, 0)

  return (
    <div style={{ padding: "6px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "48px 1fr 56px",
          gap: 12,
          alignItems: "center",
          fontSize: 11,
          color: C.muted,
          padding: "0 12px 10px",
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 10,
          fontWeight: 700,
          letterSpacing: "0.03em",
        }}
      >
        <span>排名</span>
        <span>相机编号</span>
        <span style={{ textAlign: "right" }}>次数</span>
      </div>
      {top.map((item, i) => {
        const pct = Math.round((item.value / total) * 100)
        const isTop = i < 3
        return (
          <div
            key={item.name}
            className="rank-row"
            style={{
              marginBottom: 6,
              padding: "10px 12px",
              background: isTop
                ? `linear-gradient(90deg, rgba(255,255,255,0.78) 0%, ${isTop ? (i === 0 ? "rgba(228,94,88,0.06)" : i === 1 ? "rgba(255,122,66,0.06)" : "rgba(50,109,255,0.06)") : "transparent"} 100%)`
                : undefined,
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: isTop ? "50%" : 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                color: isTop ? "#fff" : C.muted,
                background: isTop
                  ? rankColors[i]
                  : "linear-gradient(135deg, rgba(184,216,245,0.35) 0%, rgba(255,255,255,0.55) 100%)",
                fontFamily: "JetBrains Mono, monospace",
                boxShadow: isTop
                  ? `0 4px 12px ${i === 0 ? "rgba(228,94,88,0.35)" : i === 1 ? "rgba(255,122,66,0.35)" : "rgba(50,109,255,0.35)"}`
                  : "inset 0 1px 0 rgba(255,255,255,0.8)",
              }}
            >
              {item.rank}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 5,
                  letterSpacing: "0.01em",
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: "rgba(184,216,245,0.22)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.round((item.value / maxValue) * 100)}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: isTop
                      ? rankColors[i]
                      : "linear-gradient(90deg, #326DFF 0%, #24D6D2 100%)",
                    boxShadow: isTop ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: isTop ? C.text : C.muted,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{pct}%</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
