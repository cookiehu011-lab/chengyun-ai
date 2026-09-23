import { useEffect, useRef, useState } from "react"
import { Map } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import {
  type HeatMetric,
  STREETS,
  generateHeatPoints,
  streetCollection,
  gridCollection,
  gridById,
  DAY_HEAT,
  PLAY_HEAT,
  PREDICT_INDEX,
  TOMORROW_LABEL,
  generateForecastPoints,
} from "../data/dongchengMapData"
import {
  createGaussianPeaksLayer,
  type PeakPoint,
} from "./gaussianPeaksLayer"

// 经典热力配色（柔亮版）：保留 Mapbox 官方经典 ramp 的蓝→青→绿→黄→红递进结构，
// 饱和度介于经典原版与降饱和版之间，兼顾辨识度与产品浅色基调；起点使用产品主蓝。
// 历史与预测共用同一色带；预测态仅通过点位分布（热点街道加密）与「AI 明日预测」徽标区分
const CLASSIC_RAMP = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(50, 109, 255, 0)",
  0.1,
  "rgba(50, 109, 255, 0.40)",
  0.3,
  "rgba(30, 190, 235, 0.50)",
  0.5,
  "rgba(72, 205, 140, 0.58)",
  0.7,
  "rgba(255, 190, 60, 0.68)",
  1,
  "rgba(240, 80, 70, 0.82)",
] as unknown as Parameters<Map["setPaintProperty"]>[2]

// 底图瓦片：Esri 灰度画布（免 API Key、稳定），常规 2D 地图
// 清爽 = 浅灰画布，科技 = 深灰画布，各自叠加街道矢量层
const ESRI_LIGHT_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
]
const ESRI_DARK_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
]
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS"

type SkinKind = "light" | "tech"
type HeatMode = "classic" | "gaussian"

// 从点位集合提取网格峰数据（权重随指标取 weightSevere/weightRepeat，与经典热力同源）
const extractPoints = (
  fc: ReturnType<typeof generateHeatPoints>,
  m: HeatMetric,
): PeakPoint[] =>
  fc.features.map((f) => ({
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    w: Math.min(
      1,
      Number(
        (m === "repeat"
          ? f.properties?.weightRepeat
          : f.properties?.weightSevere) ??
          f.properties?.weight ??
          0.4,
      ),
    ),
  }))

// —— 街道/网格命中（纯本地几何计算）——
// MapLibre v6 与自定义 3D 图层共存时 queryRenderedFeatures 恒返回空，
// 图层委托事件（map.on("click", layerId)）因此永不触发；
// 改用射线法 point-in-polygon 直接对本地 STREETS/GRIDS 数据做命中检测。
const pointInRing = (lng: number, lat: number, ring: [number, number][]) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside
    }
  }
  return inside
}

const streetAt = (lng: number, lat: number) =>
  STREETS.find((s) => pointInRing(lng, lat, s.ring)) ?? null

interface DongchengHeatmapMapProps {
  activeDistrict: string | null // street name
  hoveredDistrict: string | null
  activeGridId: string | null
  metric: HeatMetric
  dayIndex: number
  lifecycle: string | null
  onDistrictClick: (name: string | null) => void
  onDistrictHover: (name: string | null) => void
  onGridClick: (id: string | null) => void
  onHeatModeChange?: (mode: HeatMode) => void
}

