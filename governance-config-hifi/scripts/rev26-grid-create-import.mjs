// rev26 · space-responsibility-draft.html + space-responsibility-live.html
// 网格创建能力迭代（2026-10-14，与线上实现对齐）：
// 1) 新建网格改两步式：① 所属街道（必选）→ ② 网格名称（必填）+ 编码（自动建议可改）+ 社区（街道联动下拉）+ 变更原因（必填）；
//    未选街道时 ② 区域置灰禁用；新建默认「待定责」（无主责），派发需先定责。
// 2) 批量导入：工具栏「⇪ 批量导入」抽屉，每行「街道名称,网格名称」（逗号/顿号/Tab 分隔），
//    实时预览可导入/跳过（街道不存在或已停用 / 该街道下已有同名网格），变更原因必填，确认导入自动编码递增。
// 3) 表格首列「网格编码」→「网格」：名称为主、编码灰色小字；draft 表补「来源」列。
// live 页为生效版展示同步：首列名称+编码、卡头说明、批量导入入口（?import=1 进草稿）。
import fs from 'node:fs';
import path from 'node:path';

function load(rel) {
  const FILE = path.resolve(rel);
  return { FILE, html: fs.readFileSync(FILE, 'utf8') };
}
function save(FILE, html) {
  fs.writeFileSync(FILE, html);
}
function replaceOnce(src, needle, next, tag) {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error('[' + tag + '] needle not found: ' + needle.slice(0, 70));
  if (src.indexOf(needle, i + 1) >= 0) throw new Error('[' + tag + '] needle not unique: ' + needle.slice(0, 70));
  return src.slice(0, i) + next + src.slice(i + needle.length);
}
// 整块替换（open 起到 close 止，含两端），要求唯一
function replaceBlock(src, open, close, next, tag) {
  const a = src.indexOf(open);
  if (a < 0) throw new Error('[' + tag + '] open not found');
  const b = src.indexOf(close, a);
  if (b < 0) throw new Error('[' + tag + '] close not found');
  if (src.indexOf(open, a + 1) >= 0) throw new Error('[' + tag + '] open not unique');
  return src.slice(0, a) + next + src.slice(b + close.length);
}

/* ══════════════ A · space-responsibility-draft.html ══════════════ */

let A = load('pages/space-responsibility-draft.html');
let sp = A.html;
const SP_BEFORE = sp.length;

// A1. CSS：首列编码小字 + 手动 chip + 两步式 gating + 批量导入预览
sp = replaceOnce(
  sp,
  '.gc-change-empty { padding: 18px 4px; text-align: center; color: var(--gc-muted); font-size: 12px; }',
  [
    '.gc-change-empty { padding: 18px 4px; text-align: center; color: var(--gc-muted); font-size: 12px; }',
    '/* rev26 网格创建迭代：首列名称+编码、两步式 gating、批量导入 */',
    '.gc-td-sub { display: block; margin-top: 2px; font-size: 11px; color: var(--gc-muted); font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace; }',
    '.gc-grid-name { font-weight: 500; }',
    '.gc-chip--manual { background: var(--gc-accent-soft); color: var(--gc-accent); font-size: 11px; font-weight: 500; border-radius: 9999px; padding: 1px 8px; white-space: nowrap; }',
    '.gc-n-step2.is-off { opacity: 0.45; pointer-events: none; }',
    '.gc-import-textarea { width: 100%; box-sizing: border-box; min-height: 132px; margin-top: 6px; border: 1px solid var(--gc-line-strong); border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 12px; line-height: 1.7; background: var(--gc-panel); color: var(--gc-text); resize: vertical; }',
    '.gc-import-textarea:focus { outline: 2px solid var(--gc-accent); outline-offset: -1px; border-color: var(--gc-accent); }',
    '.gc-import-preview { margin-top: 10px; border: 1px solid var(--gc-line); border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.9; background: var(--gc-bg); }',
    '.gc-import-preview .ok { color: var(--gc-text); }',
    '.gc-import-preview .bad { color: var(--gc-func-orange); }',
    '.gc-import-count { font-weight: 600; }',
  ].join('\n'),
  'sp-css',
);

