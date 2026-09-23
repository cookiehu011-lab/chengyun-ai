import fs from 'node:fs';

const dir = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const read = f => fs.readFileSync(`${dir}/${f}`, 'utf8');
const write = (f, h) => fs.writeFileSync(`${dir}/${f}`, h);
const must = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

const FOOT_OLD = '<span style="font-size:13px;color:var(--gc-muted);">改动在行内操作后即时写入草稿 · 发布请走「发布前预览」</span>';
const FOOT_NEW = '<span style="flex:1;"></span><a class="gc-btn-primary" href="publish-preview.html" data-dom-id="cta-go-preview">去发布前预览</a>';
const BANNER_RE = /<div class="gc-banner gc-banner--muted"><span>编辑中：改动将先写入草稿[^<]*<\/span><\/div>\n?/;

// 6 个草稿页：页脚说明文字 → 发布 CTA；4 个非脏数据草稿页：删蓝色横幅
for (const f of ['dedup-recurrence-draft.html', 'event-standard-draft.html', 'metric-caliber-draft.html', 'org-permission-draft.html', 'sla-matrix-draft.html', 'dispatch-claim-draft.html']) {
  let h = read(f);
  must(h.includes(FOOT_OLD), f + ' footer');
  h = h.replace(FOOT_OLD, FOOT_NEW);
  if (BANNER_RE.test(h)) h = h.replace(BANNER_RE, '');
  must(!h.includes('发布请走「发布前预览」') && !h.includes('改动将先写入草稿'), f + ' leftovers');
  write(f, h);
  console.log('ok:', f);
}
