import { useEffect, useRef, useMemo } from "react"
import * as echarts from "echarts"
import { chartTheme, resolveColor, resolveColors, type Skin } from "./echarts-theme"

const palette = [
  "#326DFF",
  "#35B985",
  "#FF7A42",
  "#E45E58",
  "#7568D8",
  "#24D6D2",
  "#9AA4B2",
]

export default function EchartsPie({
  data,
  height = 220,
  centerText,
  centerSub,
  colors,
  skin,
}: {
  data: { name?: string label?: string value: number color?: string }[]
  height?: number
  centerText?: string
  centerSub?: string
  colors?: string[]
  skin?: Skin
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])
  const effectiveColors = (colors || palette).map((c) => resolveColor(c))

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current)
    chartInstance.current = instance
    const th = chartTheme(skin)

    const option: echarts.EChartsOption = {
      color: effectiveColors,
      tooltip: {
        trigger: "item",
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: th.tooltipText, fontSize: 12 },
        extraCssText: "box-shadow: 0 8px 24px rgba(0,0,0,0.18); border-radius: 10px;",
        formatter: (params: any) =>
          `<div style="font-weight:700;margin-bottom:4px;color:${th.tooltipText}">${params.name}</div><div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span>${params.value} (${params.percent}%)</div>`,
      },
      series: [
        {
          type: "pie",
          radius: ["52%", "82%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: th.pieBorder,
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: { show: false },
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 16,
              shadowOffsetY: 4,
              shadowColor: th.shadow,
            },
          },
          data: data.map((d) => ({
            ...d,
            name: d.name || d.label || "",
            itemStyle: d.color ? { color: resolveColor(d.color) } : undefined,
          })),
        },
      ],
      graphic:
        centerText !== undefined
          ? [
              {
                type: "text",
                left: "center",
                top: "44%",
                style: {
                  text: centerText,
                  textAlign: "center",
                  fill: th.graphicText,
                  fontSize: 24,
                  fontWeight: 800,
                  fontFamily: "JetBrains Mono, monospace",
                },
              },
              {
                type: "text",
                left: "center",
                top: "56%",
                style: {
                  text: centerSub ?? "总计",
                  textAlign: "center",
                  fill: th.graphicSub,
                  fontSize: 11,
                  fontWeight: 600,
                },
              },
            ]
          : undefined,
    }

    instance.setOption(option, true)

    const resize = () => instance.resize()
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(chartRef.current)
    window.addEventListener("resize", resize)
    return () => {
      window.removeEventListener("resize", resize)
      ro.disconnect()
      instance.dispose()
    }
  }, [data, centerText, centerSub, colors, effectiveColors, skin])

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height,
      }}
    >
      <div ref={chartRef} style={{ flex: 1, height: "100%", minWidth: 0 }} />
      <div
        style={{
          width: 130,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 10,
          paddingRight: 4,
        }}
      >
        {data.map((d, i) => {
          const name = d.name || d.label || ""
          const color = resolveColor(d.color) || effectiveColors[i % effectiveColors.length]
          const pct = total ? Math.round((d.value / total) * 100) : 0
          return (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                padding: "4px 6px",
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: color,
                  flexShrink: 0,
                  boxShadow: `0 2px 6px ${color}50`,
                }}
              />
              <span
                style={{
                  color: "var(--foreground)",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                }}
                title={name}
              >
                {name}
              </span>
              <span
                style={{
                  color: "var(--foreground)",
                  fontWeight: 700,
                  fontFamily: "JetBrains Mono, monospace",
                  flexShrink: 0,
                }}
              >
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
