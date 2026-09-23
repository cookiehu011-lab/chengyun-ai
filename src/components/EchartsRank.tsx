import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { chartTheme, resolveColor, type Skin } from "./echarts-theme"

const palette = [
  "#326DFF",
  "#35B985",
  "#FF7A42",
  "#E45E58",
  "#7568D8",
  "#24D6D2",
  "#9AA4B2",
]

type Threshold = { max?: number color: string }

export default function EchartsRank({
  data,
  height = 220,
  valueSuffix = "",
  colorize = false,
  colors,
  thresholds,
  warningThreshold,
  sort = true,
  skin,
}: {
  data: { name: string value: number color?: string }[]
  height?: number
  valueSuffix?: string
  colorize?: boolean
  colors?: string[]
  thresholds?: Threshold[]
  warningThreshold?: number
  sort?: boolean
  skin?: Skin
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  const getThresholdColor = (value: number) => {
    if (!thresholds) return undefined
    for (const t of thresholds) {
      if (t.max === undefined || value <= t.max) return resolveColor(t.color)
    }
    return resolveColor(thresholds[thresholds.length - 1]?.color)
  }

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current)
    chartInstance.current = instance
    const th = chartTheme(skin)

    const sorted = sort
      ? [...data].sort((a, b) => a.value - b.value)
      : [...data]
    const max = Math.max(...data.map((d) => d.value), 1)
    const effectiveColors = (colors || palette).map((c) => resolveColor(c))

    const option: echarts.EChartsOption = {
      grid: { top: 10, right: 74, bottom: 10, left: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: th.tooltipText, fontSize: 12 },
        extraCssText: "box-shadow: 0 8px 24px rgba(0,0,0,0.18); border-radius: 10px;",
        formatter: (params: any) =>
          `<div style="font-weight:700;margin-bottom:4px;color:${th.tooltipText}">${params[0].name}</div><div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params[0].color}"></span>${params[0].value}${valueSuffix}</div>`,
      },
      xAxis: {
        type: "value",
        show: false,
        max,
      },
      yAxis: {
        type: "category",
        data: sorted.map((d) => d.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: th.value, fontSize: 12, margin: 10, fontWeight: 500 },
      },
      series: [
        {
          data: sorted.map((d, i) => {
            const explicit =
              resolveColor(d.color) ||
              getThresholdColor(d.value) ||
              (colorize
                ? effectiveColors[i % effectiveColors.length]
                : undefined)
            const warn =
              warningThreshold !== undefined && d.value <= warningThreshold
            const color = explicit
              ? explicit
              : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: "#326DFF" },
                  { offset: 1, color: "#5B8DFF" },
                ])
            const shadowBase =
              typeof explicit === "string" ? explicit : "#326DFF"
            return {
              value: d.value,
              itemStyle: {
                borderRadius: [0, 8, 8, 0],
                color,
                shadowColor: `${shadowBase}35`,
                shadowBlur: 8,
                shadowOffsetY: 3,
              },
              label: {
                show: true,
                position: "right",
                color: warn ? th.warn : th.value,
                fontSize: 13,
                fontWeight: 700,
                formatter: warn
                  ? `{c}${valueSuffix} {warn|▲}`
                  : `{c}${valueSuffix}`,
                rich: {
                  warn: {
                    color: th.warn,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: [0, 0, 0, 4],
                  },
                },
              },
            }
          }),
          type: "bar",
          barWidth: 14,
          barGap: "30%",
          showBackground: true,
          backgroundStyle: { color: th.bgRow, borderRadius: [0, 6, 6, 0] },
        },
      ],
    }

    instance.setOption(option, true)

    const handleResize = () => instance.resize()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      instance.dispose()
    }
  }, [data, valueSuffix, colorize, colors, thresholds, warningThreshold, sort, skin])

  return <div ref={chartRef} style={{ width: "100%", height }} />
}