// A2. 工具栏：「⇪ 批量导入」放「＋ 新增网格」左侧
sp = replaceOnce(
  sp,
  '      <button type="button" class="gc-btn-primary" data-gc-grid-new>＋ 新增网格</button>',
  [
    '      <button type="button" class="gc-btn-ghost" data-gc-grid-import title="每行「街道名称,网格名称」批量导入">⇪ 批量导入</button>',
    '      <button type="button" class="gc-btn-primary" data-gc-grid-new>＋ 新增网格</button>',
  ].join('\n'),
  'sp-toolbar',
);

// A3. 搜索 placeholder：名称优先
sp = replaceOnce(
  sp,
  'placeholder="搜索网格编码 / 街道 / 社区 / 主责 / 监督"',
  'placeholder="搜索网格名称 / 编码 / 街道 / 社区 / 主责 / 监督"',
  'sp-search-ph',
);

// A4. 卡头 note：补两步式与批量导入口径
sp = replaceOnce(
  sp,
  '<span class="gc-card-note">草稿编辑中：可新增、编辑、启停、删除网格</span>',
  '<span class="gc-card-note">草稿编辑中：新增先选街道再命名，支持批量导入；可编辑、启停、删除</span>',
  'sp-card-note',
);

// A5. 表头：网格编码 → 网格；补来源列
sp = replaceOnce(
  sp,
  '<tr><th>网格编码</th><th>所属街道</th><th>社区</th><th>网格主责</th><th>协同监督</th><th>状态</th><th>生效日期</th><th class="gc-th-actions">操作</th></tr>',
  '<tr><th>网格</th><th>所属街道</th><th>社区</th><th>网格主责</th><th>协同监督</th><th>状态</th><th>生效日期</th><th>来源</th><th class="gc-th-actions">操作</th></tr>',
  'sp-thead',
);

// A6. 四行首列改「名称 + 编码小字」并在生效日期后补来源单元格
const DRAFT_ROWS = [
  ['G-0418', '朝阳门南小街网格', '<td class="gc-td-code">2026-08-01</td>'],
  ['G-0417', '朝内大街网格', '<td class="gc-td-code">2026-08-01</td>'],
  ['G-0419', '东花市大街网格', '<td class="gc-td-code">2026-08-01</td>'],
  ['G-0421', '金宝街北网格', '<td class="gc-td-dash">—</td>'],
];
for (const [code, name, dateTd] of DRAFT_ROWS) {
  sp = replaceOnce(
    sp,
    '<td class="gc-td-code">' + code + '</td>',
    '<td><span class="gc-grid-name">' + name + '</span><span class="gc-td-sub">' + code + '</span></td>',
    'sp-first-cell-' + code,
  );
  const anchor = dateTd + '\n            <td class="gc-td-actions"><button type="button" class="gc-btn-link" data-gc-bind data-grid="' + code + '"';
  sp = replaceOnce(
    sp,
    anchor,
    dateTd + '\n            <td>平台同步</td>\n            <td class="gc-td-actions"><button type="button" class="gc-btn-link" data-gc-bind data-grid="' + code + '"',
    'sp-source-' + code,
  );
}

