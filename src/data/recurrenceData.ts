import { assetUrl } from "../assetUrl"

export interface RecurrenceEvent {
  id: string
  type: string
  street: string
  gridId: string
  gridName: string
  location: string
  cameraId: string
  currentDate: string // 播放头那天，如 8/18
  lastClosedDate: string // 上次结案日，如 8/06
  recurrenceCount: number // 第 N 次回潮
  intervalDays: number // 间隔天数
  beforeImage: string // 上次结案画面
  afterImage: string // 播放头那天画面
  disposition: string // 上次处置方式，如「处置结案」「劝导驱散」「限期整改」
}

export const RECURRENCE_EVENTS: RecurrenceEvent[] = [
  // 此刻（8/18）全区典型回潮
  {
    id: "R-2026-08180",
    type: "占道经营",
    street: "东华门街道",
    gridId: "DH01",
    gridName: "东华门大街网格",
    location: "东华门大街",
    cameraId: "CAM-DH01-03",
    currentDate: "8/18",
    lastClosedDate: "8/06",
    recurrenceCount: 4,
    intervalDays: 12,
    beforeImage: "/placeholders/scene-shop.svg",
    afterImage: "/placeholders/scene-shop.svg",
    disposition: "处置结案",
  },
  {
    id: "R-2026-08181",
    type: "店外经营",
    street: "朝阳门街道",
    gridId: "C02",
    gridName: "朝阳门南小街网格",
    location: "朝阳门南小街",
    cameraId: "CAM-C02-01",
    currentDate: "8/18",
    lastClosedDate: "8/09",
    recurrenceCount: 3,
    intervalDays: 9,
    beforeImage: "/placeholders/scene-shop.svg",
    afterImage: "/placeholders/scene-shop.svg",
    disposition: "处置结案",
  },
  {
    id: "R-2026-08182",
    type: "共享单车占道",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    location: "东直门交通枢纽北口",
    cameraId: "CAM-D01-05",
    currentDate: "8/18",
    lastClosedDate: "8/10",
    recurrenceCount: 3,
    intervalDays: 8,
    beforeImage: "/placeholders/scene-bike.svg",
    afterImage: "/placeholders/scene-bike.svg",
    disposition: "调度清运",
  },
  {
    id: "R-2026-08183",
    type: "无证户外广告",
    street: "建国门街道",
    gridId: "J02",
    gridName: "建内大街南网格",
    location: "建国门外大街",
    cameraId: "CAM-J02-02",
    currentDate: "8/18",
    lastClosedDate: "8/08",
    recurrenceCount: 2,
    intervalDays: 10,
    beforeImage: "/placeholders/scene-billboard.svg",
    afterImage: "/placeholders/scene-billboard.svg",
    disposition: "限期整改",
  },
  {
    id: "R-2026-08184",
    type: "机动车乱停放",
    street: "东四街道",
    gridId: "E01",
    gridName: "东四十条网格",
    location: "东四地铁站C口",
    cameraId: "CAM-E01-04",
    currentDate: "8/18",
    lastClosedDate: "8/12",
    recurrenceCount: 2,
    intervalDays: 6,
    beforeImage: "/placeholders/scene-car.svg",
    afterImage: "/placeholders/scene-car.svg",
    disposition: "劝导驱离",
  },
  {
    id: "R-2026-08185",
    type: "暴露垃圾",
    street: "北新桥街道",
    gridId: "B03",
    gridName: "北新桥三条网格",
    location: "北新桥三条胡同口",
    cameraId: "CAM-B03-01",
    currentDate: "8/18",
    lastClosedDate: "8/14",
    recurrenceCount: 2,
    intervalDays: 4,
    beforeImage: "/placeholders/scene-garbage.svg",
    afterImage: "/placeholders/scene-garbage.svg",
    disposition: "清运结案",
  },

  // 朝阳门街道 朝外大街网格 补充
  {
    id: "R-2026-08215",
    type: "店外经营",
    street: "朝阳门街道",
    gridId: "C03",
    gridName: "朝外大街网格",
    location: "朝外大街银河SOHO北侧",
    cameraId: "CAM-C03-02",
    currentDate: "8/18",
    lastClosedDate: "8/10",
    recurrenceCount: 2,
    intervalDays: 8,
    beforeImage: "/placeholders/scene-shop.svg",
    afterImage: "/placeholders/scene-shop.svg",
    disposition: "处置结案",
  },

  // 历史 8/11 回潮数据
  {
    id: "R-2026-08110",
    type: "占道经营",
    street: "东华门街道",
    gridId: "DH01",
    gridName: "东华门大街网格",
    location: "东华门大街",
    cameraId: "CAM-DH01-03",
    currentDate: "8/11",
    lastClosedDate: "8/02",
    recurrenceCount: 3,
    intervalDays: 9,
    beforeImage: "/placeholders/scene-shop.svg",
    afterImage: "/placeholders/scene-shop.svg",
    disposition: "处置结案",
  },
  {
    id: "R-2026-08111",
    type: "共享单车占道",
    street: "北新桥街道",
    gridId: "B03",
    gridName: "北新桥三条网格",
    location: "北新桥三条胡同口",
    cameraId: "CAM-B03-01",
    currentDate: "8/11",
    lastClosedDate: "8/05",
    recurrenceCount: 2,
    intervalDays: 6,
    beforeImage: "/placeholders/scene-bike.svg",
    afterImage: "/placeholders/scene-bike.svg",
    disposition: "调度清运",
  },
  {
    id: "R-2026-08112",
    type: "店外经营",
    street: "朝阳门街道",
    gridId: "C02",
    gridName: "朝阳门南小街网格",
    location: "朝阳门南小街",
    cameraId: "CAM-C02-01",
    currentDate: "8/11",
    lastClosedDate: "8/04",
    recurrenceCount: 2,
    intervalDays: 7,
    beforeImage: "/placeholders/scene-shop.svg",
    afterImage: "/placeholders/scene-shop.svg",
    disposition: "处置结案",
  },
  {
    id: "R-2026-08113",
    type: "施工占道",
    street: "东直门街道",
    gridId: "D01",
    gridName: "东直门内大街网格",
    location: "东直门内大街",
    cameraId: "CAM-D01-02",
    currentDate: "8/11",
    lastClosedDate: "8/07",
    recurrenceCount: 2,
    intervalDays: 4,
    beforeImage: "/placeholders/scene-construction.svg",
    afterImage: "/placeholders/scene-construction.svg",
    disposition: "限期整改",
  },
  {
    id: "R-2026-08114",
    type: "暴露垃圾",
    street: "崇文门外街道",
    gridId: "CW01",
    gridName: "崇外大街网格",
    location: "崇文门外大街",
    cameraId: "CAM-CW01-03",
    currentDate: "8/11",
    lastClosedDate: "8/09",
    recurrenceCount: 2,
    intervalDays: 2,
    beforeImage: "/placeholders/scene-garbage.svg",
    afterImage: "/placeholders/scene-garbage.svg",
    disposition: "清运结案",
  },
]

// 部署 base 适配：子路径部署（GitHub Pages）下 public/ 资源需拼接前缀
for (const e of RECURRENCE_EVENTS) {
  e.beforeImage = assetUrl(e.beforeImage)
  e.afterImage = assetUrl(e.afterImage)
}
