import fs from 'node:fs';

const dir = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

// ── A. 全 29 页：nav 生命周期行统一指向 live + critical-layout 380px 残留清理 ──
let navFixed = 0, wFixed = 0;
for (const f of files) {
  const fp = `${dir}/${f}`;
  let html = fs.readFileSync(fp, 'utf8');
  const A = 'href="lifecycle-draft.html" data-dom-id="nav-lifecycle-draft"';
  const B = 'href="lifecycle-live.html" data-dom-id="nav-lifecycle"';
  if (html.includes(A)) { html = html.split(A).join(B); navFixed++; }
  const W = '  width: 380px;\n  min-width: 380px;';
  if (html.includes(W)) { html = html.split(W).join('  width: 300px;\n  min-width: 300px;'); wFixed++; }
  fs.writeFileSync(fp, html);
}
console.log('nav unified:', navFixed, '| critical-layout width cleaned:', wFixed);

// ── B. org 4 页：去 toast（成功即静默，校验改聚焦） ──
const ORG = ['org-permission-live.html', 'org-permission-draft.html', 'org-role-drawer.html', 'org-disable-confirm.html'];
const REPLACES = [
  // 校验 → 聚焦
  [`    if (!name || !account) { toast('请填写姓名与账号'); return; }`,
   `    if (!name || !account) { document.getElementById(!name ? 'gc-f-name' : 'gc-f-account').focus(); return; }`],
  [`    if (!name) { toast('请填写角色名称'); return; }`,
   `    if (!name) { document.getElementById('gc-r-name').focus(); return; }`],
  // 成功提示 → 移除
  [`\n      toast('已保存「' + name + '」· 写入草稿（发布后生效）');`, ``],
  [`\n      toast('已创建「' + name + '」· 写入草稿（发布后生效）');`, ``],
  // toast 函数定义 → 移除
  [`  function toast(msg) {
    var t = document.getElementById('gc-toast');
    t.textContent = msg;
    t.classList.add('gc-toast--show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('gc-toast--show'); }, 2400);
  }

`, ``],
];
for (const f of ORG) {
  const fp = `${dir}/${f}`;
  let html = fs.readFileSync(fp, 'utf8');
  for (const [a, b] of REPLACES) {
    if (!html.includes(a)) { console.error('org pattern missing in', f, JSON.stringify(a.slice(0, 40))); process.exit(1); }
    html = html.split(a).join(b);
  }
  // toast 元素 + CSS
  html = html.split('\n').filter(l => !/gc-toast/.test(l)).join('\n');
  html = html.replace(/<div class="gc-toast"[^>]*><\/div>\n/g, '');
  if (html.includes('gc-toast') || html.includes("toast('")) { console.error('toast remnants in', f); process.exit(1); }
  fs.writeFileSync(fp, html);
  console.log('org toast removed:', f);
}
