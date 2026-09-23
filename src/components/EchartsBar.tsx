import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { chartTheme, resolveColor, type Skin } from "./echarts-theme"

const primary = "#326DFF"
const cyan = "#24D6D2"

export default function EchartsBar({
  data,
  xAxis,
  color = primary,
  height = 220,
  valueSuffix = "",
  showLabel = false,
  skin,
}: {
  data: number[]
  xAxis: string[]
  color?: string | string[]
  height?: number
  valueSuffix?: string
  showLabel?: boolean
  skin?: Skin
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current)
    chartInstance.current = instance
    const th = chartTheme(skin)

    const barColor = Array.isArray(color)
      ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: resolveColor(color[0]) },
          { offset: 1, color: resolveColor(color[1]) },
        ])
      : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: resolveColor(color) },
          { offset: 1, color: cyan },
        ])

    const option: echarts.EChartsOption = {
      grid: { top: 32, right: 16, bottom: 28, left: 16, containLabel: false },
      tooltip: {
        trigger: "axis",
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
        type: "category",
        data: xAxis,
        axisLine: { lineStyle: { color: th.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: th.label, fontSize: 11, fontWeight: 500 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: th.splitLine, type: "dashed" } },
        axisLabel: { color: th.label, fontSize: 11 },
      },
      series: [
        {
          data,
          type: "bar",
          barWidth: "36%",
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: barColor,
            shadowColor: "rgba(50,109,255,0.18)",
            shadowBlur: 8,
            shadowOffsetY: 3,
          },
          emphasis: {
            itemStyle: {
              shadowColor: "rgba(50,109,255,0.32)",
              shadowBlur: 14,
            },
          },
          label: {
            show: showLabel,
            position: "top",
            color: th.value,
            fontSize: 11,
            fontWeight: 700,
            formatter: `{c}${valueSuffix}`,
          },
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
  }, [data, xAxis, color, valueSuffix, showLabel, skin])

  return <div ref={chartRef} style={{ width: "100%", height }} />
}
