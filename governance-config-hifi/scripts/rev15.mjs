import fs from 'node:fs';

const dir = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages';
const read = f => fs.readFileSync(`${dir}/${f}`, 'utf8');
const write = (f, h) => fs.writeFileSync(`${dir}/${f}`, h);
const must = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };

// ═══ A. 空间 live：绿色横幅/角标删除 + 行编辑带上下文跳转 ═══
{
  let h = read('space-responsibility-live.html');

  // A1 绿横幅（无用：与 meta 行重复）
  h = h.replace('<div class="gc-banner gc-banner--green"><span>生效版 V2026.08.18 · 空间与责任无未发布草稿</span></div>\n', '');
  h = h.replace('<div class="gc-banner gc-banner--green"><span>生效版 V2026.08.18 · 空间与责任无未发布草稿</span></div>', '');
  must(!h.includes('无未发布草稿'), 'live green banner still present');

  // A2 卡片角标（与表脚固定句重复）
  h = h.replace('      <span class="gc-card-note">一网格一主责 · 生效版只读</span>\n', '');

  // A3 行内编辑 → 带网格编码跳转（草稿页自动打开对应抽屉）
  h = h.replace(/<tr>\s*\n\s*<td class="gc-td-code">(G-\d+)<\/td>[\s\S]*?<\/tr>/g, (row, code) =>
    row.replace('href="space-responsibility-draft.html" title="生效版只读：编辑将进入草稿"',
      `href="space-responsibility-draft.html?edit=${code}" title="进入草稿，编辑网格 ${code}"`));
  must(h.includes('href="space-responsibility-draft.html?edit=G-0418"'), 'live edit param G-0418');
  must(h.includes('href="space-responsibility-draft.html?edit=G-0421"'), 'live edit param G-0421');
  must(!h.includes('<a class="gc-btn-link" href="space-responsibility-draft.html"'), 'live plain edit href remaining');

  // A4 新增网格 → 带动作意图跳转
  h = h.replace('<a class="gc-btn-primary" href="space-responsibility-draft.html" title="生效版只读：新增网格将进入草稿">＋ 新增网格</a>',
    '<a class="gc-btn-primary" href="space-responsibility-draft.html?create=1" title="进入草稿，新增网格">＋ 新增网格</a>');
  must(h.includes('?create=1'), 'live create param');
  write('space-responsibility-live.html', h);
  console.log('A live ok');
}

// ═══ B. 空间 draft：删四层冗余文案 + 预置草稿口径修正 + URL 参数自动开抽屉 ═══
{
  let h = read('space-responsibility-draft.html');

  // B1 蓝横幅（无用）
  must(h.includes('<div class="gc-banner gc-banner--muted"><span>编辑中：改动将先写入草稿，不直接影响生效版。保存后到「发布与审计」核对并发布。</span></div>'), 'draft blue banner');
  h = h.replace('<div class="gc-banner gc-banner--muted"><span>编辑中：改动将先写入草稿，不直接影响生效版。保存后到「发布与审计」核对并发布。</span></div>\n', '');

  // B2 编辑工作台卡（无用：表单自身带上下文）
  const card = /<section class="gc-card gc-editctx"[\s\S]*?<\/section>\n\n/;
  must(card.test(h), 'draft editctx card');
  h = h.replace(card, '');

  // B3 卡片角标（无用）+ 死 CSS 清理
  h = h.replace('      <span class="gc-card-note">草稿编辑中：直接编辑网格主责与协同监督</span>\n', '');
  h = h.split('\n').filter(l => !/^\.gc-editctx/.test(l)).join('\n');

  // B4 预置草稿口径修正：生效版说"无未发布草稿"，草稿页不应预置改动（P36 差异表=3 行硬约束）
  must(h.includes('<td class="gc-td-name" data-cell="owner" data-grid="G-0421" data-orig="—（空）">张强<span class="gc-diff-mark">草稿</span></td>'), 'seed owner cell');
  h = h.replace('<td class="gc-td-name" data-cell="owner" data-grid="G-0421" data-orig="—（空）">张强<span class="gc-diff-mark">草稿</span></td>',
    '<td class="gc-td-dash" data-cell="owner" data-grid="G-0421" data-orig="—（空）">—（空）</td>');
  must(h.includes('<span class="gc-chip gc-chip--muted">待发布</span>'), 'seed chip');
  h = h.replace('<span class="gc-chip gc-chip--muted">待发布</span>', '<span class="gc-chip gc-chip--muted">待定责</span>');
  h = h.replace('<button type="button" class="gc-btn-link" data-gc-bind data-grid="G-0421" data-owner="张强" data-sup="—">编辑</button>',
    '<button type="button" class="gc-btn-link" data-gc-bind data-grid="G-0421" data-owner="" data-sup="—">编辑</button>');

  // B5 抽屉描述精简（一事件句保留在表脚，抽屉内不重复）
  h = h.replace('编辑网格主责与协同监督，保存后写入草稿，发布后才作用于新事件。一个事件同一时刻只对应一个网格责任人。',
    '编辑该网格的网格主责与协同监督。保存后写入草稿，发布后才作用于新事件。');
  h = h.replace('新增网格写入草稿；主责可稍后在表格中「编辑」。一个事件同一时刻只对应一个网格责任人。',
    '新增一条网格责任记录。保存后写入草稿，发布后才作用于新事件。');

  // B6 页脚：说明文字 → 发布 CTA
  const FOOT = '<span style="font-size:13px;color:var(--gc-muted);">改动在行内操作后即时写入草稿 · 发布请走「发布前预览」</span>';
  must(h.includes(FOOT), 'draft footer text');
  h = h.replace(FOOT, '<span style="flex:1;"></span><a class="gc-btn-primary" href="publish-preview.html" data-dom-id="cta-go-preview">去发布前预览</a>');

  // B7 URL 参数自动开抽屉（承接生效版「编辑 / 新增网格」的上下文）
  const HOOK = `  // ── 从生效版带上下文进入：?edit=G-xxxx 直接打开该网格编辑抽屉；?create=1 打开新增抽屉 ──
  var qs = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search) : null;
  if (qs && qs.get('edit')) {
    var eb = document.querySelector('[data-gc-bind][data-grid="' + qs.get('edit').toUpperCase() + '"]');
    if (eb) eb.click();
  } else if (qs && qs.get('create')) {
    var nb = document.querySelector('[data-gc-grid-new]');
    if (nb) nb.click();
  }
})();
</script>`;
  must(h.includes('})();\n</script>') && h.includes('<script id="space-edit-js">'), 'script tail');
  h = h.replace('})();\n</script>', HOOK);

  const bad = ['无未发布草稿', '改动将先写入草稿', '编辑中：网格主责与协同监督', 'gc-editctx-title', '待发布', '发布请走「发布前预览」'];
  const left = bad.filter(s => h.includes(s));
  must(!left.length, 'draft leftovers: ' + left.join(','));
  write('space-responsibility-draft.html', h);
  console.log('B draft ok');
}

// ═══ C. 全站：绿色"无未发布草稿"横幅一律删除（与 meta 行重复的无用文案） ═══
{
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  let n = 0;
  for (const f of files) {
    let h = read(f);
    const re = /<div class="gc-banner gc-banner--green"><span>生效版[^<]*无未发布草稿<\/span><\/div>\n?/g;
    if (re.test(h)) { h = h.replace(re, ''); write(f, h); n++; }
  }
  console.log('C green banners removed on', n, 'pages');
}
