// rev17: 按事件标准定稿模式改造 流程运行/持续治理/配置管理 + 全局抽屉下拉样式 + 工具栏间距 + 启停独立按钮
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const fail = (msg) => { console.error('✗ ' + msg); process.exit(1); };

function apply(file, label, fn) {
  const p = `${DIR}/${file}`;
  const before = readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) { console.log(`  = ${file} ${label} (unchanged)`); return; }
  writeFileSync(p, after);
  console.log(`  ✓ ${file} ${label}`);
}
const must = (cond, msg) => { if (!cond) fail(msg); };

/* ───────── 共享片段 ───────── */

const CSS_DRAWER = `
.gc-scrim { position: fixed; inset: 0; background: rgba(22, 45, 77, 0.32); z-index: 50; }
.gc-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 90vw; background: var(--gc-panel); border-left: 1px solid var(--gc-line); z-index: 60; display: flex; flex-direction: column; }
.gc-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--gc-line); }
.gc-drawer-title { font-size: 15px; font-weight: 600; margin: 0; }
.gc-drawer-body { flex: 1; overflow-y: auto; padding: 16px 20px; font-size: 13px; }
.gc-drawer-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--gc-line); }
.gc-ov-close { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--gc-line); background: var(--gc-panel); color: var(--gc-muted); cursor: pointer; font-size: 14px; font-family: inherit; }
.gc-ov-close:hover { color: var(--gc-text); background: var(--gc-bg-hover); }
.gc-ov-close:focus-visible { outline: 2px solid var(--gc-accent); outline-offset: 2px; }
.gc-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.gc-form-grid .gc-field--full { grid-column: 1 / -1; }
.gc-field { display: flex; flex-direction: column; gap: 6px; }
.gc-field label { font-size: 12px; color: var(--gc-muted); }
.gc-field input, .gc-field select { height: 36px; border: 1px solid var(--gc-line-strong); border-radius: 8px; padding: 0 10px; font: inherit; font-size: 13px; background: var(--gc-panel); color: var(--gc-text); min-width: 0; }
.gc-field input:focus, .gc-field select:focus { outline: 2px solid var(--gc-accent); outline-offset: -1px; border-color: var(--gc-accent); }
.gc-ov-note { margin: 12px 0 0; font-size: 12px; color: var(--gc-muted); }
.gc-btn-ghost { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--gc-line-strong); background: var(--gc-panel); color: var(--gc-text); font-size: 13px; cursor: pointer; font-family: inherit; }
.gc-btn-ghost:hover { background: var(--gc-bg-hover); }
.gc-btn-ghost:focus-visible { outline: 2px solid var(--gc-accent); outline-offset: 2px; }
.gc-diff-mark { display: inline-block; margin-left: 6px; font-size: 11px; font-weight: 500; color: var(--gc-func-orange); background: var(--gc-func-orange-soft); border-radius: 9999px; padding: 1px 8px; vertical-align: 1px; }`;

const CSS_OPS = `
.gc-btn-link { display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; font-size: 12px; font-weight: 500; font-family: inherit; color: var(--gc-accent); background: transparent; border: 1px solid var(--gc-line); border-radius: var(--gc-radius-small, 7px); text-decoration: none; cursor: pointer; }
.gc-btn-link:hover { color: var(--gc-accent); background: var(--gc-accent-soft); border-color: var(--gc-accent-soft); }
.gc-btn-link:focus-visible { outline: 2px solid var(--gc-accent); outline-offset: 1px; }
.gc-chip { display: inline-flex; align-items: center; font-size: 11px; font-weight: 500; line-height: 1.5; border-radius: 9999px; padding: 1px 8px; white-space: nowrap; }
.gc-chip--on { color: var(--gc-func-green); background: var(--gc-func-green-soft); }
.gc-chip--off { color: var(--gc-disabled-text); background: var(--gc-disabled-bg); }
.gc-th-actions { text-align: right; }
.gc-td-actions { white-space: nowrap; }
.gc-td-actions > * + * { margin-left: 8px; }`;

const CSS_SELECT = `
.gc-field select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 14px 14px; padding-right: 32px; cursor: pointer; }
.gc-field select:hover { border-color: var(--gc-accent); }`;

const CSS_TOOLBAR = `
.gc-toolbar { margin-bottom: 14px; }`;

const JS_SWITCH = `
<script id="gc-switch-js">
(function () {
  document.addEventListener('click', function (e) {
    var sw = e.target.closest ? e.target.closest('.gc-switch') : null;
    if (!sw) return;
    if (sw.closest('.gc-switch-item--readonly')) return;
    var on = sw.getAttribute('aria-checked') === 'true';
    sw.setAttribute('aria-checked', on ? 'false' : 'true');
    sw.classList.toggle('gc-switch--on', !on);
    var lb = sw.getAttribute('aria-label') || '';
    if (/(：|:)(开|关)$/.test(lb)) sw.setAttribute('aria-label', lb.replace(/(：|:)(开|关)$/, on ? '$1关' : '$1开'));
  });
})();
</script>`;

