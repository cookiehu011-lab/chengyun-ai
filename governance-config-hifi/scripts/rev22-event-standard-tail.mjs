// rev22 · event-standard-draft.html
// 1) 分区1 字典摘录表 → 后台管理列表（新增/编辑/删除/启用·停用）
// 2) 分区5 三张原因字典表 → 后台管理列表
// 3) 清理尾部：旧 440px 抽屉 CSS / 静态 scrim+抽屉 / 旧 edit-js / 旧抽屉内开关 CSS
// 4) 重写页脚脚本：页内分区切换 + 互斥阻断(读字典表两列) + 页脚四元 + toast
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('pages/event-standard-draft.html');
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
function line(s) { return '                    ' + s; }

/* ────────────────────────── 1 · 字典摘录卡 ────────────────────────── */

const DICT_FIELDS = JSON.stringify([
  { k: 'name', label: '细类', kind: 'name', required: true, ph: '如 机动车违停' },
  { k: 'code', label: '编码', kind: 'code', required: true, primary: true, ph: '如 DM-0105' },
  { k: 'standard', label: '立案标准摘录', full: true, ph: '如 占用机动车道停放超 5 分钟' },
  { k: 'evidence', label: '证据要求', full: true, ph: '如 需含车牌与全景照' },
  { k: 'cand', label: '自动结案候选', type: 'select', options: ['开', '关'], def: '关' },
  { k: 'mc', label: '必须人工核查', type: 'select', options: ['开', '关'], def: '开' },
]);

const DICT_ROWS = [
  ['机动车违停', 'DM-0101', '占用机动车道停放超 5 分钟', '需含车牌与全景照', '关', '开', 'on', ''],
  ['共享单车乱停放', 'DM-0102', '未入栏或占用盲道', '需含单车品牌与位置', '开', '开', 'on', ''],
  ['占道经营', 'DM-0103', '占用城市道路经营', '含摊位与道路全景', '关', '开', 'on', '与施工占道互斥'],
  ['施工占道', 'DM-0104', '占道施工未设围挡', '需含审批编号', '关', '开', 'on', '与占道经营互斥'],
  ['暴露垃圾', 'HJ-0201', '生活垃圾暴露未清运', '含位置与范围照', '关', '开', 'on', ''],
  ['杂物堆放', 'HJ-0202', '公共区域堆放杂物', '含堆放物与占道情况', '关', '开', 'on', ''],
  ['非法倾倒', 'HJ-0203', '建筑垃圾非法倾倒', '含倾倒过程或痕迹', '关', '开', 'on', ''],
  ['建材乱堆', 'HJ-0204', '建材占用公共空间', '含占道情况', '关', '开', 'on', ''],
  ['无证户外广告', 'GG-0301', '未经审批设置户外广告', '含广告牌全景', '关', '开', 'off', ''],
  ['超规格招牌', 'GG-0302', '招牌超出台账规格', '含尺寸对比', '关', '开', 'on', ''],
  ['违规灯箱', 'GG-0303', '灯箱破损或违规设置', '含近景照', '关', '关', 'on', '必须人工核查已关闭'],
];

const NO_DELETE_TIP = '仍被历史事件引用，不可删除，可停用';

function dictRow(r) {
  const [name, code, standard, evidence, cand, mc, st, note] = r;
  const isOff = st !== 'on';
  const locked = code === 'GG-0301';
  const delCls = locked ? 'gc-btn-link gc-btn-link--disabled' : 'gc-btn-link';
  const delAttr = locked
    ? ` data-gc-crud-nodelete="${NO_DELETE_TIP}" title="${NO_DELETE_TIP}" aria-disabled="true"`
    : '';
  return [
    '                  <tr data-gc-row>',
    `                    <td class="gc-td-name" data-col="name">${name}</td>`,
    `                    <td class="gc-td-code" data-col="code" data-primary>${code}</td>`,
    `                    <td data-col="standard">${standard}</td>`,
    `                    <td data-col="evidence">${evidence}</td>`,
    `                    <td data-col="cand">${cand}</td>`,
    `                    <td data-col="mc">${mc}</td>`,
    `                    <td data-col="status"><span class="gc-chip gc-chip--${isOff ? 'off' : 'green'}">${isOff ? '停用' : '启用'}</span></td>`,
    '                    <td class="gc-td-actions" data-col="actions"><button type="button" class="gc-btn-link" data-gc-crud-edit>编辑</button>'
      + `<button type="button" class="gc-btn-link" data-gc-crud-toggle>${isOff ? '启用' : '停用'}</button>`
      + `<button type="button" class="${delCls}"${delAttr} data-gc-crud-del>删除</button>`
      + (note ? `<span class="gc-row-note">${note}</span>` : '')
      + '</td>',
    '                  </tr>',
  ].join('\n');
}

const SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

const dictBlock = [
  '          <!-- 右：字典摘录（后台管理：新增 / 编辑 / 删除 / 启用·停用） -->',
  '          <section class="gc-card" aria-labelledby="gc-dict-title" data-gc-crud="dict" data-gc-crud-name="细类"',
  `            data-gc-crud-fields='${DICT_FIELDS}'`,
  '            data-gc-crud-note="「自动结案候选」与「必须人工核查」互斥：同一细类不能同时为「开」，存在冲突的草稿不能发布。">',
  '            <header class="gc-card-head">',
  '              <h2 class="gc-card-title" id="gc-dict-title">字典摘录</h2>',
  '              <span class="gc-card-aside">共 89 项 · 当前列出 11 项</span>',
  '            </header>',
  '            <div class="gc-toolbar">',
  '              <div class="gc-search">',
  '                ' + SEARCH_SVG,
  '                <input type="text" id="gc-q-dict" placeholder="搜索细类 / 编码 / 标准 / 证据" aria-label="搜索事件细类" data-gc-crud-q>',
  '                <button type="button" class="gc-btn-ghost" data-gc-crud-search>查询</button>',
  '              </div>',
  '              <button type="button" class="gc-btn-primary" data-gc-crud-new>＋ 新增细类</button>',
  '            </div>',
  '            <div class="gc-table-scroll">',
  '              <table class="gc-table" data-gc-crud-table>',
  '                <thead>',
  '                  <tr>',
  '                    <th scope="col">细类</th>',
  '                    <th scope="col">编码</th>',
  '                    <th scope="col">立案标准摘录</th>',
  '                    <th scope="col">证据要求</th>',
  '                    <th scope="col">自动结案候选</th>',
  '                    <th scope="col">必须人工核查</th>',
  '                    <th scope="col">状态</th>',
  '                    <th scope="col" class="gc-th-actions">操作</th>',
  '                  </tr>',
  '                </thead>',
  '                <tbody>',
  DICT_ROWS.map(dictRow).join('\n'),
  '                </tbody>',
  '              </table>',
  '            </div>',
  '            <p class="gc-card-foot">停用类型不影响已立案事件；新事件不再匹配停用类型。「必须人工核查」与「自动结案候选」互斥，同一细类只能开启一个。</p>',
  '          </section>',
].join('\n');

{
  const range = cut(
    html,
    '          <!-- 右：字典摘录 -->',
    '同一细类只能开启一个。</p>\n          </section>',
  );
  html = replaceRange(html, range, dictBlock);
}

/* ────────────────────────── 2 · 三张原因字典卡 ────────────────────────── */

const REASON_FIELDS = JSON.stringify([
  { k: 'name', label: '原因', kind: 'name', required: true, ph: '如 证据不足以成立' },
  { k: 'code', label: '编码', kind: 'code', required: true, primary: true, ph: '如 NL-04' },
]);

const REASONS = [
  {
    id: 'nl', title: '不予立案原因', aside: '待立案 · 人选择', q: 'gc-q-nl',
    rows: [['不属于事件范围', 'NL-01', 'on'], ['重复上报（已存在主事件）', 'NL-02', 'on'], ['证据不足以成立', 'NL-03', 'off']],
  },
  {
    id: 'tc', title: '退回处置原因', aside: '待核查 · 人选择', q: 'gc-q-tc',
    rows: [['处置结果与现场不符', 'TC-01', 'on'], ['证据图不清晰', 'TC-02', 'on'], ['处置未闭环（问题仍存在）', 'TC-03', 'on']],
  },
  {
    id: 'zf', title: '作废申请原因', aside: '待处置 · 人选择', q: 'gc-q-zf',
    rows: [['责任主体判定错误', 'ZF-01', 'on'], ['重复立案（已有主事件）', 'ZF-02', 'on'], ['现场已自行处置', 'ZF-03', 'off']],
  },
];