// A7. 新增网格抽屉：整块替换为两步式
sp = replaceBlock(
  sp,
  '<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-create-title" data-gc-drawer="create" hidden>',
  '</aside>',
  [
    '<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-create-title" data-gc-drawer="create" hidden>',
    '  <div class="gc-drawer-head">',
    '    <h2 class="gc-drawer-title" id="gc-create-title">新增网格</h2>',
    '    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>',
    '  </div>',
    '  <div class="gc-drawer-body">',
    '    <div class="gc-field">',
    '      <label for="gc-n-street">① 所属街道（必选，启用中的街道；含手动创建的街道）</label>',
    '      <select id="gc-n-street"><option value="">请先选择所属街道…</option><option>朝阳门街道</option><option>东华门街道</option><option>建国门街道</option><option>前门街道</option></select>',
    '    </div>',
    '    <div class="gc-form-grid gc-n-step2 is-off" id="gc-n-step2" style="margin-top: 12px;">',
    '      <div class="gc-field gc-field--full"><label for="gc-n-name">② 网格名称（必填，表格里优先显示名称）</label><input type="text" id="gc-n-name" placeholder="如 朝内大街北网格"></div>',
    '      <div class="gc-field"><label for="gc-n-code">网格编码</label><input type="text" id="gc-n-code" placeholder="选择街道后自动建议，如 G-0422"></div>',
    '      <div class="gc-field"><label for="gc-n-community">社区</label><select id="gc-n-community"></select></div>',
    '      <div class="gc-field gc-field--full"><label for="gc-n-reason">变更原因（必填，写入审计留痕）</label><input type="text" id="gc-n-reason" placeholder="如 外部平台尚未同步，先建网格承接新片区"></div>',
    '    </div>',
    '    <p class="gc-ov-note">新建网格初始为「待定责」（无主责）：派发不可用，需在表格「编辑」中指定一名主责后才可承接派发。保存后写入草稿，发布后才作用于新事件。</p>',
    '  </div>',
    '  <div class="gc-drawer-foot">',
    '    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>',
    '    <button type="button" class="gc-btn-primary" data-gc-create-save>保存到草稿</button>',
    '  </div>',
    '</aside>',
    '',
    '<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-import-title" data-gc-drawer="import" hidden>',
    '  <div class="gc-drawer-head">',
    '    <h2 class="gc-drawer-title" id="gc-import-title">批量导入网格</h2>',
    '    <button type="button" class="gc-ov-close" data-gc-close aria-label="关闭">✕</button>',
    '  </div>',
    '  <div class="gc-drawer-body">',
    '    <div class="gc-field gc-field--full">',
    '      <label for="gc-i-text">粘贴数据：每行一个网格，格式「街道名称,网格名称」（支持逗号 / 顿号 / Tab 分隔）</label>',
    '      <textarea id="gc-i-text" class="gc-import-textarea" rows="6" placeholder="朝阳门街道,朝内大街北网格&#10;朝阳门街道,朝内大街南网格&#10;东四街道,东四北大街网格&#10;前门街道,西打磨厂网格"></textarea>',
    '    </div>',
    '    <div class="gc-import-preview" data-gc-import-preview hidden></div>',
    '    <div class="gc-field gc-field--full" style="margin-top: 12px;">',
    '      <label for="gc-i-reason">变更原因（必填，写入审计留痕）</label>',
    '      <input type="text" id="gc-i-reason" placeholder="如 外部平台按片区新增网格，批量导入">',
    '    </div>',
    '    <p class="gc-ov-note">导入的网格自动编码（G-0NNN 递增）、来源为手动创建、初始为「待定责」；街道不存在或已停用、同街道下已有同名网格的行将被跳过。</p>',
    '  </div>',
    '  <div class="gc-drawer-foot">',
    '    <button type="button" class="gc-btn-ghost" data-gc-close>取消</button>',
    '    <button type="button" class="gc-btn-primary" data-gc-import-save>确认导入</button>',
    '  </div>',
    '</aside>',
  ].join('\n'),
  'sp-drawers',
);

save(A.FILE, sp);
console.log('rev26 space-draft html ok: ' + SP_BEFORE + ' → ' + sp.length + ' chars (+' + (sp.length - SP_BEFORE) + ')');

/* ══════════════ B · space-edit-js 整段重写 ══════════════ */

