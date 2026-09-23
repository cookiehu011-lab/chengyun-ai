/** Geographic tessellation of Dongcheng's 17 streets, mapped from the
 *  existing schematic layout onto real WGS84 bounds. Good enough for
 *  a light basemap overlay — not cadastral. */

import { assetUrl } from "../assetUrl"

export const DAYS = [
  "8/05",
  "8/06",
  "8/07",
  "8/08",
  "8/09",
  "8/10",
  "8/11",
  "8/12",
  "8/13",
  "8/14",
  "8/15",
  "8/16",
  "8/17",
  "8/18",
]
export const DAY_HEAT = [
  0.42, 0.38, 0.55, 0.62, 0.48, 0.44, 0.92, 0.4, 0.46, 0.58, 0.66, 0.52, 0.88,
  1,
]
/** 明日 AI 预测（走势外推，仅供预测视图，非实测值） */
export const TOMORROW_LABEL = "8/19"
export const TOMORROW_HEAT = 0.74
/** 回放轴：历史14日 + 今日 + 明日预测 */
export const PLAY_DAYS = [...DAYS, TOMORROW_LABEL]
export const PLAY_HEAT = [...DAY_HEAT, TOMORROW_HEAT]
export const PREDICT_INDEX = PLAY_DAYS.length - 1

/** 明日事件预测明细（AI 走势外推演示数据） */
export const FORECAST_TOTAL = 14
export const STREET_FORECAST: Record<string, number> = {
  朝阳门街道: 4,
  东直门街道: 3,
  安定门街道: 3,
  东华门街道: 2,
  前门街道: 2,
}
export const WEEK = ["一", "二", "三", "四", "五", "六", "日"]
export const SLOTS = ["6", "9", "12", "15", "18", "21"]

const SVG_MIN_X = 18,
  SVG_MAX_X = 274,
  SVG_MIN_Y = 6,
  SVG_MAX_Y = 490
const LNG_MIN = 116.383,
  LNG_MAX = 116.449
const LAT_MAX = 39.972,
  LAT_MIN = 39.856

export function xyToLngLat(x: number, y: number): [number, number] {
  const lng =
    LNG_MIN + ((x - SVG_MIN_X) / (SVG_MAX_X - SVG_MIN_X)) * (LNG_MAX - LNG_MIN)
  const lat =
    LAT_MAX - ((y - SVG_MIN_Y) / (SVG_MAX_Y - SVG_MIN_Y)) * (LAT_MAX - LAT_MIN)
  return [lng, lat]
}

function ringFromPts(pts: string): [number, number][] {
  const coords = pts
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => {
      const [x, y] = p.split(",").map(Number)
      return xyToLngLat(x, y)
    })
  coords.push(coords[0])
  return coords
}

function centroid(ring: [number, number][]): [number, number] {
  const pts = ring.slice(0, -1)
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return [lng, lat]
}

export type HeatMetric = "severe" | "repeat"

export interface StreetDef {
  id: string
  name: string
  events: number
  severe: number
  repeat: number
  emerging: string
  type: string
  ring: [number, number][]
  center: [number, number]
}

