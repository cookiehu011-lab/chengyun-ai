// 治理配置 · 模块内容路由（标准引擎卡页 + 自定义页）
// 规则：所有页面保存即生效；生命周期 / 指标等流程规则页只读展示
import { CardList, CrudCard, S } from "./engine"
import { CARDS } from "./cards.generated"
import { LedgerPage } from "./pages/LedgerPage"
import { SpacePage } from "./pages/SpacePage"
import { SlaPage } from "./pages/SlaPage"
import { PublishPage } from "./pages/PublishPage"
import { CustomersPage, SeeTimePage } from "./pages/PlatformPages"

const NOUNS: Record<string, string> = {
  dict: "细类",
  "lc-stage": "阶段", "lc-rule": "规则项",
  "dc-batch": "批次",
  ver: "版本", base: "考核目标", metric: "指标", factor: "因子", sup: "口径项",
  "sla-caliber": "口径项",
}

// ─── metric：治理评价标准（流程规则页，只读） ────────────────────────────────

function MetricPage({ author }: { author: string }) {
  return (
    <>
      <div style={{ ...S.card, marginBottom: "14px", padding: "12px 16px" }}>
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          流程规则由系统固定，本页只读展示。平均处置时长参与人员 / 网格比较时，必须同时开启难度校正，否则不能用于排名。
        </span>
      </div>
      <CardList defs={CARDS.metric} nouns={NOUNS} moduleName="治理评价标准" author={author} readOnly />
    </>
  )
}

// ─── lifecycle：生命周期与处置规则（流程规则页，只读） ───────────────────────

function LifecyclePage({ author }: { author: string }) {
  return (
    <>
      <CardList defs={CARDS.lifecycle} nouns={NOUNS} moduleName="生命周期与处置规则" author={author} readOnly />
      <div style={{ ...S.card, marginBottom: "14px", padding: "12px 16px" }}>
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          阶段和底线规则由系统固定；如需修改业务标准，请前往「事件标准」。
        </span>
      </div>
    </>
  )
}

// ─── dispatch：待办领取（只留领取批次，行可编辑、不可增删 / 停启用） ─────────

function DispatchPage({ author }: { author: string }) {
  const batch = CARDS.dispatch[0]
  return (
    <>
      <CrudCard
        def={batch}
        noun={NOUNS[batch.id]}
        moduleName="待办领取"
        author={author}
        canAdd={false}
        canToggle={false}
        canRemove={false}
      />
      <div style={{ ...S.card, marginBottom: "14px", padding: "12px 16px" }}>
        <span style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          全量识别不走领取；责任人收到派发后直接办理，无需领取。分配顺序、领取后回收、账号停用释放由系统执行。
        </span>
      </div>
    </>
  )
}

// ─── 路由 ────────────────────────────────────────────────────────────────────

export function ModuleContent({ id, author, cid, orgSynced }: { id: string; author: string; cid: string; orgSynced: boolean }) {
  switch (id) {
    case "customers": return <CustomersPage author={author} />
    case "seetime": return <SeeTimePage author={author} />
    case "org": return <LedgerPage cid={cid} orgSynced={orgSynced} author={author} />
    case "space": return <SpacePage author={author} cid={cid} orgSynced={orgSynced} />
    case "eventstd": {
      const dictDef = CARDS.eventstd.find((c) => c.id === "dict")!
      return (
        <CrudCard
          def={dictDef}
          noun={NOUNS[dictDef.id]}
          moduleName="事件标准"
          author={author}
          canRemove={false}
        />
      )
    }
    case "lifecycle": return <LifecyclePage author={author} />
    case "sla": return <SlaPage author={author} />
    case "dispatch": return <DispatchPage author={author} />
    case "metric": return <MetricPage author={author} />
    case "publish": return <PublishPage />
    default: return null
  }
}
