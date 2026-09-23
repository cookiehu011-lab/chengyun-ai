// 高斯 3D 峰自定义渲染层：真实三角网格钟形曲面（平滑无台阶）
// 每个事件点生成一座高斯山体网格，逐顶点按绝对高度渐变着色 + Lambert 光照，
// 山脚延伸至 2.1 倍特征半径处高度趋零，天然形成摊开的蓝紫裙边（相邻峰连成云海）。
// 替代 fill-extrusion 叠盘方案（叠盘固有"等高线台阶"纹理，无法平滑）。
import type { CustomLayerInterface } from "maplibre-gl"
import { MercatorCoordinate } from "maplibre-gl"

export type SkinKind = "light" | "tech"
export interface PeakPoint {
  lng: number
  lat: number
  w: number // 0..1 权重（与经典热力的 weightSevere/weightRepeat 同源）
}

// 剖面参数
const RINGS = 22 // 径向细分（含边缘与顶点，越大坡面越细腻）
const SEG = 32 // 周向细分
const RF_MAX = 1.6 // 裙边外延（×特征半径），该处高度恰为 0；过大易产生交叠网纹
const K = 1.15 // 高斯衰减系数（默认剖面）
const M_PER_DEG = 111320 // 纬度方向米/度

const profile = (f: number, k = K) => Math.exp(-k * f * f)
const frac = (v: number) => v - Math.floor(v)

// 高度(米)→颜色 渐变（双皮肤）：蓝紫→青→绿→黄→橙红→深红，
// 峰高重尾分布下矮丘到蓝绿、中峰黄、主峰红、极峰深红，层次分明。
// 整体低透明度（玻璃质感），山脚再按高度渐隐，可透视底图与后侧峰体
// 高度(米)→颜色 渐变（双皮肤）：蓝紫→青→绿→黄→橙→红橙，
// 红色阈值上移：多数峰顶落在黄/橙区、只有最高的少数峰尖见红橙，峰群橙红错落
const RAMP: Record<SkinKind, Array<[number, number, number, number, number]>> = {
  tech: [
    [0, 0.31, 0.47, 1.0, 0.36],
    [60, 0.24, 0.84, 0.9, 0.48],
    [160, 0.35, 0.89, 0.65, 0.58],
    [320, 1.0, 0.85, 0.39, 0.66],
    [520, 0.98, 0.6, 0.3, 0.72],
    [780, 0.92, 0.38, 0.3, 0.78],
  ],
  light: [
    [0, 0.25, 0.46, 0.98, 0.32],
    [60, 0.22, 0.75, 0.9, 0.44],
    [160, 0.35, 0.8, 0.57, 0.54],
    [320, 0.97, 0.82, 0.31, 0.62],
    [520, 0.96, 0.64, 0.28, 0.68],
    [780, 0.88, 0.4, 0.3, 0.74],
  ],
}

function rampColor(
  skin: SkinKind,
  h: number,
): [number, number, number, number] {
  const stops = RAMP[skin]
  if (h <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3], stops[0][4]]
  for (let i = 1; i < stops.length; i++) {
    if (h <= stops[i][0]) {
      const a = stops[i - 1]
      const b = stops[i]
      const t = (h - a[0]) / (b[0] - a[0])
      return [
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        a[3] + (b[3] - a[3]) * t,
        a[4] + (b[4] - a[4]) * t,
      ]
    }
  }
  const last = stops[stops.length - 1]
  return [last[1], last[2], last[3], last[4]]
}

const VERT_SRC = `
attribute vec3 a_pos;
attribute vec3 a_normal;
attribute vec4 a_color;
uniform mat4 u_matrix;
varying vec3 v_normal;
varying vec4 v_color;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 1.0);
  v_normal = a_normal;
  v_color = a_color;
}
`

