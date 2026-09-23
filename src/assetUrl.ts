// 公共资源路径：GitHub Pages 等子路径部署时，public/ 资源必须拼接部署 base
// 开发环境 BASE_URL = "/"；生产 FIGMA_PUBLIC_URL=/chengyun-ai 时为 "/chengyun-ai/"
// 不加前缀时 /event-images/... 会命中域名根路径而 404
export function assetUrl(p: string): string {
  if (!p || !p.startsWith("/")) return p
  const base = import.meta.env.BASE_URL || "/"
  return base.endsWith("/") ? base + p.slice(1) : base + p
}
