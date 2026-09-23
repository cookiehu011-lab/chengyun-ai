import fs from 'node:fs';

const root = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi';
const p = root + '/runtime-orchestration-summary.json';
const s = JSON.parse(fs.readFileSync(p, 'utf8'));

if (!Array.isArray(s.validationHistory)) s.validationHistory = [];
s.validationHistory.push({
  ranAt: new Date().toISOString(),
  command: 'scripts/audit.mjs (13 rules × 29 pages) + browser console sweep 29/29 + browser E2E (path① rollback chain, org CRUD, space CRUD, dup-check) + node --test 19/19 + validate --expected-pages=29 (rev-13)',
  result: 'passed',
  note: 'full-suite audit & fix round: (1) nav 生命周期 row unified to lifecycle-live.html across 29 pages (was inconsistent draft target; domId renamed nav-lifecycle); (2) critical-layout 380px dead code cleaned to 300px on all pages; (3) toast popups removed from 4 org pages (silent apply, validation via focus) per no-popup principle; (4) stale 换绑-era footnote 更换主责需先解绑再绑定 removed from 3 pages; (5) missing fixed sentence 空间匹配失败… added to space-responsibility-draft; (6) REAL BUG fixed: grid create dup-check used tr[data-grid-row] which original rows lack → duplicates of seeded grids were allowed; replaced with first-cell text comparison, test fixture aligned to real DOM, regression test added (test-first: red→green); browser E2E: path① full chain OK (nav→live→edit→draft→preview→publish→effective V2026.08.19 badges cleared), rollback page reachable, org account create row+no-toast OK, space create row OK, dup of G-0418 blocked OK; 29/29 pages zero console errors'
});
if (!Array.isArray(s.validationRepairLedger)) s.validationRepairLedger = [];
s.validationRepairLedger.push({
  round: 13,
  issue: 'audit found: nav inconsistency, 380px dead code, org toasts, stale wording ×3, missing fixed sentence ×1, dup-check blind to seeded rows',
  fix: 'unified nav to live; cleaned width remnants; removed toasts (focus-based validation); wording purge; sentence restored; text-based dup check with regression test',
  resolvedBy: 'main-agent'
});

fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
console.log('history:', s.validationHistory.length, '| repairs:', s.validationRepairLedger.length);
