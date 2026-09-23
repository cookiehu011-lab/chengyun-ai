// 全站结构勘察：表格列/行操作/状态chip/工具栏/脚本/横幅/注脚/抽屉
import fs from 'node:fs';
const DIR = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html')).sort();
for (const f of files) {
  const h = fs.readFileSync(`${DIR}/${f}`, 'utf8');
  const pick = (re) => { const m = h.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
  const ths = [...h.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1].trim()).filter(Boolean);
  const scripts = [...h.matchAll(/<script id="([^"]+)">/g)].map(m => m[1]);
  const banners = [...h.matchAll(/class="gc-banner[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<]{0,60})/g)].map(m => m[1].trim()).filter(Boolean);
  const notes = [...h.matchAll(/class="gc-(?:card-note|tree-note|table-note|page-note|row-note)[^"]*"[^>]*>([^<]{0,60})/g)].map(m => m[1].trim());
  const asides = [...h.matchAll(/class="gc-card-aside"[^>]*>([^<]{0,60})/g)].map(m => m[1].trim());
  const actionCell = pick(/<td class="gc-td-actions">([\s\S]{0,160}?)<\/td>/);
  const footer = pick(/<div class="gc-shell-footer">([\s\S]{0,220}?)<\/div>\s*<\/main>/).replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/\s+/g, ' ');
  const toolbar = h.includes('class="gc-toolbar"');
  const selects = (h.match(/<select/g) || []).length;
  const chips = (h.match(/gc-chip gc-chip--(on|off|green|muted)/g) || []).length;
  const drawers = [...h.matchAll(/data-gc-drawer="([^"]+)"/g)].map(m => m[1]);
  console.log(`\n===== ${f} =====`);
  if (ths.length) console.log('  TH:', ths.join(' | '));
  if (actionCell) console.log('  ACT0:', actionCell.replace(/\s+/g, ' '));
  if (banners.length) console.log('  BANNER:', banners.join(' || '));
  if (notes.length) console.log('  NOTES:', notes.join(' || '));
  if (asides.length) console.log('  ASIDE:', asides.join(' || '));
  if (footer) console.log('  FOOTER:', footer);
  console.log(`  toolbar:${toolbar ? 'Y' : 'N'} selects:${selects} chips:${chips} drawers:[${drawers.join(',')}] scripts:[${scripts.join(',')}]`);
}