const injectBeforeBody = (h, block) => h.replace('</body>', block + '\n</body>');

/* ───────── G. 全局：下拉样式 + 工具栏间距 + org 文案 ───────── */

const SELECT_PAGES = ['org-permission-live.html', 'org-permission-draft.html', 'org-disable-confirm.html', 'org-role-drawer.html', 'space-responsibility-draft.html', 'event-standard-draft.html'];
for (const f of SELECT_PAGES) {
  apply(f, 'G1 抽屉下拉样式', (h) => {
    must(h.includes('<select'), f + ': 无 select');
    must(!h.includes('gc-select-caret'), f + ': 已有 caret 包装，跳过判断失败');
    must(h.includes('gc-field'), f + ': 无 gc-field');
    if (h.includes('id="gc-rev17-css"')) return h;
    return injectBeforeBody(h, '<style id="gc-rev17-css">' + CSS_SELECT + '\n</style>');
  });
}

const TOOLBAR_PAGES = ['org-permission-live.html', 'org-permission-draft.html', 'org-disable-confirm.html', 'org-role-drawer.html', 'space-responsibility-live.html', 'space-responsibility-draft.html'];
for (const f of TOOLBAR_PAGES) {
  apply(f, 'G2 工具栏间距', (h) => {
    must(h.includes('class="gc-toolbar"'), f + ': 无 gc-toolbar');
    if (h.includes('.gc-toolbar { margin-bottom: 14px; }')) return h;
    if (h.includes('id="gc-rev17-css"')) {
      return h.replace('<style id="gc-rev17-css">', '<style id="gc-rev17-css">' + CSS_TOOLBAR + '\n');
    }
    return injectBeforeBody(h, '<style id="gc-rev17-css">' + CSS_TOOLBAR + '\n</style>');
  });
}

for (const f of ['org-permission-live.html', 'org-permission-draft.html', 'org-disable-confirm.html', 'org-role-drawer.html']) {
  apply(f, 'G3 去（演示不落库）', (h) => h.split('保存将写入草稿，发布后生效（演示不落库）。').join('保存将写入草稿，发布后生效。'));
}

/* ───────── L. 生命周期 ───────── */

apply('lifecycle-live.html', 'L1 live 底部去掉发布前预览', (h) => {
  const re = /<a class="gc-btn-primary" href="publish-preview\.html" data-dom-id="cta-go-preview">[\s\S]*?<\/a>\s*/;
  must(re.test(h), 'lifecycle-live: 底部预览按钮未找到');
  return h.replace(re, '');
});

apply('lifecycle-live.html', 'L1b live 横幅去尾句', (h) => {
  const old = '。草稿不能直接覆盖已生效版本。</span>';
  must(h.includes(old), 'lifecycle-live: 横幅尾句未找到');
  return h.replace(old, '。</span>');
});

apply('lifecycle-draft.html', 'L2 横幅去尾句 + 自动结案开关可交互', (h) => {
  const old = '。草稿不能直接覆盖已生效版本。</span>';
  must(h.includes(old), 'lifecycle-draft: 横幅尾句未找到');
  let out = h.replace(old, '。</span>');
  must(!out.includes('id="lifecycle-edit-js"'), 'lifecycle-draft: 已存在脚本');
  const block = `
<script id="lifecycle-edit-js">
(function () {
  var row = document.querySelector('.gc-autoclose-row');
  var sw = row.querySelector('.gc-switch');
  var state = row.querySelector('.gc-autoclose-state');
  var mark = state.querySelector('.gc-diff-mark');
  var chip = row.querySelector('.gc-chip');
  var bannerSpan = document.querySelector('.gc-banner span');
  function render(on) {
    sw.classList.toggle('gc-switch--on', on);
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    sw.setAttribute('aria-label', '自动结案开关（草稿：' + (on ? '开' : '关') + '）');
    state.firstChild.nodeValue = '自动结案：' + (on ? '开' : '关') + '（草稿）';
    if (mark) mark.hidden = !on;
    chip.textContent = on ? '共享单车乱停放（已选细类）' : '共享单车乱停放（候选）';
    bannerSpan.textContent = on ? '草稿编辑中：自动结案 关 → 开（共享单车乱停放）。' : '草稿与生效版一致：自动结案 关。';
  }
  sw.addEventListener('click', function () {
    render(sw.getAttribute('aria-checked') !== 'true');
  });
})();
</script>
`;
  return injectBeforeBody(out, block);
});

