// rev23 · org-permission-draft.html
// 1) 组织架构 / 账号 / 角色 三个 panel 改造为通用后台管理 CRUD 卡
// 2) 删除账号静态抽屉；保留角色权限抽屉并改为权限摘要纯文本
// 3) 重写 org-tabs-js：删旧查询/账号段，保留子页签、角色抽屉、权限摘要初始化
// 4) 更新 gc-footer-js 的 emptyRoles 选择器
// 5) 清理 page-css / gc-rev17-css 中与引擎冲突的样式
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('pages/org-permission-draft.html');
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

const SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

function actionsHTML() {
  return '<button type="button" class="gc-btn-link" data-gc-crud-edit>编辑</button>' +
    '<button type="button" class="gc-btn-link" data-gc-crud-toggle>停用</button>' +
    '<button type="button" class="gc-btn-link" data-gc-crud-del>删除</button>';
}
function statusHTML(on) {
  return '<td data-col="status"><span class="gc-chip gc-chip--' + (on ? 'green' : 'off') + '">' + (on ? '启用' : '停用') + '</span></td>';
}

/* ────────────────────────── 1 · 组织架构卡 ────────────────────────── */

const ORG_FIELDS = JSON.stringify([
  { k: 'name', label: '机构名称', kind: 'name', required: true, ph: '如 朝阳门街道' },
  { k: 'level', label: '层级', type: 'select', options: ['区级', '街道', '社区'], def: '街道' },
  { k: 'parent', label: '上级机构', ph: '如 东城区' },
  { k: 'source', label: '来源', type: 'select', options: ['平台同步', '自定义'], def: '平台同步' },
  { k: 'note', label: '备注', full: true, ph: '如 仅用于挂接网格' },
]);

const ORG_ROWS = [
  ['东城区', '区级', '—', '平台同步', '—'],
  ['朝阳门街道', '街道', '东城区', '平台同步', '—'],
  ['某社区', '社区', '朝阳门街道', '平台同步', '—'],
  ['东花市社区', '社区', '朝阳门街道', '平台同步', '—'],
  ['东华门街道', '街道', '东城区', '平台同步', '—'],
  ['金宝街社区', '社区', '东华门街道', '平台同步', '—'],
  ['建国门街道', '街道', '东城区', '平台同步', '—'],
  ['苏州社区', '社区', '建国门街道', '平台同步', '—'],
];

function orgRow(r) {
  const [name, level, parent, source, note] = r;
  return [
    '                  <tr data-gc-row>',
    '                    <td class="gc-td-name" data-col="name" data-primary>' + name + '</td>',
    '                    <td data-col="level">' + level + '</td>',
    '                    <td data-col="parent">' + parent + '</td>',
    '                    <td data-col="source">' + source + '</td>',
    '                    <td data-col="note">' + note + '</td>',
    '                    ' + statusHTML(true),
    '                    <td class="gc-td-actions" data-col="actions">' + actionsHTML() + '</td>',
    '                  </tr>',
  ].join('\n');
}

