// 一次性迁移：App.tsx 从「iframe 集成静态原型」切换为「治理配置原生模块」
// 1) 注入 import  2) main 内挂载原生模块  3) TopNav 在 config 下保持可见
// 4) 移除 gcMounted 预挂载 + 绝对定位覆盖层 + GovernanceConfigHiFi + 旧占位 GovernanceConfig
import fs from 'node:fs';

const FILE = 'src/App.tsx';
let s = fs.readFileSync(FILE, 'utf8');
const step = (name, fn) => {
  const before = s;
  s = fn(s);
  if (s === before) throw new Error('step no-op: ' + name);
  console.log('ok:', name, `(${before.length} → ${s.length})`);
};

step('import', (x) => x.replace(
  'import AIStatisticsModule from "./modules/AIStatistics"',
  'import AIStatisticsModule from "./modules/AIStatistics"\nimport GovernanceConfigNative from "./modules/gc/GovernanceConfigNative"',
));

// 1. 删除旧占位 GovernanceConfig + cfgModules 数据（从 type CfgGroup 到 HiFi 注释）
step('remove-old-governance-config', (x) => {
  const a = x.indexOf('type CfgGroup =');
  const b = x.indexOf('// ─── GovernanceConfig HiFi（29 页原型 · 产品集成）');
  if (a < 0 || b < 0 || b <= a) throw new Error('marker1');
  return x.slice(0, a) + x.slice(b);
});

// 2. 删除 GovernanceConfigHiFi + GC_HIFI_TAB_TARGETS（HiFi 注释 → TopNav 注释）
step('remove-hifi-iframe', (x) => {
  const a = x.indexOf('// ─── GovernanceConfig HiFi（29 页原型 · 产品集成）');
  const b = x.indexOf('// ─── TopNav');
  if (a < 0 || b < 0 || b <= a) throw new Error('marker2');
  return x.slice(0, a) + x.slice(b);
});

// 3. 删除 gcMounted 预挂载 state + effect
step('remove-gcmounted', (x) => {
  const a = x.indexOf('  // 治理配置 iframe 提前挂载');
  const b = x.indexOf('  const [presentationMode');
  if (a < 0 || b < 0 || b <= a) throw new Error('marker3');
  return x.slice(0, a) + x.slice(b);
});

// 4. TopNav 在 config 模块下也显示
step('topnav-always', (x) => x.replace(
  '{activeModule !== "config" && !presentationMode && (',
  '{!presentationMode && (',
));

// 5. main 内挂载原生模块
step('mount-native', (x) => {
  const wb = '        {activeModule === "workbench" && <AIWorkbench />}';
  if (!x.includes(wb)) throw new Error('marker5');
  return x.replace(wb, wb + '\n        {activeModule === "config" && <GovernanceConfigNative />}');
});

// 6. 删除绝对定位覆盖层
step('remove-overlay', (x) => {
  const a = x.indexOf('      {gcMounted && (');
  const endMark = '        </div>\n      )}';
  const b = x.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error('marker6');
  return x.slice(0, a) + x.slice(b + endMark.length);
});

fs.writeFileSync(FILE, s);
console.log('done:', s.length, 'chars');