export default function DongchengHeatmapMap({
  activeDistrict,
  hoveredDistrict,
  activeGridId,
  metric,
  dayIndex,
  lifecycle,
  onDistrictClick,
  onDistrictHover,
  onGridClick,
  onHeatModeChange,
}: DongchengHeatmapMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const initRef = useRef(false)
  const layersAddedRef = useRef(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 皮肤跟随 data-skin 属性（宿主运行时可能直接改写，用 MutationObserver 监听）
  const [skin, setSkin] = useState<SkinKind>(() =>
    document.documentElement.getAttribute("data-skin") === "tech"
      ? "tech"
      : "light",
  )
  // 热力样式：经典热力云 / 高斯峰状热力（共用同一份点位数据，仅渲染方式不同）
  const [heatMode, setHeatMode] = useState<HeatMode>("classic")
  // 3D 视角（俯仰 + 可拖拽旋转）；高斯模式默认开启以呈现峰体
  const [pitched, setPitched] = useState(false)
  const [layersReady, setLayersReady] = useState(false)
  // 高斯 3D 网格图层句柄（真实三角网格曲面，见 gaussianPeaksLayer.ts）
  const meshRef = useRef<ReturnType<typeof createGaussianPeaksLayer> | null>(
    null,
  )
  // 供 map 事件回调内读取最新热力模式
  const heatModeRef = useRef<HeatMode>(heatMode)
  heatModeRef.current = heatMode
  // 供 map 事件回调内读取最新皮肤（避免闭包捕获初始值）
  const skinRef = useRef<SkinKind>(skin)
  skinRef.current = skin
  // 供 map 事件回调内读取最新选中态与回调（init effect 仅注册一次事件，闭包需经 ref 取新值）
  const activeDistrictRef = useRef(activeDistrict)
  activeDistrictRef.current = activeDistrict
  const activeGridIdRef = useRef(activeGridId)
  activeGridIdRef.current = activeGridId
  const cbRef = useRef({ onDistrictClick, onDistrictHover, onGridClick })
  cbRef.current = { onDistrictClick, onDistrictHover, onGridClick }

  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      setSkin(el.getAttribute("data-skin") === "tech" ? "tech" : "light")
    })
    obs.observe(el, { attributes: true, attributeFilter: ["data-skin"] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!mapContainer.current || initRef.current) return
    initRef.current = true

    const map = new Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: [116.415, 39.915],
      zoom: 12.4,
      minZoom: 11,
      maxZoom: 16,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })

    mapRef.current = map
    // 调试句柄：暴露给控制台/E2E 验证使用（只读）
    ;(window as unknown as { __map?: Map }).__map = map

    map.on("error", (e) => {
      const msg = String(e.error?.message || "")
      if (msg.includes("abort") || msg.includes("Abort")) return
      setError(msg || "地图渲染错误")
    })
    // 开放地图旋转/俯仰：右键拖拽或 Ctrl+拖拽旋转，Shift+↑↓ 俯仰
    map.dragRotate.enable()
    if (map.touchZoomRotate) {
      ;(map.touchZoomRotate as unknown as { enableRotation: () => void }).enableRotation()
    }
    ;(window as any).__heatmapMap = map

    const addLayers = () => {
      if (layersAddedRef.current) return
      if (!map.isStyleLoaded()) {
        // eslint-disable-next-line no-console
        console.log("style not loaded yet, retrying...")
        return
      }
      layersAddedRef.current = true
      try {
        // 0. 皮肤初值：init 时按当前皮肤构建底图与矢量层配色
        //    （effect 首跑时 style 可能仍处于加载态，init 内直接应用最可靠）
        const techInit = skinRef.current === "tech"

        // 1. Base raster tiles (added first so vector layers draw on top)
        map.addSource("carto", {
          type: "raster",
          tiles: techInit ? ESRI_DARK_TILES : ESRI_LIGHT_TILES,
          tileSize: 256,
          maxzoom: 16,
          attribution: ESRI_ATTRIBUTION,
        })
        map.addLayer({
          id: "carto-layer",
          type: "raster",
          source: "carto",
          minzoom: 0,
          maxzoom: 22,
          paint: {
            // 科技皮肤压暗降饱和偏蓝，与藏蓝 UI 融合；清爽皮肤原色
            "raster-brightness-max": techInit ? 0.66 : 1,
            "raster-saturation": techInit ? -0.32 : -0.05,
          },
        })

        // 2. Street boundary polygons
        map.addSource("streets", {
          type: "geojson",
          data: streetCollection(),
        })

        map.addLayer({
          id: "street-fills",
          type: "fill",
          source: "streets",
          paint: {
            "fill-color": techInit ? "#0E2347" : "#F3FAFF",
            "fill-opacity": 0.82,
          },
        })

        map.addLayer({
          id: "street-lines",
          type: "line",
          source: "streets",
          paint: {
            "line-color": techInit ? "#1D3A63" : "#DDEDF8",
            "line-width": 1,
          },
        })

        // Invisible hover/drill layer for streets
        map.addLayer({
          id: "street-hover",
          type: "fill",
          source: "streets",
          paint: {
            "fill-color": "#326DFF",
            "fill-opacity": 0,
          },
        })

        // 3. Grid polygons
        map.addSource("grids", {
          type: "geojson",
          data: gridCollection(null),
        })

        map.addLayer({
          id: "grid-fills",
          type: "fill",
          source: "grids",
          paint: {
            "fill-color": "#DDEDF8",
            "fill-opacity": 0,
          },
        })

        map.addLayer({
          id: "grid-lines",
          type: "line",
          source: "grids",
          paint: {
            "line-color": "#326DFF",
            "line-width": 1,
            "line-opacity": 0,
          },
        })

        map.addLayer({
          id: "grid-hover",
          type: "fill",
          source: "grids",
          paint: {
            "fill-color": "#326DFF",
            "fill-opacity": 0,
          },
        })

        // 4. Heatmap cloud layer
        map.addSource("events", {
          type: "geojson",
          data: generateHeatPoints(),
        })

        map.addLayer({
          id: "heatmap",
          type: "heatmap",
          source: "events",
          paint: {
            "heatmap-weight": [
              "coalesce",
              ["get", metric === "severe" ? "weightSevere" : "weightRepeat"],
              0.35,
            ],
            "heatmap-intensity": 1.2,
            "heatmap-color": CLASSIC_RAMP,
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              34,
              12,
              62,
              14,
              96,
              16,
              136,
            ],
            "heatmap-opacity": 0.85,
          },
        })

        // 5. Gaussian 3D peaks：真实三角网格钟形曲面（自定义 WebGL 图层），
        //    与 events 源同一份点位（密度严格一致），平滑无台阶
        const mesh = createGaussianPeaksLayer()
        map.addLayer(mesh.layer)
        mesh.setSkin(skinRef.current)
        mesh.setVisible(heatModeRef.current === "gaussian")
        mesh.setData(extractPoints(generateHeatPoints(), metric))
        meshRef.current = mesh

        // 街道/网格点击与悬停：手动几何命中（射线法），不依赖 queryRenderedFeatures
        // （该 API 在 MapLibre v6 + 自定义 3D 图层环境下恒返回空，图层委托事件永不触发）
        const canvas = map.getCanvas()
        let hoverName: string | null = null
        let hoverCursor = ""
        let moveRaf = 0
        let pending: { lng: number; lat: number } | null = null

        const applyHover = () => {
          moveRaf = 0
          if (!pending) return
          const { lng, lat } = pending
          const street = streetAt(lng, lat)
          const over = street !== null
          const name = street?.name ?? null
          if (name !== hoverName) {
            hoverName = name
            setHovered(name)
            cbRef.current.onDistrictHover(name)
          }
          const cursor = over ? "pointer" : ""
          if (cursor !== hoverCursor) {
            hoverCursor = cursor
            canvas.style.cursor = cursor
          }
        }

        map.on("mousemove", (e) => {
          pending = { lng: e.lngLat.lng, lat: e.lngLat.lat }
          if (!moveRaf) moveRaf = requestAnimationFrame(applyHover)
        })

        map.on("mouseout", () => {
          if (moveRaf) {
            cancelAnimationFrame(moveRaf)
            moveRaf = 0
          }
          pending = null
          if (hoverName !== null) {
            hoverName = null
            setHovered(null)
            cbRef.current.onDistrictHover(null)
          }
          if (hoverCursor !== "") {
            hoverCursor = ""
            canvas.style.cursor = ""
          }
        })

        map.on("click", (e) => {
          const { lng, lat } = e.lngLat
          // 点击街道即只选中街道（网格不再通过地图点击选中，
          // 网格聚焦仅由事件轮播/外部联动触发）；同一街道再次点击取消
          const street = streetAt(lng, lat)
          if (street) {
            cbRef.current.onDistrictClick(
              activeDistrictRef.current === street.name ? null : street.name,
            )
            cbRef.current.onGridClick(null)
          }
        })

        setLayersReady(true)
      } catch (err) {
        layersAddedRef.current = false
        setError(String(err))
      }
    }

    map.on("load", addLayers)

    // Fallback: ensure layers are added even if load event timing is unusual
    const fallbackTimers = [300, 800, 1500, 2500].map((ms) =>
      setTimeout(() => {
        if (!layersAddedRef.current) addLayers()
      }, ms),
    )

    // Ensure the map renders correctly if the container size changed after init
    const resize = () => {
      map.resize()
      map.triggerRepaint()
    }
    const ro = new ResizeObserver(resize)
    if (mapContainer.current) ro.observe(mapContainer.current)
    window.addEventListener("resize", resize)

    return () => {
      fallbackTimers.forEach(clearTimeout)
      ro.disconnect()
      window.removeEventListener("resize", resize)
      map.remove()
      mapRef.current = null
      initRef.current = false
      layersAddedRef.current = false
    }
  }, [])

  // Sync hover / active highlight on street polygons
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const targetName = hoveredDistrict ?? hovered ?? null
    const targetId = STREETS.find(
      (s) => s.name === (activeDistrict || targetName),
    )?.id

    try {
      // 地图填充色随皮肤取值（mapbox 表达式不能用 CSS 变量）
      const tech = skin === "tech"
      map.setPaintProperty("street-fills", "fill-color", [
        "case",
        ["==", ["get", "id"], activeDistrict ? (targetId ?? "") : ""],
        tech ? "#16305C" : "#EAF6FF",
        tech ? "#0E2347" : "#F3FAFF",
      ])

      map.setPaintProperty("street-hover", "fill-opacity", [
        "case",
        ["==", ["get", "id"], activeDistrict ? (targetId ?? "") : ""],
        activeDistrict ? 0.22 : 0,
        ["==", ["get", "name"], targetName ?? ""],
        0.12,
        0,
      ])

      map.setPaintProperty("street-lines", "line-color", [
        "case",
        ["==", ["get", "id"], targetId ?? ""],
        "#326DFF",
        tech ? "#1D3A63" : "#DDEDF8",
      ])

      map.setPaintProperty("street-lines", "line-width", [
        "case",
        ["==", ["get", "id"], targetId ?? ""],
        2,
        1,
      ])
    } catch {
      // layers may not be ready yet
    }
  }, [activeDistrict, hoveredDistrict, hovered, skin, layersReady])

  // 皮肤同步：底图瓦片亮/暗切换 + 街道描边默认色 + 容器背景 + 高斯配色刷新
  useEffect(() => {
    const map = mapRef.current
    const tech = skin === "tech"
    if (mapContainer.current) {
      mapContainer.current.style.background = tech ? "#0A1830" : "#F3FAFF"
    }
    if (!map || !layersReady) return

    // style 可能仍在消化 init 时添加的图层（isStyleLoaded 为 false），
    // 此时挂 idle 回调重试，避免首跑早退后永不生效
    const applySkin = () => {
      try {
        // maplibre v6 的 setTiles 对 raster 源不触发重绘，直接重建底图源最可靠
        if (map.getLayer("carto-layer")) map.removeLayer("carto-layer")
        if (map.getSource("carto")) map.removeSource("carto")
        map.addSource("carto", {
          type: "raster",
          tiles: tech ? ESRI_DARK_TILES : ESRI_LIGHT_TILES,
          tileSize: 256,
          maxzoom: 16,
          attribution: ESRI_ATTRIBUTION,
        })
        map.addLayer(
          {
            id: "carto-layer",
            type: "raster",
            source: "carto",
            paint: {
              "raster-brightness-max": tech ? 0.66 : 1,
              "raster-saturation": tech ? -0.32 : -0.05,
            },
          },
          "street-fills",
        )

        // 高斯网格峰配色随皮肤刷新
        meshRef.current?.setSkin(skin)
      } catch {
        // ignore
      }
    }

    if (map.isStyleLoaded()) {
      applySkin()
    } else {
      map.once("idle", applySkin)
    }
    return () => {
      map.off("idle", applySkin)
    }
  }, [skin, layersReady])

  // 热力样式切换：经典热力云 ↔ 高斯峰状热力（平滑 3D 网格山体）
  useEffect(() => {
    const map = mapRef.current
    // 俯仰与网格峰显隐不依赖样式就绪，保证任何时刻切换都生效
    setPitched(heatMode === "gaussian")
    meshRef.current?.setVisible(heatMode === "gaussian")
    if (!map || !map.isStyleLoaded() || !layersReady) return

    try {
      map.setLayoutProperty(
        "heatmap",
        "visibility",
        heatMode === "classic" ? "visible" : "none",
      )
    } catch {
      // ignore
    }
  }, [heatMode, layersReady])

  // 3D 视角：俯仰角过渡
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReady) return
    map.easeTo({ pitch: pitched ? 55 : 0, duration: 700 })
  }, [pitched, layersReady])

  // Sync grid visibility + highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const activeStreetId = activeDistrict
      ? (STREETS.find((s) => s.name === activeDistrict)?.id ?? null)
      : null

    try {
      const gridsSource = map.getSource(
        "grids",
      ) as maplibregl.GeoJSONSource | undefined
      gridsSource?.setData(gridCollection(activeStreetId))

      // 网格仅在明确聚焦（事件轮播/外部联动设置 activeGridId）时显示；
      // 仅选中街道时保持隐藏，地图默认只展示街道层级
      const visible = activeGridId ? 1 : 0
      map.setPaintProperty("grid-fills", "fill-opacity", visible * 0.35)
      map.setPaintProperty("grid-lines", "line-opacity", visible * 0.7)
      map.setPaintProperty("grid-hover", "fill-opacity", [
        "case",
        ["==", ["get", "id"], activeGridId ?? ""],
        0.2,
        0,
      ])
    } catch {
      // ignore
    }
  }, [activeDistrict, activeGridId])

  // Sync metric weight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    try {
      map.setPaintProperty("heatmap", "heatmap-weight", [
        "coalesce",
        ["get", metric === "severe" ? "weightSevere" : "weightRepeat"],
        0.35,
      ])
      // 高斯网格峰按当前指标重建（高度/半径跟随 severe/repeat 权重）
      meshRef.current?.setData(
        extractPoints(
          dayIndex >= PREDICT_INDEX
            ? generateForecastPoints()
            : generateHeatPoints(),
          metric,
        ),
      )
    } catch {
      // ignore
    }
  }, [metric, dayIndex, layersReady])

  // Sync playback day (changes heat intensity, color ramp AND the point set:
  // 预测日整组点位切换为"明日预测分布"，让热力图真正呈现预测的热点)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const isPredict = dayIndex >= PREDICT_INDEX
    try {
      const dayFactor = (isPredict ? PLAY_HEAT : DAY_HEAT)[dayIndex] ?? 1
      map.setPaintProperty(
        "heatmap",
        "heatmap-intensity",
        0.65 + dayFactor * 0.35,
      )
      map.setPaintProperty("heatmap", "heatmap-opacity", 0.65 + dayFactor * 0.2)
      // 历史/今日/预测统一使用经典热力色带，预测仅靠点位分布区分
      map.setPaintProperty("heatmap", "heatmap-color", CLASSIC_RAMP)
      // 高斯网格峰数据随预测日切换（与 events 完全同源，密度一致）
      meshRef.current?.setData(
        extractPoints(
          isPredict ? generateForecastPoints() : generateHeatPoints(),
          metric,
        ),
      )
      // 关键：点位数据随预测日切换——热点街道（按 STREET_FORECAST）加密收拢，
      // 其余街道压低，地图呈现"明日的热点分布"而非沿用今日实况
      const source = map.getSource("events") as
        | maplibregl.GeoJSONSource
        | undefined
      if (source) {
        source.setData(isPredict ? generateForecastPoints() : generateHeatPoints())
      }
    } catch {
      // ignore
    }
  }, [dayIndex, layersReady])

  // Sync lifecycle filter by rebuilding point weights
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    try {
      const source = map.getSource(
        "events",
      ) as maplibregl.GeoJSONSource | undefined
      if (source) {
        // 预测日下保持预测点位分布，避免被生命周期筛选还原成实况点位
        source.setData(
          dayIndex >= PREDICT_INDEX
            ? generateForecastPoints()
            : generateHeatPoints(),
        )
      }
      // 网格峰同步重建（保持与 events 同点位）
      meshRef.current?.setData(
        extractPoints(
          dayIndex >= PREDICT_INDEX
            ? generateForecastPoints()
            : generateHeatPoints(),
          metric,
        ),
      )
    } catch {
      // ignore
    }
  }, [lifecycle, dayIndex, metric])

  // Zoom to active street / grid：按街道/网格实际边界精确推进取景
  useEffect(() => {
    const map = mapRef.current
    // 注意：这里不能加 isStyleLoaded 守卫——fitBounds/flyTo 是纯相机操作，不依赖样式；
    // 且同一 commit 内高亮 effect 的 setPaintProperty 会让 isStyleLoaded 短暂变 false，
    // 守卫会导致本 effect 早退后永不重跑（依赖不再变化），表现为点击街道无推进。
    if (!map) return

    // 由多边形 ring 计算经纬度包围盒
    const boundsOf = (ring: [number, number][]) => {
      let w = 180
      let s = 90
      let e = -180
      let n = -90
      ring.forEach(([x, y]) => {
        w = Math.min(w, x)
        s = Math.min(s, y)
        e = Math.max(e, x)
        n = Math.max(n, y)
      })
      return [
        [w, s],
        [e, n],
      ] as [
        [number, number],
        [number, number],
      ]
    }

    if (activeGridId) {
      const g = gridById(activeGridId)
      if (g) {
        const [lng, lat] = g.center
        map.flyTo({ center: [lng, lat], zoom: 15.2, duration: 700 })
      }
    } else if (activeDistrict) {
      const s = STREETS.find((x) => x.name === activeDistrict)
      if (s) {
        // 推进至街道边界（保留当前俯仰/方位，高斯 3D 下呈倾斜取景）
        map.fitBounds(boundsOf(s.ring), {
          padding: { top: 90, bottom: 110, left: 60, right: 60 },
          maxZoom: 14.8,
          duration: 850,
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        })
      }
    } else {
      map.flyTo({
        center: [116.415, 39.915],
        zoom: 12.4,
        duration: 700,
        pitch: map.getPitch(),
      })
    }
  }, [activeDistrict, activeGridId])

  // 热力模式变化上报（供外部图例等联动）
  useEffect(() => {
    onHeatModeChange?.(heatMode)
  }, [heatMode, onHeatModeChange])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          background: skin === "tech" ? "#0A1830" : "#F3FAFF",
        }}
      />
      {/* 热力图例 + 样式切换 + 3D 视角：与右上角「地图全屏」按钮同行并排 */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 54,
          zIndex: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 5,
          borderRadius: 999,
          background: "var(--glass-bg-strong)",
          border: "1px solid var(--glass-border)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 4px 14px rgba(22,45,77,0.10)",
        }}
      >
        {/* 热力图例：随当前热力样式联动（低→高 = 事件密度低→高） */}
        <div
          title="热力图例：颜色由冷到暖表示事件密度由低到高"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 10px",
          }}
        >
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
            低
          </span>
          <div
            style={{
              width: 52,
              height: 5,
              borderRadius: 3,
              background:
                heatMode === "gaussian"
                  ? "linear-gradient(to right, #5078FF, #3CD6E6, #5AE4A6, #FFD564, #F9994D)"
                  : "linear-gradient(to right, #326DFF, #24D6D2, #35B985, #FF7A42, #E45E58)",
            }}
          />
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
            高
          </span>
        </div>
        <div
          style={{
            width: 1,
            margin: "3px 4px",
            background: "var(--glass-border)",
          }}
        />
        {(
          [
            ["classic", "经典热力"],
            ["gaussian", "高斯热力"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setHeatMode(value)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "5px 13px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              background: heatMode === value ? "var(--primary)" : "transparent",
              color: heatMode === value ? "#fff" : "var(--muted-foreground)",
              transition: "all 0.2s ease",
            }}
          >
            {label}
          </button>
        ))}
        <div
          style={{
            width: 1,
            margin: "3px 4px",
            background: "var(--glass-border)",
          }}
        />
        <button
          onClick={() => setPitched((p) => !p)}
          title={pitched ? "恢复俯视平面" : "切换 3D 倾斜视角"}
          style={{
            border: "none",
            cursor: "pointer",
            padding: "5px 13px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            background: pitched ? "var(--accent)" : "transparent",
            color: pitched ? "#fff" : "var(--muted-foreground)",
            transition: "all 0.2s ease",
          }}
        >
          3D 视角
        </button>
      </div>
      {/* 预测日徽标：青色实线描边（产品 AI 语义色），与历史/今日实况区分 */}
      {dayIndex >= PREDICT_INDEX && (
        <div
          style={{
            position: "absolute",
            top: 58,
            right: 54,
            zIndex: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            background:
              document.documentElement.getAttribute("data-skin") === "tech"
                ? "rgba(36,214,210,0.14)"
                : "rgba(36,214,210,0.16)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(36,214,210,0.45)",
            boxShadow: "0 4px 16px rgba(36,214,210,0.30)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#17C9C4",
              boxShadow: "0 0 8px rgba(36,214,210,0.9)",
              animation: "pulse-dot 1.6s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--ai-deep)",
              letterSpacing: "0.05em",
            }}
          >
            AI 明日预测 · {TOMORROW_LABEL}
          </span>
        </div>
      )}
      {/* AI 扫描线：主题色横向细线，3s 一轮回自上而下扫过东城区 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <div className="map-scanline">
          <span className="map-scanline-core" />
        </div>
      </div>
      {error && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            background: "rgba(228,94,88,0.92)",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 4,
            fontSize: 11,
            zIndex: 30,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