const orgCard = [
  '  <section class="gc-panel" data-gc-panel="org" aria-label="组织架构">',
  '    <section class="gc-card" aria-labelledby="gc-org-crud-title" data-gc-crud="org" data-gc-crud-name="机构"',
  '      data-gc-crud-fields=\'' + ORG_FIELDS + '\'',
  '      data-gc-crud-note="平台同步数据可在这里补充、修改或停用；行政区划层级决定账号与网格的归属范围。">',
  '      <header class="gc-card-head">',
  '        <h2 class="gc-card-title" id="gc-org-crud-title">组织架构</h2>',
  '        <span class="gc-card-note">草稿编辑中：可新增、编辑、停用机构</span>',
  '      </header>',
  '      <div class="gc-toolbar">',
  '        <div class="gc-search">',
  '          ' + SEARCH_SVG,
  '          <input type="text" id="gc-q-org" placeholder="搜索机构名称 / 层级 / 上级机构" aria-label="搜索机构" data-gc-crud-q>',
  '          <button type="button" class="gc-btn-ghost" data-gc-crud-search>查询</button>',
  '        </div>',
  '        <button type="button" class="gc-btn-primary" data-gc-crud-new>＋ 新增机构</button>',
  '      </div>',
  '      <div class="gc-table-scroll">',
  '        <table class="gc-table" data-gc-crud-table>',
  '          <thead>',
  '            <tr>',
  '              <th scope="col">机构名称</th>',
  '              <th scope="col">层级</th>',
  '              <th scope="col">上级机构</th>',
  '              <th scope="col">来源</th>',
  '              <th scope="col">备注</th>',
  '              <th scope="col">状态</th>',
  '              <th scope="col" class="gc-th-actions">操作</th>',
  '            </tr>',
  '          </thead>',
  '          <tbody>',
  ORG_ROWS.map(orgRow).join('\n'),
  '            <tr class="gc-empty-row" data-empty-row hidden><td colspan="7">未找到匹配机构，请调整关键词</td></tr>',
  '          </tbody>',
  '        </table>',
  '      </div>',
  '      <p class="gc-card-foot">同步行政区也可停用；停用后其下账号与网格不再接收新事件，已挂接数据保留。</p>',
  '    </section>',
  '  </section>',
].join('\n');

/* ────────────────────────── 2 · 账号卡 ────────────────────────── */

const ACCOUNT_FIELDS = JSON.stringify([
  { k: 'name', label: '姓名', kind: 'name', required: true },
  { k: 'account', label: '账号', kind: 'code', required: true, ph: 'name@seetime' },
  { k: 'role', label: '角色', type: 'select', options: ['全局协调', '领导', '立案审核', '网格责任人', '监督员'], def: '立案审核' },
  { k: 'org', label: '归属组织', type: 'select', options: ['东城区', '朝阳门街道', '东华门街道', '建国门街道', '某社区'], def: '东城区' },
  { k: 'scope', label: '负责范围', ph: '如 网格 G-0418 / 全区' },
  { k: 'login', label: '最近登录', kind: 'code', ph: '2026-09-05' },
]);

const ACCOUNT_ROWS = [
  ['王倩', 'wangqian@seetime', '全局协调', '东城区', '全区', '2026-09-05'],
  ['李明', 'liming@seetime', '领导', '东城区', '全区（只读）', '2026-09-04'],
  ['赵敏', 'zhaomin@seetime', '立案审核', '东城区', '全区', '2026-09-05'],
  ['刘洋', 'liuyang@seetime', '网格责任人', '朝阳门街道 · 某社区', '网格 G-0418', '2026-09-05'],
  ['陈督', 'chendu@seetime', '监督员', '朝阳门街道', '朝阳门街道辖区', '2026-09-01'],
];

function accountRow(r) {
  const [name, account, role, org, scope, login] = r;
  const isLiu = name === '刘洋';
  const actions = isLiu
    ? '<button type="button" class="gc-btn-link" data-gc-crud-edit>编辑</button>' +
      '<a class="gc-btn-link" href="org-disable-confirm.html" data-dom-id="org-open-disable-confirm">停用</a>' +
      '<button type="button" class="gc-btn-link" data-gc-crud-del>删除</button>' +
      '<span class="gc-td-warning">停用将释放网格 G-0418 主责，需先交接</span>'
    : actionsHTML();
  return [
    '                  <tr data-gc-row>',
    '                    <td class="gc-td-name" data-col="name" data-primary>' + name + '</td>',
    '                    <td class="gc-td-code" data-col="account">' + account + '</td>',
    '                    <td data-col="role">' + role + '</td>',
    '                    <td data-col="org">' + org + '</td>',
    '                    <td data-col="scope">' + scope + '</td>',
    '                    <td class="gc-td-code" data-col="login">' + login + '</td>',
    '                    ' + statusHTML(true),
    '                    <td class="gc-td-actions" data-col="actions">' + actions + '</td>',
    '                  </tr>',
  ].join('\n');
}

