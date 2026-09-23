// rev24 · space-responsibility-draft.html
// 网格责任表补齐后台管理「启用/停用」能力（与其它配置页范式对齐）：
// 1) 四行静态网格：编辑与删除之间插入行级「停用/启用」开关（待定责行初始为「启用」按钮）
// 2) 卡头补一致性角标「草稿编辑中：可新增、编辑、启停、删除网格」
// 3) space-edit-js：新增 toast + 启停委托（启用↔停用；无主责行点「启用」给提示不生效）
// 4) space-edit-js 新增行构造：带启停按钮（状态=启用→按钮「停用」，否则「启用」）
// 5) gc-footer-js：syncStatusChips 升级待定责→启用时同步按钮文字；unassignedGrids 跳过显式停用行
// 约束：不改动 bind/create 抽屉流程与 ?edit=/?create= 深链，保持 grid-edit.test.mjs 基线全绿。
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('pages/space-responsibility-draft.html');
let html = fs.readFileSync(FILE, 'utf8');
const before = html.length;

function cut(src, startMark, endMark, from = 0) {
  const s = src.indexOf(startMark, from);
  if (s < 0) throw new Error('start mark not found: ' + startMark.slice(0, 60));
  const e = src.indexOf(endMark, s);
  if (e < 0) throw new Error('end mark not found: ' + endMark.slice(0, 60));
  return { s, e: e + endMark.length };
}
function replaceRange(src, range, next) {
  return src.slice(0, range.s) + next + src.slice(range.e);
}
function replaceOnce(src, needle, next) {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error('needle not found: ' + needle.slice(0, 60));
  if (src.indexOf(needle, i + 1) >= 0) throw new Error('needle not unique: ' + needle.slice(0, 60));
  return src.slice(0, i) + next + src.slice(i + needle.length);
}

/* ───────────── 1 · 卡头一致性角标 ───────────── */

html = replaceOnce(
  html,
  '    <header class="gc-card-head">\n' +
    '      <h2 class="gc-card-title" id="gc-grid-title">网格责任表</h2>\n' +
    '    </header>',
  '    <header class="gc-card-head">\n' +
    '      <h2 class="gc-card-title" id="gc-grid-title">网格责任表</h2>\n' +
    '      <span class="gc-card-note">草稿编辑中：可新增、编辑、启停、删除网格</span>\n' +
    '    </header>',
);

/* ───────────── 2 · 静态行插入启停开关 ───────────── */

const GRID_ROWS = [
  { code: 'G-0418', owner: '刘洋', sup: '陈督', btn: '停用' },
  { code: 'G-0417', owner: '张强', sup: '—', btn: '停用' },
  { code: 'G-0419', owner: '周琳', sup: '—', btn: '停用' },
  { code: 'G-0421', owner: '', sup: '—', btn: '启用' },
];
for (const g of GRID_ROWS) {
  const oldCell =
    '<td class="gc-td-actions"><button type="button" class="gc-btn-link" data-gc-bind data-grid="' + g.code +
    '" data-owner="' + g.owner + '" data-sup="' + g.sup + '">编辑</button>';
  const newCell =
    '<td class="gc-td-actions"><button type="button" class="gc-btn-link" data-gc-bind data-grid="' + g.code +
    '" data-owner="' + g.owner + '" data-sup="' + g.sup + '">编辑</button>' +
    '<button type="button" class="gc-btn-link" data-gc-toggle data-grid="' + g.code + '">' + g.btn + '</button>';
  html = replaceOnce(html, oldCell, newCell);
}

/* ───────────── 3 · space-edit-js：toast + 启停委托 ───────────── */

const TOGGLE_JS = [
  '  // ── 启用 / 停用（后台管理范式：行级启停，写入草稿） ──',
  '  function toast(msg) {',
  "    var el = document.querySelector('[data-gc-draft-toast]');",
  '    if (!el) return;',
  '    el.textContent = msg;',
  "    el.classList.add('gc-draft-toast--show');",
  '    clearTimeout(toast._t);',
  "    toast._t = setTimeout(function () { el.classList.remove('gc-draft-toast--show'); }, 3200);",
  '  }',
  '  function statusOf(tr) {',
  "    var chip = tr.querySelector('.gc-chip');",
  '    if (!chip) return \'off\';',
  "    if (chip.classList.contains('gc-chip--green')) return 'on';",
  "    if (chip.classList.contains('gc-chip--muted')) return 'pending';",
  "    return 'off';",
  '  }',
  '  function setStatus(tr, cls, text, btnText) {',
  "    var chip = tr.querySelector('.gc-chip');",
  "    if (chip) { chip.className = 'gc-chip ' + cls; chip.textContent = text; }",
  "    var btn = tr.querySelector('[data-gc-toggle]');",
  '    if (btn) btn.textContent = btnText;',
  '  }',
  "  document.addEventListener('click', function (e) {",
  "    var b = e.target.closest ? e.target.closest('[data-gc-toggle]') : null;",
  '    if (!b) return;',
  "    var tr = b.closest('tr');",
  '    if (!tr) return;',
  '    var st = statusOf(tr);',
  "    if (st === 'on') {",
  "      setStatus(tr, 'gc-chip--off', '停用', '启用');",
  "      toast('已停用该网格，写入草稿；停用后事件不再匹配派发，尚未生效。');",
  '      return;',
  '    }',
  "    var owner = tr.querySelector('td[data-cell=\"owner\"]');",
  "    var ov = owner ? (owner.textContent || '').replace(/\\s/g, '') : '';",
  "    var hasOwner = !!ov && ov !== '—' && ov.indexOf('（空）') < 0 && ov.indexOf('(空)') < 0;",
  "    if (!hasOwner) { toast('该网格还没有网格主责，请先在「编辑」中指定，再启用。'); return; }",
  "    setStatus(tr, 'gc-chip--green', '启用', '停用');",
  "    toast('已启用该网格，写入草稿，尚未生效。');",
  '  });',
  '',
].join('\n');

