import React from "react"
import ReactDOM from "react-dom/client"
import { setWorkerUrl } from "maplibre-gl"
import App from "./App?rev=cr50"
import "./index.css"

// 显式指定 MapLibre worker 地址：maplibre-gl 6.x 默认在运行时用
// new URL('./maplibre-gl-worker.mjs', import.meta.url) 拼路径，文件名动态计算
// 导致打包器无法识别与拷贝该文件，GeoJSON 解析 worker 全部失效
//（经典热力/街道/网格不渲染，高斯峰为自定义 WebGL 层不受影响）。
// worker 与其依赖 maplibre-gl-shared.mjs 由 public/ 原样提供（见 prebuild 脚本），
// 这里指向站点根路径，兼容开发与 /chengyun-ai/ 部署基座。
setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