const accountCard = [
  '  <section class="gc-panel" data-gc-panel="accounts" hidden aria-label="账号">',
  '    <section class="gc-card" aria-labelledby="gc-account-crud-title" data-gc-crud="account" data-gc-crud-name="账号"',
  '      data-gc-crud-fields=\'' + ACCOUNT_FIELDS + '\'',
  '      data-gc-crud-note="草稿编辑中：可新增账号、调整角色与负责范围">',
  '      <header class="gc-card-head">',
  '        <h2 class="gc-card-title" id="gc-account-crud-title">账号</h2>',
  '        <span class="gc-card-note">草稿编辑中：可新增账号、调整角色与负责范围</span>',
  '      </header>',
  '      <div class="gc-toolbar">',
  '        <div class="gc-search">',
  '          ' + SEARCH_SVG,
  '          <input type="text" id="gc-q-accounts" placeholder="搜索姓名 / 账号 / 角色 / 归属组织 / 负责范围" aria-label="搜索账号" data-gc-crud-q>',
  '          <button type="button" class="gc-btn-ghost" data-gc-crud-search>查询</button>',
  '        </div>',
  '        <button type="button" class="gc-btn-primary" data-gc-crud-new>＋ 新建账号</button>',
  '      </div>',
  '      <div class="gc-table-scroll">',
  '        <table class="gc-table" data-gc-crud-table>',
  '          <thead>',
  '            <tr>',
  '              <th scope="col">姓名</th>',
  '              <th scope="col">账号</th>',
  '              <th scope="col">角色</th>',
  '              <th scope="col">归属组织</th>',
  '              <th scope="col">负责范围</th>',
  '              <th scope="col">最近登录</th>',
  '              <th scope="col">状态</th>',
  '              <th scope="col" class="gc-th-actions">操作</th>',
  '            </tr>',
  '          </thead>',
  '          <tbody>',
  ACCOUNT_ROWS.map(accountRow).join('\n'),
  '            <tr class="gc-empty-row" data-empty-row hidden><td colspan="8">未找到匹配账号，请调整关键词</td></tr>',
  '          </tbody>',
  '        </table>',
  '      </div>',
  '    </section>',
  '  </section>',
].join('\n');

/* ────────────────────────── 3 · 角色卡 ────────────────────────── */

const ROLE_FIELDS = JSON.stringify([
  { k: 'name', label: '角色名称', kind: 'name', required: true },
  { k: 'members', label: '成员数', type: 'number' },
  { k: 'summary', label: '权限摘要', full: true },
  { k: 'source', label: '来源', type: 'select', options: ['平台预置', '自定义'], def: '平台预置' },
]);

const ROLE_ROWS = [
  { name: '全局协调', members: '1', perms: '1,1,1,0,0,0,1', source: '平台预置' },
  { name: '领导', members: '1', perms: '1,0,0,0,0,0,1', source: '平台预置' },
  { name: '立案审核', members: '1', perms: '1,0,0,1,0,0,1', source: '平台预置' },
  { name: '网格责任人', members: '1', perms: '1,0,0,1,0,0,1', source: '平台预置' },
  { name: '监督员', members: '1', perms: '1,0,0,0,1,0,1', source: '平台预置' },
];

function roleSummary(perms) {
  const labels = ['配置查看', '配置编辑', '发布', '事件办理', '核查', '结案', '档案查看'];
  const hit = [];
  perms.split(',').forEach(function (v, i) { if (Number(v)) hit.push(labels[i]); });
  return hit.length ? hit.join('、') : '—';
}

function roleRow(r) {
  const summary = roleSummary(r.perms);
  return [
    '                  <tr data-gc-row data-perms="' + r.perms + '">',
    '                    <td class="gc-td-name" data-col="name" data-primary>' + r.name + '</td>',
    '                    <td class="gc-num-cell" data-col="members">' + r.members + '</td>',
    '                    <td data-col="summary">' + summary + '</td>',
    '                    <td data-col="source">' + r.source + '</td>',
    '                    ' + statusHTML(true),
    '                    <td class="gc-td-actions" data-col="actions">' +
      '<a class="gc-btn-link" href="org-role-drawer.html" data-dom-id="org-open-role-drawer">查看权限</a>' +
      '<button type="button" class="gc-btn-link" data-gc-role-edit>权限</button>' +
      actionsHTML() + '</td>',
    '                  </tr>',
  ].join('\n');
}