function reasonRow(r) {
  const [name, code, st] = r;
  const isOff = st !== 'on';
  return '                  <tr data-gc-row>'
    + `<td class="gc-td-name" data-col="name">${name}</td>`
    + `<td class="gc-td-code" data-col="code" data-primary>${code}</td>`
    + `<td data-col="status"><span class="gc-chip gc-chip--${isOff ? 'off' : 'green'}">${isOff ? '停用' : '启用'}</span></td>`
    + '<td class="gc-td-actions" data-col="actions"><button type="button" class="gc-btn-link" data-gc-crud-edit>编辑</button>'
    + `<button type="button" class="gc-btn-link" data-gc-crud-toggle>${isOff ? '启用' : '停用'}</button>`
    + '<button type="button" class="gc-btn-link" data-gc-crud-del>删除</button></td></tr>';
}

const reasonBlock = REASONS.map((c) => [
  `          <div class="gc-card" data-gc-crud="${c.id}" data-gc-crud-name="${c.title}"`,
  `            data-gc-crud-fields='${REASON_FIELDS}'`,
  '            data-gc-crud-note="停用原因不影响历史事件；历史事件保留立案时的原因文案。">',
  '            <header class="gc-card-head">',
  `              <h2 class="gc-card-title">${c.title}</h2>`,
  `              <span class="gc-card-aside">${c.aside}</span>`,
  '            </header>',
  '            <div class="gc-toolbar">',
  '              <div class="gc-search">',
  '                ' + SEARCH_SVG,
  `                <input type="text" id="${c.q}" placeholder="搜索原因 / 编码" aria-label="搜索${c.title}" data-gc-crud-q>`,
  '                <button type="button" class="gc-btn-ghost" data-gc-crud-search>查询</button>',
  '              </div>',
  '              <button type="button" class="gc-btn-primary" data-gc-crud-new>＋ 新增原因</button>',
  '            </div>',
  '            <div class="gc-table-scroll">',
  '              <table class="gc-table" data-gc-crud-table>',
  '                <thead><tr><th scope="col">原因</th><th scope="col">编码</th><th scope="col">状态</th><th scope="col" class="gc-th-actions">操作</th></tr></thead>',
  '                <tbody>',
  c.rows.map(reasonRow).join('\n'),
  '                </tbody>',
  '              </table>',
  '            </div>',
  '          </div>',
].join('\n')).join('\n\n');

{
  const range = cut(
    html,
    '          <div class="gc-card">\n            <header class="gc-card-head">\n              <h2 class="gc-card-title">不予立案原因</h2>',
    '          <div class="gc-note-box">',
  );
  html = replaceRange(html, range, reasonBlock + '\n\n');
}

/* ────────────────────────── 3 · 尾部清理 ────────────────────────── */

// 3a · 旧抽屉 CSS（440px，与引擎 460px 重复）
{
  const range = cut(html, '<style id="event-standard-edit-css">', '</style>');
  html = replaceRange(html, range, '');
}