html = replaceOnce(html, '  // ── 抽屉开关 ──', TOGGLE_JS + '  // ── 抽屉开关 ──');

/* ───────────── 4 · 新增行构造：带启停按钮 ───────────── */

html = replaceOnce(
  html,
  "    eb.textContent = '编辑'; tdA.appendChild(eb);\n" +
    "    var db = document.createElement('button'); db.type = 'button'; db.className = 'gc-btn-link';",
  "    eb.textContent = '编辑'; tdA.appendChild(eb);\n" +
    "    var tb = document.createElement('button'); tb.type = 'button'; tb.className = 'gc-btn-link';\n" +
    "    tb.setAttribute('data-gc-toggle', ''); tb.setAttribute('data-grid', code);\n" +
    "    tb.textContent = status === '启用' ? '停用' : '启用'; tdA.appendChild(tb);\n" +
    "    var db = document.createElement('button'); db.type = 'button'; db.className = 'gc-btn-link';",
);

/* ───────────── 5 · gc-footer-js：停用豁免 + 按钮同步 ───────────── */

// 5a. unassignedGrids 跳过显式停用行（停用网格不参与派发，不阻断发布）
html = replaceOnce(
  html,
  "    [].slice.call(document.querySelectorAll('td[data-cell=\"owner\"][data-grid]')).forEach(function (td) {\n" +
    "      var v = (td.textContent || '').replace(/\\s/g, '');\n" +
    "      if (!v || v === '—' || v.indexOf('（空）') >= 0 || v.indexOf('(空)') >= 0) {\n" +
    '        out.push(td.getAttribute(\'data-grid\'));\n' +
    '      }\n' +
    '    });',
  "    [].slice.call(document.querySelectorAll('td[data-cell=\"owner\"][data-grid]')).forEach(function (td) {\n" +
    "      var stChip = td.closest('tr').querySelector('.gc-chip');\n" +
    "      if (stChip && stChip.classList.contains('gc-chip--off')) return; // 停用网格不参与派发，不阻断\n" +
    "      var v = (td.textContent || '').replace(/\\s/g, '');\n" +
    "      if (!v || v === '—' || v.indexOf('（空）') >= 0 || v.indexOf('(空)') >= 0) {\n" +
    '        out.push(td.getAttribute(\'data-grid\'));\n' +
    '      }\n' +
    '    });',
);

// 5b. syncStatusChips 待定责→启用时，同步该行启停按钮文字
html = replaceOnce(
  html,
  "      if (chip && (chip.textContent || '').indexOf('待定责') >= 0) {\n" +
    "        chip.className = 'gc-chip gc-chip--green';\n" +
    "        chip.textContent = '启用';\n" +
    '      }',
  "      if (chip && (chip.textContent || '').indexOf('待定责') >= 0) {\n" +
    "        chip.className = 'gc-chip gc-chip--green';\n" +
    "        chip.textContent = '启用';\n" +
    "        var tbtn = tr.querySelector('[data-gc-toggle]');\n" +
    "        if (tbtn) tbtn.textContent = '停用';\n" +
    '      }',
);

// 5c. syncStatusChips 行定位改用 closest('tr')（与 mini-dom 测试环境兼容，浏览器行为不变）
html = replaceOnce(
  html,
  "      var tr = td.parentNode;\n",
  "      var tr = td.closest('tr');\n",
);

/* ───────────── 断言 ───────────── */

const staticToggles = (html.match(/data-gc-toggle data-grid="G-\d{4}">/g) || []).length;
if (staticToggles !== 4) throw new Error('static toggle buttons expected 4, got ' + staticToggles);
const builderToggle = html.includes("tb.setAttribute('data-gc-toggle', '')");
if (!builderToggle) throw new Error('new-row builder missing toggle button');
if (!html.includes('草稿编辑中：可新增、编辑、启停、删除网格')) throw new Error('card note missing');
if (!html.includes("stChip.classList.contains('gc-chip--off')) return")) throw new Error('footer disable-exempt missing');
if (!html.includes("var tbtn = tr.querySelector('[data-gc-toggle]')")) throw new Error('footer toggle-sync missing');
if (html.includes('<script id="space-edit-js">') === false) throw new Error('space-edit-js vanished');
if (html.includes("html.includes('换绑')")) throw new Error('unexpected');

fs.writeFileSync(FILE, html);
console.log('rev24 ok: ' + before + ' → ' + html.length + ' chars (+' + (html.length - before) + ')');
console.log('counts:', JSON.stringify({
  staticToggles: staticToggles,
  cardNote: html.includes('草稿编辑中：可新增、编辑、启停、删除网格'),
  footerExempt: html.includes('停用网格不参与派发，不阻断'),
}));
