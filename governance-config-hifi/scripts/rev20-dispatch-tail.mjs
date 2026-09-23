import fs from 'node:fs';

const file = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages/dispatch-claim-draft.html';
let s = fs.readFileSync(file, 'utf8');

/* 1) 删除旧抽屉样式 + 静态 scrim/drawer + dispatch-edit-js + gc-switch-js */
const A = '<style id="dispatch-drawer-css">';
const B = '<style id="gc-footer-css">';
const i = s.indexOf(A);
const j = s.indexOf(B);
if (i < 0 || j < 0 || j < i) throw new Error('tail block anchors not found');
const removedLen = j - i;
s = s.slice(0, i) + s.slice(j);

/* 2) 重写 gc-footer-js：阻断条件改为「领取批次列表里没有任何启用行」 */
const C = '<script id="gc-footer-js">';
const c0 = s.indexOf(C);
if (c0 < 0) throw new Error('gc-footer-js not found');
const c1 = s.indexOf('</script>', c0) + '</script>'.length;
if (c1 < '</script>'.length) throw new Error('gc-footer-js close tag not found');

const NEW = [
'<script id="gc-footer-js">',
'(function () {',
'  var footerNote = document.querySelector(\'[data-gc-dc-footer-note]\');',
'  var previewBtn = document.getElementById(\'gc-dc-go-preview\');',
'  var reasonEl = document.getElementById(\'gc-dc-footer-reason\');',
'  var toastEl = document.querySelector(\'[data-gc-draft-toast]\');',
'  var card = document.getElementById(\'gc-batch-card\');',
'  var READY_NOTE = \'本页只写入草稿；「确认发布」在「规则版本」页，须经「发布前预览」做冲突校验后确认。\';',
'  var BLOCK_NOTE = \'不能进入发布前预览：领取批次列表里没有任何启用行，办理页没有领取入口，事件会堆在「待立案 / 待核查」无法派发。\';',
'',
'  function rows() {',
'    return card ? Array.prototype.slice.call(card.querySelectorAll(\'tbody tr[data-gc-row]\')) : [];',
'  }',
'  function isOn(tr) {',
'    var td = tr.querySelector(\'td[data-col="status"]\');',
'    return !!td && td.textContent.indexOf(\'启用\') > -1;',
'  }',
'',
'  /* 阻断条件：领取批次全部停用（或一行不剩）→ 办理页无入口，闭环断在「待立案 / 待核查」 */',
'  function scanConflicts() {',
'    var all = rows();',
'    var on = all.filter(isOn).length;',
'    var blocked = on === 0;',
'    if (footerNote) {',
'      footerNote.textContent = blocked ? BLOCK_NOTE : READY_NOTE;',
'      footerNote.classList.toggle(\'gc-shell-footer-note--block\', blocked);',
'    }',
'    if (previewBtn) {',
'      previewBtn.disabled = blocked;',
'      var tip = blocked ? \'领取批次全部停用，派发闭环没有入口，不能进入发布前预览\' : \'带着本草稿进入发布前预览\';',
'      previewBtn.title = tip;',
'      if (reasonEl) reasonEl.textContent = tip;',
'    }',
'    document.body.setAttribute(\'data-gc-draft-state\', blocked ? \'blocked\' : \'ready\');',
'    return on;',
'  }',
'',
'  /* ── 底部动作条：只写入草稿 / 进入发布前预览（发布不在模块页） ── */',
'  var saveDraft = document.querySelector(\'[data-gc-dc-save-draft]\');',
'  if (saveDraft) saveDraft.addEventListener(\'click\', function () {',
'    toast(\'已写入草稿，尚未生效。发布需在「规则版本」页经「发布前预览」做冲突校验后确认。\');',
'  });',
'  if (previewBtn) previewBtn.addEventListener(\'click\', function () {',
'    if (previewBtn.disabled) return;',
'    location.href = \'publish-preview.html?scene=ok\';',
'  });',
'  function toast(msg) {',
'    if (!toastEl) return;',
'    toastEl.textContent = msg;',
'    toastEl.classList.add(\'gc-draft-toast--show\');',
'    clearTimeout(toast._t);',
'    toast._t = setTimeout(function () { toastEl.classList.remove(\'gc-draft-toast--show\'); }, 3200);',
'  }',
'',
'  /* ── 列表变化后复检：新增 / 删除 / 启停都会改动 tbody（引擎在更晚的脚本里 boot） ── */',
'  document.addEventListener(\'click\', function () { scanConflicts(); });',
'  if (card && window.MutationObserver) {',
'    new MutationObserver(function () { scanConflicts(); }).observe(card, {',
'      subtree: true, childList: true, attributes: true, attributeFilter: [\'hidden\', \'class\']',
'    });',
'  }',
'  scanConflicts();',
'})();',
'</script>'
].join('\n');

s = s.slice(0, c0) + NEW + s.slice(c1);
fs.writeFileSync(file, s, 'utf8');
console.log('rev20 ok: removed ' + removedLen + ' chars, footer rewritten at ' + c0);
