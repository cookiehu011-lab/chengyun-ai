// rev21: dedup-recurrence-draft.html 尾部与 CRUD 改造同步
// 1) 删除旧抽屉 CSS / 静态 scrim+drawer / dedup-edit-js / gc-switch-js
// 2) 删除 page-css 里已失效的 .gc-kv* / .gc-switch* 规则
// 3) 重写 gc-footer-js：阻断条件 = 判重条件列表里至少一条「空间条件 + 启用」
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('pages/dedup-recurrence-draft.html');
let html = fs.readFileSync(file, 'utf8');
const before = html.length;

// ── 1. 删除尾部旧块：dedup-drawer-css … gc-switch-js ──
const startA = html.indexOf('<style id="dedup-drawer-css">');
const swStart = html.indexOf('<script id="gc-switch-js">');
if (startA === -1 || swStart === -1 || swStart < startA) throw new Error('rev21: tail markers not found');
const swEnd = html.indexOf('</script>', swStart) + '</script>'.length;
if (swEnd <= swStart) throw new Error('rev21: gc-switch-js end not found');
html = html.slice(0, startA).replace(/\s+$/, '') + '\n\n' + html.slice(swEnd).replace(/^\s+/, '');

// ── 2. 删除失效的 page-css 规则 ──
const deadCss = [
  '.gc-kv { margin: 0; display: flex; flex-direction: column; gap: 8px; }\n',
  '.gc-kv-row { display: flex; gap: 8px; font-size: 13px; }\n',
  '.gc-kv-row dt { color: var(--gc-muted); flex: 0 0 150px; }\n',
  '.gc-kv-row dd { margin: 0; color: var(--gc-text); min-width: 0; }\n',
  '.gc-kv-sub { display: block; font-size: 11px; color: var(--gc-muted); margin-top: 2px; }\n',
  '.gc-switch { width: 34px; height: 19px; border-radius: 9999px; background: var(--gc-line-strong); position: relative; flex-shrink: 0; display: inline-block; vertical-align: middle; margin-right: 6px; }\n',
  '.gc-switch[aria-checked="true"] { background: var(--gc-accent); }\n',
  '.gc-switch-knob { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 9999px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); }\n',
  '.gc-switch[aria-checked="true"] .gc-switch-knob { left: auto; right: 2px; }\n',
];
let removedCss = 0;
for (const line of deadCss) {
  if (html.includes(line)) { html = html.replace(line, ''); removedCss += line.length; }
}

// ── 3. 重写 gc-footer-js ──
const jsStart = html.indexOf('<script id="gc-footer-js">');
if (jsStart === -1) throw new Error('rev21: gc-footer-js not found');
const jsEnd = html.indexOf('</script>', jsStart) + '</script>'.length;

const newFooterJs = `<script id="gc-footer-js">
(function () {
  var footerNote = document.querySelector('[data-gc-dr-footer-note]');
  var previewBtn = document.getElementById('gc-dr-go-preview');
  var reasonEl = document.getElementById('gc-dr-footer-reason');
  var toastEl = document.querySelector('[data-gc-draft-toast]');
  var dupCard = document.getElementById('gc-duprule-card');
  var READY_NOTE = '本页只写入草稿；「确认发布」在「规则版本」页，须经「发布前预览」做冲突校验后确认。';

  // 阻断条件取自本页规则原文：判重必须有空间条件。
  // 判定 = 「判重条件」列表里至少存在一条「条件类型 = 空间条件」且状态为「启用」的行。
  function spaceRuleCount() {
    if (!dupCard) return 0;
    var rows = dupCard.querySelectorAll('tbody tr[data-gc-row]');
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      var kind = rows[i].querySelector('[data-col="kind"]');
      var st = rows[i].querySelector('[data-col="status"]');
      if (!kind || !st) continue;
      if (kind.textContent.replace(/\\s+/g, '') !== '空间条件') continue;
      if (st.textContent.indexOf('启用') === -1) continue;
      n++;
    }
    return n;
  }

  function scanConflicts() {
    var blocked = spaceRuleCount() === 0;
    if (footerNote) {
      footerNote.textContent = blocked
        ? '不能进入发布前预览：判重必须有空间条件，列表里必须至少保留一条「条件类型 = 空间条件」且状态为「启用」的行，否则会把不同类型全区事件误判为重复。'
        : READY_NOTE;
      footerNote.classList.toggle('gc-shell-footer-note--block', blocked);
    }
    if (previewBtn) {
      previewBtn.disabled = blocked;
      var tip = blocked
        ? '当前判重条件里没有启用中的空间条件，不能进入发布前预览'
        : '带着本草稿进入发布前预览';
      previewBtn.title = tip;
      if (reasonEl) reasonEl.textContent = tip;
    }
    document.body.setAttribute('data-gc-draft-state', blocked ? 'blocked' : 'ready');
    return blocked;
  }

  // ── 底部动作条：只写入草稿 / 进入发布前预览（发布不在模块页） ──
  var saveDraft = document.querySelector('[data-gc-dr-save-draft]');
  if (saveDraft) saveDraft.addEventListener('click', function () {
    scanConflicts();
    toast(previewBtn && previewBtn.disabled
      ? '已写入草稿，尚未生效。当前仍被阻断：判重条件里没有启用中的空间条件。'
      : '已写入草稿，尚未生效。发布需在「规则版本」页经「发布前预览」做冲突校验后确认。');
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

  // ── 列表行变化（启停 / 新增 / 删除 / 编辑）后复检 ──
  document.addEventListener('click', function () { setTimeout(scanConflicts, 0); });
  if (dupCard && window.MutationObserver) {
    new MutationObserver(function () { scanConflicts(); })
      .observe(dupCard, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  scanConflicts();
  setTimeout(scanConflicts, 0);
})();
</script>`;

html = html.slice(0, jsStart) + newFooterJs + html.slice(jsEnd);

fs.writeFileSync(file, html, 'utf8');
console.log(`rev21 ok: removed ${before - html.length} chars (incl. dead css ${removedCss}), footer rewritten at ${jsStart}`);
