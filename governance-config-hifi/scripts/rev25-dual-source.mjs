// rev25 · org-permission-live.html + space-responsibility-live.html
// 双来源口径修订（2026-10-12，与线上实现对齐）：组织与网格支持「外部平台同步 + 人员手动创建」。
// 1) 组织卡：卡头改双来源说明 + 「＋ 新建组织」按钮；树中新增手动创建示例（前门街道 + 西打磨厂社区，
//    带「手动」chip 与行内「编辑 / 停用」）；卡脚口径更新。
// 2) 网格责任表：卡头补双来源说明；表头与四行补「来源」列；新增手动创建示例行 G-0422（前门街道 · 待定责）；
//    卡脚补手动网格口径。
// 约束：不改抽屉 / 搜索 / 页签 JS 逻辑；同步节点保持只读展示。
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

/* ══════════════ A · org-permission-live.html ══════════════ */

let A = load('pages/org-permission-live.html');
let org = A.html;
const ORG_BEFORE = org.length;

// A1. CSS：手动 chip + 节点行内操作 + 小号主按钮
org = replaceOnce(
  org,
  '/* 轻提示 */',
  [
    '/* 轻提示 */',
    '/* rev25 双来源：手动创建标识与节点操作 */',
    '.gc-chip--manual { background: var(--gc-accent-soft); color: var(--gc-accent); font-size: 11px; font-weight: 500; border-radius: 9999px; padding: 1px 8px; white-space: nowrap; }',
    '.gc-org-act { display: inline-flex; gap: 6px; margin-left: 8px; }',
    '.gc-btn-link--sm { padding: 2px 8px; font-size: 11px; }',
    '.gc-btn-primary--sm { height: 28px; padding: 0 12px; font-size: 12px; border-radius: 8px; }',
    '.gc-card-head-right { display: flex; align-items: center; gap: 12px; }',
  ].join('\n'),
  'org-css',
);

// A2. 卡头：标题 + 双来源说明 + 新建组织按钮
org = replaceOnce(
  org,
  [
    '      <h2 class="gc-card-title" id="gc-orgtree-title">组织架构（来自平台同步）</h2>',
    '        <span class="gc-card-note">同步数据 · 只读</span>',
  ].join('\n'),
  [
    '      <h2 class="gc-card-title" id="gc-orgtree-title">组织架构</h2>',
    '        <div class="gc-card-head-right">',
    '          <span class="gc-card-note">双来源：平台同步（只读）＋ 手动创建（可编辑、可停用）</span>',
    '          <button type="button" class="gc-btn-primary gc-btn-primary--sm">＋ 新建组织</button>',
    '        </div>',
  ].join('\n'),
  'org-card-head',
);

// A3. 树：建国门分支后插入手动创建示例（前门街道 + 西打磨厂社区）
org = replaceOnce(
  org,
  [
    '          <div class="gc-org-branch">',
    '            <div class="gc-org-node"><span class="gc-org-name">建国门街道</span><span class="gc-chip gc-chip--sync">同步</span></div>',
    '            <div class="gc-org-children">',
    '              <div class="gc-org-node gc-org-node--leaf"><span class="gc-org-name">苏州社区</span><span class="gc-chip gc-chip--sync">同步</span></div>',
    '            </div>',
    '          </div>',
  ].join('\n'),
  [
    '          <div class="gc-org-branch">',
    '            <div class="gc-org-node"><span class="gc-org-name">建国门街道</span><span class="gc-chip gc-chip--sync">同步</span></div>',
    '            <div class="gc-org-children">',
    '              <div class="gc-org-node gc-org-node--leaf"><span class="gc-org-name">苏州社区</span><span class="gc-chip gc-chip--sync">同步</span></div>',
    '            </div>',
    '          </div>',
    '          <div class="gc-org-branch">',
    '            <div class="gc-org-node"><span class="gc-org-name">前门街道</span><span class="gc-chip gc-chip--manual">手动</span><span class="gc-org-act"><button type="button" class="gc-btn-link gc-btn-link--sm" title="编辑手动创建的街道">编辑</button><button type="button" class="gc-btn-link gc-btn-link--sm" title="停用后不能再被勾选为账号负责范围">停用</button></span></div>',
    '            <div class="gc-org-children">',
    '              <div class="gc-org-node gc-org-node--leaf"><span class="gc-org-name">西打磨厂社区</span><span class="gc-chip gc-chip--manual">手动</span><span class="gc-org-act"><button type="button" class="gc-btn-link gc-btn-link--sm" title="编辑手动创建的社区">编辑</button><button type="button" class="gc-btn-link gc-btn-link--sm" title="停用该社区（仅展示，不参与范围）">停用</button></span></div>',
    '            </div>',
    '          </div>',
  ].join('\n'),
  'org-tree-manual-branch',
);

// A4. 卡脚：双来源口径
org = replaceOnce(
  org,
  '      <p class="gc-card-foot">同步行政区不可新建、不可编辑、不可画围栏；此处仅用于挂接账号与网格。</p>',
  '      <p class="gc-card-foot">平台同步节点：名称、层级、上级只读（街道可停用）。手动创建节点：由本系统维护，可编辑、可停用，街道与同步街道同权——可勾选为账号负责范围、可挂网格主责与协同监督；社区仅展示，不能作为范围或挂责任人。</p>',
  'org-card-foot',
);

save(A.FILE, org);
console.log('rev25 org ok: ' + ORG_BEFORE + ' → ' + org.length + ' chars (+' + (org.length - ORG_BEFORE) + ')');

/* ══════════════ B · space-responsibility-live.html ══════════════ */