// 3b · 静态 scrim + 两张静态抽屉 + 旧 edit-js → 新页脚脚本
const FOOTER_JS = `<script id="gc-footer-js">
(function () {
  var DICT = '[data-gc-crud="dict"]';
  var tabs = [].slice.call(document.querySelectorAll('[data-gc-pane-btn]'));
  var panes = [].slice.call(document.querySelectorAll('[data-gc-pane]'));
  var blockBanner = document.querySelector('[data-gc-es-block]');
  var blockMain = document.querySelector('[data-gc-es-block-main]');
  var footerNote = document.querySelector('[data-gc-es-footer-note]');
  var previewBtn = document.getElementById('gc-es-go-preview');
  var reasonEl = document.getElementById('gc-es-footer-reason');
  var toastEl = document.querySelector('[data-gc-es-toast]');
  var READY_NOTE = '本页只写入草稿；「确认发布」在「规则版本」页，须经「发布前预览」做冲突校验后确认。';
  var blockedState = false;

  /* ── 页内分区切换：分类字典 | 事件等级 | 成立规则 | 字段与证据 | 原因字典 ── */
  function showPane(key) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-gc-pane-btn') === key;
      t.classList.toggle('gc-part-tab--active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panes.forEach(function (p) {
      var on = p.getAttribute('data-gc-pane') === key;
      p.classList.toggle('gc-part-pane--active', on);
      if (on) { p.removeAttribute('hidden'); } else { p.setAttribute('hidden', ''); }
    });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showPane(t.getAttribute('data-gc-pane-btn')); });
  });

  /* ── 互斥真源 = 字典表每行的「自动结案候选 / 必须人工核查」两列（引擎读写同一处 DOM） ── */
  function dictCard() { return document.querySelector(DICT); }
  function dictRows() {
    var c = dictCard();
    return c ? [].slice.call(c.querySelectorAll('tr[data-gc-row]')) : [];
  }
  function cellOf(tr, k) { return tr.querySelector('td[data-col="' + k + '"]'); }
  function textOf(tr, k) { var td = cellOf(tr, k); return td ? td.textContent.replace(/\\s+/g, ' ').trim() : ''; }
  function isOn(tr, k) { return textOf(tr, k) === '开'; }
  function isEnabled(tr) { return textOf(tr, 'status').indexOf('启用') > -1; }
  function isConflict(tr) { return isEnabled(tr) && isOn(tr, 'cand') && isOn(tr, 'mc'); }

  // 行内冲突标记：只维护「互斥冲突」这一条，保留其它业务行注
  function markRow(tr, on) {
    var act = cellOf(tr, 'actions');
    if (!act) return;
    var note = null;
    [].slice.call(act.querySelectorAll('.gc-row-note')).forEach(function (s) {
      if (s.textContent.indexOf('互斥冲突') === 0) note = s;
    });
    if (on) {
      if (!note) {
        note = document.createElement('span');
        note.className = 'gc-row-note';
        act.appendChild(note);
      }
      var want = '互斥冲突：不能发布';
      if (note.textContent !== want) note.textContent = want;
      if (!tr.classList.contains('gc-row--conflict')) tr.classList.add('gc-row--conflict');
    } else {
      if (note && note.parentNode) note.parentNode.removeChild(note);
      if (tr.classList.contains('gc-row--conflict')) tr.classList.remove('gc-row--conflict');
    }
  }

  function syncFooter(blocked, names) {
    if (footerNote) {
      footerNote.textContent = blocked
        ? '不能进入发布前预览：先解除「' + names.join('」「') + '」的互斥（启用中的细类不能同时开启「允许自动结案候选」与「必须人工核查」）。'
        : READY_NOTE;
      footerNote.classList.toggle('gc-shell-footer-note--block', blocked);
    }
    if (previewBtn) {
      previewBtn.disabled = blocked;
      var tip = blocked ? '当前草稿存在互斥冲突，不能进入发布前预览' : '带着本草稿进入发布前预览';
      previewBtn.title = tip;
      if (reasonEl) reasonEl.textContent = tip;
    }
    document.body.setAttribute('data-gc-es-state', blocked ? 'blocked' : 'ready');
  }

  function scanConflicts() {
    var hits = [];
    dictRows().forEach(function (tr) {
      var bad = isConflict(tr);
      markRow(tr, bad);
      if (bad) hits.push(textOf(tr, 'name') || textOf(tr, 'code'));
    });
    blockedState = hits.length > 0;
    if (blockBanner) {
      if (hits.length) {
        if (blockMain) {
          var msg = '冲突：细类「' + hits.join('」「') + '」同时开启「允许自动结案候选」与「必须人工核查」。';
          if (blockMain.textContent !== msg) blockMain.textContent = msg;
        }
        blockBanner.removeAttribute('hidden');
      } else {
        blockBanner.setAttribute('hidden', '');
      }
    }
    syncFooter(blockedState, hits);
    return hits;
  }

  // 一键修复：关闭冲突细类的「允许自动结案候选」，保留「必须人工核查」
  var fixBtn = document.querySelector('[data-gc-es-fix]');
  if (fixBtn) fixBtn.addEventListener('click', function () {
    dictRows().forEach(function (tr) {
      if (!isConflict(tr)) return;
      var td = cellOf(tr, 'cand');
      if (td) td.textContent = '关';
    });
    scanConflicts();
    toast('已关闭冲突细类的「允许自动结案候选」，写入草稿，尚未生效。');
  });

  /* ── 页头「＋ 新增细类」：切到分类字典并打开新增抽屉（引擎负责抽屉） ── */
  var headNew = document.querySelector('[data-gc-es-new]');
  if (headNew) headNew.addEventListener('click', function () {
    showPane('dict');
    var b = document.querySelector(DICT + ' [data-gc-crud-new]');
    if (b) b.click();
  });

  /* ── 底部动作条：只写入草稿 / 进入发布前预览（发布不在模块页） ── */
  var saveDraft = document.querySelector('[data-gc-es-save-draft]');
  if (saveDraft) saveDraft.addEventListener('click', function () {
    toast('已写入草稿，尚未生效。发布需在「规则版本」页经「发布前预览」做冲突校验后确认。');
  });
  if (previewBtn) previewBtn.addEventListener('click', function () {
    if (previewBtn.disabled) return;
    location.href = 'publish-preview.html?scene=' + (blockedState ? 'conflict' : 'ok');
  });
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('gc-es-toast--show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('gc-es-toast--show'); }, 3200);
  }

  /* ── 复检：引擎对本表的所有写操作都由点击发起，点击后复检（引擎监听为冒泡阶段，晚于捕获） ── */
  document.addEventListener('click', function () { setTimeout(scanConflicts, 0); }, true);
  setTimeout(scanConflicts, 0);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(scanConflicts, 0); });
  }
})();
</script>
`;

