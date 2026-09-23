// 给 AIStatistics 内 22 处 Echarts* 调用点插入 skin={skin}，并加组件 skin prop
import { readFileSync, writeFileSync } from 'node:fs';

const f = '/Users/cookieqi/Downloads/Untitled/src/modules/AIStatistics.tsx';
let src = readFileSync(f, 'utf8');

// 1) 组件签名加 skin prop
src = src.replace(
  'export default function AIStatistics() {',
  'export default function AIStatistics({ skin }: { skin: "light" | "tech" }) {',
);

// 2) 每个多行开标签 <EchartsXxx\n → <EchartsXxx skin={skin}\n
src = src.replace(/<Echarts(Line|Bar|Rank|Pie|Funnel)\n/g, '<Echarts$1 skin={skin}\n');

// 3) 单行形态 <EchartsPie data= → <EchartsPie skin={skin} data=
src = src.replace(/<EchartsPie data=/g, '<EchartsPie skin={skin} data=');

// 4) 两处 var 拼接 boxShadow → 固定 rgba（CSS 不支持 var+hex 透明度拼接）
src = src.split('boxShadow: `0 2px 8px ${C.primary}40`').join('boxShadow: "0 2px 8px rgba(91,141,255,0.30)"');
src = src.split('boxShadow: `0 2px 10px ${C.primary}50`').join('boxShadow: "0 2px 10px rgba(91,141,255,0.30)"');

writeFileSync(f, src);
const n = (src.match(/skin=\{skin\}/g) || []).length;
console.log('skin props inserted:', n);
console.log('shadow fixed:', !src.includes('${C.primary}40') && !src.includes('${C.primary}50'));