const STREET_SRC: Array<Omit<StreetDef, "ring" | "center"> & { pts: string }> =
  [
    {
      id: "hepingli",
      name: "和平里街道",
      pts: "48,6 228,6 228,68 48,68",
      events: 15,
      severe: 0.22,
      repeat: 0.14,
      emerging: "偶发",
      type: "暴露垃圾",
    },
    {
      id: "dongzhimen",
      name: "东直门街道",
      pts: "228,6 274,6 274,150 228,150",
      events: 38,
      severe: 0.72,
      repeat: 0.38,
      emerging: "持续",
      type: "大型垃圾堆积",
    },
    {
      id: "andingmen",
      name: "安定门街道",
      pts: "48,68 148,68 148,128 48,128",
      events: 22,
      severe: 0.48,
      repeat: 0.36,
      emerging: "持续",
      type: "施工占道",
    },
    {
      id: "beixinqiao",
      name: "北新桥街道",
      pts: "148,68 228,68 228,150 148,150",
      events: 24,
      severe: 0.78,
      repeat: 0.7,
      emerging: "持续高发",
      type: "共享单车占道",
    },
    {
      id: "jiaodaokou",
      name: "交道口街道",
      pts: "48,128 110,128 110,178 48,178",
      events: 18,
      severe: 0.36,
      repeat: 0.22,
      emerging: "偶发",
      type: "占道经营",
    },
    {
      id: "jingshan",
      name: "景山街道",
      pts: "18,178 110,178 110,272 18,272",
      events: 11,
      severe: 0.18,
      repeat: 0.12,
      emerging: "偶发",
      type: "暴露垃圾",
    },
    {
      id: "dongsi",
      name: "东四街道",
      pts: "110,128 228,128 228,238 110,238",
      events: 31,
      severe: 0.64,
      repeat: 0.4,
      emerging: "持续",
      type: "无证户外广告",
    },
    {
      id: "chaoyangmen",
      name: "朝阳门街道",
      pts: "228,150 274,150 274,238 228,238",
      events: 47,
      severe: 0.94,
      repeat: 0.74,
      emerging: "新热点",
      type: "施工占道",
    },
    {
      id: "donghuamen",
      name: "东华门街道",
      pts: "18,272 122,272 122,335 18,335",
      events: 19,
      severe: 0.88,
      repeat: 0.86,
      emerging: "持续加剧",
      type: "占道经营",
    },
    {
      id: "jianguomen",
      name: "建国门街道",
      pts: "122,238 274,238 274,310 122,310",
      events: 29,
      severe: 0.58,
      repeat: 0.28,
      emerging: "持续",
      type: "无证户外广告",
    },
    {
      id: "qianmen",
      name: "前门街道",
      pts: "18,335 108,335 108,402 18,402",
      events: 16,
      severe: 0.3,
      repeat: 0.2,
      emerging: "偶发",
      type: "占道经营",
    },
    {
      id: "chongwen",
      name: "崇文门外街道",
      pts: "108,310 192,310 192,382 108,382",
      events: 22,
      severe: 0.44,
      repeat: 0.32,
      emerging: "持续",
      type: "暴露垃圾",
    },
    {
      id: "donghuashi",
      name: "东花市街道",
      pts: "192,310 274,310 274,382 192,382",
      events: 25,
      severe: 0.5,
      repeat: 0.34,
      emerging: "持续",
      type: "施工占道",
    },
    {
      id: "tiyuguan",
      name: "体育馆路街道",
      pts: "70,382 192,382 192,450 70,450",
      events: 14,
      severe: 0.26,
      repeat: 0.16,
      emerging: "偶发",
      type: "暴露垃圾",
    },
    {
      id: "longtan",
      name: "龙潭街道",
      pts: "192,382 274,382 274,450 192,450",
      events: 18,
      severe: 0.34,
      repeat: 0.22,
      emerging: "偶发",
      type: "疑似堆物",
    },
    {
      id: "tiantan",
      name: "天坛街道",
      pts: "18,402 70,402 70,450 18,450",
      events: 12,
      severe: 0.16,
      repeat: 0.1,
      emerging: "偶发",
      type: "暴露垃圾",
    },
    {
      id: "yongdingmen",
      name: "永定门外街道",
      pts: "18,450 274,450 274,490 18,490",
      events: 8,
      severe: 0.12,
      repeat: 0.08,
      emerging: "偶发",
      type: "暴露垃圾",
    },
  ]

export const STREETS: StreetDef[] = STREET_SRC.map((s) => {
  const ring = ringFromPts(s.pts)
  return { ...s, ring, center: centroid(ring) }
})

export interface GridDef {
  id: string
  streetId: string
  name: string
  alley: string
  events: number
  severe: number
  repeat: number
  emerging: string
  type: string
  watch: boolean
  ring: [number, number][]
  center: [number, number]
}

