const stagePalette = ["#2F6BFF", "#24D6D2", "#2E9B68", "#7967D8", "#D98A20"]

export default function StageLifecycle({
  data,
}: {
  data: { name: string value: number }[]
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div style={{ padding: "8px 4px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
        }}
      >
        {data.map((d, i) => {
          const color = stagePalette[i % stagePalette.length]
          const isLast = i === data.length - 1
          return (
            <div
              key={d.name}
              style={{ flex: 1, display: "flex", alignItems: "center" }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: "#fff",
                  border: `1px solid ${color}40`,
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                  boxShadow: `0 2px 8px ${color}14`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#6E8197",
                    marginBottom: 6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {d.name}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color,
                    fontFamily: "JetBrains Mono, monospace",
                    lineHeight: 1,
                  }}
                >
                  {d.value}
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#F3F7FC",
                    marginTop: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round((d.value / max) * 100)}%`,
                      height: "100%",
                      backgroundColor: color,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
              {!isLast && (
                <div
                  style={{
                    width: 16,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#B8D8F5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div
        style={{
          marginTop: 10,
          textAlign: "center",
          fontSize: 11,
          color: "#6E8197",
        }}
      >
        全阶段合计{" "}
        <span
          style={{
            color: "#162D4D",
            fontWeight: 700,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {total}
        </span>{" "}
        件
      </div>
    </div>
  )
}