let B = load('pages/space-responsibility-live.html');
let sp = B.html;
const SP_BEFORE = sp.length;

// B1. CSS：手动 chip
sp = replaceOnce(
  sp,
  '.gc-chip--muted { background: var(--gc-bg-active); color: var(--gc-muted); font-size: 11px; font-weight: 500; border-radius: 9999px; padding: 1px 8px; white-space: nowrap; }',
  [
    '.gc-chip--muted { background: var(--gc-bg-active); color: var(--gc-muted); font-size: 11px; font-weight: 500; border-radius: 9999px; padding: 1px 8px; white-space: nowrap; }',
    '.gc-chip--manual { background: var(--gc-accent-soft); color: var(--gc-accent); font-size: 11px; font-weight: 500; border-radius: 9999px; padding: 1px 8px; white-space: nowrap; }',
  ].join('\n'),
  'sp-css',
);

// B2. 卡头：双来源说明
sp = replaceOnce(
  sp,
  '      <h2 class="gc-card-title" id="gc-grid-title">网格责任表</h2>',
  [
    '      <h2 class="gc-card-title" id="gc-grid-title">网格责任表</h2>',
    '      <span class="gc-card-note">双来源：平台同步（只读）＋ 手动创建（可编辑街道 / 社区）；均可启停与定责</span>',
  ].join('\n'),
  'sp-card-head',
);

// B3. 表头：生效日期后加「来源」
sp = replaceOnce(
  sp,
  '<th>状态</th><th>生效日期</th><th class="gc-th-actions">操作</th>',
  '<th>状态</th><th>生效日期</th><th>来源</th><th class="gc-th-actions">操作</th>',
  'sp-thead',
);

// B4. 四行补来源单元格（插在各自操作列前）
sp = replaceOnce(
  sp,
  '</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0418"',
  '</td><td>平台同步</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0418"',
  'sp-row-0418',
);
sp = replaceOnce(
  sp,
  '</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0417"',
  '</td><td>平台同步</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0417"',
  'sp-row-0417',
);
sp = replaceOnce(
  sp,
  '</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0419"',
  '</td><td>平台同步</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0419"',
  'sp-row-0419',
);
sp = replaceOnce(
  sp,
  '</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0421"',
  '</td><td>平台同步</td>\n            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0421"',
  'sp-row-0421',
);

// B5. G-0421 行后插入手动创建示例行 G-0422（前门街道 · 待定责）
sp = replaceOnce(
  sp,
  '<td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0421" title="进入草稿，编辑网格 G-0421">编辑</a></td>\n          </tr>',
  [
    '<td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0421" title="进入草稿，编辑网格 G-0421">编辑</a></td>',
    '          </tr>',
    '          <tr>',
    '            <td class="gc-td-code">G-0422</td><td>前门街道</td><td class="gc-td-dash">—</td><td class="gc-td-dash">—（空）</td><td class="gc-td-dash">—</td>',
    '            <td><span class="gc-chip gc-chip--muted">待定责</span></td><td class="gc-td-dash">—</td>',
    '            <td><span class="gc-chip gc-chip--manual">手动</span></td>',
    '            <td class="gc-td-actions"><a class="gc-btn-link" href="space-responsibility-draft.html?edit=G-0422" title="进入草稿，编辑网格 G-0422">编辑</a></td>',
    '          </tr>',
  ].join('\n'),
  'sp-row-0422',
);

// B6. 卡脚：手动网格口径（追加在「一个事件同一时刻…」之前）
sp = replaceOnce(
  sp,
  '    <p class="gc-card-foot">一个事件同一时刻只对应一个网格责任人。</p>',
  [
    '    <p class="gc-card-foot">手动创建网格：编码创建后不可改，创建后为「待定责」，指定主责后派发才可用；不提供删除，停用后新事件不再匹配。平台同步网格仍以外部平台为权威源。</p>',
    '    <p class="gc-card-foot">一个事件同一时刻只对应一个网格责任人。</p>',
  ].join('\n'),
  'sp-card-foot',
);

save(B.FILE, sp);
console.log('rev25 space ok: ' + SP_BEFORE + ' → ' + sp.length + ' chars (+' + (sp.length - SP_BEFORE) + ')');

/* ══════════════ 断言 ══════════════ */

const checks = {
  // chip 计数含 CSS 类定义各 1 处：org 期望 1(css)+2(节点)=3；space 期望 1(css)+1(G-0422)=2
  orgManualChips: (org.match(/gc-chip--manual/g) || []).length,
  orgNewBtn: org.includes('＋ 新建组织'),
  orgFootDual: org.includes('街道与同步街道同权'),
  spManualChips: (sp.match(/gc-chip--manual/g) || []).length,
  spTheadSource: sp.includes('<th>来源</th>'),
  spSyncCells: (sp.match(/<td>平台同步<\/td>/g) || []).length,
  spNewRow: sp.includes('G-0422'),
  spFootManual: sp.includes('手动创建网格：编码创建后不可改'),
};
console.log('checks:', JSON.stringify(checks));
if (checks.orgManualChips !== 3) throw new Error('org manual chips expected 3 (css + 2 nodes)');
if (!checks.orgNewBtn || !checks.orgFootDual) throw new Error('org card incomplete');
if (checks.spManualChips !== 2) throw new Error('space manual chips expected 2 (css + G-0422)');
if (!checks.spTheadSource) throw new Error('space thead missing 来源');
if (checks.spSyncCells !== 4) throw new Error('space sync cells expected 4');
if (!checks.spNewRow || !checks.spFootManual) throw new Error('space card incomplete');
console.log('rev25 all ok');