/* ───────── S. 时限规则（sla-matrix） ───────── */

const SLA_ORIG = `var ORIG = {
  '共享单车乱停放×一般': [15, 120, 30, 1440, '升级提醒'],
  '机动车违停×一般': [15, 60, 30, 1440, '升级提醒'],
  '占道经营×一般': [15, 90, 30, 1440, '升级提醒'],
  '施工占道×紧急': [10, 45, 20, 720, '升级 + 挂督办'],
  '暴露垃圾×紧急': [10, 30, 20, 720, '升级 + 挂督办'],
  '非法倾倒×一般': [15, 120, 30, 2880, '升级提醒'],
  '无证户外广告×一般': [15, 1440, 30, 4320, '升级提醒'],
  '违规灯箱×一般': [15, 2880, 30, 4320, '升级提醒']
};`;

const slaThead = (h) => {
  const old = '<th scope="col">超时动作</th>';
  must(h.includes(old), 'sla: thead 未找到');
  return h.replace(old, old + '<th scope="col" class="gc-th-actions">操作</th>');
};
const slaKeyOf = (tr) => {
  const m = tr.match(/<td>([^<]+)<\/td>\s*<td><span class="gc-tag gc-tag--(?:normal|urgent)">([^<]+)<\/span>/);
  must(m, 'sla: 行键解析失败 ' + tr.slice(0, 60));
  return [m[1] + '×' + m[2], m[1], m[2]];
};

apply('sla-matrix-live.html', 'S1 live 行编辑入口 + 共享CSS', (h) => {
  let out = slaThead(h);
  out = out.replace(/<tr>[\s\S]*?<\/tr>/g, (tr) => {
    if (!tr.includes('gc-tag')) return tr;
    const [key, sub, lv] = slaKeyOf(tr);
    return tr.replace(/<\/tr>$/, '<td class="gc-td-actions"><a class="gc-btn-link" href="sla-matrix-draft.html?edit=' + encodeURIComponent(key) + '" title="进入草稿，编辑该行时限">编辑</a></td></tr>');
  });
  if (!out.includes('id="gc-rev17-css"')) out = injectBeforeBody(out, '<style id="gc-rev17-css">' + CSS_OPS + '\n</style>');
  return out;
});

