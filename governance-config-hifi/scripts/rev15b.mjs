import fs from 'node:fs';

const dir = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
for (const f of ['event-standard-drawer.html', 'event-standard-live.html', 'shell-coordinator.html', 'shell-leader.html', 'shell-case-officer.html']) {
  const p = `${dir}/${f}`;
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, 'utf8');
  const re = /<div class="gc-banner-live" role="status">\s*<svg[\s\S]*?<\/svg>\s*<span>生效版[^<]*无未发布草稿<\/span>\s*<\/div>\n?/g;
  if (re.test(h)) {
    h = h.replace(re, '');
    fs.writeFileSync(p, h);
    console.log('removed green banner:', f);
  }
}
// 终检：全站不得再有"无未发布草稿"
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const left = files.filter(f => fs.readFileSync(`${dir}/${f}`, 'utf8').includes('无未发布草稿'));
if (left.length) { console.error('STILL PRESENT:', left.join(',')); process.exit(1); }
console.log('site-wide clean: 无未发布草稿 = 0');