const SCRIPT = `<script id="space-edit-js">
(function () {
  // ── 数据：街道 → 启用中社区（含 rev25 手动街道前门） ──
  var STREETS = {
    '朝阳门街道': ['某社区', '东花市社区'],
    '东华门街道': ['金宝街社区'],
    '建国门街道': ['苏州社区'],
    '前门街道': ['西打磨厂社区']
  };

  // ── 查询 ──
  var input = document.getElementById('gc-q-grid');
  var tbody = document.querySelector('table.gc-table--grid tbody');
  function runSearch() {
    var q = (input.value || '').trim().toLowerCase();
    [].slice.call(tbody.querySelectorAll('tr')).forEach(function (tr) {
      tr.hidden = !!q && tr.textContent.toLowerCase().indexOf(q) < 0;
    });
  }
  input.addEventListener('input', runSearch);
  document.querySelector('[data-gc-search]').addEventListener('click', runSearch);

  // ── 单元格更新 ──
  function setCell(grid, field, val) {
    var td = document.querySelector('td[data-cell="' + field + '"][data-grid="' + grid + '"]');
    if (!td) return;
    var empty = !val;
    td.className = empty ? 'gc-td-dash' : (field === 'owner' ? 'gc-td-name' : '');
    td.textContent = empty ? (field === 'owner' ? '—（空）' : '—') : val;
  }

  // ── 启用 / 停用（后台管理范式：行级启停，写入草稿） ──
  function toast(msg) {
    var el = document.querySelector('[data-gc-draft-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('gc-draft-toast--show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('gc-draft-toast--show'); }, 3200);
  }
  function statusOf(tr) {
    var chip = tr.querySelector('.gc-chip');
    if (!chip) return 'off';
    if (chip.classList.contains('gc-chip--green')) return 'on';
    if (chip.classList.contains('gc-chip--muted')) return 'pending';
    return 'off';
  }
  function setStatus(tr, cls, text, btnText) {
    var chip = tr.querySelector('.gc-chip');
    if (chip) { chip.className = 'gc-chip ' + cls; chip.textContent = text; }
    var btn = tr.querySelector('[data-gc-toggle]');
    if (btn) btn.textContent = btnText;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-toggle]') : null;
    if (!b) return;
    var tr = b.closest('tr');
    if (!tr) return;
    var st = statusOf(tr);
    if (st === 'on') {
      setStatus(tr, 'gc-chip--off', '停用', '启用');
      toast('已停用该网格，写入草稿；停用后事件不再匹配派发，尚未生效。');
      return;
    }
    var owner = tr.querySelector('td[data-cell="owner"]');
    var ov = owner ? (owner.textContent || '').replace(/\\s/g, '') : '';
    var hasOwner = !!ov && ov !== '—' && ov.indexOf('（空）') < 0 && ov.indexOf('(空)') < 0;
    if (!hasOwner) { toast('该网格还没有网格主责，请先在「编辑」中指定，再启用。'); return; }
    setStatus(tr, 'gc-chip--green', '启用', '停用');
    toast('已启用该网格，写入草稿，尚未生效。');
  });

  // ── 抽屉开关（bind / create / import 三者互斥） ──
  var scrim = document.querySelector('[data-gc-scrim]');
  var drawers = {
    bind: document.querySelector('[data-gc-drawer="bind"]'),
    create: document.querySelector('[data-gc-drawer="create"]'),
    import: document.querySelector('[data-gc-drawer="import"]')
  };
  var cur = null;
  function openDrawer(name) {
    Object.keys(drawers).forEach(function (k) { if (drawers[k]) drawers[k].hidden = true; });
    if (drawers[name]) drawers[name].hidden = false;
    scrim.hidden = false;
  }
  function close() {
    Object.keys(drawers).forEach(function (k) { if (drawers[k]) drawers[k].hidden = true; });
    scrim.hidden = true;
  }
  scrim.addEventListener('click', close);
  [].slice.call(document.querySelectorAll('[data-gc-close]')).forEach(function (b) { b.addEventListener('click', close); });

  // ── 编辑（单行编辑，统一入口） ──
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-bind]') : null;
    if (!b) return;
    var sub = b.closest('tr').querySelector('.gc-td-sub');
    var code = sub ? sub.textContent.trim() : b.getAttribute('data-grid');
    cur = { grid: code, owner: b.getAttribute('data-owner'), sup: b.getAttribute('data-sup') };
    document.getElementById('gc-bind-title').textContent = '网格 ' + code + ' · 编辑';
    document.getElementById('gc-b-grid').value = code;
    document.getElementById('gc-b-owner').value = cur.owner || '';
    document.getElementById('gc-b-sup').value = (cur.sup && cur.sup !== '—') ? cur.sup : '';
    document.getElementById('gc-b-reason').value = '';
    openDrawer('bind');
  });

  document.querySelector('[data-gc-bind-save]').addEventListener('click', function () {
    if (!cur) return;
    var reason = document.getElementById('gc-b-reason').value.trim();
    if (!reason) { document.getElementById('gc-b-reason').focus(); return; }
    setCell(cur.grid, 'owner', document.getElementById('gc-b-owner').value);
    setCell(cur.grid, 'sup', document.getElementById('gc-b-sup').value);
    close();
  });

  // ── 网格编码：扫描现有行（.gc-td-sub）取最大值递增 ──
  function nextCode() {
    var max = 400;
    [].slice.call(tbody.querySelectorAll('.gc-td-sub')).forEach(function (s) {
      var m = /G-(\\d+)/.exec(s.textContent || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'G-' + String(max + 1).padStart(4, '0');
  }

  // ── 插行（新增 / 批量导入共用）：首列名称+编码，默认待定责、无主责、手动来源 ──
  function addGridRow(row) {
    var code = row.code;
    var tr = document.createElement('tr');
    tr.setAttribute('data-grid-row', code);
    var tdN = document.createElement('td');
    var nameSpan = document.createElement('span'); nameSpan.className = 'gc-grid-name'; nameSpan.textContent = row.name; tdN.appendChild(nameSpan);
    var subSpan = document.createElement('span'); subSpan.className = 'gc-td-sub'; subSpan.textContent = code; tdN.appendChild(subSpan);
    tr.appendChild(tdN);
    var tdS = document.createElement('td'); tdS.textContent = row.street; tr.appendChild(tdS);
    var tdCm = document.createElement('td'); tdCm.textContent = row.community || '—'; tr.appendChild(tdCm);
    var tdO = document.createElement('td'); tdO.className = 'gc-td-dash';
    tdO.setAttribute('data-cell', 'owner'); tdO.setAttribute('data-grid', code);
    tdO.textContent = '—（空）'; tr.appendChild(tdO);
    var tdSup = document.createElement('td'); tdSup.className = 'gc-td-dash';
    tdSup.setAttribute('data-cell', 'sup'); tdSup.setAttribute('data-grid', code);
    tdSup.textContent = '—'; tr.appendChild(tdSup);
    var tdSt = document.createElement('td');
    var chip = document.createElement('span'); chip.className = 'gc-chip gc-chip--muted'; chip.textContent = '待定责';
    tdSt.appendChild(chip); tr.appendChild(tdSt);
    var tdD = document.createElement('td'); tdD.className = 'gc-td-dash'; tdD.textContent = '—'; tr.appendChild(tdD);
    var tdSrc = document.createElement('td');
    var srcChip = document.createElement('span'); srcChip.className = 'gc-chip gc-chip--manual'; srcChip.textContent = '手动';
    tdSrc.appendChild(srcChip); tr.appendChild(tdSrc);
    var tdA = document.createElement('td'); tdA.className = 'gc-td-actions';
    var eb = document.createElement('button'); eb.type = 'button'; eb.className = 'gc-btn-link';
    eb.setAttribute('data-gc-bind', ''); eb.setAttribute('data-grid', code);
    eb.setAttribute('data-owner', ''); eb.setAttribute('data-sup', '—');
    eb.textContent = '编辑'; tdA.appendChild(eb);
    var tb = document.createElement('button'); tb.type = 'button'; tb.className = 'gc-btn-link';
    tb.setAttribute('data-gc-toggle', ''); tb.setAttribute('data-grid', code);
    tb.textContent = '启用'; tdA.appendChild(tb);
    var db = document.createElement('button'); db.type = 'button'; db.className = 'gc-btn-link';
    db.setAttribute('data-gc-del', ''); db.setAttribute('data-grid', code);
    db.textContent = '删除'; tdA.appendChild(db);
    tr.appendChild(tdA);
    tbody.appendChild(tr);
    return tr;
  }

  // ── 同街道重名（对比现有行名称 + 本批次待导入行） ──
  function existingNameKey(street, name) {
    var hit = false;
    [].slice.call(tbody.querySelectorAll('tr')).some(function (tr) {
      var st = tr.children[1] ? tr.children[1].textContent.trim() : '';
      var nm = tr.querySelector('.gc-grid-name');
      if (st === street && nm && nm.textContent.trim() === name) { hit = true; return true; }
      return false;
    });
    return hit;
  }

  // ── 新增网格（两步式：① 街道 → ② 名称/编码/社区/原因） ──
  var streetSel = document.getElementById('gc-n-street');
  var step2 = document.getElementById('gc-n-step2');
  var nameInp = document.getElementById('gc-n-name');
  var codeInp = document.getElementById('gc-n-code');
  var commSel = document.getElementById('gc-n-community');
  var reasonInp = document.getElementById('gc-n-reason');

  function fillCommunities(street) {
    commSel.textContent = '';
    var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '不指定社区…'; commSel.appendChild(opt0);
    (STREETS[street] || []).forEach(function (c) {
      var o = document.createElement('option'); o.value = c; o.textContent = c; commSel.appendChild(o);
    });
    commSel.value = '';
  }
  streetSel.addEventListener('change', function () {
    var street = streetSel.value;
    if (street) {
      step2.classList.remove('is-off');
      // 编码自动建议：保留用户改过的非标准值（与线上实现同口径）
      if (!codeInp.value || /^G-\\d+$/.test(codeInp.value)) codeInp.value = nextCode();
      fillCommunities(street);
    } else {
      step2.classList.add('is-off');
    }
  });

  document.querySelector('[data-gc-grid-new]').addEventListener('click', function () {
    streetSel.value = '';
    step2.classList.add('is-off');
    nameInp.value = ''; codeInp.value = ''; reasonInp.value = '';
    fillCommunities('');
    openDrawer('create');
  });

  document.querySelector('[data-gc-create-save]').addEventListener('click', function () {
    var street = streetSel.value;
    if (!street) { streetSel.focus(); return; }
    var name = nameInp.value.trim();
    if (!name) { nameInp.focus(); return; }
    var code = codeInp.value.trim().toUpperCase();
    if (!code) { codeInp.focus(); return; }
    var dupCode = [].slice.call(tbody.querySelectorAll('.gc-td-sub')).some(function (s) {
      return s.textContent.trim().toUpperCase() === code;
    });
    if (dupCode) { codeInp.focus(); return; }
    if (existingNameKey(street, name)) { nameInp.focus(); return; }
    var reason = reasonInp.value.trim();
    if (!reason) { reasonInp.focus(); return; }
    var community = commSel.value || '';
    addGridRow({ code: code, street: street, name: name, community: community });
    toast('已新增网格「' + name + '」（' + code + '），写入草稿；初始为待定责。');
    close();
  });

  // ── 批量导入（每行「街道名称,网格名称」） ──
  var importTa = document.getElementById('gc-i-text');
  var importPreview = document.querySelector('[data-gc-import-preview]');
  var importReason = document.getElementById('gc-i-reason');

  function parseImport(text) {
    var rows = [];
    String(text || '').split(/\\n/).forEach(function (line) {
      if (!line.trim()) return;
      var parts = line.split(/[,，、\\t]/).map(function (p) { return p.trim(); }).filter(Boolean);
      var street = parts[0] || '';
      var name = parts[1] || '';
      if (!street || !name) { rows.push({ street: street, name: name, ok: false, why: '格式需为「街道名称,网格名称」' }); return; }
      if (!STREETS[street]) { rows.push({ street: street, name: name, ok: false, why: '街道不存在或已停用' }); return; }
      if (existingNameKey(street, name) || rows.some(function (r) { return r.ok && r.street === street && r.name === name; })) {
        rows.push({ street: street, name: name, ok: false, why: '该街道下已有同名网格' });
        return;
      }
      rows.push({ street: street, name: name, ok: true });
    });
    return rows;
  }
  function renderImportPreview() {
    var rows = parseImport(importTa.value);
    if (!rows.length) { importPreview.hidden = true; importPreview.textContent = ''; return; }
    var ok = rows.filter(function (r) { return r.ok; });
    var bad = rows.filter(function (r) { return !r.ok; });
    importPreview.hidden = false;
    importPreview.textContent = '';
    var head = document.createElement('div');
    var b1 = document.createElement('span'); b1.className = 'gc-import-count'; b1.textContent = '可导入 ' + ok.length + ' 个';
    head.appendChild(b1);
    if (bad.length) {
      var b2 = document.createElement('span'); b2.className = 'gc-import-count';
      b2.textContent = '，跳过 ' + bad.length + ' 行';
      head.appendChild(b2);
    }
    importPreview.appendChild(head);
    rows.forEach(function (r) {
      var line = document.createElement('div');
      line.className = r.ok ? 'ok' : 'bad';
      line.textContent = r.ok ? ('✓ ' + r.street + ' → ' + r.name) : ('✕ ' + r.street + ' → ' + (r.name || '—') + '：' + r.why);
      importPreview.appendChild(line);
    });
  }
  importTa.addEventListener('input', renderImportPreview);

  document.querySelector('[data-gc-grid-import]').addEventListener('click', function () {
    importTa.value = ''; importReason.value = '';
    importPreview.hidden = true; importPreview.textContent = '';
    openDrawer('import');
  });

  document.querySelector('[data-gc-import-save]').addEventListener('click', function () {
    var rows = parseImport(importTa.value);
    var ok = rows.filter(function (r) { return r.ok; });
    if (!ok.length) { importTa.focus(); return; }
    var reason = importReason.value.trim();
    if (!reason) { importReason.focus(); return; }
    ok.forEach(function (r) { addGridRow({ code: nextCode(), street: r.street, name: r.name, community: '' }); });
    toast('已批量导入 ' + ok.length + ' 个网格，写入草稿；初始为待定责。');
    close();
  });

  // ── 删除 ──
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-del]') : null;
    if (!b) return;
    var tr = b.closest ? b.closest('tr') : null;
    if (tr) tr.remove();
  });

  // ── 从生效版带上下文进入：?edit=G-xxxx 打开编辑；?create=1 打开新增；?import=1 打开批量导入 ──
  var qs = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search) : null;
  if (qs && qs.get('edit')) {
    var code = qs.get('edit').toUpperCase();
    var eb = [].slice.call(document.querySelectorAll('[data-gc-bind]')).filter(function (b) {
      var tr = b.closest('tr');
      var sub = tr ? tr.querySelector('.gc-td-sub') : null;
      return (sub ? sub.textContent.trim() : b.getAttribute('data-grid')) === code;
    })[0];
    if (eb) eb.click();
  } else if (qs && qs.get('create')) {
    var nb = document.querySelector('[data-gc-grid-new]');
    if (nb) nb.click();
  } else if (qs && qs.get('import')) {
    var ib = document.querySelector('[data-gc-grid-import]');
    if (ib) ib.click();
  }
})();
</script>`;