apply('sla-matrix-draft.html', 'S2 横幅去尾句 + 行编辑抽屉 + 钩子', (h) => {
  const old = '。草稿不能直接覆盖已生效版本。</span>';
  must(h.includes(old), 'sla-draft: 横幅尾句未找到');
  let out = h.replace(old, '。</span>');
  out = slaThead(out);
  out = out.replace(/<tr>[\s\S]*?<\/tr>/g, (tr) => {
    if (!tr.includes('gc-tag')) return tr;
    const [key] = slaKeyOf(tr);
    const cell = '<td class="gc-td-actions"><button type="button" class="gc-btn-link" data-gc-sla-edit data-key="' + key + '">编辑</button></td>';
    return tr.replace(/<\/tr>$/, cell + '</tr>');
  });
  must(!out.includes('id="sla-edit-js"'), 'sla-draft: 已存在脚本');
  const block = `
<style id="sla-drawer-css">${CSS_DRAWER}
</style>
<div class="gc-scrim" data-gc-scrim hidden></div>
<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-sla-title" data-gc-drawer="sla" hidden>
  <div class="gc-drawer-head">
    <h2 class="gc-drawer-title" id="gc-sla-title">时限编辑</h2>
    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>
  </div>
  <div class="gc-drawer-body">
    <div class="gc-form-grid">
      <div class="gc-field"><label for="gc-s-case">立案时限（分钟）</label><input type="number" id="gc-s-case" min="1"></div>
      <div class="gc-field"><label for="gc-s-dispose">处置时限（分钟）</label><input type="number" id="gc-s-dispose" min="1"></div>
      <div class="gc-field"><label for="gc-s-check">核查时限（分钟）</label><input type="number" id="gc-s-check" min="1"></div>
      <div class="gc-field"><label for="gc-s-close">结案时限（分钟）</label><input type="number" id="gc-s-close" min="1"></div>
      <div class="gc-field gc-field--full"><label for="gc-s-act">超时动作</label>
        <select id="gc-s-act"><option>升级提醒</option><option>升级 + 挂督办</option></select>
      </div>
    </div>
    <p class="gc-ov-note">保存后写入草稿并标注与生效版的差异；发布后才作用于新事件。</p>
  </div>
  <div class="gc-drawer-foot">
    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>
    <button type="button" class="gc-btn-primary" data-gc-sla-save>保存到草稿</button>
  </div>
</aside>
<script id="sla-edit-js">
(function () {
  ${SLA_ORIG}
  var tbody = document.querySelector('table.gc-sla-table tbody');
  var scrim = document.querySelector('[data-gc-scrim]');
  var drawer = document.querySelector('[data-gc-drawer="sla"]');
  var cur = null;
  function parseMin(t) {
    t = t.trim();
    if (t.indexOf('小时') >= 0) return Math.round(parseFloat(t) * 60);
    return parseInt(t, 10);
  }
  function fmt(min) {
    if (min >= 240) { var hh = min / 60; return (Number.isInteger(hh) ? hh : hh.toFixed(1)) + ' 小时'; }
    return min + ' 分';
  }
  function rowKey(tr) {
    var sub = tr.children[1].textContent.trim();
    var tag = tr.children[2].textContent.trim();
    return sub + '×' + tag;
  }
  function open() { drawer.hidden = false; scrim.hidden = false; }
  function close() { drawer.hidden = true; scrim.hidden = true; }
  scrim.addEventListener('click', close);
  [].slice.call(document.querySelectorAll('[data-gc-close]')).forEach(function (b) { b.addEventListener('click', close); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-sla-edit]') : null;
    if (!b) return;
    var tr = b.closest('tr');
    cur = { key: b.getAttribute('data-key'), tr: tr };
    document.getElementById('gc-sla-title').textContent = '时限编辑 · ' + b.getAttribute('data-key');
    document.getElementById('gc-s-case').value = parseMin(tr.children[4].textContent);
    document.getElementById('gc-s-dispose').value = parseMin(tr.children[5].textContent);
    document.getElementById('gc-s-check').value = parseMin(tr.children[6].textContent);
    document.getElementById('gc-s-close').value = parseMin(tr.children[7].textContent);
    document.getElementById('gc-s-act').value = tr.children[8].textContent.trim();
    open();
  });
  document.querySelector('[data-gc-sla-save]').addEventListener('click', function () {
    if (!cur) return;
    var ids = ['gc-s-case', 'gc-s-dispose', 'gc-s-check', 'gc-s-close'];
    for (var i = 0; i < ids.length; i++) {
      var v = parseInt(document.getElementById(ids[i]).value, 10);
      if (!v || v < 1) { document.getElementById(ids[i]).focus(); return; }
    }
    var orig = ORIG[cur.key] || null;
    for (var i = 0; i < 4; i++) {
      var v = parseInt(document.getElementById(ids[i]).value, 10);
      var td = cur.tr.children[4 + i];
      var diff = orig && orig[i] !== v;
      td.innerHTML = fmt(v) + (diff ? '<span class="gc-diff-mark">草稿</span>' : '');
    }
    var act = document.getElementById('gc-s-act').value;
    var actDiff = orig && orig[4] !== act;
    cur.tr.children[8].innerHTML = (act === '升级 + 挂督办' ? '<span class="gc-tag gc-tag--supervise">' + act + '</span>' : act) + (actDiff ? '<span class="gc-diff-mark">草稿</span>' : '');
    close();
  });
  var qs = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search) : null;
  if (qs && qs.get('edit')) {
    var key = qs.get('edit');
    var b = document.querySelector('[data-gc-sla-edit][data-key="' + key + '"]');
    if (b) b.click();
  }
})();
</script>
`;
  return injectBeforeBody(out, block);
});

/* ───────── D. 派工与认领 ───────── */

apply('dispatch-claim-live.html', 'D1 live 横幅去尾句 + 共享CSS', (h) => {
  const old = '。草稿不能直接覆盖已生效版本。</span>';
  must(h.includes(old), 'dispatch-live: 横幅尾句未找到');
  let out = h.replace(old, '。</span>');
  if (!out.includes('id="gc-rev17-css"')) out = injectBeforeBody(out, '<style id="gc-rev17-css">' + CSS_OPS + '\n</style>');
  return out;
});

