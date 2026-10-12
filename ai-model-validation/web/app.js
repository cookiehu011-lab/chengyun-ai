const state = {
  stats: null,
  pipeline: [],
  items: [],
  selectedId: null,
  detail: null,
  lightbox: { open: false, urls: [], labels: [], index: 0 },
};

const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json();
}

function worthChip(v) {
  if (v === 1) return '<span class="chip ok">有价值</span>';
  if (v === 0) return '<span class="chip bad">无价值</span>';
  return '<span class="chip">待第2步</span>';
}

function confChip(c) {
  if (c === "有把握") return '<span class="chip ok">有把握</span>';
  if (c === "没把握") return '<span class="chip warn">没把握</span>';
  return "";
}

function amapConflict(it) {
  const name = it.camera_name || "";
  const poi = it.amap_nearest_poi_name || "";
  if (!poi || !name) return "";
  // rough: if neither contains a 2+ char shared chunk from the other, flag
  const short = name.replace(/[0-9\.\-_/]/g, "").slice(0, 6);
  if (short && poi.includes(short.slice(0, 4))) return "";
  if (poi.length >= 4 && name.includes(poi.slice(0, 4))) return "";
  return '<span class="chip warn">高德与名称冲突</span>';
}

function nameSceneConflict(it) {
  if (!it.name_scene_conflict) return "";
  const sign = it.dominant_sign_text ? `→${escapeHtml(it.dominant_sign_text)}` : "";
  return `<span class="chip warn">名称画面冲突${sign}</span>`;
}

function edgeTypeLabel(t) {
  if (t === "part_of") return "构成";
  if (t === "segment_of") return "路段";
  if (t === "landmark_of") return "地标关联";
  return t || "关联";
}

function edgeStatusChip(status) {
  if (status === "approved") return '<span class="chip ok">已校验</span>';
  if (status === "rejected") return '<span class="chip bad">已驳回</span>';
  return '<span class="chip warn">待校验</span>';
}

function edgeReviewBtns(edgeId, status) {
  if (!edgeId) return "";
  const st = status || "proposed";
  return `<span class="edge-actions" data-edge-id="${edgeId}">
    <button type="button" class="btn tiny ${st === "approved" ? "" : "secondary"}" data-edge-status="approved">通过</button>
    <button type="button" class="btn tiny secondary" data-edge-status="rejected">驳回</button>
    ${st !== "proposed" ? '<button type="button" class="btn tiny secondary" data-edge-status="proposed">重置</button>' : ""}
  </span>`;
}

function renderEdgeLine(c, { upward = false } = {}) {
  const cat = `${c.cat_l1 || ""}/${c.cat_l2 || ""}`;
  const cams =
    c.camera_count != null ? ` <span class="muted">相机 ${c.camera_count}</span>` : "";
  const arrow = upward ? " ↑" : "";
  const belong = upward ? "属于 " : "";
  return (
    `<li>` +
    `<span class="chip">${escapeHtml(edgeTypeLabel(c.edge_type))}${arrow}</span> ` +
    edgeStatusChip(c.edge_status) +
    ` ${belong}<b>${escapeHtml(c.entity_name)}</b> ` +
    `<span class="muted">${escapeHtml(cat)}</span>${cams} ` +
    edgeReviewBtns(c.edge_id, c.edge_status) +
    `</li>`
  );
}