sp = replaceBlock(sp, '<script id="space-edit-js">', '</script>', SCRIPT, 'sp-script');
save(A.FILE, sp);
console.log('rev26 space-draft script ok: ' + sp.length + ' chars');

/* ══════════════ C · space-responsibility-live.html ══════════════ */

let B = load('pages/space-responsibility-live.html');
let lv = B.html;
const LV_BEFORE = lv.length;

// C1. CSS：首列编码小字（live 无 gc-change-empty，锚 rev17 style 块）
lv = replaceOnce(
  lv,
  '<style id="gc-rev17-css">\n.gc-toolbar { margin-bottom: 14px; }\n</style>',
  [
    '<style id="gc-rev17-css">',
    '.gc-toolbar { margin-bottom: 14px; }',
    '.gc-td-sub { display: block; margin-top: 2px; font-size: 11px; color: var(--gc-muted); font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace; }',
    '</style>',
  ].join('\n'),
  'lv-css',
);

// C2. 卡头 note：补两步式与批量导入口径
lv = replaceOnce(
  lv,
  '<span class="gc-card-note">双来源：平台同步（只读）＋ 手动创建（可编辑街道 / 社区）；均可启停与定责</span>',
  '<span class="gc-card-note">双来源：平台同步（只读）＋ 手动创建（先选街道再命名，或按「街道名称,网格名称」批量导入）</span>',
  'lv-card-note',
);