const GRID_SRC: Array<Omit<GridDef, "ring" | "center"> & {
  x: number
  y: number
  w: number
  h: number
}> = [
  {
    id: "A11",
    streetId: "donghuamen",
    name: "网格A11",
    alley: "东华门大街",
    x: 22,
    y: 276,
    w: 48,
    h: 28,
    events: 9,
    severe: 0.96,
    repeat: 0.92,
    emerging: "持续加剧",
    type: "占道经营",
    watch: true,
  },
  {
    id: "A12",
    streetId: "donghuamen",
    name: "网格A12",
    alley: "金鱼胡同",
    x: 72,
    y: 276,
    w: 48,
    h: 28,
    events: 6,
    severe: 0.58,
    repeat: 0.44,
    emerging: "持续",
    type: "占道经营",
    watch: false,
  },
  {
    id: "A02",
    streetId: "donghuamen",
    name: "网格A02",
    alley: "东厂胡同",
    x: 22,
    y: 306,
    w: 48,
    h: 26,
    events: 3,
    severe: 0.34,
    repeat: 0.22,
    emerging: "偶发",
    type: "疑似堆物",
    watch: true,
  },
  {
    id: "A08",
    streetId: "donghuamen",
    name: "网格A08",
    alley: "南池子大街",
    x: 72,
    y: 306,
    w: 48,
    h: 26,
    events: 2,
    severe: 0.28,
    repeat: 0.18,
    emerging: "偶发",
    type: "暴露垃圾",
    watch: false,
  },
  {
    id: "B03",
    streetId: "beixinqiao",
    name: "网格B03",
    alley: "北新桥三条",
    x: 150,
    y: 72,
    w: 38,
    h: 38,
    events: 8,
    severe: 0.82,
    repeat: 0.76,
    emerging: "持续高发",
    type: "共享单车占道",
    watch: true,
  },
  {
    id: "B05",
    streetId: "beixinqiao",
    name: "网格B05",
    alley: "北新桥头条",
    x: 190,
    y: 72,
    w: 36,
    h: 38,
    events: 6,
    severe: 0.64,
    repeat: 0.58,
    emerging: "持续",
    type: "共享单车占道",
    watch: false,
  },
  {
    id: "B08",
    streetId: "beixinqiao",
    name: "网格B08",
    alley: "民安街",
    x: 150,
    y: 112,
    w: 76,
    h: 34,
    events: 5,
    severe: 0.46,
    repeat: 0.4,
    emerging: "持续",
    type: "占道经营",
    watch: false,
  },
  {
    id: "C07",
    streetId: "chaoyangmen",
    name: "网格C07",
    alley: "朝阳门内大街",
    x: 230,
    y: 154,
    w: 42,
    h: 40,
    events: 12,
    severe: 0.9,
    repeat: 0.8,
    emerging: "新热点",
    type: "施工占道",
    watch: true,
  },
  {
    id: "C02",
    streetId: "chaoyangmen",
    name: "网格C02",
    alley: "朝阳门南小街",
    x: 230,
    y: 196,
    w: 42,
    h: 40,
    events: 11,
    severe: 0.7,
    repeat: 0.36,
    emerging: "持续",
    type: "违规占道施工",
    watch: false,
  },
  {
    id: "D01",
    streetId: "dongzhimen",
    name: "网格D01",
    alley: "东直门内大街",
    x: 230,
    y: 10,
    w: 42,
    h: 68,
    events: 10,
    severe: 0.76,
    repeat: 0.4,
    emerging: "持续",
    type: "大型垃圾堆积",
    watch: true,
  },
  {
    id: "D02",
    streetId: "dongzhimen",
    name: "网格D02",
    alley: "东直门南小街",
    x: 230,
    y: 80,
    w: 42,
    h: 66,
    events: 8,
    severe: 0.52,
    repeat: 0.28,
    emerging: "偶发",
    type: "疑似堆物",
    watch: false,
  },
  {
    id: "E01",
    streetId: "dongsi",
    name: "网格E01",
    alley: "东四十条",
    x: 112,
    y: 132,
    w: 56,
    h: 50,
    events: 7,
    severe: 0.68,
    repeat: 0.42,
    emerging: "持续",
    type: "无证户外广告",
    watch: false,
  },
  {
    id: "E02",
    streetId: "dongsi",
    name: "网格E02",
    alley: "朝阳门北小街",
    x: 170,
    y: 132,
    w: 56,
    h: 50,
    events: 6,
    severe: 0.5,
    repeat: 0.3,
    emerging: "持续",
    type: "占道经营",
    watch: false,
  },
  {
    id: "J01",
    streetId: "jianguomen",
    name: "网格J01",
    alley: "建国门内大街",
    x: 124,
    y: 242,
    w: 148,
    h: 32,
    events: 9,
    severe: 0.62,
    repeat: 0.3,
    emerging: "持续",
    type: "无证户外广告",
    watch: false,
  },
  {
    id: "J02",
    streetId: "jianguomen",
    name: "网格J02",
    alley: "建内大街南",
    x: 124,
    y: 276,
    w: 148,
    h: 32,
    events: 7,
    severe: 0.4,
    repeat: 0.22,
    emerging: "偶发",
    type: "施工占道",
    watch: false,
  },
]

