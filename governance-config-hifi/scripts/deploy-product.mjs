import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/cookieqi/Downloads/Untitled';
const srcDir = root + '/governance-config-hifi/pages';
const outDir = root + '/public/governance-config';

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const hexMap = [
  ['F6F8FB', 'F3FAFF'], ['0F172A', '162D4D'], ['64748B', '6E8197'], ['E2E8F0', 'D8E7F7'],
  ['2F6BFF', '326DFF'], ['DCEBFF', 'E1EBFF'], ['1F5AE6', '245BE6'], ['174CBF', '1D4BC8'],
  ['EEF2F8', 'EAF4FE'], ['E2E9F5', 'E0EEFD'], ['CBD5E1', 'B8D8F5'],
  ['2E9B68', '35B985'], ['E6F4EC', 'E3F6EE'],
  ['D98A20', 'FF7A42'], ['FBF0DF', 'FDEBE3'],
  ['D94C4C', 'E45E58'], ['FBE7E7', 'FBEBEA'],
  ['7967D8', '7568D8'], ['EEEBFA', 'EEEEFB'],
  ['F1F5F9', 'EDF4FC'], ['94A3B8', '8CA3BC'],
];
const rgbaMap = [
  ['rgba(15, 23, 42', 'rgba(22, 45, 77'],
  ['rgba(15,23,42', 'rgba(22,45,77'],
];
// 字体：产品镜像与真源共用系统 CJK 栈（不引外部字体，避免 render-blocking + FOUT）
const bridge = `<script>
(function () {
  var map = { "治理大屏": "dashboard", "AI实时治理": "realtime", "事件档案": "archive", "AI统计": "statistics", "AI工作台": "workbench" };
  document.addEventListener("click", function (e) {
    var el = e.target;
    while (el && el !== document.body && !(el.classList && el.classList.contains("gc-top-tab"))) el = el.parentNode;
    if (!el || el === document.body) return;
    if (el.classList && el.classList.contains("gc-top-tab--active")) return;
    var label = (el.textContent || "").trim();
    var target = map[label];
    if (target && el.getAttribute("href") === "#") {
      e.preventDefault();
      e.stopPropagation();
      try { parent.postMessage({ source: "gc-hifi", target: target }, "*"); } catch (err) {}
    }
  }, true);
})();
</script>`;

// 顶栏视觉对齐产品：品牌区改为双行结构 + 产品蓝渐变标，整体配色与 React TopNav 一致
const BRAND_OLD = '<span class="gc-topbar-brand"><span class="gc-brand-mark" aria-hidden="true">城</span>SeeTime 城运AI</span>';
const BRAND_NEW = '<span class="gc-topbar-brand"><span class="gc-brand-mark" aria-hidden="true"></span><span class="gc-brand-text"><b>城运AI</b><i>东城城指中心</i></span></span>';
const LAYERS_ICON = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>";
const topbarAlign = `<style id="gc-topbar-align">
.gc-shell-topbar { background: rgba(255,255,255,0.85); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.65); box-shadow: 0 8px 32px rgba(22,45,77,0.08); padding: 0 22px; }
.gc-topbar-brand { gap: 12px; }
.gc-brand-mark { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #326DFF 0%, #24D6D2 100%); box-shadow: 0 6px 20px rgba(50,109,255,0.40), inset 0 1px 0 rgba(255,255,255,0.30); font-size: 0; }
.gc-brand-mark::before { content: ""; display: block; width: 17px; height: 17px; background-color: #FFFFFF; -webkit-mask: url("${LAYERS_ICON}") center / contain no-repeat; mask: url("${LAYERS_ICON}") center / contain no-repeat; }
.gc-brand-text { display: flex; flex-direction: column; line-height: 1.25; }
.gc-brand-text b { font-size: 16px; font-weight: 800; color: #162D4D; letter-spacing: 0.02em; }
.gc-brand-text i { font-style: normal; font-size: 10px; font-weight: 500; color: #6E8197; letter-spacing: 0.03em; }
.gc-top-tab { padding: 7px 14px; border-radius: 9px; color: #6E8197; }
.gc-top-tab:hover { color: #162D4D; background: rgba(50,109,255,0.06); }
.gc-top-tab--active, .gc-top-tab--active:hover { background: rgba(50,109,255,0.12); color: #326DFF; font-weight: 700; box-shadow: inset 0 1px 0 rgba(255,255,255,0.5); }
</style>`;

