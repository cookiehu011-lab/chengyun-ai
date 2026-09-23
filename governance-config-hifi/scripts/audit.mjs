import fs from 'node:fs';
import path from 'node:path';

const dir = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
const problems = {};
const info = {};
const add = (f, rule, msg) => { (problems[f] ||= []).push(`${rule}: ${msg}`); };
const note = (f, rule, msg) => { (info[f] ||= []).push(`${rule}: ${msg}`); };

const PALETTE = new Set(['F6F8FB','0F172A','64748B','E2E8F0','2F6BFF','DCEBFF','1F5AE6','174CBF','EEF2F8','E2E9F5','CBD5E1','2E9B68','E6F4EC','D98A20','FBF0DF','D94C4C','FBE7E7','7967D8','EEEBFA','F1F5F9','94A3B8','FFFFFF','FFF']);
const NAV_HREFS = ['org-permission-live.html','space-responsibility-live.html','event-standard-live.html','lifecycle-live.html','sla-matrix-live.html','dispatch-claim-live.html','dedup-recurrence-live.html','metric-caliber-live.html','publish-draft-review.html'];

for (const f of files) {
  const fp = `${dir}/${f}`;
  const html = fs.readFileSync(fp, 'utf8');
  const bodyStart = html.indexOf('<body>');
  const body = html.slice(bodyStart);

  // R1 CSS 泄漏：</style> 后紧跟 CSS 规则
  if (/<\/style>\s*\n\s*\.[a-z-]+ \{/.test(html)) add(f, 'R1-css-leak', 'orphan CSS after </style>');

  // R2 残留 </script>
  if (/<\/script>\s*<\/script>/.test(html)) add(f, 'R2-stray-script', 'duplicate closing script tags');

  // R3 脚本引用先于 DOM（rev12 bug 类）
  const scriptRe = /<script id="([^"]+)">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    const [full, sid, code] = m;
    const scriptPos = m.index;
    const refs = new Set();
    for (const mm of code.matchAll(/getElementById\('([^']+)'\)/g)) refs.push ? null : refs.add('id:' + mm[1]);
    for (const mm of code.matchAll(/querySelector(?:All)?\('\[data-([a-z-]+)(?:="([^"]+)")?\]'\)/g)) refs.add('attr:' + (mm[2] ? `data-${mm[1]}="${mm[2]}"` : `data-${mm[1]}`));
    for (const mm of code.matchAll(/querySelector(?:All)?\('([^']+)'\)/g)) {
      const sel = mm[1];
      if (sel.startsWith('td[') || sel.includes('data-')) {
        const am = sel.match(/data-([a-z-]+)(?:="([^"]+)")?/);
        if (am) refs.add('attr:' + (am[2] !== undefined ? `data-${am[1]}="${am[2]}"` : `data-${am[1]}`));
      } else if (/^#[\w-]+$/.test(sel)) refs.add('id:' + sel.slice(1));
    }
    for (const ref of refs) {
      const needle = ref.startsWith('id:') ? `id="${ref.slice(3)}"` : ref.slice(5);
      const pos = html.indexOf(needle);
      if (pos < 0) { add(f, 'R3-ref-missing', `${sid}: ${ref} 不存在于页面`); continue; }
      // 排除引用本身位于脚本内部（字符串字面量）的情况：找脚本外的首次出现
      const outside = html.slice(0, scriptPos).indexOf(needle) >= 0 || html.slice(scriptPos + full.length).indexOf(needle) >= 0;
      if (!outside) continue;
      if (pos > scriptPos + full.length && html.slice(0, scriptPos).indexOf(needle) < 0) {
        add(f, 'R3-script-before-dom', `${sid}: ${ref} 首次出现在脚本之后（脚本执行时取不到）`);
      }
    }
  }

  // R4 href 有效性
  for (const mm of html.matchAll(/href="([a-z0-9-]+\.html)"/g)) {
    const target = mm[1];
    if (!fs.existsSync(path.join(dir, target))) add(f, 'R4-href-broken', target);
  }

  // R5 重复 ID
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(x => x[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) add(f, 'R5-dup-id', [...new Set(dup)].join(','));

  // R6 侧栏 300px
  if (!html.includes('width: 300px; min-width: 300px; background: #F7F9FC;')) add(f, 'R6-sidebar', 'missing 300px override');
  if (html.includes('width: 380px;') || html.includes('width: 320px;\n  min-width: 320px;')) note(f, 'R6-sidebar', 'legacy width remnants');

  // R7 左栏 9 个模块行（生命周期行统一指向 live）
  const missingNav = NAV_HREFS.filter(h => !html.includes(`href="${h}"`));
  if (missingNav.length) add(f, 'R7-nav', 'missing: ' + missingNav.join(','));
  if (html.includes('data-dom-id="nav-lifecycle-draft"')) add(f, 'R7-nav', 'stale domId nav-lifecycle-draft');

  // R8 head 基础
  if (!html.includes('<meta charset="UTF-8">')) add(f, 'R8-head', 'no charset');
  if (!html.includes('name="viewport"')) add(f, 'R8-head', 'no viewport');
  if (!/<html[^>]*class="light"/.test(html)) add(f, 'R8-head', 'no html.light');
  if (!html.includes('lang="zh-CN"')) add(f, 'R8-head', 'no lang');

  // R9 hidden 浮层与关闭逻辑（仅检查浮层根元素；开态展示页本身可见，跳过）
  const OPEN_STATE = /-drawer\.html$|-confirm\.html$|space-match-/.test(f);
  if (!OPEN_STATE) {
    for (const mm of body.matchAll(/<(?:aside|div) class="gc-(?:drawer|modal)"[^>]*>/g)) {
      if (!mm[0].includes('hidden')) add(f, 'R9-overlay', 'overlay without initial hidden: ' + mm[0].slice(0, 80));
    }
  }

  // R10 toast 清单（决策用）
  if (body.includes('gc-toast')) note(f, 'R10-toast', 'has toast popup');

  // R11 固定句（全局适用句）
  const FIXED = [
    '一个事件同一时刻只对应一个网格责任人。',
    '空间匹配失败不能直接立案派发，也不等于不予立案。',
  ];
  if (f.startsWith('space-')) {
    for (const s of FIXED) if (!html.includes(s)) add(f, 'R11-fixed', 'missing: ' + s);
  }

  // R12 非色板 hex（内联样式里的硬编码色）
  const offPal = new Set();
  for (const mm of html.matchAll(/#([0-9A-Fa-f]{6})\b/g)) {
    const h = mm[1].toUpperCase();
    if (!PALETTE.has(h)) offPal.add(mm[1]);
  }
  if (offPal.size) note(f, 'R12-offpalette', [...offPal].slice(0, 8).join(','));

  // R13 flash/flicker 动画
  for (const mm of html.matchAll(/@keyframes ([\w-]+)/g)) note(f, 'R13-anim', 'keyframes: ' + mm[1]);

  // R14 冗余文案禁入（rev15 定稿口径）
  for (const s of ['无未发布草稿', '改动将先写入草稿', '编辑中：网格主责与协同监督', '发布请走「发布前预览」', '草稿编辑中：可调整细类', '（演示不落库）', '写死演示对', '草稿编辑中：阈值与观察期', '草稿编辑中：权重可改']) {
    if (html.includes(s)) add(f, 'R14-copy', 'forbidden: ' + s);
  }
}

console.log('=== FILES:', files.length, '===');
let total = 0;
for (const f of files) {
  const p = problems[f];
  if (p) { total += p.length; console.log('\n✗ ' + f); for (const x of p) console.log('   ' + x); }
}
console.log('\n=== TOTAL PROBLEMS:', total, '===');
console.log('\n=== INFO (toasts / anims / offpalette) ===');
for (const f of files) {
  const n = info[f];
  if (n) console.log('ℹ ' + f + '\n   ' + n.join('\n   '));
}
