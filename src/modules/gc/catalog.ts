// 治理配置 · 外部平台网格清单（演示数据）
// 网格名称 ↔ 编号一一对应：手动创建 / 批量导入时网格从清单中下拉选择，
// 编号按所选名称回显；清单外名称（批量导入）按序自动补号。
import { MODULES } from "./meta"
export const GRID_CATALOG: Record<string, { name: string; code: string }[]> = {
  "朝阳门街道": [
    { name: "朝内大街北网格", code: "G-0401" },
    { name: "朝阳门外南大街网格", code: "G-0402" },
    { name: "大方家胡同网格", code: "G-0403" },
    { name: "朝内大街网格", code: "G-0417" },
    { name: "朝阳门南小街网格", code: "G-0418" },
    { name: "东花市大街网格", code: "G-0419" },
  ],
  "东华门街道": [
    { name: "东华门大街网格", code: "G-0404" },
    { name: "王府井西街网格", code: "G-0405" },
    { name: "金宝街北网格", code: "G-0421" },
  ],
  "建国门街道": [
    { name: "苏州胡同网格", code: "G-0406" },
    { name: "大羊毛胡同网格", code: "G-0407" },
    { name: "建国门内大街网格", code: "G-0420" },
  ],
  "前门街道": [
    { name: "前门东大街网格", code: "G-0408" },
    { name: "西打磨厂网格", code: "G-0422" },
  ],
}

/** 按街道+编号查清单名称（老数据迁移回填用） */
export function catalogNameOf(street: string, code: string): string {
  return GRID_CATALOG[street]?.find((x) => x.code === code)?.name || ""
}

// ─── 功能订阅全量（与 ledger 的 MENUS / MENU_CHILDREN 同口径） ─────────────
// 粒度到二级功能（AI实时治理页签 / 治理配置子模块），不下沉到操作标签。
export const FEATURE_LEAF_IDS = ["dashboard", "archive", "stats", "workbench"]
export const FEATURE_LIVE_TABS = ["recognition", "case", "inspect", "void"]
// V1.2：客户可订阅的治理配置子模块收敛为 6 项（lifecycle / metric 仅内部入口，勾选不重新开放）
export const FEATURE_CONFIG_MODULES = MODULES.filter((m) => !m.platform && m.id !== "lifecycle" && m.id !== "metric").map((m) => m.id)
export const FULL_WEB_FEATURES = [...FEATURE_LEAF_IDS, "live", ...FEATURE_LIVE_TABS, "config", ...FEATURE_CONFIG_MODULES]
export const FULL_APP_FEATURES = FULL_WEB_FEATURES