const roleCard = [
  '  <section class="gc-panel" data-gc-panel="roles" hidden aria-label="角色">',
  '    <section class="gc-card" aria-labelledby="gc-role-crud-title" data-gc-crud="role" data-gc-crud-name="角色"',
  '      data-gc-crud-fields=\'' + ROLE_FIELDS + '\'',
  '      data-gc-crud-note="平台预置模板可调整权限，自定义角色可追加">',
  '      <header class="gc-card-head">',
  '        <h2 class="gc-card-title" id="gc-role-crud-title">角色</h2>',
  '        <span class="gc-card-note">草稿编辑中：平台预置模板可调整权限，自定义角色可追加</span>',
  '      </header>',
  '      <div class="gc-toolbar">',
  '        <div class="gc-search">',
  '          ' + SEARCH_SVG,
  '          <input type="text" id="gc-q-roles" placeholder="搜索角色名称 / 权限摘要" aria-label="搜索角色" data-gc-crud-q>',
  '          <button type="button" class="gc-btn-ghost" data-gc-crud-search>查询</button>',
  '        </div>',
  '        <button type="button" class="gc-btn-primary" data-gc-crud-new>＋ 新建角色</button>',
  '      </div>',
  '      <div class="gc-table-scroll">',
  '        <table class="gc-table" data-gc-crud-table>',
  '          <thead>',
  '            <tr>',
  '              <th scope="col">角色</th>',
  '              <th scope="col">成员数</th>',
  '              <th scope="col">权限摘要</th>',
  '              <th scope="col">来源</th>',
  '              <th scope="col">状态</th>',
  '              <th scope="col" class="gc-th-actions">操作</th>',
  '            </tr>',
  '          </thead>',
  '          <tbody>',
  ROLE_ROWS.map(roleRow).join('\n'),
  '            <tr class="gc-empty-row" data-empty-row hidden><td colspan="6">未找到匹配角色，请调整关键词</td></tr>',
  '          </tbody>',
  '        </table>',
  '      </div>',
  '      <p class="gc-card-foot">一个事件同一时刻只对应一个网格责任人。</p>',
  '    </section>',
  '  </section>',
].join('\n');

const panelsBlock = [orgCard, accountCard, roleCard].join('\n\n');

{
  const range = cut(
    html,
    '<section class="gc-panel" data-gc-panel="org"',
    '  </section>\n</div>\n\n<div class="gc-scrim" data-gc-scrim hidden></div>',
  );
  html = replaceRange(html, range, panelsBlock + '\n');
}

/* ────────────────────────── 4 · 删除账号静态抽屉 ────────────────────────── */

{
  const range = cut(
    html,
    '<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-account-drawer-title" data-gc-drawer="account" hidden>',
    '</aside>\n\n<aside class="gc-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-role-drawer-title" data-gc-drawer="role" hidden>',
  );
  html = replaceRange(html, range, '');
}

/* ────────────────────────── 5 · 重写 org-tabs-js ────────────────────────── */

