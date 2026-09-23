// 预测面板紫色 → 产品青色 AI 语义统一
import { readFileSync, writeFileSync } from 'node:fs';

const f = '/Users/cookieqi/Downloads/Untitled/src/App.tsx';
let s = readFileSync(f, 'utf8');
let n = 0;

// TomorrowForecast 区块内（含回放预测槽）的紫色替换
const pairs = [
  // 面板容器
  ['border: "1px dashed rgba(156,141,240,0.70)"', 'border: "1px dashed rgba(36,214,210,0.60)"'],
  ['background: "rgba(117,104,216,0.08)"', 'background: "rgba(36,214,210,0.08)"'],
  ['borderLeft: `3px solid ${T.purple}`', 'borderLeft: `3px solid var(--accent)`'],
  // ✦ AI 预测 徽标
  ['backgroundColor: "rgba(117,104,216,0.16)"', 'backgroundColor: "rgba(36,214,210,0.14)"'],
  ['border: "1px dashed rgba(156,141,240,0.75)"', 'border: "1px dashed rgba(36,214,210,0.65)"'],
  // 文字强调
  ['color: T.purple,', 'color: "var(--ai-deep)",'],
  ['backgroundColor: T.purple,', 'backgroundColor: "var(--ai-deep)",'],
  // 洞察 chip
  ['backgroundColor: "rgba(117,104,216,0.10)"', 'backgroundColor: "rgba(36,214,210,0.10)"'],
  ['border: "1px dashed rgba(156,141,240,0.55)"', 'border: "1px dashed rgba(36,214,210,0.50)"'],
  // 分类型进度条
  ['backgroundColor: "rgba(117,104,216,0.12)"', 'backgroundColor: "rgba(36,214,210,0.12)"'],
  ['"repeating-linear-gradient(135deg,#7568D8 0 4px,#9C8DF0 4px 8px)"', '"repeating-linear-gradient(135deg,#1FC7C2 0 4px,#8CE8E4 4px 8px)"'],
  ['boxShadow: "0 0 8px rgba(156,141,240,0.45)"', 'boxShadow: "0 0 8px rgba(36,214,210,0.45)"'],
  // 预置兵力建议容器
  ['backgroundColor: "rgba(117,104,216,0.06)"', 'backgroundColor: "rgba(36,214,210,0.06)"'],
  // 回放预测槽
  ['"repeating-linear-gradient(135deg,#7568D8 0 3px,#9C8DF0 3px 6px)"', '"repeating-linear-gradient(135deg,#1FC7C2 0 3px,#8CE8E4 3px 6px)"'],
  ['"repeating-linear-gradient(135deg,rgba(117,104,216,0.55) 0 3px,rgba(156,141,240,0.28) 3px 6px)"', '"repeating-linear-gradient(135deg,rgba(36,214,210,0.55) 0 3px,rgba(36,214,210,0.22) 3px 6px)"'],
  ['"1px dashed rgba(156,141,240,0.85)"', '"1px dashed rgba(36,214,210,0.85)"'],
  ['"0 0 10px rgba(156,141,240,0.65)"', '"0 0 10px rgba(36,214,210,0.60)"'],
];

for (const [a, b] of pairs) {
  const parts = s.split(a);
  n += parts.length - 1;
  s = parts.join(b);
}

// count 数字使用 T.purple 的写法（带 fontFamily 的内联对象）
s = s.split('color: T.purple,\n                fontFamily: T.mono,').join('color: "var(--ai-deep)",\n                fontFamily: T.mono,');

writeFileSync(f, s);
console.log('replaced:', n);
console.log('forecast purple left:', (s.slice(0, 14000).match(/117, ?104, ?216|156, ?141, ?240|#7568D8|#9C8DF0/g) || []).length);