export const GRIDS: GridDef[] = GRID_SRC.map((g) => {
  const ring = ringFromPts(
    `${g.x},${g.y} ${g.x + g.w},${g.y} ${g.x + g.w},${g.y + g.h} ${g.x},${g.y + g.h}`,
  )
  return { ...g, ring, center: centroid(ring) }
})

export const AI_FOCUS = ["chaoyangmen", "dongzhimen", "jianguomen"] as const

export const TOP_GRIDS = [
  {
    grid: "C02",
    streetId: "chaoyangmen",
    name: "朝阳门南小街网格",
    tag: "新热点",
    count: 23,
    trend: "+5",
  },
  {
    grid: "D01",
    streetId: "dongzhimen",
    name: "东直门内大街网格",
    tag: "持续",
    count: 19,
    trend: "+2",
  },
  {
    grid: "J01",
    streetId: "jianguomen",
    name: "建国门内大街网格",
    tag: "持续",
    count: 16,
    trend: "-1",
  },
  {
    grid: "B03",
    streetId: "beixinqiao",
    name: "北新桥三条网格",
    tag: "持续高发",
    count: 14,
    trend: "+3",
  },
  {
    grid: "E01",
    streetId: "dongsi",
    name: "东四十条网格",
    tag: "持续",
    count: 11,
    trend: "0",
  },
]

export interface PlaceSignature {
  line: string
  why: string
  hour: number[]
  punch: (d: number, s: number) => number
  weekNow: number
  weekBase: number
  interval: string
  waves: number
  imgUrl?: string
}

