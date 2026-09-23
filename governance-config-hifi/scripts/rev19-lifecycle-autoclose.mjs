// rev19 · lifecycle-draft.html：把「自动结案规则」从全局单例开关改为列表后台管理
// 重写 lifecycle-edit-js，使其从表格行读取状态（行启用 = 纳入自动结案），保留 互斥阻断 演示。
import fs from 'node:fs';

const file = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages/lifecycle-draft.html';
let html = fs.readFileSync(file, 'utf8');

const NEW_JS = `<script id="lifecycle-edit-js">
(function () {
  // ── 自动结案：行 = 适用细类，状态「启用」= 纳入清单；命中「必须人工核查」→ 阻断发布 ──
  var ICONS = {
    ok: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    block: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>'
  };
  var table = document.querySelector('[data-gc-lc-table]');
  if (!table) return;
  var verdict = document.querySelector('[data-gc-lc-verdict]');
  var vIco = document.querySelector('[data-gc-lc-verdict-ico]');
  var vMain = document.querySelector('[data-gc-lc-verdict-main]');
  var vSub = document.querySelector('[data-gc-lc-verdict-sub]');
  var footerNote = document.querySelector('[data-gc-lc-footer-note]');
  var previewBtn = document.getElementById('gc-lc-go-preview');
  var reasonEl = document.getElementById('gc-lc-footer-reason');
  var saveBtn = document.querySelector('[data-gc-lc-save]');
  var toastEl = document.querySelector('[data-gc-lc-toast]');
  var fixBtn = document.querySelector('[data-gc-lc-fix]');
  var toastTimer = null;
  var restored = false;

  function txt(td) { return td ? td.textContent.replace(/\\s+/g, ' ').trim() : ''; }
  function rows() {
    return Array.prototype.slice.call(table.querySelectorAll('tr[data-gc-row]')).map(function (tr) {
      return {
        tr: tr,
        name: txt(tr.querySelector('td[data-col="name"]')),
        code: txt(tr.querySelector('td[data-col="code"]')),
        source: txt(tr.querySelector('td[data-col="source"]')),
        mc: txt(tr.querySelector('td[data-col="mc"]')),
        on: txt(tr.querySelector('td[data-col="status"]')).indexOf('启用') > -1
      };
    });
  }
  function conflicts() {
    return rows().filter(function (r) { return r.on && r.source === '开' && r.mc === '是'; });
  }
  function setMc(r, v) {
    var td = r.tr.querySelector('td[data-col="mc"]');
    if (td) td.textContent = v;
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('gc-lc-toast--show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('gc-lc-toast--show'); }, 3400);
  }

  function computeState() {
    var on = rows().filter(function (r) { return r.on; });
    var tone, main, sub;
    if (!on.length) {
      tone = 'warn';
      main = '自动结案未生效：当前没有启用中的适用细类，所有立案事件都将进入待处置。';
      sub = '把任意一行的「状态」置为启用即可纳入自动结案；该状态不涉及互斥，可以进入发布前预览。';
    } else {
      var noSource = null, conflict = null;
      on.forEach(function (r) {
        if (!noSource && r.source !== '开') noSource = r;
        if (!conflict && r.mc === '是') conflict = r;
      });
      if (noSource) {
        tone = 'block';
        main = '阻断发布：启用中的适用细类「' + noSource.name + '」的「允许自动结案候选」未开启。';
        sub = '需先在「事件标准 · 细类」把该细类的「允许自动结案候选」改为「开」，或在本页停用该行后再发布。';
      } else if (conflict) {
        tone = 'block';
        main = '阻断发布：自动结案适用细类与「必须人工核查」互斥。';
        sub = conflict.name + '（' + conflict.code + '）已命中「必须人工核查」。请停用该行，或先在「事件标准 · 细类」关闭该细类的「必须人工核查」。';
      } else {
        tone = 'ok';
        main = '校验通过：启用中的 ' + on.length + ' 个适用细类与核查规则不冲突。';
        sub = on.map(function (r) { return r.name + '（' + r.code + '）'; }).join('、') + ' 均未开启「必须人工核查」，可随草稿进入发布前预览。';
      }
    }
    return { tone: tone, main: main, sub: sub, blocked: tone === 'block' };
  }

  function render() {
    var s = computeState();
    if (verdict) verdict.className = 'gc-lc-verdict gc-lc-verdict--' + s.tone;
    if (vIco) vIco.innerHTML = ICONS[s.tone];
    if (vMain) vMain.textContent = s.main;
    if (vSub) vSub.textContent = s.sub;

    if (footerNote) {
      footerNote.textContent = s.blocked
        ? '不能进入发布前预览：先解除自动结案与「必须人工核查」的互斥。'
        : '本页只保存草稿；发布前预览会做冲突校验，业务模块页不提供发布入口。';
      footerNote.classList.toggle('gc-shell-footer-note--block', s.blocked);
    }
    if (previewBtn) {
      previewBtn.disabled = s.blocked;
      var tip = s.blocked ? '当前草稿存在阻断项，不能进入发布前预览' : '带着本草稿进入发布前预览';
      previewBtn.title = tip;
      if (reasonEl) reasonEl.textContent = tip;
    }

    var conf = conflicts();
    if (fixBtn) {
      fixBtn.disabled = !conf.length;
      fixBtn.classList.toggle('gc-btn-link--disabled', !conf.length);
      fixBtn.setAttribute('aria-disabled', conf.length ? 'false' : 'true');
      fixBtn.textContent = restored ? '恢复互斥演示' : '模拟解除互斥';
      fixBtn.title = conf.length
        ? '演示用：等同于在「事件标准 · 细类」关闭该细类的「必须人工核查」'
        : (restored ? '演示用：恢复这些细类的「必须人工核查」' : '当前没有启用中的互斥细类');
    }
    document.body.setAttribute('data-gc-lc-state', s.blocked ? 'blocked' : (s.tone === 'ok' ? 'ready' : 'off'));
  }

  if (fixBtn) fixBtn.addEventListener('click', function () {
    if (fixBtn.disabled) return;
    var conf = conflicts();
    if (restored) {
      // 还原：把本页被解除的细类恢复为「必须人工核查 = 是」
      rows().forEach(function (r) {
        if (r.on && r.source === '开') setMc(r, '是');
      });
      restored = false;
      render();
      toast('演示：已恢复「必须人工核查」，自动结案与它重新互斥。');
      return;
    }
    if (!conf.length) return;
    conf.forEach(function (r) { setMc(r, '否'); });
    restored = true;
    render();
    toast('演示：已在「事件标准 · 细类」关闭这些细类的「必须人工核查」，互斥解除，可进入发布前预览。');
  });

  if (previewBtn) previewBtn.addEventListener('click', function () {
    if (previewBtn.disabled) return;
    location.href = 'publish-preview.html';
  });

  if (saveBtn) saveBtn.addEventListener('click', function () {
    toast('草稿已保存（未发布）：生效版本仍为 V2026.08.18，发布需经「发布前预览」确认。');
  });

  // 引擎对表格的改动（启用·停用 / 新增 / 删除 / 编辑保存）后立即重算阻断态
  var mo = new MutationObserver(function () { render(); });
  mo.observe(table, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });

  // 深链：?off=1 全部停用 · ?fix=1 解除互斥 · ?open=1 追加一行启用（演示非法细类阻断）
  var qs = new URLSearchParams(location.search);
  if (qs.get('off') === '1') {
    rows().forEach(function (r) { setMc(r, r.mc); });
    Array.prototype.slice.call(table.querySelectorAll('tr[data-gc-row]')).forEach(function (tr) {
      var st = tr.querySelector('td[data-col="status"]');
      if (st) st.innerHTML = '<span class="gc-chip gc-chip--off">停用</span>';
      var tg = tr.querySelector('[data-gc-crud-toggle]');
      if (tg) tg.textContent = '启用';
    });
  }
  if (qs.get('fix') === '1') {
    conflicts().forEach(function (r) { setMc(r, '否'); });
    restored = true;
  }

  render();
})();
</script>`;

const start = html.indexOf('<script id="lifecycle-edit-js">');
if (start < 0) { console.error('FAIL: lifecycle-edit-js not found'); process.exit(1); }
const endMark = '</script>';
const end = html.indexOf(endMark, start);
if (end < 0) { console.error('FAIL: closing script tag not found'); process.exit(1); }
const endAll = end + endMark.length;

html = html.slice(0, start) + NEW_JS + html.slice(endAll);
fs.writeFileSync(file, html);
console.log('OK · lifecycle-edit-js rewritten · bytes=' + Buffer.byteLength(html));
