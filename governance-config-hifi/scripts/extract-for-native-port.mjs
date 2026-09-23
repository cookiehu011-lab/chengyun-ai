// 从治理配置静态原型页抽取结构化配置 → JSON（供 React 原生重建使用）
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('pages');
const OUT = path.resolve('scripts/gc-native-extract.json');

const draftPages = [
  'org-permission-draft', 'space-responsibility-draft', 'event-standard-draft',
  'lifecycle-draft', 'sla-matrix-draft', 'dispatch-claim-draft',
  'dedup-recurrence-draft', 'metric-caliber-draft',
];

function extractCard(cardHtml) {
  const id = (cardHtml.match(/data-gc-crud="([^"]+)"/) || [])[1] || '';
  const name = (cardHtml.match(/data-gc-crud-name="([^"]+)"/) || [])[1] || '';
  const note = (cardHtml.match(/data-gc-crud-note="([^"]+)"/) || [])[1] || '';
  let fields = [];
  const fm = cardHtml.match(/data-gc-crud-fields='([^']+)'/);
  if (fm) { try { fields = JSON.parse(fm[1]); } catch { /* keep empty */ } }
  const title = (cardHtml.match(/<h2[^>]*>([^<]+)<\/h2>/) || [])[1] || '';
  const headM = cardHtml.match(/<thead[\s\S]*?<\/thead>/);
  const cols = headM
    ? [...headM[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
    : [];
  const rows = [];
  const tbodyM = cardHtml.match(/<tbody[\s\S]*?<\/tbody>/);
  if (tbodyM) {
    for (const trM of tbodyM[0].matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)) {
      const tds = [...trM[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim());
      rows.push(tds);
    }
  }
  return { id, name, title, note, fields, cols, rows };
}

function extractPage(base) {
  const html = fs.readFileSync(path.join(DIR, base + '.html'), 'utf8');
  const cards = [];
  const positions = [...html.matchAll(/<(?:section|div)[^>]*data-gc-crud="/g)].map(m => m.index);
  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    cards.push(extractCard(html.slice(positions[i], end)));
  }
  const footerM = html.match(/<script id="gc-footer-js">([\s\S]*?)<\/script>/);
  const footer = footerM ? footerM[1] : '';
  const h1 = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1] || '';
  const secs = [...html.matchAll(/<section[^>]*aria-label="([^"]+)"[^>]*>/g)].map(m => m[1]);
  return { base, h1, secs, cards, footer };
}

function extractShell() {
  const html = fs.readFileSync(path.join(DIR, 'shell-coordinator.html'), 'utf8');
  const navItems = [...html.matchAll(/<a[^>]*href="([a-z0-9-]+\.html)"[^>]*>([\s\S]*?)<\/a>/g)]
    .filter(m => m[1].includes('live') || m[1].includes('draft') || m[1].includes('publish'))
    .map(m => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
  const roleBtn = (html.match(/切换角色[\s\S]{0,400}/) || [''])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300);
  return { navItems: navItems.slice(0, 24), roleBtn };
}

const result = { pages: {}, shell: extractShell() };
for (const base of draftPages) result.pages[base] = extractPage(base);

fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
for (const base of draftPages) {
  const p = result.pages[base];
  console.log(base, '| h1:', p.h1, '| cards:', p.cards.map(c => c.id + '(' + c.rows.length + ')').join(','), '| footer:', p.footer.length);
}
console.log('shell nav:', result.shell.navItems.map(n => n.href).join(', '));
console.log('OUT:', OUT);
