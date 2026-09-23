// rev16: 事件标准对齐 rev15 交互模式（空间与责任定稿）
// A. live: 行「编辑」→ draft?edit=CODE；头部「＋ 新增细类」→ draft?create=1；底部换只读提示
// B. draft: 行级 编辑/启停/删除 即时操作 + 编辑/新增抽屉 + URL 钩子（注入本页主脚本内）
// C. 文案清理：树注冗余前缀、卡片角标按钮；audit R14 补禁入词
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

/* ───────────────────────── A. live 页 ───────────────────────── */

apply('event-standard-live.html', 'A1 头部新增入口', (h) => {
  if (h.includes('draft.html?create=1" title="进入草稿，新增细类"')) return h;
  const re = /(<div class="gc-workspace-header-actions">)[\s\S]*?<\/div>/;
  if (!re.test(h)) fail('live: header-actions 块未找到');
  return h.replace(re, '$1\n          <a class="gc-btn-primary" href="event-standard-draft.html?create=1" title="进入草稿，新增细类">＋ 新增细类</a>\n        </div>');
});

apply('event-standard-live.html', 'A2 行操作 编辑+规则', (h) => {
  return h.replace(/<tr>[\s\S]*?<\/tr>/g, (tr) => {
    if (!tr.includes('gc-td-code')) return tr;
    const m = tr.match(/gc-td-name">([^<]+)<\/td>\s*<td class="gc-td-code">([A-Z]+-\d+)<\/td>/);
    if (!m) fail('live: 行缺少名称/编码 ' + tr.slice(0, 80));
    const code = m[2];
    const noteM = tr.match(/<span class="gc-row-note">[\s\S]*?<\/span>/);
    const note = noteM ? noteM[0] : '';
    const cell = '<td class="gc-td-actions">'
      + `<a class="gc-btn-link" href="event-standard-draft.html?edit=${code}" title="进入草稿，编辑细类 ${code}">编辑</a>`
      + '<a class="gc-btn-link" href="event-standard-drawer.html" data-dom-id="event-open-drawer">规则</a>'
      + note + '</td>';
    return tr.replace(/<td class="gc-td-actions">[\s\S]*?<\/td>/, cell);
  });
});

apply('event-standard-live.html', 'A3 底部动作条换只读提示', (h) => {
  if (h.includes('生效版只读 · 调整细类与启停请通过行内「编辑」进入草稿')) return h;
  const re = /<div class="gc-shell-footer">\s*<a class="gc-btn-primary" href="event-standard-draft\.html" data-dom-id="cta-edit">[\s\S]*?<\/a>\s*<\/div>/;
  if (!re.test(h)) fail('live: 底部 cta-edit 未找到');
  return h.replace(re, '<div class="gc-shell-footer">\n        <span style="font-size:13px;color:var(--gc-muted);">生效版只读 · 调整细类与启停请通过行内「编辑」进入草稿</span>\n      </div>');
});

/* ───────────────────────── B. draft 页 ───────────────────────── */

apply('event-standard-draft.html', 'B1 头部新增按钮', (h) => {
  if (h.includes('data-gc-es-new')) return h;
  const re = /(<div class="gc-workspace-header-actions">)[\s\S]*?<\/div>/;
  if (!re.test(h)) fail('draft: header-actions 块未找到');
  return h.replace(re, '$1\n          <button type="button" class="gc-btn-primary" data-gc-es-new>＋ 新增细类</button>\n        </div>');
});

apply('event-standard-draft.html', 'B2 行操作 编辑/启停/删除', (h) => {
  return h.replace(/<tr>[\s\S]*?<\/tr>/g, (tr) => {
    if (!tr.includes('gc-td-code')) return tr;
    const m = tr.match(/gc-td-name">([^<]+)<\/td>\s*<td class="gc-td-code">([A-Z]+-\d+)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/);
    if (!m) fail('draft: 行字段解析失败 ' + tr.slice(0, 80));
    const [, name, code, std, ev] = m;
    const cand = tr.includes('候选·未启用') ? '1' : '0';
    const stopped = tr.includes('gc-chip--off">停用');
    const referenced = code === 'GG-0301';
    const noteM = tr.match(/<span class="gc-row-note">[\s\S]*?<\/span>/);
    const note = noteM ? noteM[0] : '';
    const del = referenced
      ? '<button type="button" class="gc-btn-link gc-btn-link--disabled" disabled title="仍被历史事件引用，不可删除，可停用" aria-disabled="true">删除</button>'
      : `<button type="button" class="gc-btn-link" data-gc-del data-code="${code}">删除</button>`;
    const cell = '<td class="gc-td-actions">'
      + `<button type="button" class="gc-btn-link" data-gc-bind data-code="${code}" data-name="${name}" data-standard="${std}" data-evidence="${ev}" data-cand="${cand}">编辑</button>`
      + `<button type="button" class="gc-btn-link" data-gc-toggle data-code="${code}">${stopped ? '启用' : '停用'}</button>`
      + del + note + '</td>';
    return tr.replace(/<td class="gc-td-actions">[\s\S]*?<\/td>/, cell);
  });
});

apply('event-standard-draft.html', 'B3 卡片角标去冗余按钮', (h) => {
  const old = '<span class="gc-card-aside">共 89 项 · 当前显示 11 项 · <button type="button" class="gc-btn-link">＋ 新增细类</button></span>';
  const neu = '<span class="gc-card-aside">共 89 项 · 当前显示 11 项</span>';
  if (h.includes(neu)) return h;
  if (!h.includes(old)) fail('draft: card-aside 原文未找到');
  return h.replace(old, neu);
});

apply('event-standard-draft.html', 'B4 树注去冗余前缀', (h) => {
  const old = '<p class="gc-tree-note">草稿编辑中：可调整细类、证据要求与自动结案候选 · 摘自国家标准字典 · 共 89 项</p>';
  const neu = '<p class="gc-tree-note">摘自国家标准字典 · 共 89 项，此处展示 5 个大类</p>';
  if (h.includes(neu)) return h;
  if (!h.includes(old)) fail('draft: tree-note 原文未找到');
  return h.replace(old, neu);
});

apply('event-standard-draft.html', 'B5 抽屉+主脚本+URL钩子', (h) => {
  if (h.includes('id="event-standard-edit-js"')) return h;
  if (!h.includes('</body>')) fail('draft: 缺少 </body>');
  const block = `
<style id="event-standard-edit-css">
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
</style>
<div class="gc-scrim" data-gc-scrim hidden></div>

<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-bind-title" data-gc-drawer="bind" hidden>
  <div class="gc-drawer-head">
    <h2 class="gc-drawer-title" id="gc-bind-title">细类编辑</h2>
    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>
  </div>
  <div class="gc-drawer-body">
    <div class="gc-form-grid">
      <div class="gc-field"><label for="gc-b-code">编码</label><input type="text" id="gc-b-code" readonly></div>
      <div class="gc-field"><label for="gc-b-name">细类名称（必填）</label><input type="text" id="gc-b-name"></div>
      <div class="gc-field gc-field--full"><label for="gc-b-standard">立案标准摘录</label><input type="text" id="gc-b-standard"></div>
      <div class="gc-field gc-field--full"><label for="gc-b-evidence">证据要求</label><input type="text" id="gc-b-evidence"></div>
      <div class="gc-field"><label for="gc-b-cand">自动结案候选</label>
        <select id="gc-b-cand"><option value="0">不参与</option><option value="1">候选（未启用）</option></select>
      </div>
    </div>
    <p class="gc-ov-note">编辑该细类的立案标准与证据要求。保存后写入草稿，发布后才作用于新事件。</p>
  </div>
  <div class="gc-drawer-foot">
    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>
    <button type="button" class="gc-btn-primary" data-gc-bind-save>保存到草稿</button>
  </div>
</aside>

<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-create-title" data-gc-drawer="create" hidden>
  <div class="gc-drawer-head">
    <h2 class="gc-drawer-title" id="gc-create-title">新增细类</h2>
    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>
  </div>
  <div class="gc-drawer-body">
    <div class="gc-form-grid">
      <div class="gc-field"><label for="gc-n-cat">所属分类</label>
        <select id="gc-n-cat"><option>道路秩序</option><option>环境卫生</option><option>广告标识</option><option>市政设施</option><option>其他</option></select>
      </div>
      <div class="gc-field"><label for="gc-n-code">编码（必填）</label><input type="text" id="gc-n-code" placeholder="如：QT-0501"></div>
      <div class="gc-field"><label for="gc-n-name">细类名称（必填）</label><input type="text" id="gc-n-name" placeholder="如：流动摊贩"></div>
      <div class="gc-field"><label for="gc-n-cand">自动结案候选</label>
        <select id="gc-n-cand"><option value="0">不参与</option><option value="1">候选（未启用）</option></select>
      </div>
      <div class="gc-field gc-field--full"><label for="gc-n-standard">立案标准摘录</label><input type="text" id="gc-n-standard" placeholder="如：占用城市道路散发广告传单"></div>
      <div class="gc-field gc-field--full"><label for="gc-n-evidence">证据要求</label><input type="text" id="gc-n-evidence" placeholder="如：含传单与道路全景"></div>
    </div>
    <p class="gc-ov-note">新增一条细类并写入草稿，发布后才作用于新事件。新细类默认启用。</p>
  </div>
  <div class="gc-drawer-foot">
    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>
    <button type="button" class="gc-btn-primary" data-gc-create-save>保存到草稿</button>
  </div>
</aside>
<script id="event-standard-edit-js">
(function () {
  var tbody = document.querySelector('table.gc-table tbody');

  // ── 行定位 ──
  function rowOf(code) {
    var rows = [].slice.call(tbody.querySelectorAll('tr'));
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i].querySelector('.gc-td-code');
      if (c && c.textContent.trim().toUpperCase() === code) return rows[i];
    }
    return null;
  }

  // ── 抽屉开关 ──
  var scrim = document.querySelector('[data-gc-scrim]');
  var drawers = { bind: document.querySelector('[data-gc-drawer="bind"]'), create: document.querySelector('[data-gc-drawer="create"]') };
  var cur = null;
  function openDrawer(name) {
    if (drawers.bind) drawers.bind.hidden = true;
    if (drawers.create) drawers.create.hidden = true;
    if (drawers[name]) drawers[name].hidden = false;
    scrim.hidden = false;
  }
  function close() {
    if (drawers.bind) drawers.bind.hidden = true;
    if (drawers.create) drawers.create.hidden = true;
    scrim.hidden = true;
  }
  scrim.addEventListener('click', close);
  [].slice.call(document.querySelectorAll('[data-gc-close]')).forEach(function (b) { b.addEventListener('click', close); });

  // ── 编辑（单行编辑，统一入口） ──
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-bind]') : null;
    if (!b) return;
    cur = { code: b.getAttribute('data-code') };
    document.getElementById('gc-bind-title').textContent = '细类 ' + cur.code + ' · 编辑';
    document.getElementById('gc-b-code').value = cur.code;
    document.getElementById('gc-b-name').value = b.getAttribute('data-name') || '';
    document.getElementById('gc-b-standard').value = (b.getAttribute('data-standard') && b.getAttribute('data-standard') !== '—') ? b.getAttribute('data-standard') : '';
    document.getElementById('gc-b-evidence').value = (b.getAttribute('data-evidence') && b.getAttribute('data-evidence') !== '—') ? b.getAttribute('data-evidence') : '';
    document.getElementById('gc-b-cand').value = b.getAttribute('data-cand') || '0';
    openDrawer('bind');
  });

  document.querySelector('[data-gc-bind-save]').addEventListener('click', function () {
    if (!cur) return;
    var name = document.getElementById('gc-b-name').value.trim();
    if (!name) { document.getElementById('gc-b-name').focus(); return; }
    var standard = document.getElementById('gc-b-standard').value.trim() || '—';
    var evidence = document.getElementById('gc-b-evidence').value.trim() || '—';
    var cand = document.getElementById('gc-b-cand').value;
    var tr = rowOf(cur.code);
    if (tr) {
      var nameTd = tr.querySelector('.gc-td-name');
      if (nameTd) nameTd.textContent = name;
      tr.children[2].textContent = standard;
      tr.children[3].textContent = evidence;
      var candTd = tr.children[4];
      if (cand === '1') { candTd.className = ''; candTd.innerHTML = '<span class="gc-chip gc-chip--off">候选·未启用</span>'; }
      else { candTd.className = 'gc-td-dash'; candTd.textContent = '—'; }
      var eb = tr.querySelector('[data-gc-bind]');
      if (eb) {
        eb.setAttribute('data-name', name);
        eb.setAttribute('data-standard', standard);
        eb.setAttribute('data-evidence', evidence);
        eb.setAttribute('data-cand', cand);
      }
    }
    close();
  });

  // ── 新增细类 ──
  document.querySelector('[data-gc-es-new]').addEventListener('click', function () {
    document.getElementById('gc-n-code').value = '';
    document.getElementById('gc-n-name').value = '';
    document.getElementById('gc-n-standard').value = '';
    document.getElementById('gc-n-evidence').value = '';
    document.getElementById('gc-n-cand').value = '0';
    openDrawer('create');
  });

  document.querySelector('[data-gc-create-save]').addEventListener('click', function () {
    var code = document.getElementById('gc-n-code').value.trim().toUpperCase();
    if (!code) { document.getElementById('gc-n-code').focus(); return; }
    var name = document.getElementById('gc-n-name').value.trim();
    if (!name) { document.getElementById('gc-n-name').focus(); return; }
    if (rowOf(code)) { document.getElementById('gc-n-code').focus(); return; }
    var standard = document.getElementById('gc-n-standard').value.trim() || '—';
    var evidence = document.getElementById('gc-n-evidence').value.trim() || '—';
    var cand = document.getElementById('gc-n-cand').value;

    var tr = document.createElement('tr');
    var tdN = document.createElement('td'); tdN.className = 'gc-td-name'; tdN.textContent = name; tr.appendChild(tdN);
    var tdC = document.createElement('td'); tdC.className = 'gc-td-code'; tdC.textContent = code; tr.appendChild(tdC);
    var tdS = document.createElement('td'); tdS.textContent = standard; tr.appendChild(tdS);
    var tdE = document.createElement('td'); tdE.textContent = evidence; tr.appendChild(tdE);
    var tdCand = document.createElement('td');
    if (cand === '1') { tdCand.innerHTML = '<span class="gc-chip gc-chip--off">候选·未启用</span>'; }
    else { tdCand.className = 'gc-td-dash'; tdCand.textContent = '—'; }
    tr.appendChild(tdCand);
    var tdSt = document.createElement('td'); tdSt.innerHTML = '<span class="gc-chip gc-chip--on">启用</span>'; tr.appendChild(tdSt);
    var tdA = document.createElement('td'); tdA.className = 'gc-td-actions';
    var eb = document.createElement('button'); eb.type = 'button'; eb.className = 'gc-btn-link';
    eb.setAttribute('data-gc-bind', ''); eb.setAttribute('data-code', code);
    eb.setAttribute('data-name', name); eb.setAttribute('data-standard', standard);
    eb.setAttribute('data-evidence', evidence); eb.setAttribute('data-cand', cand);
    eb.textContent = '编辑'; tdA.appendChild(eb);
    var tb = document.createElement('button'); tb.type = 'button'; tb.className = 'gc-btn-link';
    tb.setAttribute('data-gc-toggle', ''); tb.setAttribute('data-code', code);
    tb.textContent = '停用'; tdA.appendChild(tb);
    var db = document.createElement('button'); db.type = 'button'; db.className = 'gc-btn-link';
    db.setAttribute('data-gc-del', ''); db.setAttribute('data-code', code);
    db.textContent = '删除'; tdA.appendChild(db);
    tr.appendChild(tdA);
    tbody.appendChild(tr);

    close();
  });

  // ── 启用 / 停用（行级即时切换，写入草稿） ──
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-toggle]') : null;
    if (!b) return;
    var tr = b.closest ? b.closest('tr') : null;
    if (!tr) return;
    var chip = tr.children[5] && tr.children[5].querySelector('.gc-chip');
    if (!chip) return;
    if (chip.textContent === '启用') { chip.className = 'gc-chip gc-chip--off'; chip.textContent = '停用'; b.textContent = '启用'; }
    else { chip.className = 'gc-chip gc-chip--on'; chip.textContent = '启用'; b.textContent = '停用'; }
  });

  // ── 删除 ──
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-del]') : null;
    if (!b) return;
    var tr = b.closest ? b.closest('tr') : null;
    if (tr) tr.remove();
  });

  // ── 从生效版带上下文进入：?edit=DM-0101 直接打开该细类编辑抽屉；?create=1 打开新增抽屉 ──
  var qs = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search) : null;
  if (qs && qs.get('edit')) {
    var eb = document.querySelector('[data-gc-bind][data-code="' + qs.get('edit').toUpperCase() + '"]');
    if (eb) eb.click();
  } else if (qs && qs.get('create')) {
    var nb = document.querySelector('[data-gc-es-new]');
    if (nb) nb.click();
  }
})();
</script>
`;
  return h.replace('</body>', block + '</body>');
});

// rev15d 教训：钩子必须在 event-standard-edit-js 脚本内部（开启标签之后、其 </script> 之前）
{
  const h = readFileSync(`${DIR}/event-standard-draft.html`, 'utf8');
  const s = h.indexOf('<script id="event-standard-edit-js">');
  const e = h.indexOf('</script>', s);
  const hook = h.indexOf("?edit=DM-0101 直接打开该细类编辑抽屉");
  if (!(s > -1 && e > s && hook > s && hook < e)) fail('钩子位置断言失败：URL 钩子不在 event-standard-edit-js 内');
  console.log('  ✓ 钩子位置断言通过（位于 event-standard-edit-js 内）');
}

console.log('\nrev16 done.');
