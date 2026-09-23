import fs from 'node:fs';

const root = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi';
const p = root + '/runtime-orchestration-summary.json';
const s = JSON.parse(fs.readFileSync(p, 'utf8'));

if (!Array.isArray(s.validationHistory)) s.validationHistory = [];
s.validationHistory.push({
  ranAt: new Date().toISOString(),
  command: 'rev15/15b/15c/15d + audit (R14 copy rules) + tests 21/21 + browser E2E (edit/create param, live click-through, fresh-tab console) + deploy',
  result: 'passed',
  note: 'space-responsibility interaction & copy overhaul per user screenshots: (1) live row 编辑 & 新增网格 now carry context via URL (?edit=G-xxxx / ?create=1) and draft page auto-opens the matching drawer — no more bare jump to a generic draft page; (2) removed 4 layers of redundant copy on draft (blue banner, edit-workbench card, card note, footer text → replaced by single 去发布前预览 CTA) and green 无未发布草稿 banners site-wide (11 pages); (3) consistency fix: draft page no longer pre-seeds G-0421 张强/待发布 (contradicted live banner 无未发布草稿 and would have broken P36 3-row diff); (4) REAL BUG fixed: hook first injected into shell-collapse-js (first script-tail match) ran before space-edit-js listeners registered → auto-open dead; relocated into space-edit-js tail with position assertion. E2E: ?edit=G-0418/G-0419/G-0421 drawers auto-open with prefill, ?create=1 opens create drawer, live native click-through works, fresh-tab console clean.'
});
if (!Array.isArray(s.validationRepairLedger)) s.validationRepairLedger = [];
s.validationRepairLedger.push({
  round: 15,
  issue: 'live actions lost context (bare navigation); 4-layer redundant copy; seeded draft state contradicted live banner; hook injected into wrong script',
  fix: 'URL-param drawer auto-open (?edit/?create); copy purge site-wide; seed reset; hook relocated + position regression rules',
  resolvedBy: 'main-agent'
});

fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
console.log('history:', s.validationHistory.length, '| repairs:', s.validationRepairLedger.length);