// C3. 工具栏：「⇪ 批量导入」放「＋ 新增网格」左侧
lv = replaceOnce(
  lv,
  '      <a class="gc-btn-primary" href="space-responsibility-draft.html?create=1" title="进入草稿，新增网格">＋ 新增网格</a>',
  [
    '      <a class="gc-btn-ghost" href="space-responsibility-draft.html?import=1" title="进入草稿，按「街道名称,网格名称」批量导入">⇪ 批量导入</a>',
    '      <a class="gc-btn-primary" href="space-responsibility-draft.html?create=1" title="进入草稿，新增网格">＋ 新增网格</a>',
  ].join('\n'),
  'lv-toolbar',
);

// C4. 搜索 placeholder：名称优先
lv = replaceOnce(
  lv,
  'placeholder="搜索网格编码 / 街道 / 社区 / 主责 / 监督"',
  'placeholder="搜索网格名称 / 编码 / 街道 / 社区 / 主责 / 监督"',
  'lv-search-ph',
);

// C5. 表头：网格编码 → 网格
lv = replaceOnce(
  lv,
  '<tr><th>网格编码</th><th>所属街道</th>',
  '<tr><th>网格</th><th>所属街道</th>',
  'lv-thead',
);

// C6. 五行首列改「名称 + 编码小字」
const LIVE_ROWS = [
  ['G-0418', '朝阳门南小街网格'],
  ['G-0417', '朝内大街网格'],
  ['G-0419', '东花市大街网格'],
  ['G-0421', '金宝街北网格'],
  ['G-0422', '西打磨厂网格'],
];
for (const [code, name] of LIVE_ROWS) {
  lv = replaceOnce(
    lv,
    '<td class="gc-td-code">' + code + '</td><td>',
    '<td><span class="gc-grid-name">' + name + '</span><span class="gc-td-sub">' + code + '</span></td><td>',
    'lv-first-cell-' + code,
  );
}