{
  const range = cut(html, '<div class="gc-scrim" data-gc-scrim hidden></div>', '<script id="event-standard-edit-js">');
  // cut 返回到 <script id="event-standard-edit-js"> 结束，需再吃掉整个旧脚本
  const tail = html.indexOf('</script>', range.e);
  if (tail < 0) throw new Error('old edit-js closing tag not found');
  html = replaceRange(html, { s: range.s, e: tail + '</script>'.length }, FOOTER_JS.trimEnd());
}

// 3c · 旧「抽屉内互斥开关」样式 → 互斥冲突行样式
{
  const range = cut(
    html,
    '\n/* 抽屉内互斥开关 */',
    '.gc-inline-fix { margin-left: 4px; padding: 0; border: 0; background: none; color: var(--gc-func-red); font: inherit; font-size: 12px; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }',
  );
  const next = '\n/* 互斥冲突行标记（冲突细类：可保存草稿，不能被发布） */\n'
    + '.gc-row--conflict .gc-td-code { color: var(--gc-func-red); font-weight: 600; }\n'
    + '.gc-row--conflict .gc-row-note { color: var(--gc-func-red); }';
  html = replaceRange(html, range, next);
}

/* ────────────────────────── 4 · 校验与落盘 ────────────────────────── */

const mustZero = [
  ['data-gc-bind', /data-gc-bind/],
  ['data-gc-drawer', /data-gc-drawer=/],
  ['data-gc-scrim', /data-gc-scrim/],
  ['data-gc-mc', /data-gc-mc=/],
  ['gc-check-row', /gc-check-row/],
  ['gc-mc-field', /gc-mc-field/],
  ['gc-inline-fix', /gc-inline-fix/],
  ['gc-field-label', /gc-field-label/],
  ['gc-drawer-conflict', /gc-drawer-conflict/],
  ['event-standard-edit-js', /event-standard-edit-js/],
  ['event-standard-edit-css', /event-standard-edit-css/],
  ['old data-gc-toggle', /data-gc-toggle/],
  ['old data-gc-del', /data-gc-del(?![\w-])/],
  ['width: 440px', /width: 440px/],
];
mustZero.forEach(function (pair) {
  const m = html.match(new RegExp(pair[1].source, 'g'));
  if (m) throw new Error('leftover found: ' + pair[0] + ' × ' + m.length);
});

const mustHave = [
  ['gc-footer-js', /<script id="gc-footer-js">/],
  ['dict card', /data-gc-crud="dict"/],
  ['nl card', /data-gc-crud="nl"/],
  ['tc card', /data-gc-crud="tc"/],
  ['zf card', /data-gc-crud="zf"/],
  ['header new btn', /data-gc-es-new/],
  ['preview btn', /id="gc-es-go-preview"/],
];
mustHave.forEach(function (pair) {
  if (!pair[1].test(html)) throw new Error('missing: ' + pair[0]);
});

const counts = {
  crudCards: (html.match(/data-gc-crud="/g) || []).length,
  crudTables: (html.match(/data-gc-crud-table/g) || []).length,
  crudRows: (html.match(/data-gc-row/g) || []).length,
  crudNew: (html.match(/data-gc-crud-new/g) || []).length,
};

fs.writeFileSync(FILE, html);
console.log('rev22 ok: ' + before + ' → ' + html.length + ' chars (' + (before - html.length) + ' removed)');
console.log('counts: ' + JSON.stringify(counts));