export const SIGNATURES: Record<string, PlaceSignature> = {
  A11: {
    line: "周五 16–18 点，占道经营在此网格反复成形。",
    why: "同相机 C-A11-03，结案后 3–5 天回潮。这是这块地的时间指纹，不是旧工单列表。",
    hour: [0.12, 0.1, 0.18, 0.22, 0.28, 0.4, 0.72, 1, 0.86, 0.48, 0.22, 0.14],
    punch: (d, s) => {
      let v = 0.08
      if (d <= 4 && s >= 2) v = 0.22
      if (d === 4 && (s === 3 || s === 4)) v = 1
      if (d === 5 && s === 3) v = 0.56
      return v
    },
    weekNow: 14,
    weekBase: 8,
    interval: "3–5 天",
    waves: 4,
    imgUrl: assetUrl("/placeholders/scene-generic.svg"),
  },
  B03: {
    line: "早晚高峰，共享单车在桥口两侧堆积。",
    why: "密度随通勤起伏，周末明显回落。这是节律，不是单件列表。",
    hour: [0.2, 0.55, 0.8, 0.42, 0.3, 0.28, 0.7, 0.9, 0.5, 0.22, 0.12, 0.08],
    punch: (d, s) => {
      let v = 0.1
      if (s === 1 || s === 4) v = d <= 4 ? 0.9 : 0.3
      if (s === 2) v = 0.35
      return v
    },
    weekNow: 11,
    weekBase: 10,
    interval: "当日回潮",
    waves: 6,
    imgUrl: assetUrl("/placeholders/scene-generic.svg"),
  },
  C07: {
    line: "本周新出现的施工占道热点，傍晚最重。",
    why: "近 14 日热力从冷变热。这是「新热点」，不是历史工单堆叠。",
    hour: [0.08, 0.1, 0.16, 0.22, 0.4, 0.62, 0.88, 0.7, 0.44, 0.2, 0.12, 0.08],
    punch: (d, s) => (d <= 4 && s >= 3 ? 0.55 + s * 0.08 : 0.12),
    weekNow: 7,
    weekBase: 2,
    interval: "连续 6 日",
    waves: 2,
    imgUrl: assetUrl("/placeholders/scene-generic.svg"),
  },
  C02: {
    line: "朝阳门南小街施工占道已持续成形，午后到傍晚最重。",
    why: "与右侧严重现场同一条街。近 14 日强度抬升，结案后仍回潮。",
    hour: [0.1, 0.14, 0.22, 0.38, 0.55, 0.82, 0.9, 0.6, 0.32, 0.18, 0.12, 0.08],
    punch: (d, s) => (d <= 4 && s >= 2 ? 0.4 + s * 0.1 : 0.12),
    weekNow: 12,
    weekBase: 6,
    interval: "2–4 天",
    waves: 5,
    imgUrl: assetUrl("/placeholders/scene-generic.svg"),
  },
  D01: {
    line: "东直门内大街后巷垃圾堆积，早高峰后仍在画面中。",
    why: "同一巷段反复成形，网格责任人首次处置被退回后回潮。",
    hour: [0.18, 0.4, 0.62, 0.5, 0.38, 0.34, 0.48, 0.7, 0.55, 0.28, 0.16, 0.1],
    punch: (d, s) => (s >= 1 && s <= 3 ? 0.45 + (d === 2 ? 0.3 : 0) : 0.14),
    weekNow: 9,
    weekBase: 7,
    interval: "4 天",
    waves: 3,
    imgUrl: assetUrl("/placeholders/scene-generic.svg"),
  },
  J01: {
    line: "建国门内大街裙房顶部广告牌夜间最扰民。",
    why: "识别集中在 20 点后，周末略降。新广告位，不是旧案堆叠。",
    hour: [0.06, 0.08, 0.1, 0.12, 0.18, 0.28, 0.4, 0.72, 0.9, 0.8, 0.44, 0.16],
    punch: (d, s) => (s >= 4 ? 0.7 : 0.12),
    weekNow: 6,
    weekBase: 4,
    interval: "隔夜回潮",
    waves: 4,
    imgUrl: assetUrl("/placeholders/scene-generic.svg"),
  },
}

export function streetByName(name: string | null) {
  return STREETS.find((s) => s.name === name) || null
}
export function streetById(id: string | null) {
  return STREETS.find((s) => s.id === id) || null
}
export function gridsOf(streetId: string | null) {
  return GRIDS.filter((g) => g.streetId === streetId)
}
export function gridById(id: string | null) {
  return GRIDS.find((g) => g.id === id) || null
}

export function signatureOf(
  streetId: string | null,
  gridId: string | null,
): PlaceSignature | null {
  if (gridId && SIGNATURES[gridId]) return SIGNATURES[gridId]
  const grids = gridsOf(streetId)
  const watched = grids.find((g) => SIGNATURES[g.id])
  if (watched) return SIGNATURES[watched.id]
  const s = streetById(streetId)
  if (!s) return null
  return {
    line: `${s.name.replace("街道", "")}当前是「${s.emerging}」，主类型 ${s.type}。`,
    why: "历史在这里显示为热点类型与时段结构，不展开事件清单。",
    hour: [0.15, 0.18, 0.22, 0.28, 0.36, 0.42, 0.5, 0.4, 0.3, 0.2, 0.14, 0.1],
    punch: (d, si) => 0.12 + (si > 2 ? 0.2 : 0) + (d === 4 ? 0.3 : 0),
    weekNow: 5,
    weekBase: 4,
    interval: "不稳定",
    waves: 3,
  }
}