apply('dispatch-claim-draft.html', 'D2 尾句 + 调整入口 + 抽屉 + 开关可交互', (h) => {
  const old = '。草稿不能直接覆盖已生效版本。</span>';
  must(h.includes(old), 'dispatch-draft: 横幅尾句未找到');
  let out = h.replace(old, '。</span>');
  // 待立案卡片头加「调整」
  const headOld = '<span class="gc-chip gc-chip--sync">面向角色：立案审核</span>';
  must(out.includes(headOld), 'dispatch-draft: 待立案卡头未找到');
  out = out.replace(headOld, headOld + '<button type="button" class="gc-btn-link" data-gc-batch-adjust>调整</button>');
  // 回收预告步骤加「调整」
  const stepOld = '<div class="gc-step-desc">60 分钟进入预告<span class="gc-diff-mark">草稿</span></div>';
  must(out.includes(stepOld), 'dispatch-draft: 回收预告步骤未找到');
  out = out.replace(stepOld, '<div class="gc-step-desc">60 分钟进入预告<span class="gc-diff-mark">草稿</span><button type="button" class="gc-btn-link" data-gc-recycle-adjust>调整</button></div>');
  must(!out.includes('id="dispatch-edit-js"'), 'dispatch-draft: 已存在脚本');
  const block = `
<style id="dispatch-drawer-css">${CSS_DRAWER}
</style>
<div class="gc-scrim" data-gc-scrim hidden></div>
<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-dc-title" data-gc-drawer="dc" hidden>
  <div class="gc-drawer-head">
    <h2 class="gc-drawer-title" id="gc-dc-title">调整批次与回收参数</h2>
    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>
  </div>
  <div class="gc-drawer-body">
    <div class="gc-form-grid">
      <div class="gc-field"><label for="gc-d-batch">待立案默认件数</label><input type="number" id="gc-d-batch" min="1" max="99"></div>
      <div class="gc-field"><label for="gc-d-recycle">回收预告（分钟）</label><input type="number" id="gc-d-recycle" min="1"></div>
    </div>
    <p class="gc-ov-note">保存后写入草稿并标注与生效版的差异；发布后才作用于新事件。</p>
  </div>
  <div class="gc-drawer-foot">
    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>
    <button type="button" class="gc-btn-primary" data-gc-dc-save>保存到草稿</button>
  </div>
</aside>
<script id="dispatch-edit-js">
(function () {
  var scrim = document.querySelector('[data-gc-scrim]');
  var drawer = document.querySelector('[data-gc-drawer="dc"]');
  function open(focusId) {
    document.getElementById('gc-d-batch').value = document.querySelector('.gc-batch-num').textContent.trim();
    var step = document.querySelectorAll('.gc-step-desc')[2];
    document.getElementById('gc-d-recycle').value = parseInt(step.textContent.trim(), 10);
    drawer.hidden = false; scrim.hidden = false;
    document.getElementById(focusId).focus();
  }
  function close() { drawer.hidden = true; scrim.hidden = true; }
  scrim.addEventListener('click', close);
  [].slice.call(document.querySelectorAll('[data-gc-close]')).forEach(function (b) { b.addEventListener('click', close); });
  var bb = document.querySelector('[data-gc-batch-adjust]');
  var rb = document.querySelector('[data-gc-recycle-adjust]');
  if (bb) bb.addEventListener('click', function () { open('gc-d-batch'); });
  if (rb) rb.addEventListener('click', function () { open('gc-d-recycle'); });
  document.querySelector('[data-gc-dc-save]').addEventListener('click', function () {
    var batch = parseInt(document.getElementById('gc-d-batch').value, 10);
    var recycle = parseInt(document.getElementById('gc-d-recycle').value, 10);
    if (!batch || batch < 1) { document.getElementById('gc-d-batch').focus(); return; }
    if (!recycle || recycle < 1) { document.getElementById('gc-d-recycle').focus(); return; }
    var num = document.querySelector('.gc-batch-num');
    num.textContent = batch;
    var numMark = num.parentNode.querySelector('.gc-diff-mark');
    if (numMark) numMark.hidden = batch === 10;
    var step = document.querySelectorAll('.gc-step-desc')[2];
    var stepMark = step.querySelector('.gc-diff-mark');
    step.firstChild.nodeValue = recycle + ' 分钟进入预告';
    if (stepMark) stepMark.hidden = recycle === 30;
    var bannerSpan = document.querySelector('.gc-banner span');
    bannerSpan.textContent = (batch === 10 && recycle === 30)
      ? '草稿与生效版一致：暂无待发布改动。'
      : '草稿编辑中：待立案默认件数 10 → ' + batch + '、回收预告 30 → ' + recycle + ' 分钟。';
    close();
  });
})();
</script>
${JS_SWITCH}`;
  return injectBeforeBody(out, block);
});

/* ───────── E. 查重复发 ───────── */

for (const f of ['dedup-recurrence-live.html', 'dedup-recurrence-draft.html']) {
  apply(f, 'E1 演示对标题规范化 + 共享CSS', (h) => {
    let out = h.split('预览（写死演示对）').join('预览（演示对）');
    if (!out.includes('id="gc-rev17-css"')) out = injectBeforeBody(out, '<style id="gc-rev17-css">' + CSS_OPS + '\n</style>');
    return out;
  });
}