const ORG_TABS_JS = `<script id="org-tabs-js">
(function () {
  var PERM_LABELS = ['配置查看', '配置编辑', '发布', '事件办理', '核查', '结案', '档案查看'];

  // ── 子页签 ──
  var tabs = [].slice.call(document.querySelectorAll('.gc-subtab'));
  function activate(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-gc-tab') === name;
      t.classList.toggle('gc-subtab--active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    [].slice.call(document.querySelectorAll('[data-gc-panel]')).forEach(function (p) {
      p.hidden = p.getAttribute('data-gc-panel') !== name;
    });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activate(t.getAttribute('data-gc-tab')); });
  });

  // ── 抽屉开关（仅保留角色权限抽屉） ──
  var scrim = document.querySelector('[data-gc-scrim]');
  function openDrawer(name) {
    var d = document.querySelector('[data-gc-drawer="' + name + '"]');
    if (!d) return;
    d.hidden = false;
    if (scrim) scrim.hidden = false;
  }
  function closeDrawers() {
    [].slice.call(document.querySelectorAll('[data-gc-drawer]')).forEach(function (d) { d.hidden = true; });
    if (scrim) scrim.hidden = true;
  }
  if (scrim) scrim.addEventListener('click', closeDrawers);
  [].slice.call(document.querySelectorAll('[data-gc-close]')).forEach(function (b) {
    b.addEventListener('click', closeDrawers);
  });

  // ── 权限摘要（纯文本） ──
  function permSummary(perms) {
    var labels = [];
    perms.forEach(function (v, i) { if (v) labels.push(PERM_LABELS[i]); });
    return labels.length ? labels.join('、') : '—';
  }
  [].slice.call(document.querySelectorAll('[data-gc-crud="role"] tr[data-gc-row]')).forEach(function (r) {
    var raw = r.getAttribute('data-perms') || '';
    if (!raw) return;
    var perms = raw.split(',').map(Number);
    var cell = r.querySelector('td[data-col="summary"]');
    if (cell) cell.textContent = permSummary(perms);
  });

  // ── 角色抽屉 ──
  var editingRoleRow = null;
  function openRole(row) {
    editingRoleRow = row || null;
    var titleEl = document.getElementById('gc-role-drawer-title');
    if (titleEl) titleEl.textContent = row ? '编辑角色' : '新建角色';
    var nameCell = row ? row.querySelector('td[data-col="name"]') : null;
    document.getElementById('gc-r-name').value = nameCell ? (nameCell.textContent || '').replace(/\\s+/g, ' ').trim() : '';
    var raw = row ? (row.getAttribute('data-perms') || '') : '1,0,0,0,0,0,1';
    var perms = raw.split(',').map(Number);
    [].slice.call(document.querySelectorAll('[data-gc-perm]')).forEach(function (cb) {
      cb.checked = !!perms[Number(cb.getAttribute('data-gc-perm'))];
    });
    openDrawer('role');
  }

  document.querySelector('[data-gc-role-save]').addEventListener('click', function () {
    var name = document.getElementById('gc-r-name').value.trim();
    if (!name) { document.getElementById('gc-r-name').focus(); return; }
    var perms = [0, 0, 0, 0, 0, 0, 0];
    [].slice.call(document.querySelectorAll('[data-gc-perm]')).forEach(function (cb) {
      if (cb.checked) perms[Number(cb.getAttribute('data-gc-perm'))] = 1;
    });
    var summary = permSummary(perms);
    if (editingRoleRow) {
      var r = editingRoleRow;
      r.setAttribute('data-perms', perms.join(','));
      var nameCell = r.querySelector('td[data-col="name"]');
      if (nameCell) nameCell.textContent = name;
      var summaryCell = r.querySelector('td[data-col="summary"]');
      if (summaryCell) summaryCell.textContent = summary;
    } else {
      var tr = document.createElement('tr');
      tr.setAttribute('data-gc-row', '');
      tr.setAttribute('data-perms', perms.join(','));
      tr.innerHTML =
        '<td class="gc-td-name" data-col="name" data-primary>' + name + '</td>' +
        '<td class="gc-num-cell" data-col="members">0</td>' +
        '<td data-col="summary">' + summary + '</td>' +
        '<td data-col="source">自定义</td>' +
        '<td data-col="status"><span class="gc-chip gc-chip--green">启用</span></td>' +
        '<td class="gc-td-actions" data-col="actions">' +
          '<a class="gc-btn-link" href="org-role-drawer.html" data-dom-id="org-open-role-drawer">查看权限</a>' +
          '<button type="button" class="gc-btn-link" data-gc-role-edit>权限</button>' +
          '<button type="button" class="gc-btn-link" data-gc-crud-edit>编辑</button>' +
          '<button type="button" class="gc-btn-link" data-gc-crud-toggle>停用</button>' +
          '<button type="button" class="gc-btn-link" data-gc-crud-del>删除</button>' +
        '</td>';
      var table = document.querySelector('[data-gc-crud="role"] [data-gc-crud-table]');
      var tbody = table ? table.querySelector('tbody') : null;
      var empty = tbody ? tbody.querySelector('[data-empty-row]') : null;
      if (tbody) tbody.insertBefore(tr, empty || null);
    }
    closeDrawers();
  });

  // ── 行内按钮（事件委托，覆盖新建行） ──
  document.addEventListener('click', function (e) {
    var rb = e.target.closest ? e.target.closest('[data-gc-role-edit]') : null;
    if (rb) { openRole(rb.closest('tr')); }
  });
})();
</script>
`;

