import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { chartTheme, resolveColor, type Skin } from "./echarts-theme"

const FOUND = "#326DFF"
const CLOSED = "#2E9B68"

/**
 * 发现与闭环：今日用两根柱，近 7 日 / 近 30 日 用双折线。
 * 每天为 0 也保留；不在点上铺件数标签。
 */
export default function EchartsDiscoverClose({
  labels,
  found,
  closed,
  mode,
  height = 200,
  axisLabelInterval,
  onItemClick,
  skin,
}: {
  labels: string[]
  found: number[]
  closed: number[]
  mode: "bar" | "line"
  height?: number
  axisLabelInterval?: number
  onItemClick?: (day: string, series: "发现" | "闭环", value: number) => void
  skin?: Skin
}) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current)
    const th = chartTheme(skin)
    const foundColor = resolveColor(FOUND)
    const closedColor = resolveColor(CLOSED)

    const isBar = mode === "bar"
    const series: echarts.SeriesOption[] = [
      {
        name: "发现",
        type: isBar ? "bar" : "line",
        data: found,
        barWidth: isBar ? 26 : undefined,
        itemStyle: { color: foundColor, borderRadius: isBar ? [6, 6, 0, 0] : 0 },
        lineStyle: isBar ? undefined : { width: 2.5, color: foundColor },
        symbol: isBar ? undefined : "circle",
        symbolSize: isBar ? undefined : 5,
        showSymbol: !isBar,
        smooth: false,
        areaStyle: isBar
          ? undefined
          : { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(50,109,255,0.14)" },
              { offset: 1, color: "rgba(50,109,255,0.00)" },
            ]) },
      },
      {
        name: "闭环",
        type: isBar ? "bar" : "line",
        data: closed,
        barWidth: isBar ? 26 : undefined,
        itemStyle: { color: closedColor, borderRadius: isBar ? [6, 6, 0, 0] : 0 },
        lineStyle: isBar ? undefined : { width: 2.5, color: closedColor },
        symbol: isBar ? undefined : "circle",
        symbolSize: isBar ? undefined : 5,
        showSymbol: !isBar,
        smooth: false,
        areaStyle: isBar
          ? undefined
          : { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(46,155,104,0.12)" },
              { offset: 1, color: "rgba(46,155,104,0.00)" },
            ]) },
      },
    ]

    const option: echarts.EChartsOption = {
      grid: { top: 34, right: 18, bottom: 26, left: 14, containLabel: false },
      legend: {
        top: 0,
        right: 0,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
        textStyle: { color: th.label, fontSize: 11, fontWeight: 600 },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: th.tooltipText, fontSize: 11.5 },
        extraCssText: "box-shadow: 0 8px 24px rgba(0,0,0,0.18); border-radius: 10px;",
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: isBar,
        axisLine: { lineStyle: { color: th.axisLine } },
        axisTick: { show: false },
        axisLabel: {
          color: th.label,
          fontSize: 10.5,
          fontWeight: 500,
          ...(axisLabelInterval !== undefined ? { interval: axisLabelInterval } : {}),
        },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: th.splitLine, type: "dashed" } },
        axisLabel: { color: th.label, fontSize: 10.5 },
      },
      series,
    }

    instance.setOption(option, true)

    const handleClick = (p: any) => {
      const name = String(p.name ?? "")
      const seriesName = String(p.seriesName ?? "")
      if ((seriesName === "发现" || seriesName === "闭环") && name) {
        onItemClick?.(name, seriesName, Number(p.value ?? 0))
      }
    }
    if (onItemClick) instance.on("click", handleClick)

    const handleResize = () => instance.resize()
    window.addEventListener("resize", handleResize)
    return () => {
      if (onItemClick) instance.off("click", handleClick)
      window.removeEventListener("resize", handleResize)
      instance.dispose()
    }
  }, [labels, found, closed, mode, axisLabelInterval, onItemClick, skin])

  return <div ref={chartRef} style={{ width: "100%", height }} />
}