apply('dedup-recurrence-draft.html', 'E2 阈值调整入口 + 抽屉 + 开关可交互', (h) => {
  const noteOld = '<span class="gc-card-note">草稿编辑中：阈值与观察期可改（示例值）</span>';
  must(h.includes(noteOld), 'dedup-draft: 冗余 note 未找到');
  let out = h.replace(noteOld, '<span class="gc-card-aside"><button type="button" class="gc-btn-link" data-gc-th-adjust>调整阈值</button></span>');
  must(!out.includes('id="dedup-edit-js"'), 'dedup-draft: 已存在脚本');
  const block = `
<style id="dedup-drawer-css">${CSS_DRAWER}
</style>
<div class="gc-scrim" data-gc-scrim hidden></div>
<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-dd-title" data-gc-drawer="dd" hidden>
  <div class="gc-drawer-head">
    <h2 class="gc-drawer-title" id="gc-dd-title">调整候选专题与观察期</h2>
    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>
  </div>
  <div class="gc-drawer-body">
    <div class="gc-form-grid">
      <div class="gc-field"><label for="gc-dd-count">候选成立：复发次数（次）</label><input type="number" id="gc-dd-count" min="1"></div>
      <div class="gc-field"><label for="gc-dd-gap">候选成立：间隔（天）</label><input type="number" id="gc-dd-gap" min="1"></div>
      <div class="gc-field"><label for="gc-dd-obs">观察期（天）</label><input type="number" id="gc-dd-obs" min="1"></div>
    </div>
    <p class="gc-ov-note">保存后写入草稿；评价口径中的复发率读取观察期。</p>
  </div>
  <div class="gc-drawer-foot">
    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>
    <button type="button" class="gc-btn-primary" data-gc-dd-save>保存到草稿</button>
  </div>
</aside>
<script id="dedup-edit-js">
(function () {
  var scrim = document.querySelector('[data-gc-scrim]');
  var drawer = document.querySelector('[data-gc-drawer="dd"]');
  var card = document.getElementById('gc-topic-title').closest('.gc-card');
  function open() {
    var dds = card.querySelectorAll('.gc-kv-row dd');
    document.getElementById('gc-dd-count').value = parseInt(dds[0].textContent.trim(), 10);
    document.getElementById('gc-dd-gap').value = parseInt(dds[1].textContent.trim(), 10);
    document.getElementById('gc-dd-obs').value = parseInt(dds[2].textContent.trim(), 10);
    drawer.hidden = false; scrim.hidden = false;
  }
  function close() { drawer.hidden = true; scrim.hidden = true; }
  scrim.addEventListener('click', close);
  [].slice.call(document.querySelectorAll('[data-gc-close]')).forEach(function (b) { b.addEventListener('click', close); });
  document.querySelector('[data-gc-th-adjust]').addEventListener('click', open);
  document.querySelector('[data-gc-dd-save]').addEventListener('click', function () {
    var ids = ['gc-dd-count', 'gc-dd-gap', 'gc-dd-obs'];
    var vals = [];
    for (var i = 0; i < ids.length; i++) {
      var v = parseInt(document.getElementById(ids[i]).value, 10);
      if (!v || v < 1) { document.getElementById(ids[i]).focus(); return; }
      vals.push(v);
    }
    var dds = card.querySelectorAll('.gc-kv-row dd');
    dds[0].firstChild.nodeValue = vals[0] + ' 次';
    dds[1].firstChild.nodeValue = vals[1] + ' 天';
    dds[2].firstChild.nodeValue = vals[2] + ' 天';
    close();
  });
})();
</script>
${JS_SWITCH}`;
  return injectBeforeBody(out, block);
});

/* ───────── F. 评价口径 ───────── */

const metricThead = (h) => {
  if (h.includes('<th class="gc-th-actions">备注</th>')) {
    return h.replace('<th class="gc-th-actions">备注</th>', '<th>备注</th><th class="gc-th-actions">操作</th>');
  }
  must(h.includes('<th>备注</th>'), 'metric: thead 备注列未找到');
  return h.replace('<th>备注</th>', '<th>备注</th><th class="gc-th-actions">操作</th>');
};

apply('metric-caliber-live.html', 'F1 live 启用chip化 + 行编辑入口 + thead', (h) => {
  let out = metricThead(h);
  out = out.replace(/<tr><td class="gc-td-name">([^<]+)<\/td>[\s\S]*?<\/tr>/g, (tr, name) => {
    let r = tr.replace('<td>开</td>', '<td><span class="gc-chip gc-chip--on">启用</span></td>');
    return r.replace(/<\/tr>$/, '<td class="gc-td-actions"><a class="gc-btn-link" href="metric-caliber-draft.html?edit=' + encodeURIComponent(name) + '" title="进入草稿，编辑该指标口径">编辑</a></td></tr>');
  });
  if (!out.includes('id="gc-rev17-css"')) out = injectBeforeBody(out, '<style id="gc-rev17-css">' + CSS_OPS + '\n</style>');
  return out;
});