{
  const range = cut(html, '<script id="org-tabs-js">', '</script>');
  html = replaceRange(html, range, ORG_TABS_JS.trimEnd());
}

/* ────────────────────────── 6 · 更新 gc-footer-js 的 emptyRoles ────────────────────────── */

{
  const range = cut(html, '<script id="gc-footer-js">', '</script>');
  const next = `<script id="gc-footer-js">
(function () {
  var footerNote = document.querySelector('[data-gc-op-footer-note]');
  var previewBtn = document.getElementById('gc-op-go-preview');
  var reasonEl = document.getElementById('gc-op-footer-reason');
  var toastEl = document.querySelector('[data-gc-draft-toast]');
  var READY_NOTE = '本页只写入草稿；「确认发布」在「规则版本」页，须经「发布前预览」做冲突校验后确认。';

  // 角色权限全为空 → 该角色名下的账号登录后什么也做不了，立案 / 核查终局决定无人可执行
  function emptyRoles() {
    var out = [];
    [].slice.call(document.querySelectorAll('[data-gc-crud="role"] tr[data-gc-row]')).forEach(function (tr) {
      var raw = tr.getAttribute('data-perms') || '';
      if (!raw) return;
      var perms = raw.split(',').map(Number);
      var granted = perms.filter(function (n) { return n === 1; }).length;
      if (granted === 0) {
        var nameCell = tr.querySelector('td[data-col="name"]');
        out.push(nameCell ? (nameCell.textContent || '').replace(/\\s+/g, ' ').trim() : '未命名角色');
      }
    });
    return out;
  }

  function scanConflicts() {
    var voids = emptyRoles();
    var blocked = voids.length > 0;
    if (footerNote) {
      footerNote.textContent = blocked
        ? '不能进入发布前预览：角色「' + voids.join('、') + '」没有任何权限，名下账号登录后无法办理事件，立案 / 核查终局决定无人可执行。'
        : READY_NOTE;
      footerNote.classList.toggle('gc-shell-footer-note--block', blocked);
    }
    if (previewBtn) {
      previewBtn.disabled = blocked;
      var tip = blocked ? '角色「' + voids.join('、') + '」权限为空，不能进入发布前预览' : '带着本草稿进入发布前预览';
      previewBtn.title = tip;
      if (reasonEl) reasonEl.textContent = tip;
    }
    document.body.setAttribute('data-gc-draft-state', blocked ? 'blocked' : 'ready');
    return voids;
  }

  // ── 底部动作条：只写入草稿 / 进入发布前预览（发布不在模块页） ──
  var saveDraft = document.querySelector('[data-gc-op-save-draft]');
  if (saveDraft) saveDraft.addEventListener('click', function () {
    toast('已写入草稿，尚未生效。发布需在「规则版本」页经「发布前预览」做冲突校验后确认。');
  });
  if (previewBtn) previewBtn.addEventListener('click', function () {
    if (previewBtn.disabled) return;
    location.href = 'publish-preview.html?scene=ok';
  });
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('gc-draft-toast--show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('gc-draft-toast--show'); }, 3200);
  }

  // ── 角色保存后复检（本脚本的委托监听晚于 org-tabs-js 的行内监听） ──
  document.addEventListener('click', function () { scanConflicts(); });
  scanConflicts();
})();
</script>
`;
  html = replaceRange(html, range, next.trimEnd());
}

/* ────────────────────────── 7 · CSS 清理 ────────────────────────── */