// ── 科技感皮肤（深空导航蓝）：--gc-* 变量整体覆盖 + 元素级兜底 ──
const gcThemeCss = `<style id="gc-theme-tech">
.gc-skin-toggle { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border-radius: 16px; border: 1px solid var(--gc-line); background: var(--gc-panel); }
.gc-skin-toggle button { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: none; border-radius: 12px; background: transparent; color: var(--gc-muted); font: 600 11px/1.4 var(--gc-font-sans); cursor: pointer; transition: color .15s, background-color .15s; }
.gc-skin-toggle button:hover { color: var(--gc-text); }
.gc-skin-toggle button.is-active { background: var(--gc-accent); color: #FFFFFF; }
html[data-gc-theme="tech"] {
  --gc-bg: #0A1730;
  --gc-panel: #12233E;
  --gc-text: #D8E6FA;
  --gc-muted: #8CA3BC;
  --gc-line: rgba(120, 165, 235, 0.20);
  --gc-accent: #5B8DFF;
  --gc-accent-soft: rgba(91, 141, 255, 0.18);
  --gc-accent-hover: #75A1FF;
  --gc-accent-active: #3D74E8;
  --gc-bg-hover: rgba(91, 141, 255, 0.10);
  --gc-bg-active: rgba(91, 141, 255, 0.16);
  --gc-line-strong: rgba(120, 165, 235, 0.35);
  --gc-func-green: #3ECF9A;
  --gc-func-green-soft: rgba(62, 207, 154, 0.16);
  --gc-func-orange: #FF9357;
  --gc-func-orange-soft: rgba(255, 147, 87, 0.16);
  --gc-func-red: #F0726C;
  --gc-func-red-soft: rgba(240, 114, 108, 0.16);
  --gc-func-purple: #9C8DF0;
  --gc-func-purple-soft: rgba(156, 141, 240, 0.16);
  --gc-disabled-bg: rgba(255, 255, 255, 0.06);
  --gc-disabled-text: #64788F;
}
html[data-gc-theme="tech"] body { background: #0A1730; color: #D8E6FA; }
html[data-gc-theme="tech"] .gc-shell { background: #0A1730; }
html[data-gc-theme="tech"] .gc-shell-sidebar { background: #0C1B33; }
html[data-gc-theme="tech"] .gc-shell-topbar { background: rgba(10, 24, 44, 0.78); border-bottom-color: rgba(120, 165, 235, 0.18); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45); }
html[data-gc-theme="tech"] .gc-brand-text b { color: #D8E6FA; }
html[data-gc-theme="tech"] .gc-brand-text i { color: #8CA3BC; }
html[data-gc-theme="tech"] .gc-top-tab { color: #8CA3BC; }
html[data-gc-theme="tech"] .gc-top-tab:hover { color: #D8E6FA; background: rgba(91, 141, 255, 0.10); }
html[data-gc-theme="tech"] .gc-top-tab--active, html[data-gc-theme="tech"] .gc-top-tab--active:hover { background: rgba(91, 141, 255, 0.18); color: #7FA8FF; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
html[data-gc-theme="tech"] .gc-table thead th { background: #0E2040; }
html[data-gc-theme="tech"] .gc-table tbody tr:hover td { background: rgba(91, 141, 255, 0.07); }
html[data-gc-theme="tech"] .gc-card { box-shadow: 0 1px 2px rgba(0,0,0,0.35); }
</style>`;

// 主题桥：接收产品皮肤消息 + 读取本地记忆 + 挂载顶栏切换控件（双向同步）
const gcThemeScript = `<script id="gc-theme-bridge">
(function () {
  function current() { return document.documentElement.getAttribute("data-gc-theme") === "tech" ? "tech" : "light"; }
  function syncToggle() {
    var w = document.getElementById("gc-skin-toggle");
    if (!w) return;
    var bs = w.querySelectorAll("button[data-skin]");
    for (var i = 0; i < bs.length; i++) {
      if (bs[i].getAttribute("data-skin") === current()) bs[i].classList.add("is-active");
      else bs[i].classList.remove("is-active");
    }
  }
  function apply(t) {
    document.documentElement.setAttribute("data-gc-theme", t);
    try { localStorage.setItem("gc-skin", t); } catch (e) {}
    syncToggle();
  }
  try { var saved = localStorage.getItem("gc-skin"); if (saved === "tech" || saved === "light") apply(saved); } catch (e) {}
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.source === "product-theme" && (d.theme === "tech" || d.theme === "light")) apply(d.theme);
  });
  var SUN = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
  function mount() {
    var right = document.querySelector(".gc-topbar-right");
    if (!right || document.getElementById("gc-skin-toggle")) { syncToggle(); return; }
    var wrap = document.createElement("div");
    wrap.id = "gc-skin-toggle";
    wrap.className = "gc-skin-toggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "皮肤配色切换");
    wrap.innerHTML = '<button type="button" data-skin="light">' + SUN + '清爽</button><button type="button" data-skin="tech">' + MOON + '科技</button>';
    right.insertBefore(wrap, right.firstChild);
    wrap.addEventListener("click", function (ev) {
      var t = ev.target && ev.target.closest ? (ev.target.closest("button[data-skin]") || {}).getAttribute : null;
      var btn = ev.target.closest ? ev.target.closest("button[data-skin]") : null;
      if (!btn) return;
      var theme = btn.getAttribute("data-skin");
      if (theme === current()) return;
      apply(theme);
      try {
        if (parent.__gcSetSkin) parent.__gcSetSkin(theme);
        if (parent !== window) parent.postMessage({ source: "gc-skin-change", theme: theme }, "*");
      } catch (e) {}
    });
    syncToggle();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
</script>`;

let count = 0;
for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith('.html'))) {
  let html = fs.readFileSync(path.join(srcDir, f), 'utf8');
  for (const [a, b] of hexMap) {
    html = html.split(a).join(b);
    html = html.split(a.toLowerCase()).join(b.toLowerCase());
  }
  for (const [a, b] of rgbaMap) html = html.split(a).join(b);
  // 不再注入外部字体 <link>：镜像与真源共用系统 CJK 栈
  html = html.split(BRAND_OLD).join(BRAND_NEW);
  html = html.replace('</body>', topbarAlign + '\n' + gcThemeCss + '\n' + bridge + '\n' + gcThemeScript + '\n</body>');
  fs.writeFileSync(path.join(outDir, f), html);
  count++;
}
console.log('deployed', count, 'pages to public/governance-config');
