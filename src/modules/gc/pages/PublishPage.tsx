// 发布与审计 · 原生版
// 产品规则：草稿不能直接发布；必须在此页经「发布前预览」冲突校验后「确认发布」。
// 校验不通过的模块保持草稿并给出原因；支持版本历史与回滚（回滚后模块回到草稿）。
import { useMemo, useState } from "react"
import { useGc, useToast } from "../store"
import { useGate } from "../gates"
import { MODULES } from "../meta"
import { ConfirmModal, S } from "../engine"

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function PublishPage({ author }: { author: string }) {
  const { state, dispatch, releaseVersion } = useGc()
  const toast = useToast()
  const [previewing, setPreviewing] = useState(false)
  const [confirmPub, setConfirmPub] = useState(false)
  const [rollbackIdx, setRollbackIdx] = useState<number | null>(null)

  const drafts = MODULES.filter((m) => m.id !== "publish" && m.mode !== "ledger" && state.modules[m.id] === "草稿")
  // hooks 在顶层逐模块取（模块数固定），避免回调内调用
  // 治理基础两页为责任台账（保存即生效），不参与草稿发布，无门控
  const gates = {
    eventstd: useGate("eventstd"),
    lifecycle: useGate("lifecycle"), sla: useGate("sla"), dispatch: useGate("dispatch"),
    dedup: useGate("dedup"), metric: useGate("metric"),
  }
  const gateById = (id: string) => gates[id as keyof typeof gates]

  const passable = useMemo(() => drafts.filter((m) => !gateById(m.id).blocked), [drafts, gates])
  const blocked = useMemo(() => drafts.filter((m) => gateById(m.id).blocked), [drafts, gates])

  function publish() {
    if (passable.length === 0) return
    dispatch({
      type: "publish",
      modules: passable.map((m) => m.id),
      version: releaseVersion,
      date: today(),
      author: author.split(" · ")[0] || author,
    })
    toast(`已发布 ${releaseVersion}：${passable.map((m) => m.name).join("、")}。回滚可在版本历史中操作。`)
    setPreviewing(false)
    setConfirmPub(false)
  }

  return (
    <>
      {/* 基线卡 */}
      <section style={{ ...S.card, marginBottom: "14px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }} aria-label="当前基线">
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>当前基线：{state.baseline.version}</div>
          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>{state.baseline.date} 生效 · 治理配置全量</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted-foreground)", border: "1px solid var(--border)", borderRadius: "5px", padding: "3px 8px" }}>
            下一发布版本：{releaseVersion}
          </span>
          <button
            type="button"
            style={{ ...S.btnPrimary, opacity: drafts.length === 0 ? 0.5 : 1 }}
            disabled={drafts.length === 0}
            onClick={() => setPreviewing(true)}
          >
            生成发布前预览
          </button>
        </div>
      </section>

      {/* 草稿清单 + 冲突校验 */}
      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="草稿与冲突校验">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>草稿与冲突校验</h3>
          <span style={S.cardNote}>校验不通过的模块保持草稿；通过校验的模块可随下一次发布一起生效</span>
        </header>
        {drafts.length === 0 ? (
          <div style={S.empty}>当前没有草稿模块。业务模块页的修改保存后即成为草稿。</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>模块</th>
                <th style={S.th}>校验结果</th>
                <th style={S.th}>说明</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((m) => {
                const g = gateById(m.id)
                return (
                  <tr key={m.id}>
                    <td style={{ ...S.td, ...S.tdName }}>{m.name}</td>
                    <td style={S.td}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "11px",
                        backgroundColor: g.blocked ? "rgba(228,94,88,0.12)" : "rgba(53,185,133,0.12)",
                        color: g.blocked ? "var(--red)" : "var(--green)",
                      }}>
                        {g.blocked ? "存在冲突" : "校验通过"}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: "var(--muted-foreground)", fontSize: "11px", lineHeight: 1.6 }}>{g.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* 版本历史 */}
      <section style={{ ...S.card, marginBottom: "14px" }} aria-label="版本历史与审计">
        <header style={S.cardHead}>
          <h3 style={S.cardTitle}>版本历史与审计</h3>
          <span style={S.cardNote}>回滚只把模块退回草稿态；历史事件仍引用当时规则版本</span>
        </header>
        <div style={{ padding: "6px 16px 14px" }}>
          {state.audit.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: a.immediate ? undefined : "JetBrains Mono, monospace", fontSize: "12px", fontWeight: 600, color: a.immediate ? "var(--muted-foreground)" : a.rollbackOf ? "var(--amber)" : i === 0 && !a.rollbackOf ? "var(--green)" : "var(--foreground)", minWidth: "110px" }}>
                {a.immediate ? "即时生效" : a.version}
              </span>
              <span style={{ fontSize: "11px", color: "var(--muted-foreground)", minWidth: "150px" }}>{a.date} · {a.author}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px" }}>{a.modules.join("、")}</div>
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>{a.note}</div>
              </div>
              {!a.rollbackOf && !a.immediate && a.modules[0] !== "全部模块" && (
                <button type="button" style={{ ...S.btnLink, color: "var(--amber)" }} onClick={() => setRollbackIdx(i)}>回滚</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 发布前预览 */}
      {previewing && (
        <>
          <div style={S.scrim} onClick={() => setPreviewing(false)} />
          <div style={{ ...S.drawer, width: "520px" }} role="dialog" aria-label="发布前预览">
            <div style={S.drawerHead}>
              <strong style={{ fontSize: "13px" }}>发布前预览 · {releaseVersion}</strong>
              <button type="button" style={{ ...S.btnLink, color: "var(--muted-foreground)", fontSize: "16px", lineHeight: 1 }} onClick={() => setPreviewing(false)} aria-label="关闭">✕</button>
            </div>
            <div style={S.drawerBody}>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.8, marginBottom: "12px" }}>
                冲突校验结果如下。确认发布后，通过校验的模块一起生效；存在冲突的模块保持草稿，发布入口只在本页。
              </div>
              {passable.length === 0 && blocked.length === 0 && (
                <div style={S.empty}>没有待发布草稿。</div>
              )}
              {[...passable, ...blocked].map((m) => {
                const g = gateById(m.id)
                return (
                  <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "12px" }}>{m.name}</strong>
                      <span style={{
                        fontSize: "10px", padding: "1px 7px", borderRadius: "999px",
                        backgroundColor: g.blocked ? "rgba(228,94,88,0.12)" : "rgba(53,185,133,0.12)",
                        color: g.blocked ? "var(--red)" : "var(--green)",
                      }}>
                        {g.blocked ? "存在冲突" : "校验通过"}
                      </span>
                    </div>
                    {g.blocked && <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "6px", lineHeight: 1.6 }}>{g.note}</div>}
                  </div>
                )
              })}
              {passable.length > 0 && (
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "10px", lineHeight: 1.7 }}>
                  将发布：{passable.map((m) => m.name).join("、")} → {releaseVersion}（{today()} 生效，操作人 {author.split(" · ")[0]}）
                </div>
              )}
            </div>
            <div style={S.drawerFoot}>
              <button type="button" style={S.btnSecondary} onClick={() => setPreviewing(false)}>返回</button>
              <button
                type="button"
                style={{ ...S.btnPrimary, opacity: passable.length === 0 ? 0.5 : 1 }}
                disabled={passable.length === 0}
                onClick={() => setConfirmPub(true)}
              >
                确认发布
              </button>
            </div>
          </div>
        </>
      )}

      {confirmPub && (
        <ConfirmModal
          title="确认发布"
          body={<>将发布 <strong>{releaseVersion}</strong>：{passable.map((m) => m.name).join("、")}。发布后立即生效，历史事件仍引用当时规则版本。</>}
          confirmText="确认发布"
          onConfirm={publish}
          onClose={() => setConfirmPub(false)}
        />
      )}

      {rollbackIdx !== null && (
        <ConfirmModal
          title="回滚确认"
          body={<>将回滚 <strong>{state.audit[rollbackIdx]?.version}</strong>（{state.audit[rollbackIdx]?.modules.join("、")}），这些模块回到草稿态，需重新校验发布。</>}
          confirmText="确认回滚"
          onConfirm={() => {
            const entry = state.audit[rollbackIdx]
            if (entry) {
              dispatch({ type: "rollback", entry, author: author.split(" · ")[0] || author, date: today() })
              toast(`已回滚 ${entry.version}，相关模块回到草稿。`)
            }
            setRollbackIdx(null)
          }}
          onClose={() => setRollbackIdx(null)}
        />
      )}
    </>
  )
}
