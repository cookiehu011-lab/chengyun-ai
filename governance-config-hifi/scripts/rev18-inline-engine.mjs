// rev18: 把通用后台管理引擎（base css / engine css / engine js）统一注入 6 个配置草稿页
// 幂等：已存在的页跳过。CSS 插到 </head> 前（让各页自有样式优先，避免视觉回归）；JS 插到 </body> 前。
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = join(root, 'pages');

// 1) base css：从已验证的 sla 页原样截取
const sla = readFileSync(join(pagesDir, 'sla-matrix-draft.html'), 'utf8');
function slice(src, startMark, endMark) {
  const s = src.indexOf(startMark);
  if (s < 0) throw new Error('missing start ' + startMark);
  const e = src.indexOf(endMark, s);
  if (e < 0) throw new Error('missing end ' + endMark);
  return src.slice(s, e + endMark.length);
}
const baseCss = slice(sla, '<style id="gc-crud-base-css">', '</style>');

// 2) engine css / js：从 partial 拆分
const engine = readFileSync(join(root, 'partials', 'gc-crud-engine.html'), 'utf8');
const jsMark = '<script id="gc-crud-js">';
const jsAt = engine.indexOf(jsMark);
if (jsAt < 0) throw new Error('engine js marker not found');
const engineCss = engine.slice(0, jsAt).trim();
const engineJs = engine.slice(jsAt).trim();

const targets = [
  'lifecycle-draft.html',
  'dispatch-claim-draft.html',
  'dedup-recurrence-draft.html',
  'event-standard-draft.html',
  'org-permission-draft.html',
  'space-responsibility-draft.html'
];

for (const f of targets) {
  const p = join(pagesDir, f);
  let html = readFileSync(p, 'utf8');
  const before = html.length;
  if (html.includes('id="gc-crud-js"')) { console.log('SKIP (already) ' + f); continue; }
  if (!html.includes('</head>')) throw new Error('no </head> in ' + f);
  if (!html.includes('</body>')) throw new Error('no </body> in ' + f);
  const css = (html.includes('id="gc-crud-base-css"') ? '' : baseCss + '\n') +
    (html.includes('id="gc-crud-css"') ? '' : engineCss + '\n');
  html = html.replace('</head>', css + '</head>');
  html = html.replace(/<\/body>\s*<\/html>\s*$/, engineJs + '\n</body>\n</html>\n');
  writeFileSync(p, html);
  console.log('OK ' + f + ' bytes ' + before + ' -> ' + html.length);
}
