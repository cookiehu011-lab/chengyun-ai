// rev27 · space-responsibility-draft.html + space-responsibility-live.html
// 网格创建口径再迭代（2026-10-14 第二轮，与线上实现对齐）：
// 1) 新建网格：① 所属街道 → ② 网格改为「下拉选择」（来自外部平台网格清单，清单中已创建的不再出现）；
// 2) 网格编号：基于所选网格名称回显（清单内名称↔编号一一对应），只读不可改；清单外名称（批量导入）按序自动补号；
// 3) 表格首列拆为「网格名称」「网格编号」两列，其余信息不变（街道/社区/主责/协同/状态/生效日期/来源/操作）。
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
function replaceAll(src, needle, next, tag) {
  if (!src.includes(needle)) throw new Error('[' + tag + '] needle not found');
  return src.split(needle).join(next);
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

// A1. CSS：只读回显编号样式
sp = replaceOnce(
  sp,
  '.gc-import-count { font-weight: 600; }',
  [
    '.gc-import-count { font-weight: 600; }',
    '/* rev27 网格清单口径：编号回显只读 */',
    '.gc-drawer input[readonly] { background: var(--gc-bg); color: var(--gc-muted); }',
  ].join('\n'),
  'sp-css',
);

// A2. 表头：网格 → 网格名称 + 网格编号
sp = replaceOnce(
  sp,
  '<tr><th>网格</th><th>所属街道</th>',
  '<tr><th>网格名称</th><th>网格编号</th><th>所属街道</th>',
  'sp-thead',
);

// A3. 四行首列拆两列（名称 td + 编号 td[data-code]）
const DRAFT_ROWS = [
  ['G-0418', '朝阳门南小街网格'],
  ['G-0417', '朝内大街网格'],
  ['G-0419', '东花市大街网格'],
  ['G-0421', '金宝街北网格'],
];
for (const [code, name] of DRAFT_ROWS) {
  sp = replaceOnce(
    sp,
    '<td><span class="gc-grid-name">' + name + '</span><span class="gc-td-sub">' + code + '</span></td>',
    '<td class="gc-grid-name">' + name + '</td><td class="gc-td-code" data-code="' + code + '">' + code + '</td>',
    'sp-first-cells-' + code,
  );
}

// A4. 新增抽屉 ② 区：名称 input → 清单下拉；编号 → 只读回显
sp = replaceOnce(
  sp,
  '<div class="gc-field gc-field--full"><label for="gc-n-name">② 网格名称（必填，表格里优先显示名称）</label><input type="text" id="gc-n-name" placeholder="如 朝内大街北网格"></div>',
  '<div class="gc-field gc-field--full"><label for="gc-n-name">② 网格（下拉选择，来自外部平台网格清单；清单中已创建的不再出现）</label><select id="gc-n-name"></select></div>',
  'sp-name-select',
);
sp = replaceOnce(
  sp,
  '<div class="gc-field"><label for="gc-n-code">网格编码</label><input type="text" id="gc-n-code" placeholder="选择街道后自动建议，如 G-0422"></div>',
  '<div class="gc-field"><label for="gc-n-code">网格编号（按所选网格回显，创建后不可改）</label><input type="text" id="gc-n-code" placeholder="选择网格后回显编号，如 G-0401" readonly></div>',
  'sp-code-readonly',
);
sp = replaceOnce(
  sp,
  '<p class="gc-ov-note">新建网格初始为「待定责」（无主责）：派发不可用，需在表格「编辑」中指定一名主责后才可承接派发。保存后写入草稿，发布后才作用于新事件。</p>',
  '<p class="gc-ov-note">网格名称与编号一一对应（清单回显，不手工编号）。新建网格初始为「待定责」（无主责）：派发不可用，需在表格「编辑」中指定一名主责后才可承接派发。保存后写入草稿，发布后才作用于新事件。</p>',
  'sp-note',
);
save(A.FILE, sp);
console.log('rev27 space-draft html ok: ' + sp.length + ' chars');

/* ══════════════ B · space-edit-js 整段重写 ══════════════ */

const SCRIPT = `<script id="space-edit-js">
(function () {
  // ── 外部平台网格清单（演示数据）：网格名称 ↔ 编号一一对应 ──
  var GRID_CATALOG = {
    '朝阳门街道': [
      { name: '朝内大街北网格', code: 'G-0401' },
      { name: '朝阳门外南大街网格', code: 'G-0402' },
      { name: '大方家胡同网格', code: 'G-0403' },
      { name: '朝内大街网格', code: 'G-0417' },
      { name: '朝阳门南小街网格', code: 'G-0418' },
      { name: '东花市大街网格', code: 'G-0419' }
    ],
    '东华门街道': [
      { name: '东华门大街网格', code: 'G-0404' },
      { name: '王府井西街网格', code: 'G-0405' },
      { name: '金宝街北网格', code: 'G-0421' }
    ],
    '建国门街道': [
      { name: '苏州胡同网格', code: 'G-0406' },
      { name: '大羊毛胡同网格', code: 'G-0407' },
      { name: '建国门内大街网格', code: 'G-0420' }
    ],
    '前门街道': [
      { name: '前门东大街网格', code: 'G-0408' },
      { name: '西打磨厂网格', code: 'G-0422' }
    ]
  };
  // ── 街道 → 启用中社区（含 rev25 手动街道前门） ──
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

  // ── 编辑（单行编辑，统一入口；按行内编号定位） ──
  function codeOfTr(tr) {
    var td = tr ? tr.querySelector('td[data-code]') : null;
    return td ? td.textContent.trim() : '';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-gc-bind]') : null;
    if (!b) return;
    var code = codeOfTr(b.closest('tr')) || b.getAttribute('data-grid');
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

  // ── 网格编号：扫描现有行（td[data-code]）取最大值递增（清单外名称兜底） ──
  function nextCode() {
    var max = 400;
    [].slice.call(tbody.querySelectorAll('td[data-code]')).forEach(function (td) {
      var m = /G-(\\d+)/.exec(td.textContent || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'G-' + String(max + 1).padStart(4, '0');
  }
  // 编号回显：清单内名称用清单编号；清单外按序自动补号
  function codeForName(street, name) {
    var list = GRID_CATALOG[street] || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i].code;
    return nextCode();
  }

  // ── 该街道下已创建的网格名称 ──
  function createdNames(street) {
    var set = {};
    [].slice.call(tbody.querySelectorAll('tr')).forEach(function (tr) {
      var st = tr.children[2] ? tr.children[2].textContent.trim() : '';
      var nm = tr.querySelector('td.gc-grid-name');
      if (st === street && nm) set[nm.textContent.trim()] = 1;
    });
    return set;
  }
  // ── 网格下拉：清单中该街道下尚未创建的网格 ──
  function fillGridOptions(street, keepName) {
    var sel = document.getElementById('gc-n-name');
    sel.textContent = '';
    var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '请选择网格…'; sel.appendChild(opt0);
    var created = createdNames(street);
    var opts = [];
    (GRID_CATALOG[street] || []).forEach(function (x) { if (!created[x.name] && x.name !== keepName) opts.push(x.name); });
    if (keepName) opts.unshift(keepName);
    opts.forEach(function (n) {
      var o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
    });
    sel.value = keepName || '';
  }

  // ── 插行（新增 / 批量导入共用）：名称+编号两列，默认待定责、无主责、手动来源 ──
  function addGridRow(row) {
    var code = row.code;
    var tr = document.createElement('tr');
    tr.setAttribute('data-grid-row', code);
    var tdN = document.createElement('td'); tdN.className = 'gc-grid-name'; tdN.textContent = row.name; tr.appendChild(tdN);
    var tdC = document.createElement('td'); tdC.className = 'gc-td-code';
    tdC.setAttribute('data-code', code); tdC.textContent = code; tr.appendChild(tdC);
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
      var st = tr.children[2] ? tr.children[2].textContent.trim() : '';
      var nm = tr.querySelector('td.gc-grid-name');
      if (st === street && nm && nm.textContent.trim() === name) { hit = true; return true; }
      return false;
    });
    return hit;
  }

  // ── 新增网格（两步式：① 街道 → ② 网格下拉 + 编号回显 + 社区 + 原因） ──
  var streetSel = document.getElementById('gc-n-street');
  var step2 = document.getElementById('gc-n-step2');
  var nameSel = document.getElementById('gc-n-name');
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
      fillGridOptions(street, '');
      fillCommunities(street);
      codeInp.value = '';
    } else {
      step2.classList.add('is-off');
    }
  });
  nameSel.addEventListener('change', function () {
    var name = nameSel.value;
    codeInp.value = name ? codeForName(streetSel.value, name) : '';
  });

  document.querySelector('[data-gc-grid-new]').addEventListener('click', function () {
    streetSel.value = '';
    step2.classList.add('is-off');
    nameSel.textContent = '';
    codeInp.value = ''; reasonInp.value = '';
    fillCommunities('');
    openDrawer('create');
  });

  document.querySelector('[data-gc-create-save]').addEventListener('click', function () {
    var street = streetSel.value;
    if (!street) { streetSel.focus(); return; }
    var name = nameSel.value;
    if (!name) { nameSel.focus(); return; }
    var code = codeInp.value.trim().toUpperCase();
    if (!code) { nameSel.focus(); return; }
    var dupCode = [].slice.call(tbody.querySelectorAll('td[data-code]')).some(function (td) {
      return td.textContent.trim().toUpperCase() === code;
    });
    if (dupCode) { nameSel.focus(); return; }
    if (existingNameKey(street, name)) { nameSel.focus(); return; }
    var reason = reasonInp.value.trim();
    if (!reason) { reasonInp.focus(); return; }
    var community = commSel.value || '';
    addGridRow({ code: code, street: street, name: name, community: community });
    toast('已新增网格「' + name + '」（' + code + '），写入草稿；初始为待定责。');
    close();
  });

  // ── 批量导入（每行「街道名称,网格名称」；编号按清单回显，清单外自动补号） ──
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
    ok.forEach(function (r) { addGridRow({ code: codeForName(r.street, r.name), street: r.street, name: r.name, community: '' }); });
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
      return codeOfTr(b.closest('tr')) === code;
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
console.log('rev27 space-draft script ok: ' + sp.length + ' chars');

/* ══════════════ C · space-responsibility-live.html ══════════════ */

let B = load('pages/space-responsibility-live.html');
let lv = B.html;

// C1. 表头
lv = replaceOnce(
  lv,
  '<tr><th>网格</th><th>所属街道</th>',
  '<tr><th>网格名称</th><th>网格编号</th><th>所属街道</th>',
  'lv-thead',
);

// C2. 五行首列拆两列
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
    '<td><span class="gc-grid-name">' + name + '</span><span class="gc-td-sub">' + code + '</span></td><td>',
    '<td class="gc-grid-name">' + name + '</td><td class="gc-td-code" data-code="' + code + '">' + code + '</td><td>',
    'lv-first-cells-' + code,
  );
}

// C3. 卡头 note 更新
lv = replaceOnce(
  lv,
  '<span class="gc-card-note">双来源：平台同步（只读）＋ 手动创建（先选街道再命名，或按「街道名称,网格名称」批量导入）</span>',
  '<span class="gc-card-note">双来源：平台同步（只读）＋ 手动创建（网格取自外部平台清单下拉选择，编号随名称回显；或按「街道名称,网格名称」批量导入）</span>',
  'lv-card-note',
);

save(B.FILE, lv);
console.log('rev27 space-live ok: ' + lv.length + ' chars');

/* ══════════════ 断言 ══════════════ */

const checks = {
  draftThead: sp.includes('<th>网格名称</th>') && sp.includes('<th>网格编号</th>') && !sp.includes('<th>网格</th>'),
  draftCodeCells: (sp.match(/<td class="gc-td-code" data-code="G-\d+">/g) || []).length,
  draftNameSelect: sp.includes('② 网格（下拉选择，来自外部平台网格清单'),
  draftCodeReadonly: sp.includes('选择网格后回显编号') && sp.includes('id="gc-n-code" placeholder="选择网格后回显编号，如 G-0401" readonly'),
  draftCatalog: sp.includes('GRID_CATALOG') && sp.includes('朝内大街北网格'),
  liveThead: lv.includes('<th>网格名称</th>') && lv.includes('<th>网格编号</th>') && !lv.includes('<th>网格</th>'),
  liveCodeCells: (lv.match(/<td class="gc-td-code" data-code="G-\d+">/g) || []).length,
  liveCardNote: lv.includes('编号随名称回显'),
  noSubLeft: !sp.includes('gc-td-sub') && !lv.includes('gc-td-sub'),
};
console.log('checks:', JSON.stringify(checks));
if (!checks.draftThead || !checks.liveThead) throw new Error('thead missing');
if (checks.draftCodeCells !== 4) throw new Error('draft code cells expected 4, got ' + checks.draftCodeCells);
if (checks.liveCodeCells !== 5) throw new Error('live code cells expected 5, got ' + checks.liveCodeCells);
if (!checks.draftNameSelect || !checks.draftCodeReadonly || !checks.draftCatalog) throw new Error('draft two-step select incomplete');
if (!checks.liveCardNote) throw new Error('live card note missing');
if (!checks.noSubLeft) throw new Error('gc-td-sub leftovers');
console.log('rev27 all ok');
