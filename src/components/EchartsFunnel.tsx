import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { chartTheme, resolveColor, type Skin } from "./echarts-theme"

export default function EchartsFunnel({
  data,
  height = 220,
  valueSuffix = "",
  showPercent = true,
  colors,
  skin,
}: {
  data: { name: string value: number color?: string }[]
  height?: number
  valueSuffix?: string
  showPercent?: boolean
  colors?: string[]
  skin?: Skin
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current)
    chartInstance.current = instance
    const th = chartTheme(skin)

    const total = data.reduce((sum, d) => sum + d.value, 0)
    const palette = (colors || [
      "#326DFF",
      "#24D6D2",
      "#35B985",
      "#FF7A42",
      "#E45E58",
      "#7568D8",
      "#9AA4B2",
    ]).map((c) => resolveColor(c))

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "item",
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: th.tooltipText, fontSize: 12 },
        extraCssText: "box-shadow: 0 8px 24px rgba(0,0,0,0.18); border-radius: 10px;",
        formatter: (params: any) => {
          const pct = total ? Math.round((params.value / total) * 100) : 0
          return `<div style="font-weight:700;margin-bottom:4px;color:${th.tooltipText}">${params.name}</div><div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span>${params.value}${valueSuffix} (${pct}%)</div>`
        },
      },
      color: palette,
      series: [
        {
          type: "funnel",
          left: "8%",
          right: "30%",
          top: 10,
          bottom: 10,
          minSize: "28%",
          maxSize: "100%",
          sort: "descending",
          gap: 4,
          label: {
            show: true,
            position: "inside",
            formatter: showPercent
              ? (params: any) =>
                  `{name|${params.name}}\n{val|${params.value}${valueSuffix}}`
              : (params: any) => params.name,
            rich: {
              name: {
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                textShadowColor: "rgba(0,0,0,0.18)",
                textShadowBlur: 2,
              },
              val: {
                color: "rgba(255,255,255,0.92)",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "JetBrains Mono, monospace",
              },
            },
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: th.pieBorder,
            borderWidth: 1.5,
            borderRadius: 8,
            shadowColor: th.shadowSoft,
            shadowBlur: 10,
            shadowOffsetY: 5,
          },
          emphasis: {
            label: { fontSize: 13 },
            itemStyle: {
              shadowBlur: 18,
              shadowColor: th.shadow,
            },
          },
          data: data.map((d, i) => {
            const color = resolveColor(d.color) || palette[i % palette.length]
            return {
              name: d.name,
              value: d.value,
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color },
                  { offset: 1, color: `${color}CC` },
                ]),
              },
            }
          }),
        },
      ],
      graphic: data.map((d, i) => {
        const pct = total ? Math.round((d.value / total) * 100) : 0
        return {
          type: "text",
          left: "74%",
          top: `${18 + i * 16}%`,
          style: {
            text: `{name|${d.name}}  {pct|${pct}%}`,
            textAlign: "left",
            fill: th.graphicText,
            fontSize: 12,
            rich: {
              name: { fill: th.graphicText, fontSize: 12, fontWeight: 500 },
              pct: {
                fill: th.pctColor,
                fontWeight: 700,
                fontFamily: "JetBrains Mono, monospace",
              },
            },
          },
        }
      }),
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
  }, [data, valueSuffix, showPercent, colors, skin])

  return <div ref={chartRef} style={{ width: "100%", height }} />
}