function renderEntityTree(d) {
  const parent = d.entity_parent;
  const children = d.entity_children || [];
  const related = d.entity_related || [];
  const asChild = d.entity_as_child_of || [];
  if (!parent && !children.length && !related.length && !asChild.length) {
    return '<div class="entity-tree empty-tree">暂无构成/子实体/关联</div>';
  }
  const childLines = children.map((c) => renderEdgeLine(c)).join("");
  const relLines = related
    .map(
      (c) =>
        `<li><span class="chip warn">${escapeHtml(edgeTypeLabel(c.edge_type))}</span> ` +
        edgeStatusChip(c.edge_status) +
        ` <b>${escapeHtml(c.entity_name)}</b> ` +
        edgeReviewBtns(c.edge_id, c.edge_status) +
        `</li>`
    )
    .join("");
  const upLines = asChild.map((c) => renderEdgeLine(c, { upward: true })).join("");
  return `
    <div class="entity-tree">
      <div class="tree-title">构成关系 <span class="muted">（场所构成 / 路段优先校验）</span></div>
      ${
        parent
          ? `<div class="tree-parent">父实体 · <b>${escapeHtml(parent.entity_name)}</b>
               <span class="muted">${escapeHtml((parent.cat_l1 || "") + "/" + (parent.cat_l2 || ""))}</span></div>`
          : ""
      }
      ${upLines ? `<ul class="tree-list">${upLines}</ul>` : ""}
      ${
        childLines
          ? `<div class="tree-subtitle">子实体 / 路段</div><ul class="tree-list">${childLines}</ul>`
          : ""
      }
      ${
        relLines
          ? `<div class="tree-subtitle">关联</div><ul class="tree-list">${relLines}</ul>`
          : ""
      }
    </div>
  `;
}

