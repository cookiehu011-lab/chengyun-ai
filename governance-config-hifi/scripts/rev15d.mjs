import fs from 'node:fs';

const p = '/Users/cookieqi/Downloads/Untitled/governance-config-hifi/pages/space-responsibility-draft.html';
let h = fs.readFileSync(p, 'utf8');

const HOOK = `  // ── 从生效版带上下文进入：?edit=G-xxxx 直接打开该网格编辑抽屉；?create=1 打开新增抽屉 ──
  var qs = (typeof location !== 'undefined' && location.search) ? new URLSearchParams(location.search) : null;
  if (qs && qs.get('edit')) {
    var eb = document.querySelector('[data-gc-bind][data-grid="' + qs.get('edit').toUpperCase() + '"]');
    if (eb) eb.click();
  } else if (qs && qs.get('create')) {
    var nb = document.querySelector('[data-gc-grid-new]');
    if (nb) nb.click();
  }
`;

// 1) 从 shell-collapse-js 中摘除误注入的钩子
const stray = HOOK.trimEnd();
if (h.includes(stray)) {
  h = h.replace(stray + '\n', '').replace(stray, '');
  console.log('stray hook removed from shell-collapse-js');
}

// 2) 注入到 space-edit-js 末尾（删除处理器之后、IIFE 收口之前）
const ANCHOR = '    if (tr) tr.remove();\n  });\n})();';
if (!h.includes(ANCHOR)) { console.error('space-edit-js tail anchor not found'); process.exit(1); }
h = h.replace(ANCHOR, '    if (tr) tr.remove();\n  });\n' + HOOK + '})();');

// 3) 校验：钩子必须位于 space-edit-js 内部（其开启标签之后、且在该脚本内）
const sIdx = h.indexOf('<script id="space-edit-js">');
const qIdx = h.indexOf("qs.get('edit')");
const eIdx = h.indexOf('</script>', sIdx);
if (!(qIdx > sIdx && qIdx < eIdx)) { console.error('hook not inside space-edit-js'); process.exit(1); }
const cIdx = h.indexOf('<script id="shell-collapse-js">');
const cEnd = h.indexOf('</script>', cIdx);
if (h.slice(cIdx, cEnd).includes("qs.get('edit')")) { console.error('stray hook still in shell-collapse-js'); process.exit(1); }

fs.writeFileSync(p, h);
console.log('hook relocated into space-edit-js: ok');