apply('metric-caliber-draft.html', 'F2 启停按钮 + 编辑抽屉 + 权重调整 + 开关可交互', (h) => {
  const noteOld = '<span class="gc-card-note">草稿编辑中：权重可改（示例值）</span>';
  must(h.includes(noteOld), 'metric-draft: 冗余 note 未找到');
  let out = h.replace(noteOld, '<span class="gc-card-aside"><button type="button" class="gc-btn-link" data-gc-weight-adjust>调整权重</button></span>');
  out = metricThead(out);
  out = out.replace(/<tr><td class="gc-td-name">([^<]+)<\/td>[\s\S]*?<\/tr>/g, (tr, name) => {
    let r = tr.replace('<td>开</td>', '<td><span class="gc-chip gc-chip--on">启用</span></td>');
    const cell = '<td class="gc-td-actions">'
      + '<button type="button" class="gc-btn-link" data-gc-mc-toggle data-name="' + name + '">停用</button>'
      + '<button type="button" class="gc-btn-link" data-gc-mc-edit data-name="' + name + '">编辑</button>'
      + '</td>';
    return r.replace(/<\/tr>$/, cell + '</tr>');
  });
  must(!out.includes('id="metric-edit-js"'), 'metric-draft: 已存在脚本');
  const block = `
<style id="metric-drawer-css">${CSS_DRAWER}
</style>
<div class="gc-scrim" data-gc-scrim hidden></div>
<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-mc-title" data-gc-drawer="mc" hidden>
  <div class="gc-drawer-head">
    <h2 class="gc-drawer-title" id="gc-mc-title">指标口径编辑</h2>
    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>
  </div>
  <div class="gc-drawer-body">
    <div class="gc-form-grid">
      <div class="gc-field"><label for="gc-m-name">指标</label><input type="text" id="gc-m-name" readonly></div>
      <div class="gc-field"><label for="gc-m-join">参与人员 / 网格比较</label>
        <select id="gc-m-join"><option value="1">可</option><option value="0">不参与</option></select>
      </div>
      <div class="gc-field gc-field--full"><label for="gc-m-note">备注</label><input type="text" id="gc-m-note"></div>
    </div>
    <p class="gc-ov-note">公式分子分母定义由平台冻结，只能调整参与比较与备注；保存后写入草稿。</p>
  </div>
  <div class="gc-drawer-foot">
    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>
    <button type="button" class="gc-btn-primary" data-gc-mc-save>保存到草稿</button>
  </div>
</aside>
<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-mw-title" data-gc-drawer="mw" hidden>
  <div class="gc-drawer-head">
    <h2 class="gc-drawer-title" id="gc-mw-title">调整难度校正权重</h2>
    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>
  </div>
  <div class="gc-drawer-body">
    <div class="gc-form-grid">
      <div class="gc-field"><label for="gc-w-1">事件类型因子</label><input type="number" id="gc-w-1" min="0"></div>
      <div class="gc-field"><label for="gc-w-2">严重程度 / 等级因子</label><input type="number" id="gc-w-2" min="0"></div>
      <div class="gc-field"><label for="gc-w-3">发生时段因子</label><input type="number" id="gc-w-3" min="0"></div>
      <div class="gc-field"><label for="gc-w-4">区域因子</label><input type="number" id="gc-w-4" min="0"></div>
    </div>
    <p class="gc-ov-note">权重和不必强制为 100，发布时提示将归一化。</p>
  </div>
  <div class="gc-drawer-foot">
    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>
    <button type="button" class="gc-btn-primary" data-gc-mw-save>保存到草稿</button>
  </div>
</aside>
<script id="metric-edit-js">
(function () {
  var tbody = document.querySelector('table.gc-table tbody');
  var scrim = document.querySelector('[data-gc-scrim]');
  var drawers = { mc: document.querySelector('[data-gc-drawer="mc"]'), mw: document.querySelector('[data-gc-drawer="mw"]') };
  var cur = null;
  function openDrawer(name) { drawers.mc.hidden = name !== 'mc'; drawers.mw.hidden = name !== 'mw'; scrim.hidden = false; }
  function close() { drawers.mc.hidden = true; drawers.mw.hidden = true; scrim.hidden = true; }
  scrim.addEventListener('click', close);
  [].slice.call(document.querySelectorAll('[data-gc-close]')).forEach(function (b) { b.addEventListener('click', close); });
  function rowOf(name) {
    var rows = [].slice.call(tbody.querySelectorAll('tr'));
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].children[0] && rows[i].children[0].textContent.trim() === name) return rows[i];
    }
    return null;
  }
  // ── 启用 / 停用（独立操作按钮） ──
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-mc-toggle]') : null;
    if (!b) return;
    var tr = b.closest('tr');
    var chipTd = tr.children[2];
    var on = chipTd.textContent.indexOf('启用') >= 0;
    chipTd.innerHTML = '<span class="gc-chip ' + (on ? 'gc-chip--off' : 'gc-chip--on') + '">' + (on ? '停用' : '启用') + '</span>';
    b.textContent = on ? '启用' : '停用';
  });
  // ── 行编辑 ──
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-mc-edit]') : null;
    if (!b) return;
    var name = b.getAttribute('data-name');
    var tr = rowOf(name);
    cur = { name: name, tr: tr };
    document.getElementById('gc-m-name').value = name;
    document.getElementById('gc-m-join').value = tr.children[3].textContent.trim() === '可' ? '1' : '0';
    document.getElementById('gc-m-note').value = tr.children[5].textContent.trim();
    if (tr.children[5].textContent.trim() === '—') document.getElementById('gc-m-note').value = '';
    openDrawer('mc');
  });
  document.querySelector('[data-gc-mc-save]').addEventListener('click', function () {
    if (!cur) return;
    var join = document.getElementById('gc-m-join').value;
    var note = document.getElementById('gc-m-note').value.trim();
    var tdJoin = cur.tr.children[3];
    if (join === '1') { tdJoin.className = ''; tdJoin.textContent = '可'; }
    else { tdJoin.className = 'gc-td-dash'; tdJoin.textContent = '—'; }
    var tdNote = cur.tr.children[5];
    if (note) { tdNote.className = ''; tdNote.textContent = note; }
    else { tdNote.className = 'gc-td-dash'; tdNote.textContent = '—'; }
    close();
  });
  // ── 权重调整 ──
  document.querySelector('[data-gc-weight-adjust]').addEventListener('click', function () {
    var ws = document.querySelectorAll('.gc-factor .gc-factor-weight');
    for (var i = 0; i < ws.length; i++) {
      document.getElementById('gc-w-' + (i + 1)).value = parseInt(ws[i].textContent.replace(/[^0-9]/g, ''), 10) || 0;
    }
    openDrawer('mw');
  });
  document.querySelector('[data-gc-mw-save]').addEventListener('click', function () {
    var vals = [];
    for (var i = 1; i <= 4; i++) {
      var v = parseInt(document.getElementById('gc-w-' + i).value, 10);
      if (isNaN(v) || v < 0) { document.getElementById('gc-w-' + i).focus(); return; }
      vals.push(v);
    }
    var ws = document.querySelectorAll('.gc-factor .gc-factor-weight');
    for (var i = 0; i < ws.length; i++) ws[i].textContent = '权重 ' + vals[i];
    close();
  });
  // ── 从生效版带上下文进入：?edit=指标名 ──
  var qs = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search) : null;
  if (qs && qs.get('edit')) {
    var b = document.querySelector('[data-gc-mc-edit][data-name="' + qs.get('edit') + '"]');
    if (b) b.click();
  }
})();
</script>
${JS_SWITCH}`;
  return injectBeforeBody(out, block);
});

