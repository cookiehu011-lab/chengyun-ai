// 从静态原型抽取结果生成 React 原生版数据文件（一次性迁移工具）
// 输入: scripts/gc-native-extract.json  输出: ../src/modules/gc/cards.generated.ts
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('scripts/gc-native-extract.json');
const OUT = path.resolve('../src/modules/gc/cards.generated.ts');

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// page → 模块键
const PAGE_KEY = {
  'org-permission-draft': 'org',
  'event-standard-draft': 'eventstd',
  'lifecycle-draft': 'lifecycle',
  'sla-matrix-draft': 'sla',
  'dispatch-claim-draft': 'dispatch',
  'dedup-recurrence-draft': 'dedup',
  'metric-caliber-draft': 'metric',
};

const out = {};
const warns = [];
for (const [page, key] of Object.entries(PAGE_KEY)) {
  const cards = data.pages[page]?.cards || [];
  out[key] = cards.map((c) => {
    // 行单元格去掉最后一列（操作）；过滤引擎空模板行
    const rows = c.rows.map((r) => r.slice(0, -1)).filter((r) => r.length > 0 && r.some((c2) => c2 && c2.trim() && c2.trim() !== '—' || /[\u4e00-\u9fa5A-Za-z0-9]/.test(c2 || '')));
    const valueCols = c.cols.slice(0, -2); // 去掉 状态/操作
    if (c.fields.length && c.fields.length !== valueCols.length) {
      warns.push(`${key}/${c.id}: fields ${c.fields.length} vs valueCols ${valueCols.length} (${valueCols.join('|')})`);
    }
    // 列数一致性
    for (const r of rows) {
      if (r.length !== c.cols.length - 1) warns.push(`${key}/${c.id}: row cell ${r.length} != cols-1 ${c.cols.length - 1} :: ${r[0]}`);
    }
    return { id: c.id, title: c.title, note: c.note, fields: c.fields, cols: c.cols, rows };
  });
}

const banner = `// ⚠ 本文件由 governance-config-hifi/scripts/gen-native-cards.mjs 生成，请勿手改。
// 数据源：治理配置静态原型页（rev23/rev24 后版本），字段与行数据 1:1 移植。
`;

const body = banner + 'export const CARDS: Record<string, GeneratedCard[]> = ' + JSON.stringify(out, null, 1) + '\n';

const types = `
export interface GeneratedField {
  k: string
  label: string
  kind?: string
  type?: "text" | "select" | "textarea"
  options?: string[]
  def?: string
  required?: boolean
  ph?: string
  full?: boolean
}

export interface GeneratedCard {
  id: string
  title: string
  note: string
  fields: GeneratedField[]
  cols: string[]
  rows: string[][]
}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body + types);
console.log('written:', OUT, fs.statSync(OUT).size, 'bytes');
console.log(warns.length ? 'WARNINGS:\n' + warns.join('\n') : 'no alignment warnings');