async function reviewEdge(edgeId, status) {
  await api(`/api/edges/${edgeId}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status, reviewed_by: "web" }),
  });
  await loadStats();
  if (state.selectedId) {
    state.detail = await api(`/api/samples/${state.selectedId}`);
    renderDetail();
  }
}

function renderPipeline() {
  const focus = state.stats?.current_focus_step ?? 2;
  const p = state.stats?.progress || {};
  $("pipeline").innerHTML = state.pipeline
    .map((s) => {
      const active = s.step === focus;
      const done = s.step < focus;
      let badge = "未开始";
      if (s.step === 1) badge = "已接入";
      if (s.step === 2) {
        badge = (p.step2_pending ?? 0) > 0 ? `${p.step2_pending} 待跑` : "完成";
      }
      if (s.step === 3) {
        badge = (p.step3_pending ?? 0) > 0
          ? `${p.step3_pending} 待聚`
          : `${state.stats?.entity_count ?? p.step3_done ?? 0} 实体`;
      }
      if (s.step === 5) {
        badge = (p.step5_pending ?? 0) > 0
          ? `${p.step5_pending} 待标`
          : `${p.step5_done ?? 0} 已标`;
      }
      if (s.step > focus && s.step !== 5) badge = "未开始";
      if (done && s.step === 1) badge = "完成";
      if (done && s.step === 2) badge = "完成";
      if ((p.step5_done ?? 0) > 0 && s.step === 5) {
        /* keep badge above */
      }
      return `<div class="step ${active ? "active" : ""} ${done ? "done" : ""}">
        <div class="idx">STEP ${s.step}</div>
        <h3>${s.title}</h3>
        <p>${s.desc}</p>
        <div class="badge">${badge}</div>
      </div>`;
    })
    .join("");
}

function slotLabel(s) {
  return ({ morning: "早", noon: "中", afternoon: "晚" }[s] || s);
}

function renderTagList(tags, { dynamic = false } = {}) {
  const list = Array.isArray(tags) ? tags : [];
  if (!list.length) return '<span class="muted">—</span>';
  return list
    .map((t) => {
      const conf = t.confidence === "没把握" ? " warn" : " ok";
      let text = t.key || "";
      if (t.value) text += `:${t.value}`;
      if (dynamic && t.level) text += `·${t.level}`;
      if (dynamic && Array.isArray(t.slots) && t.slots.length) {
        text += ` (${t.slots.map(slotLabel).join("")})`;
      }
      return `<span class="chip${conf}">${escapeHtml(text)}</span>`;
    })
    .join(" ");
}

function renderSceneTags(d) {
  if (!d.step5_at && !d.scene_type) {
    return `<div class="card">
      <h3>第5步 · 画面理解</h3>
      <div class="muted">尚未打标签</div>
      <div class="actions" style="margin-top:10px">
        <button class="btn" id="btnRunStep5">跑第5步</button>
      </div>
    </div>`;
  }
  return `<div class="card">
    <h3>第5步 · 画面理解</h3>
    <div class="kv">
      <div class="row"><span>场景</span><b>${escapeHtml(d.scene_type || "—")} · ${escapeHtml(d.scene_viewpoint || "—")}</b></div>
      <div class="row"><span>把握</span><b>${escapeHtml(d.step5_confidence || "—")}</b></div>
      <div class="row"><span>摘要</span><b>${escapeHtml(d.scene_summary || "—")}</b></div>
      <div class="row"><span>定位锚点</span><b class="tag-wrap">${renderTagList(d.static_tags)}</b></div>
      <div class="row"><span>当下状态</span><b class="tag-wrap">${renderTagList(d.dynamic_tags, { dynamic: true })}</b></div>
    </div>
    <div class="actions" style="margin-top:10px">
      <button class="btn secondary" id="btnRunStep5">重跑第5步</button>
    </div>
  </div>`;
}

function renderStats() {
  const s = state.stats;
  if (!s) return;
  const p = s.progress || {};
  const e = s.edge_stats || {};
  $("topStats").innerHTML = [
    ["样本", s.total],
    ["有价值", p.worth_yes],
    ["候选实体", s.entity_count ?? 0],
    ["构成待校", e.edge_pending],
    ["画面已标", p.step5_done],
    ["画面待标", p.step5_pending],
  ]
    .map(([k, v]) => `<div class="stat"><b>${v ?? 0}</b><span>${k}</span></div>`)
    .join("");

  const sel = $("stratum");
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">全部分层</option>' +
    (s.by_stratum || [])
      .map((x) => `<option value="${x.stratum}">${x.stratum} (${x.n})</option>`)
      .join("");
  sel.value = cur;
}

function renderList() {
  $("listCount").textContent = state.items.length;
  $("list").innerHTML = state.items
    .map((it) => {
      const active = it.id === state.selectedId ? "active" : "";
      const cat =
        it.effective_cat_l1 && it.effective_cat_l2
          ? `${it.effective_cat_l1}/${it.effective_cat_l2}`
          : it.cat_l1
            ? `${it.cat_l1}/${it.cat_l2 || "—"}`
            : "未分类";
      return `<button class="item ${active}" data-id="${it.id}">
        <div class="name">${escapeHtml(it.camera_name || it.camera_id)}</div>
        <div class="meta">
          <span class="chip">${escapeHtml(it.sample_stratum)}</span>
          ${worthChip(it.worth_use)}
          ${confChip(it.ai_confidence || it.step3_confidence)}
          <span class="chip">${escapeHtml(cat)}</span>
          ${nameSceneConflict(it)}${amapConflict(it)}${it.entity_name_proposed ? `<span class="chip ok">实体·${escapeHtml(it.entity_name_proposed)}</span>` : (it.worth_use === 1 ? '<span class="chip">待聚实体</span>' : '')}${it.scene_type ? `<span class="chip">景·${escapeHtml(it.scene_type)}</span>` : (it.worth_use === 1 ? '<span class="chip warn">待画面标签</span>' : '')}
        </div>
      </button>`;
    })
    .join("");

  $("list").querySelectorAll(".item").forEach((el) => {
    el.addEventListener("click", () => selectSample(Number(el.dataset.id)));
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stepNodes(pipelineStep) {
  const labels = ["接入", "筛选分类", "建模", "发布", "应用"];
  return labels
    .map((label, i) => {
      const stepNum = i + 1;
      let cls = "wait";
      if (stepNum === 1) cls = "on";
      if (pipelineStep >= 2 && stepNum === 2) cls = "on";
      if (pipelineStep >= 3 && stepNum === 3) cls = "on";
      if (pipelineStep >= stepNum && stepNum > 3) cls = "on";
      if (stepNum === 2 && pipelineStep < 2) cls = "";
      if (stepNum === 3 && pipelineStep < 3) cls = "";
      return `<div class="node ${cls}">${stepNum}. ${label}</div>`;
    })
    .join("");
}

function renderDetail() {
  const d = state.detail;
  if (!d) {
    $("detail").innerHTML = '<div class="empty">从左侧选择一路相机</div>';
    return;
  }

  const viewable = (d.images || []).filter((im) => im.url);
  const imgs = (d.images || [])
    .map((im) => {
      if (!im.url) {
        return `<div class="shot missing"><span class="tag">${im.label}</span>无图</div>`;
      }
      const idx = viewable.findIndex((v) => v.slot === im.slot);
      return `<div class="shot" data-lb-index="${idx}" title="点击放大"><span class="tag">${im.label}</span><img src="${im.url}" alt="${im.label}" loading="lazy" referrerpolicy="no-referrer" decoding="async" onerror="this.closest('.shot').classList.add('broken');this.closest('.shot').removeAttribute('data-lb-index');this.replaceWith(Object.assign(document.createElement('span'),{className:'broken-msg',textContent:'加载失败'}))" /></div>`;
    })
    .join("");

  $("detail").innerHTML = `
    <div class="detail-inner">
      <div class="detail-head">
        <div>
          <h2>${escapeHtml(d.camera_name)}</h2>
          <div class="ids">${escapeHtml(d.camera_id)} · id ${d.id} · ${escapeHtml(d.sample_stratum)}</div>
        </div>
        <div class="actions">
          <button class="btn secondary" id="btnPrev">上一路</button>
          <button class="btn secondary" id="btnNext">下一路</button>
          <button class="btn" id="btnRunStep2" ${d.worth_use != null ? "" : ""}>跑第2步</button>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:12px">
          <h3>本路链路进度</h3>
          <div class="flow">${stepNodes(d.pipeline_step || 0)}</div>
        </div>
        <div class="gallery">${imgs || '<div class="shot missing">无截帧</div>'}</div>
        <div class="scene-under-gallery">${renderSceneTags(d)}</div>
      </div>

      <div class="grid2">
        <div class="card">
          <h3>输入要素</h3>
          <div class="kv">
            <div class="row"><span>名称</span><b>${escapeHtml(d.camera_name)}</b></div>
            <div class="row"><span>经度</span><b>${d.gcj02_lon ?? "—"}</b></div>
            <div class="row"><span>纬度</span><b>${d.gcj02_lat ?? "—"}</b></div>
            <div class="row"><span>高德POI</span><b>${escapeHtml(d.amap_nearest_poi_name || "—")}${amapConflict(d) ? "（弱参考，冲突时以名称+画面为准）" : ""}</b></div>
            <div class="row"><span>高德类型</span><b>${escapeHtml(d.amap_nearest_poi_type || "—")}</b></div>
            <div class="row"><span>地址</span><b>${escapeHtml(d.amap_formatted_address || "—")}</b></div>
            <div class="row"><span>状态</span><b>${escapeHtml(d.status)}</b></div>
          </div>
        </div>
        <div class="card">
          <h3>第2步 · AI 结果</h3>
          <div class="kv">
            <div class="row"><span>价值</span><b>${d.worth_use == null ? "未跑" : d.worth_use === 1 ? "用" : "不用"}</b></div>
            <div class="row"><span>一级</span><b>${escapeHtml(d.cat_l1 || "—")}</b></div>
            <div class="row"><span>二级</span><b>${escapeHtml(d.cat_l2 || "—")}</b></div>
            <div class="row"><span>把握</span><b>${escapeHtml(d.ai_confidence || "—")}${d.name_scene_conflict ? " · 名称画面冲突" : ""}</b></div>
            <div class="row"><span>主招牌</span><b>${escapeHtml(d.dominant_sign_text || "—")}${d.name_scene_conflict ? "（与名称不一致）" : ""}</b></div>
            <div class="row"><span>依据</span><b>${escapeHtml(d.step2_reason || "—")}</b></div>
            <div class="row"><span>画面</span><b>${escapeHtml(d.scene_desc || "—")}</b></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>第3步 · 候选实体</h3>
        <div class="kv">
          <div class="row"><span>实体名</span><b>${escapeHtml(d.entity_name_proposed || d.entity?.entity_name || "—")}</b></div>
          <div class="row"><span>分类</span><b>${escapeHtml((d.entity?.cat_l1 || d.cat_l1 || "—") + "/" + (d.entity?.cat_l2 || d.cat_l2 || "—"))}</b></div>
          <div class="row"><span>同实体相机</span><b>${d.entity?.camera_count ?? (d.entity_proposal_id ? "已挂" : "未聚")}</b></div>
          <div class="row"><span>把握</span><b>${escapeHtml(d.step3_confidence || d.entity?.confidence || "—")}</b></div>
          <div class="row"><span>依据</span><b>${escapeHtml(d.entity?.reason || "—")}</b></div>
        </div>
        ${renderEntityTree(d)}
      </div>

      <div class="grid2">
        <div class="card">
          <h3>人审（可改）</h3>
          <div class="field">
            <label>要不要用</label>
            <select id="hWorth">
              <option value="">（沿用 AI）</option>
              <option value="1" ${d.human_worth_use === 1 ? "selected" : ""}>用</option>
              <option value="0" ${d.human_worth_use === 0 ? "selected" : ""}>不用</option>
            </select>
          </div>
          <div class="field">
            <label>一级分类</label>
            <input id="hL1" value="${escapeHtml(d.human_cat_l1 || "")}" placeholder="如：交通出行" />
          </div>
          <div class="field">
            <label>二级分类</label>
            <input id="hL2" value="${escapeHtml(d.human_cat_l2 || "")}" placeholder="如：停车场" />
          </div>
          <div class="field">
            <label>画面说明</label>
            <textarea id="hDesc" placeholder="可选">${escapeHtml(d.human_scene_desc || "")}</textarea>
          </div>
          <button class="btn" id="btnSaveReview">保存人审</button>
        </div>
        <div class="card">
          <h3>后续步骤（预留）</h3>
          <div class="kv">
            <div class="row"><span>第3步</span><b>${d.entity_proposal_id ? ("已挂 #" + d.entity_proposal_id) : "未聚实体"}</b></div>
            <div class="row"><span>第4步</span><b>未开始 · 发布门禁</b></div>
            <div class="row"><span>第5步</span><b>${d.step5_at ? ("已标 · " + escapeHtml(d.scene_type || "")) : "未打标签"}</b></div>
            <div class="row"><span>更新</span><b>${escapeHtml(d.updated_at || "—")}</b></div>
          </div>
        </div>
      </div>
    </div>
  `;

  $("btnPrev").onclick = () => nav(-1);
  $("btnNext").onclick = () => nav(1);
  $("btnRunStep2").onclick = () => runStep2(d.id);
  $("btnSaveReview").onclick = () => saveReview(d.id);
  if ($("btnRunStep5")) $("btnRunStep5").onclick = () => runStep5(d.id);

  document.querySelectorAll("#detail .edge-actions button").forEach((btn) => {
    btn.onclick = async (ev) => {
      ev.preventDefault();
      const wrap = btn.closest(".edge-actions");
      const edgeId = Number(wrap?.dataset.edgeId);
      const status = btn.dataset.edgeStatus;
      if (!edgeId || !status) return;
      btn.disabled = true;
      try {
        await reviewEdge(edgeId, status);
      } catch (err) {
        alert("边校验失败：" + err.message);
        btn.disabled = false;
      }
    };
  });

  const gallery = document.querySelector("#detail .gallery");
  if (gallery) {
    gallery.onclick = (e) => {
      const shot = e.target.closest(".shot[data-lb-index]");
      if (!shot) return;
      const idx = Number(shot.dataset.lbIndex);
      if (Number.isNaN(idx) || idx < 0) return;
      openLightbox(viewable, idx);
    };
  }
}

function openLightbox(images, index) {
  const urls = images.map((im) => im.url).filter(Boolean);
  if (!urls.length) return;
  state.lightbox = {
    open: true,
    urls,
    labels: images.map((im) => im.label || ""),
    index: Math.max(0, Math.min(index, urls.length - 1)),
  };
  renderLightbox();
}

function closeLightbox() {
  state.lightbox.open = false;
  renderLightbox();
}

function stepLightbox(delta) {
  const lb = state.lightbox;
  if (!lb.open || lb.urls.length < 2) return;
  lb.index = (lb.index + delta + lb.urls.length) % lb.urls.length;
  renderLightbox();
}

function renderLightbox() {
  const root = $("lightbox");
  if (!root) return;
  const lb = state.lightbox;
  if (!lb.open) {
    root.hidden = true;
    document.body.style.overflow = "";
    return;
  }
  root.hidden = false;
  document.body.style.overflow = "hidden";
  $("lbImg").src = lb.urls[lb.index];
  $("lbImg").alt = lb.labels[lb.index] || "";
  $("lbCap").textContent =
    lb.urls.length > 1
      ? `${lb.labels[lb.index] || ""} · ${lb.index + 1}/${lb.urls.length}`
      : lb.labels[lb.index] || "";
  const multi = lb.urls.length > 1;
  $("lbPrev").disabled = !multi;
  $("lbNext").disabled = !multi;
  $("lbPrev").style.visibility = multi ? "visible" : "hidden";
  $("lbNext").style.visibility = multi ? "visible" : "hidden";
}

function nav(delta) {
  const idx = state.items.findIndex((x) => x.id === state.selectedId);
  if (idx < 0) return;
  const next = state.items[idx + delta];
  if (next) selectSample(next.id);
}

async function selectSample(id) {
  state.selectedId = id;
  renderList();
  // 选中项滚进左侧列表可视区
  const active = document.querySelector(`.item.active`);
  if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  state.detail = await api(`/api/samples/${id}`);
  renderDetail();
  // 右侧详情回到顶部；窄屏时把详情滚进视口
  const detail = $("detail");
  if (detail) {
    detail.scrollTop = 0;
    if (window.matchMedia("(max-width: 980px)").matches) {
      detail.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }
}

async function loadStats() {
  state.stats = await api("/api/stats");
  renderStats();
  renderPipeline();
}

async function loadList() {
  const params = new URLSearchParams();
  const q = $("q").value.trim();
  const stratum = $("stratum").value;
  const worth = $("worth").value;
  const edge = $("edge")?.value || "";
  const step5 = $("step5")?.value || "";
  if (q) params.set("q", q);
  if (stratum) params.set("stratum", stratum);
  if (worth) params.set("worth", worth);
  if (edge) params.set("edge", edge);
  if (step5) params.set("step5", step5);
  params.set("limit", "200");
  const data = await api(`/api/samples?${params}`);
  state.items = data.items;
  renderList();
  if (state.selectedId && !state.items.some((x) => x.id === state.selectedId)) {
    state.selectedId = null;
    state.detail = null;
    renderDetail();
  }
}

async function saveReview(id) {
  const body = {
    human_worth_use: $("hWorth").value === "" ? null : Number($("hWorth").value),
    human_cat_l1: $("hL1").value.trim() || null,
    human_cat_l2: $("hL2").value.trim() || null,
    human_scene_desc: $("hDesc").value.trim() || null,
    reviewed_by: "web",
  };
  // omit nulls that mean "clear"? send as-is; backend exclude_unset — we need to always send
  state.detail = await api(`/api/samples/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  await loadStats();
  await loadList();
  renderDetail();
}

async function runStep2(id) {
  const btn = $("btnRunStep2");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "跑第2步中…";
  }
  try {
    state.detail = await api(`/api/samples/${id}/step2`, { method: "POST" });
    await loadStats();
    await loadList();
    renderDetail();
  } catch (e) {
    alert("第2步失败：\n" + e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "跑第2步";
    }
  }
}

