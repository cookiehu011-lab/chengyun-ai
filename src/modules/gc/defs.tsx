// 治理配置 · 模块内容路由（标准引擎卡页 + 自定义页）
import { CardList, S, Switch } from "./engine"
import { useGc } from "./store"
import { CARDS } from "./cards.generated"
import { LedgerPage } from "./pages/LedgerPage"
import { SpacePage } from "./pages/SpacePage"
import { SlaPage } from "./pages/SlaPage"
import { PublishPage } from "./pages/PublishPage"
import { CustomersPage, SeeTimePage } from "./pages/PlatformPages"

const NOUNS: Record<string, string> = {
  dict: "细类", nl: "原因", tc: "原因", zf: "原因",
  "lc-stage": "阶段", "lc-rule": "规则项", "lc-autoclose": "细类",
  "dc-batch": "批次", "dc-recycle": "环节", "dc-urgent": "置顶条件",
  "dr-dup": "判重条件", "dr-recur": "判定项", "dr-topic": "口径项",
  ver: "版本", base: "考核目标", metric: "指标", factor: "因子", sup: "口径项",
  "sla-caliber": "口径项",
}

// ─── metric：难度校正开关 + 引擎卡 ───────────────────────────────────────────

function MetricPage() {
  const { state, dispatch } = useGc()
  const adjustOn = state.switches.metricAdjust !== false
  return (
    <>
      <div style={{ ...S.card, marginBottom: "14px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "14px" }}>
        <Switch on={adjustOn} label="难度校正" onChange={(v) => dispatch({ type: "set-switch", key: "metricAdjust", on: v })} />
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          平均处置时长参与人员 / 网格比较时，必须同时开启难度校正，否则发布前校验会拒绝。
        </span>
      </div>
      <CardList defs={CARDS.metric} nouns={NOUNS} />
    </>
  )
}

// ─── 路由 ────────────────────────────────────────────────────────────────────

export function ModuleContent({ id, author, cid, orgSynced }: { id: string; author: string; cid: string; orgSynced: boolean }) {
  switch (id) {
    case "customers": return <CustomersPage author={author} />
    case "seetime": return <SeeTimePage author={author} />
    case "org": return <LedgerPage cid={cid} orgSynced={orgSynced} />
    case "space": return <SpacePage author={author} cid={cid} orgSynced={orgSynced} />
    case "eventstd": return <CardList defs={CARDS.eventstd} nouns={NOUNS} />
    case "lifecycle": return <CardList defs={CARDS.lifecycle} nouns={NOUNS} />
    case "sla": return <SlaPage />
    case "dispatch": return <CardList defs={CARDS.dispatch} nouns={NOUNS} />
    case "dedup": return <CardList defs={CARDS.dedup} nouns={NOUNS} />
    case "metric": return <MetricPage />
    case "publish": return <PublishPage author={author} />
    default: return null
  }
}
