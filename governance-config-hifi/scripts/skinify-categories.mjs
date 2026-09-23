// 分类组件补 skin 形参并在调用处传值
import { readFileSync, writeFileSync } from 'node:fs';

const f = '/Users/cookieqi/Downloads/Untitled/src/modules/AIStatistics.tsx';
let src = readFileSync(f, 'utf8');
const SIG = ': { skin: "light" | "tech" })';

// 无参组件
for (const name of ['ProcessCategory', 'EfficiencyCategory', 'AICategory', 'QualityCategory']) {
  src = src.replace(`function ${name}() {`, `function ${name}({ skin }${SIG} {`);
}

// OverviewCategory / EventsCategory：解构加 skin + 类型加 skin
src = src.replace(
  `function OverviewCategory({
  groupBy,
  setGroupBy,
  availableLevels,
}: {
  groupBy: GroupByLevel
  setGroupBy: (v: GroupByLevel) => void
  availableLevels: GroupByLevel[]
}) {`,
  `function OverviewCategory({
  groupBy,
  setGroupBy,
  availableLevels,
  skin,
}: {
  groupBy: GroupByLevel
  setGroupBy: (v: GroupByLevel) => void
  availableLevels: GroupByLevel[]
  skin: "light" | "tech"
}) {`,
);

const eventsOld = src.match(/function EventsCategory\(\{([\s\S]*?)\}\) \{/);
if (eventsOld) {
  const body = eventsOld[1];
  const lines = body.split('\n');
  // 在解构最后加 skin，类型对象里加 skin
  const insertIdx = lines.findIndex((l) => l.trim() === '}: {');
  if (insertIdx > 0) {
    lines.splice(insertIdx, 0, '  skin,');
    const closeIdx = lines.findIndex((l, i) => i > insertIdx && l.trim() === '}) {');
    if (closeIdx > 0) {
      lines.splice(closeIdx, 0, '  skin: "light" | "tech"');
    }
    src = src.replace(eventsOld[0], `function EventsCategory({${lines.join('\n')}}) {`);
  }
}

// 调用处传 skin
src = src.replace('<ProcessCategory />', '<ProcessCategory skin={skin} />');
src = src.replace('<EfficiencyCategory />', '<EfficiencyCategory skin={skin} />');
src = src.replace('<QualityCategory />', '<QualityCategory skin={skin} />');
src = src.replace('<AICategory />', '<AICategory skin={skin} />');

writeFileSync(f, src);
console.log('done', src.includes('<ProcessCategory skin={skin} />'));
