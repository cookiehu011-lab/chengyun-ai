// echarts canvas 主题工具：canvas 不认 CSS 变量，需解析为实际色值并按皮肤取整套图表用色
export type Skin = "light" | "tech"

export function resolveColor(c: string | undefined, fallback = "#326DFF"): string {
  if (!c) return fallback
  if (!c.startsWith("var(")) return c
  const name = c.slice(4, -1).trim()
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

export function resolveColors(list: string[] | undefined): string[] | undefined {
  return list?.map((c) => resolveColor(c))
}

export function chartTheme(skin?: Skin) {
  const tech = skin ? skin === "tech" : document.documentElement.getAttribute("data-skin") === "tech"
  return tech
    ? {
        tooltipBg: "rgba(16, 32, 58, 0.96)",
        tooltipBorder: "rgba(120, 165, 235, 0.35)",
        tooltipText: "#D8E6FA",
        axisLine: "rgba(120, 165, 235, 0.35)",
        splitLine: "rgba(120, 165, 235, 0.22)",
        label: "#9FB4D0",
        value: "#D8E6FA",
        markerBorder: "#12233E",
        bgRow: "rgba(120, 165, 235, 0.12)",
        shadow: "rgba(0, 0, 0, 0.45)",
        shadowSoft: "rgba(0, 0, 0, 0.30)",
        pieBorder: "rgba(10, 23, 48, 0.90)",
        graphicText: "#D8E6FA",
        graphicSub: "#8CA3BC",
        pctColor: "#7FA8FF",
        warn: "#FF9357",
      }
    : {
        tooltipBg: "rgba(255, 255, 255, 0.96)",
        tooltipBorder: "rgba(184, 216, 245, 0.65)",
        tooltipText: "#162D4D",
        axisLine: "rgba(184, 216, 245, 0.45)",
        splitLine: "rgba(184, 216, 245, 0.28)",
        label: "#6E8197",
        value: "#162D4D",
        markerBorder: "#FFFFFF",
        bgRow: "rgba(184, 216, 245, 0.18)",
        shadow: "rgba(22, 45, 77, 0.12)",
        shadowSoft: "rgba(22, 45, 77, 0.08)",
        pieBorder: "rgba(255, 255, 255, 0.85)",
        graphicText: "#162D4D",
        graphicSub: "#6E8197",
        pctColor: "#326DFF",
        warn: "#FF7A42",
      }
}
