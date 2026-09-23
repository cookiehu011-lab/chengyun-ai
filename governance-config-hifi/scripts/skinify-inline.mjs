// 皮肤适配 codemod：把模块内联的白色面板/控件底色替换为语义变量
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  '/Users/cookieqi/Downloads/Untitled/src/App.tsx',
  '/Users/cookieqi/Downloads/Untitled/src/modules/AIStatistics.tsx',
];

// 1) 复合渐变整体替换
const GRADIENTS = [
  ['linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.68) 100%)', 'linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--card) 100%)'],
  ['linear-gradient(105deg, rgba(50,109,255,0.08) 0%, rgba(255,255,255,0.82) 55%, rgba(36,214,210,0.05) 100%)', 'linear-gradient(105deg, rgba(91,141,255,0.10) 0%, var(--card) 55%, rgba(46,230,224,0.06) 100%)'],
  ['linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 100%)', 'linear-gradient(180deg, var(--glass-bg-strong) 0%, var(--card) 100%)'],
  ['linear-gradient(180deg, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.78) 100%)', 'linear-gradient(180deg, var(--glass-bg-strong) 0%, var(--card) 100%)'],
];

// 2) 单值面板/控件底（带引号形式，避免误伤 boxShadow 内的白色高光）
const SOLIDS = [
  ['rgba(255,255,255,0.96)', 'var(--glass-bg-strong)'],
  ['rgba(255,255,255,0.92)', 'var(--glass-bg-strong)'],
  ['rgba(255,255,255,0.90)', 'var(--glass-bg-strong)'],
  ['rgba(255,255,255,0.88)', 'var(--glass-bg-strong)'],
  ['rgba(255,255,255,0.85)', 'var(--glass-bg-strong)'],
  ['rgba(255,255,255,0.82)', 'var(--glass-bg-strong)'],
  ['rgba(255,255,255,0.78)', 'var(--card)'],
  ['rgba(255,255,255,0.72)', 'var(--card)'],
  ['rgba(255,255,255,0.7)', 'var(--chip-bg)'],
  ['rgba(255,255,255,0.68)', 'var(--card)'],
  ['rgba(255,255,255,0.65)', 'var(--control-bg)'],
  ['rgba(255,255,255,0.62)', 'var(--chip-bg)'],
  ['rgba(255,255,255,0.6)', 'var(--chip-bg)'],
  ['rgba(255,255,255,0.55)', 'var(--row-bg)'],
];

let totalGrad = 0;
let totalSolid = 0;
for (const f of FILES) {
  let src = readFileSync(f, 'utf8');
  let g = 0, s = 0;
  for (const [a, b] of GRADIENTS) {
    const parts = src.split(a);
    g += parts.length - 1;
    src = parts.join(b);
  }
  // 仅替换字符串字面量形式的单值（"rgba(...)" 或 `rgba(...)` 单独成值），带前引号界定
  for (const [a, b] of SOLIDS) {
    for (const q of ['"', '`']) {
      const needle = q + a + q;
      const parts = src.split(needle);
      s += parts.length - 1;
      src = parts.join(q + b + q);
    }
  }
  writeFileSync(f, src);
  totalGrad += g; totalSolid += s;
  console.log(f.split('/').pop(), 'gradients:', g, 'solids:', s);
}
console.log('TOTAL gradients:', totalGrad, 'solids:', totalSolid);
