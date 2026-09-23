import fs from 'node:fs';

const dir = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

// ── A. sla 两页 h1 补 gc-page-title（修 20px 漂移 → 18px 全站统一） ──
for (const f of ['sla-matrix-live.html', 'sla-matrix-draft.html']) {
  const p = `${dir}/${f}`;
  let html = fs.readFileSync(p, 'utf8');
  if (!html.includes('<h1 class="gc-h1 gc-page-title">')) {
    const before = '<h1 class="gc-h1">';
    if (!html.includes(before)) { console.error('h1 pattern missing in', f); process.exit(1); }
    html = html.replace('<h1 class="gc-h1">', '<h1 class="gc-h1 gc-page-title">');
    fs.writeFileSync(p, html);
  }
  console.log('h1 unified:', f);
}

// ── B. lifecycle-live / dispatch-claim-live：meta 提示用 span.gc-meta-draft + 样式定义 ──
const META_CSS = '.gc-meta-draft {\n  color: var(--gc-func-orange);\n  font-weight: 500;\n}\n\n';
for (const f of ['lifecycle-live.html', 'dispatch-claim-live.html']) {
  const p = `${dir}/${f}`;
  let html = fs.readFileSync(p, 'utf8');
  const OLD = '2026-08-18 · 有未发布草稿</p>';
  const NEW = '2026-08-18 · <span class="gc-meta-draft">有未发布草稿</span></p>';
  if (html.includes(OLD)) html = html.replace(OLD, NEW);
  if (!html.includes('.gc-meta-draft {')) {
    const anchor = html.match(/^\.gc-page-meta \{[^\n]*\}$/m);
    if (!anchor) { console.error('css anchor missing in', f); process.exit(1); }
    html = html.replace(anchor[0], anchor[0] + '\n\n' + META_CSS.trimEnd());
  }
  fs.writeFileSync(p, html);
  console.log('meta-draft unified:', f);
}

// ── C. 全 29 页：表格行 hover 微交互（若页内存在表格样式块） ──
const HOVER = '.gc-table tbody tr:hover td { background: rgba(50,109,255,0.04); }';
let hoverAdded = 0, hoverSkipped = 0;
for (const f of files) {
  const p = `${dir}/${f}`;
  let html = fs.readFileSync(p, 'utf8');
  if (html.includes('.gc-table tbody tr:hover')) { hoverSkipped++; continue; }
  const anchor = '.gc-table thead th { background: #F7F9FC; }';
  if (!html.includes(anchor)) { hoverSkipped++; continue; }
  html = html.replace(anchor, anchor + '\n' + HOVER);
  fs.writeFileSync(p, html);
  hoverAdded++;
}
console.log('row-hover added:', hoverAdded, '| skipped(no table):', hoverSkipped);