const FRAG_SRC = `
precision mediump float;
varying vec3 v_normal;
varying vec4 v_color;
void main() {
  vec3 n = normalize(v_normal);
  // 天光方向（mercator 空间：x 东、y 南、z 上）
  vec3 L = normalize(vec3(-0.32, -0.42, 0.85));
  float diff = max(dot(n, L), 0.0);
  float shade = 0.60 + 0.40 * diff;
  gl_FragColor = vec4(v_color.rgb * shade, v_color.a);
}
`

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn("gaussian peaks shader error:", gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

export function createGaussianPeaksLayer(id = "gauss-peaks-mesh") {
  let points: PeakPoint[] = []
  let skin: SkinKind = "light"
  let visible = false
  let glCtx: WebGL2RenderingContext | null = null
  let program: WebGLProgram | null = null
  let vbo: WebGLBuffer | null = null
  let ibo: WebGLBuffer | null = null
  let indexCount = 0
  let dirty = false
  let uMatrix: WebGLUniformLocation | null = null
  let aPos = 0
  let aNormal = 0
  let aColor = 0

  function build() {
    const gl = glCtx
    if (!gl || !points.length) {
      indexCount = 0
      return
    }

    const vertsPerPeak = (RINGS + 1) * (SEG + 1)
    const trisPerPeak = RINGS * SEG * 2
    const totalVerts = vertsPerPeak * points.length
    const totalIndices = trisPerPeak * 3 * points.length

    const buf = new Float32Array(totalVerts * 10) // pos3 + normal3 + color4
    const idx = new Uint32Array(totalIndices)

    let vi = 0
    let ii = 0
    let vBase = 0

    for (const p of points) {
      const mc = MercatorCoordinate.fromLngLat([p.lng, p.lat], 0)
      const unit = mc.meterInMercatorCoordinateUnits()
      const mx0 = mc.x
      const my0 = mc.y

      // 确定性多重抖动（同一坐标永远同一结果）：高度/形状/尺寸/朝向各自独立
      const seed = Math.sin(p.lng * 12.9898 + p.lat * 78.233) * 43758.5453
      const j1 = seed - Math.floor(seed)
      const j2 = frac(seed * 1.37 + 0.31)
      const j3 = frac(seed * 2.71 + 0.67)
      const j4 = frac(seed * 4.13 + 0.19)

      // 高度：重尾分布——w^2.4 幂次拉开差距，再乘 0.32~2.3 宽幅抖动
      // → 即使同街道同权重的相邻峰也能差出数倍，彻底告别"齐刷刷"
      const H = (60 + Math.pow(p.w, 2.4) * 800) * (0.32 + j1 * 1.98)
      // 剖面指数逐峰随机：0.85 尖锐锥体 ~ 2.15 平缓圆顶，形状各异
      const k = 0.85 + j2 * 1.3
      // 特征半径独立抖动（0.6~1.55），均值收窄减少裙边交叠
      const r0Deg = (0.0026 + p.w * 0.0018) * (0.6 + j3 * 0.95)
      const r0m = r0Deg * M_PER_DEG
      // 椭圆 footprint + 随机朝向：每座峰的剪影都不一样
      const aspect = 0.68 + j4 * 0.85
      const rot = j2 * Math.PI
      const cosR = Math.cos(rot)
      const sinR = Math.sin(rot)
      const zEdge = profile(RF_MAX, k) // 裙边残余高度占比（置零贴地）

      for (let i = 0; i <= RINGS; i++) {
        const f = (RF_MAX * i) / RINGS // i=0 外缘裙边 → i=RINGS 峰心
        const rM = f * r0m
        const z = Math.max((profile(f, k) - zEdge) * H, 0)
        const [cr, cg, cb, ca0] = rampColor(skin, z)
        // 透明感：山脚大幅渐隐（掠射方向壳双重叠加也几乎不可见，消除交叉网纹）
        const ca = ca0 * (0.12 + 0.88 * Math.min(z / 220, 1))

        for (let s = 0; s <= SEG; s++) {
          const a = (s / SEG) * Math.PI * 2
          const ca1 = Math.cos(a)
          const sa1 = Math.sin(a)
          // 椭圆（东西轴拉伸 aspect）再旋转 rot
          const ex = ca1 * aspect
          const nyc = sa1
          const east = rM * (ex * cosR - nyc * sinR)
          const north = rM * (ex * sinR + nyc * cosR)
          // 该方向的等效半径（用于法线斜率）
          const rDir = Math.max(r0m * Math.hypot(ca1 * aspect, sa1), r0m * 0.4)

          // 表面法线：z(r) 高度场，outward normal ∝ (-dz/dr·dir, 1)
          const dzdr = ((-2 * k * f * profile(f, k) * H) / rDir) * (f > 0 ? 1 : 0)

          // 位置（mercator 单位；y 轴向南，故北向取负）
          buf[vi++] = mx0 + east * unit
          buf[vi++] = my0 - north * unit
          buf[vi++] = z * unit

          // 法线（ENU→mercator 方向）
          let nx = -dzdr * ca1 * unit
          let ny = dzdr * sa1 * unit
          let nz = unit
          const nl = Math.hypot(nx, ny, nz) || 1
          buf[vi++] = nx / nl
          buf[vi++] = ny / nl
          buf[vi++] = nz / nl

          buf[vi++] = cr
          buf[vi++] = cg
          buf[vi++] = cb
          buf[vi++] = ca
        }
      }

      // 索引：环带四边形 → 两三角形
      for (let i = 0; i < RINGS; i++) {
        for (let s = 0; s < SEG; s++) {
          const a0 = vBase + i * (SEG + 1) + s
          const b0 = a0 + 1
          const c0 = a0 + (SEG + 1)
          const d0 = c0 + 1
          idx[ii++] = a0
          idx[ii++] = c0
          idx[ii++] = b0
          idx[ii++] = b0
          idx[ii++] = c0
          idx[ii++] = d0
        }
      }
      vBase += vertsPerPeak
    }

    if (!vbo) vbo = gl.createBuffer()
    if (!ibo) ibo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
    indexCount = totalIndices
    dirty = false
  }

  const layer: CustomLayerInterface = {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      glCtx = gl
      const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
      if (!vs || !fs) return
      const prog = gl.createProgram()
      if (!prog) return
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        // eslint-disable-next-line no-console
        console.warn(
          "gaussian peaks link error:",
          gl.getProgramInfoLog(prog),
        )
        return
      }
      program = prog
      uMatrix = gl.getUniformLocation(prog, "u_matrix")
      aPos = gl.getAttribLocation(prog, "a_pos")
      aNormal = gl.getAttribLocation(prog, "a_normal")
      aColor = gl.getAttribLocation(prog, "a_color")
      if (points.length) build()
    },
    render(gl, args) {
      if (!visible || !program || !uMatrix) return
      if (dirty) build()
      if (!indexCount || !vbo || !ibo) return
      const m = args.defaultProjectionData?.mainMatrix
      if (!m) return

      gl.useProgram(program)
      gl.uniformMatrix4fv(uMatrix, false, m as unknown as Float32Array)

      gl.disable(gl.CULL_FACE)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.depthMask(true)
      gl.enable(gl.BLEND)
      // 非 premultiplied 输出（文档允许显式切换 blendFunc）
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      )

      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 40, 0)
      gl.enableVertexAttribArray(aNormal)
      gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 40, 12)
      gl.enableVertexAttribArray(aColor)
      gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 40, 24)

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0)

      // 恢复 maplibre 期望的 blend 状态（premultiplied）
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    },
    onRemove(_map, gl) {
      if (vbo) gl.deleteBuffer(vbo)
      if (ibo) gl.deleteBuffer(ibo)
      if (program) gl.deleteProgram(program)
      vbo = null
      ibo = null
      program = null
      glCtx = null
      indexCount = 0
    },
  }

  return {
    layer,
    setData(next: PeakPoint[]) {
      points = next
      if (glCtx) dirty = true
    },
    setSkin(next: SkinKind) {
      if (next === skin) return
      skin = next
      if (glCtx) dirty = true
    },
    setVisible(next: boolean) {
      visible = next
    },
  }
}