function pointInRing(lng: number, lat: number, ring: [number, number][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function gaussian() {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function generateHeatPoints(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  STREETS.forEach((s) => {
    const count = Math.max(5, Math.round(s.events * 1.1))
    const spread = s.events >= 35 ? 0.35 : s.events >= 20 ? 0.48 : 0.62
    let made = 0
    let guard = 0
    while (made < count && guard < count * 12) {
      guard++
      const [clng, clat] = s.center
      const lng = clng + gaussian() * 0.012 * spread
      const lat = clat + gaussian() * 0.01 * spread
      if (!pointInRing(lng, lat, s.ring)) continue
      const stage = (["待立案", "待处置", "待核查", "已结案(今)"] as const)[
        made % 4
      ]
      features.push({
        type: "Feature",
        properties: {
          district: s.name,
          streetId: s.id,
          weight: s.severe,
          weightSevere: s.severe,
          weightRepeat: s.repeat,
          stage,
        },
        geometry: { type: "Point", coordinates: [lng, lat] },
      })
      made++
    }
  })
  return { type: "FeatureCollection", features }
}

/** 明日预测热力点位：仅预测日使用。按街道预测件数布点，热点街道（朝阳门/东直门/安定门）
 *  明显加密收拢，其余街道压低为背景噪声——使地图热力呈现"预测的热点分布"而非实况分布 */
export function generateForecastPoints(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  STREETS.forEach((s) => {
    const forecast = STREET_FORECAST[s.name]
    const isHotspot = forecast !== undefined
    // 热点街道：每预测件数布 4 个点并向中心收拢；非热点：低密度背景点
    const count = isHotspot ? forecast * 4 : 3
    const spread = isHotspot ? 0.30 : 0.66
    const weight = isHotspot ? forecast * 7 : 3
    let made = 0
    let guard = 0
    while (made < count && guard < count * 12) {
      guard++
      const [clng, clat] = s.center
      const lng = clng + gaussian() * 0.012 * spread
      const lat = clat + gaussian() * 0.01 * spread
      if (!pointInRing(lng, lat, s.ring)) continue
      features.push({
        type: "Feature",
        properties: {
          district: s.name,
          streetId: s.id,
          weight,
          weightSevere: weight,
          weightRepeat: isHotspot ? weight : 2,
          stage: "预测",
        },
        geometry: { type: "Point", coordinates: [lng, lat] },
      })
      made++
    }
  })
  return { type: "FeatureCollection", features }
}

export function streetCollection(): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: STREETS.map((s) => ({
      type: "Feature",
      properties: { id: s.id, name: s.name, events: s.events },
      geometry: { type: "Polygon", coordinates: [s.ring] },
    })),
  }
}

export function gridCollection(
  streetId: string | null,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: gridsOf(streetId).map((g) => ({
      type: "Feature",
      properties: {
        id: g.id,
        name: g.name,
        streetId: g.streetId,
        events: g.events,
        type: g.type,
      },
      geometry: { type: "Polygon", coordinates: [g.ring] },
    })),
  }
}

export function heatColor(t: number) {
  const a = [14, 165, 233]
  const b = [34, 197, 94]
  const c = [234, 179, 8]
  const d = [239, 68, 68]
  let from = a,
    to = b,
    p = t
  if (t < 0.33) {
    p = t / 0.33
  } else if (t < 0.66) {
    from = b
    to = c
    p = (t - 0.33) / 0.33
  } else {
    from = c
    to = d
    p = (t - 0.66) / 0.34
  }
  const r = Math.round(from[0] + (to[0] - from[0]) * p)
  const g = Math.round(from[1] + (to[1] - from[1]) * p)
  const bl = Math.round(from[2] + (to[2] - from[2]) * p)
  return `rgba(${r},${g},${bl},${0.18 + t * 0.55})`
}
