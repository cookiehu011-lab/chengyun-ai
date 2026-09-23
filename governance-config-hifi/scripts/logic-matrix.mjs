import fs from 'node:fs';

const dir = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();

const rows = [];
for (const f of files) {
  const html = fs.readFileSync(`${dir}/${f}`, 'utf8');
  const h1 = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1] || '';
  // 元信息行：含 生效版本/编辑中 的文本
  const meta = (html.match(/(生效版本[^<]{5,90}|编辑中[^<]{5,90})/) || [])[1] || '';
  // 橙色横幅
  const banner = /gc-banner[^"]*(orange|warn)[^"]*|草稿不能直接覆盖/.test(html) && html.includes('草稿不能直接覆盖已生效版本');
  // 主 CTA：第一个 gc-btn-primary
  const ctaM = html.match(/<a[^>]*class="[^"]*gc-btn-primary[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>|<button[^>]*class="[^"]*gc-btn-primary[^"]*"[^>]*data-dom-id="([^"]+)"[^>]*>([^<]+)<\/button>/);
  const cta = ctaM ? (ctaM[2] || ctaM[4]) + (ctaM[1] ? ' →' + ctaM[1] : ctaM[3] ? ' [' + ctaM[3] + ']' : '') : '—';
  // 徽章
  const badges = [];
  if (html.includes('>草稿<')) badges.push('草稿');
  if (html.includes('>已发布<')) badges.push('已发布');
  if (html.includes('>待发布<')) badges.push('待发布');
  // 固定句抽检
  const fixed = [];
  if (html.includes('发布后只作用于新事件，不改写历史结论。')) fixed.push('新事件');
  if (html.includes('一个事件同一时刻只对应一个网格责任人。')) fixed.push('一网格');
  if (html.includes('空间匹配失败不能直接立案派发，也不等于不予立案。')) fixed.push('匹配失败');
  if (html.includes('网格责任人不能自己结案')) fixed.push('不能自结');
  if (html.includes('重复上报不创建新事件') || html.includes('不创建新事件')) fixed.push('重复不新建');
  if (html.includes('结案后再次发生')) fixed.push('复发新建');
  // 编辑路径：live 页应有 → draft 的入口
  const draftOf = f.replace('-live', '-draft');
  const hasEditPath = f.includes('-live') ? /href="[^"]*-draft\.html"|编辑/.test(html) : 'n/a';
  rows.push({ f, h1, meta: meta.slice(0, 60), banner, cta: cta.slice(0, 46), badges: badges.join('|') || '—', fixed: fixed.join(',') || '—', hasEditPath });
}

// 打印矩阵
const w = [34, 22, 56, 7, 40, 12, 22, 6];
const head = ['page', 'h1', 'meta', 'orange', 'primaryCTA', 'badges', 'fixed', 'edit'];
console.log(head.map((h, i) => String(h).padEnd(w[i])).join(' '));
for (const r of rows) {
  console.log([r.f, r.h1, r.meta, r.banner ? 'YES' : '-', r.cta, r.badges, r.fixed, String(r.hasEditPath)].map((x, i) => String(x).padEnd(w[i])).join(' '));
}