async function runStep5(id) {
  const btn = $("btnRunStep5");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "跑第5步中…";
  }
  try {
    state.detail = await api(`/api/samples/${id}/step5`, { method: "POST" });
    await loadStats();
    await loadList();
    renderDetail();
  } catch (e) {
    alert("第5步失败：\n" + e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "跑第5步";
    }
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function pollBatch() {
  try {
    const s = await api("/api/step2/batch");
    const hint = $("batchHint");
    const btn = $("btnBatchStep2");
    if (s.running) {
      hint.textContent = `批量中 ${s.ok + s.fail}/${s.total}` + (s.current_id ? ` · #${s.current_id}` : "");
      if (btn) btn.disabled = true;
      await loadStats();
      await loadList();
      if (state.selectedId) {
        state.detail = await api(`/api/samples/${state.selectedId}`);
        renderDetail();
      }
    } else {
      if (btn) btn.disabled = false;
      if (s.message && s.message !== "idle") {
        hint.textContent = s.message;
      }
    }
  } catch (_) {
    /* ignore */
  }
}

async function startBatch() {
  const btn = $("btnBatchStep2");
  if (btn) btn.disabled = true;
  try {
    const res = await api("/api/step2/batch", {
      method: "POST",
      body: JSON.stringify({ limit: 200, workers: 2 }),
    });
    $("batchHint").textContent = res.started ? "已开始批量…" : "已有任务在跑";
  } catch (e) {
    alert("启动批量失败：" + e.message);
    if (btn) btn.disabled = false;
  }
}

async function pollStep3() {
  try {
    const s = await api("/api/step3/batch");
    const hint = $("batchHint");
    const btn = $("btnBatchStep3");
    if (s.running) {
      hint.textContent = "第3步聚类中…";
      if (btn) btn.disabled = true;
    } else {
      if (btn) btn.disabled = false;
      if (s.message && s.message !== "idle" && String(s.message).startsWith("done")) {
        hint.textContent = s.message;
        await loadStats();
        await loadList();
        if (state.selectedId) {
          state.detail = await api(`/api/samples/${state.selectedId}`);
          renderDetail();
        }
      }
    }
  } catch (_) {}
}

async function startStep3() {
  const btn = $("btnBatchStep3");
  if (btn) btn.disabled = true;
  try {
    const res = await api("/api/step3/batch?reset=true", { method: "POST" });
    $("batchHint").textContent = res.started ? "第3步已开始…" : "第3步任务已在跑";
  } catch (e) {
    alert("启动第3步失败：" + e.message);
    if (btn) btn.disabled = false;
  }
}

async function pollStep5() {
  try {
    const s = await api("/api/step5/batch");
    const hint = $("batchHint");
    const btn = $("btnBatchStep5");
    if (s.running) {
      hint.textContent =
        `第5步打标中 ${s.ok + s.fail}/${s.total}` +
        (s.current_id ? ` · #${s.current_id}` : "");
      if (btn) btn.disabled = true;
      await loadStats();
      if (state.selectedId) {
        state.detail = await api(`/api/samples/${state.selectedId}`);
        renderDetail();
      }
    } else {
      if (btn) btn.disabled = false;
      if (s.message && s.message !== "idle" && String(s.message).startsWith("done")) {
        hint.textContent = "第5步 " + s.message;
        await loadStats();
        await loadList();
        if (state.selectedId) {
          state.detail = await api(`/api/samples/${state.selectedId}`);
          renderDetail();
        }
      }
    }
  } catch (_) {}
}

async function startStep5() {
  const btn = $("btnBatchStep5");
  if (btn) btn.disabled = true;
  try {
    const res = await api("/api/step5/batch?limit=30&workers=2", { method: "POST" });
    $("batchHint").textContent = res.started ? "第5步已开始（先30路）…" : "第5步任务已在跑";
  } catch (e) {
    alert("启动第5步失败：" + e.message);
    if (btn) btn.disabled = false;
  }
}

async function boot() {
  const pipe = await api("/api/pipeline");
  state.pipeline = pipe.steps;
  await loadStats();
  await loadList();
  if (state.items[0]) await selectSample(state.items[0].id);

  $("q").addEventListener("input", debounce(loadList, 250));
  $("stratum").addEventListener("change", loadList);
  $("worth").addEventListener("change", loadList);
  if ($("edge")) $("edge").addEventListener("change", loadList);
  if ($("step5")) $("step5").addEventListener("change", loadList);
  $("btnBatchStep2").addEventListener("click", startBatch);
  $("btnBatchStep3").addEventListener("click", startStep3);
  if ($("btnBatchStep5")) $("btnBatchStep5").addEventListener("click", startStep5);

  $("lbClose").onclick = closeLightbox;
  $("lbPrev").onclick = () => stepLightbox(-1);
  $("lbNext").onclick = () => stepLightbox(1);
  $("lightbox").addEventListener("click", (e) => {
    if (e.target === $("lightbox") || e.target.classList.contains("lb-stage")) {
      closeLightbox();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!state.lightbox.open) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  setInterval(pollBatch, 4000);
  setInterval(pollStep3, 3000);
  setInterval(pollStep5, 4000);
  pollBatch();
  pollStep3();
  pollStep5();
}

boot().catch((e) => {
  $("topStats").textContent = "加载失败：" + e.message;
});
