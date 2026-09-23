import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { chartTheme, resolveColor, type Skin } from "./echarts-theme"

const primary = "#326DFF"
const accent = "#24D6D2"

export default function EchartsLine({
  series,
  xAxis,
  height = 220,
  valueSuffix = "",
  skin,
}: {
  series: { name: string data: number[] color?: string dashed?: boolean }[]
  xAxis: string[]
  height?: number
  valueSuffix?: string
  skin?: Skin
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current)
    chartInstance.current = instance
    const th = chartTheme(skin)

    const palette = [
      primary,
      "#35B985",
      accent,
      "#FF7A42",
      "#E45E58",
      "#7568D8",
    ]

    const option: echarts.EChartsOption = {
      grid: { top: 28, right: 20, bottom: 38, left: 18, containLabel: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: th.tooltipText, fontSize: 12 },
        extraCssText: "box-shadow: 0 8px 24px rgba(0,0,0,0.18); border-radius: 10px;",
      },
      legend: {
        data: series.map((s) => s.name),
        bottom: 4,
        left: "center",
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 4,
        itemGap: 20,
        itemStyle: { borderRadius: 2 },
        textStyle: { color: th.label, fontSize: 11, fontWeight: 500 },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xAxis,
        axisLine: { lineStyle: { color: th.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: th.label, fontSize: 12, fontWeight: 500 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: th.splitLine, type: "dashed" } },
        axisLabel: { color: th.label, fontSize: 11 },
      },
      series: series.map((s, i) => {
        const color = resolveColor(s.color, palette[i % palette.length])
        return {
          name: s.name,
          data: s.data,
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: s.dashed ? 7 : 7,
          lineStyle: { width: 3, color, type: s.dashed ? "dashed" : "solid" },
          itemStyle: { color, borderWidth: 2, borderColor: th.markerBorder },
          emphasis: { scale: 1.6 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${color}35` },
              { offset: 1, color: `${color}08` },
            ]),
          },
        }
      }),
    }

    instance.setOption(option, true)

    const handleResize = () => instance.resize()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      instance.dispose()
    }
  }, [series, xAxis, valueSuffix, skin])

  return <div ref={chartRef} style={{ width: "100%", height }} />
}