save(B.FILE, lv);
console.log('rev26 space-live ok: ' + LV_BEFORE + ' → ' + lv.length + ' chars (+' + (lv.length - LV_BEFORE) + ')');

/* ══════════════ 断言 ══════════════ */

const checks = {
  draftThead: sp.includes('<th>网格</th>') && !sp.includes('<th>网格编码</th>'),
  draftImportBtn: sp.includes('data-gc-grid-import'),
  draftStep1: sp.includes('① 所属街道（必选，启用中的街道；含手动创建的街道）'),
  draftStep2: sp.includes('② 网格名称（必填，表格里优先显示名称）'),
  draftStep2Gate: sp.includes('gc-n-step2') && sp.includes('is-off'),
  draftImportDrawer: sp.includes('data-gc-drawer="import"') && sp.includes('data-gc-import-save'),
  draftSubCells: (sp.match(/<span class="gc-td-sub">G-\d+<\/span>/g) || []).length,
  draftUrlImport: sp.includes("qs.get('import')"),
  liveThead: lv.includes('<th>网格</th>') && !lv.includes('<th>网格编码</th>'),
  liveImportLink: lv.includes('space-responsibility-draft.html?import=1'),
  liveSubCells: (lv.match(/<span class="gc-td-sub">G-\d+<\/span>/g) || []).length,
  names: ['朝阳门南小街网格', '朝内大街网格', '东花市大街网格', '金宝街北网格', '西打磨厂网格'].every((n) => sp.includes(n) && lv.includes(n)),
};
console.log('checks:', JSON.stringify(checks));
if (!checks.draftThead || !checks.liveThead) throw new Error('thead missing');
if (!checks.draftImportBtn || !checks.draftImportDrawer || !checks.draftUrlImport) throw new Error('draft import incomplete');
if (!checks.draftStep1 || !checks.draftStep2 || !checks.draftStep2Gate) throw new Error('draft two-step drawer incomplete');
if (!checks.liveImportLink) throw new Error('live import link missing');
if (checks.draftSubCells !== 4) throw new Error('draft sub cells expected 4, got ' + checks.draftSubCells);
if (checks.liveSubCells !== 5) throw new Error('live sub cells expected 5, got ' + checks.liveSubCells);
if (!checks.names) throw new Error('grid names missing');
console.log('rev26 all ok');