/* ───────── P. 发布与审计 ───────── */

apply('publish-draft-review.html', 'P1 差异行直达模块草稿 + 共享CSS', (h) => {
  const old = '<th>所属模块</th></tr></thead>';
  must(h.includes(old), 'publish: thead 未找到');
  let out = h.replace(old, '<th>所属模块</th><th class="gc-th-actions">操作</th></tr></thead>');
  const MAP = {
    '生命周期': ['lifecycle-draft.html', '到生命周期草稿中修改'],
    '时限规则': ['sla-matrix-draft.html?edit=' + encodeURIComponent('共享单车乱停放×一般'), '到时限规则草稿中修改该行'],
    '派工与认领': ['dispatch-claim-draft.html', '到派工与认领草稿中修改']
  };
  out = out.replace(/<tr><td class="gc-td-name">[\s\S]*?<\/tr>/g, (tr) => {
    let target = null;
    for (const k of Object.keys(MAP)) { if (tr.includes('<td>' + k + '</td>')) target = MAP[k]; }
    must(target, 'publish: 未识别差异行模块 ' + tr.slice(0, 60));
    return tr.replace(/<\/tr>$/, '<td class="gc-td-actions"><a class="gc-btn-link" href="' + target[0] + '" title="' + target[1] + '">去编辑</a></td></tr>');
  });
  if (!out.includes('id="gc-rev17-css"')) out = injectBeforeBody(out, '<style id="gc-rev17-css">' + CSS_OPS + '\n</style>');
  return out;
});

console.log('\nrev17 done.');