// 7a · page-css：删 .gc-card-foot 冲突、.gc-toolbar 冲突、抽屉 440px、改 actions 对齐
html = html.replace(
  '.gc-card-foot { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--gc-muted); }\n',
  ''
);
html = html.replace(
  '.gc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }\n',
  ''
);
html = html.replace('.gc-th-actions { text-align: right; }', '.gc-th-actions { text-align: left; }');
html = html.replace(
  '.gc-td-actions { text-align: right; white-space: nowrap; }',
  '.gc-td-actions { text-align: left; white-space: nowrap; }'
);
html = html.replace(
  '.gc-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 90vw; background: var(--gc-panel); border-left: 1px solid var(--gc-line); z-index: 60; display: flex; flex-direction: column; }\n',
  ''
);

// 7b · gc-rev17-css：删除 .gc-toolbar { margin-bottom: 14px; }
html = html.replace(
  '<style id="gc-rev17-css">\n.gc-toolbar { margin-bottom: 14px; }\n\n',
  '<style id="gc-rev17-css">\n'
);

/* ────────────────────────── 8 · 校验与落盘 ────────────────────────── */

const mustZero = [
  ['data-gc-search', /data-gc-search/],
  ['data-gc-account-', /data-gc-account-/],
  ['data-role-name', /data-role-name/],
  ['data-custom', /\bdata-custom\b/],
  ['data-gc-drawer="account"', /data-gc-drawer="account"/],
  ['gc-perm-summary', /gc-perm-summary/],
  ['width: 440px', /width: 440px/],
  ['gc-toolbar margin-bottom', /\.gc-toolbar\s*\{[^}]*margin-bottom/],
];
mustZero.forEach(function (pair) {
  const m = html.match(new RegExp(pair[1].source, 'g'));
  if (m) throw new Error('leftover found: ' + pair[0] + ' × ' + m.length);
});

const mustHave = [
  ['data-gc-crud="org"', /data-gc-crud="org"/],
  ['data-gc-crud="account"', /data-gc-crud="account"/],
  ['data-gc-crud="role"', /data-gc-crud="role"/],
  ['org crud table', /data-gc-panel="org"[\s\S]{0,2000}data-gc-crud-table/],
  ['account crud table', /data-gc-panel="accounts"[\s\S]{0,2000}data-gc-crud-table/],
  ['role crud table', /data-gc-panel="roles"[\s\S]{0,2000}data-gc-crud-table/],
  ['gc-crud-js', /<script id="gc-crud-js">/],
  ['data-col="status"', /data-col="status"/],
  ['data-col="actions"', /data-col="actions"/],
  ['org-role-drawer.html', /org-role-drawer\.html/],
  ['org-disable-confirm.html', /org-disable-confirm\.html/],
  ['cta-go-preview', /data-dom-id="cta-go-preview"/],
  ['cta-save-draft', /data-dom-id="cta-save-draft"/],
  ['gc-op-save-draft', /data-gc-op-save-draft/],
  ['gc-footer-js', /<script id="gc-footer-js">/],
  ['org-tabs-js', /<script id="org-tabs-js">/],
  ['gc-r-name', /id="gc-r-name"/],
  ['data-gc-perm="0"', /data-gc-perm="0"/],
  ['rev13 name check line', /if \(!name\) \{ document\.getElementById\('gc-r-name'\)\.focus\(\); return; \}/],
];
mustHave.forEach(function (pair) {
  if (!pair[1].test(html)) throw new Error('missing: ' + pair[0]);
});

const counts = {
  crudCards: (html.match(/data-gc-crud="(org|account|role)" data-gc-crud-name=/g) || []).length,
  crudTables: (html.match(/<table class="gc-table" data-gc-crud-table>/g) || []).length,
  crudRows: (html.match(/<tr data-gc-row/g) || []).length,
  crudNew: (html.match(/data-gc-crud-new/g) || []).length,
};
if (counts.crudCards !== 3) throw new Error('crudCards expected 3, got ' + counts.crudCards);
if (counts.crudTables !== 3) throw new Error('crudTables expected 3, got ' + counts.crudTables);

fs.writeFileSync(FILE, html);
console.log('rev23 ok: ' + before + ' → ' + html.length + ' chars (' + (before - html.length) + ' removed)');
console.log('counts: ' + JSON.stringify(counts));
