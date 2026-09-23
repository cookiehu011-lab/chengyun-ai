import fs from 'node:fs';

const root = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi';
const p = root + '/runtime-orchestration-summary.json';
const s = JSON.parse(fs.readFileSync(p, 'utf8'));

if (!Array.isArray(s.validationHistory)) s.validationHistory = [];
s.validationHistory.push({
  ranAt: new Date().toISOString(),
  command: 'scripts/logic-matrix.mjs (29 pages) + browser computed-style sweep (7 pages × 10 metrics) + browser re-verify (rev-14) + audit 0 + tests 19/19 + deploy',
  result: 'passed',
  note: 'UI-consistency & logic review round: logic matrix verified across 29 pages (meta lines, badges, CTA hierarchy, fixed sentences all coherent; dedup/metric fixed sentences present, org CRUD paths valid). Computed-style sweep found 2 visual drifts + 1 gap, all fixed: (1) sla-matrix live/draft h1 missing gc-page-title class → 20px vs 18px elsewhere, unified to 18px; (2) 有未发布草稿 meta hint plain-text on lifecycle-live & dispatch-claim-live vs orange span on sla — unified to span.gc-meta-draft (orange) + style injected; (3) table row hover missing site-wide — added subtle rgba(50,109,255,0.04) tbody tr:hover to all 29 pages. Browser re-verify: h1 18px, meta-draft orange, rowHover true on 4 spot pages.'
});
if (!Array.isArray(s.validationRepairLedger)) s.validationRepairLedger = [];
s.validationRepairLedger.push({
  round: 14,
  issue: 'h1 size drift on sla pages; inconsistent draft-meta hint styling; missing table row hover',
  fix: 'gc-page-title class added; span.gc-meta-draft unified + CSS injected; row-hover rule added to 29 pages',
  resolvedBy: 'main-agent'
});

fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
console.log('history:', s.validationHistory.length, '| repairs:', s.validationRepairLedger.length);
