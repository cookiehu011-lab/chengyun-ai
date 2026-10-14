// 「空间与责任 · 草稿」网格编辑（space-edit-js）单元测试
// rev27 口径：表格首两列「网格名称」「网格编号」；新增两步式（① 所属街道 → ② 网格下拉（外部平台清单））；
// 编号按所选网格名称回显（清单内名称↔编号一一对应，清单外名称按序补号）；批量导入同口径。
// 覆盖：查询过滤 / 行编辑 / 空网格编辑 / 两步式新增 / 批量导入 / 删除 / 启停 / 页面结构回归
// 运行：node --test governance-config-hifi/tests/grid-edit.test.mjs
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDocument, createDispatch, El } from './mini-dom.mjs';

const PAGE = new URL('../pages/space-responsibility-draft.html', import.meta.url);
const LIVE = new URL('../pages/space-responsibility-live.html', import.meta.url);

function extractScript(html) {
  const open = '<script id="space-edit-js">';
  const a = html.indexOf(open);
  assert.ok(a >= 0, 'page must contain space-edit-js');
  const start = a + open.length;
  const end = html.indexOf('</script>', start);
  assert.ok(end > start, 'script must be closed');
  return html.slice(start, end);
}

function extractFooter(html) {
  const open = '<script id="gc-footer-js">';
  const a = html.indexOf(open);
  assert.ok(a >= 0, 'page must contain gc-footer-js');
  const start = a + open.length;
  const end = html.indexOf('</script>', start);
  assert.ok(end > start, 'footer script must be closed');
  return html.slice(start, end);
}

const ROWS = [
  { code: 'G-0418', name: '朝阳门南小街网格', street: '朝阳门街道', community: '某社区', owner: '刘洋', sup: '陈督', status: '启用' },
  { code: 'G-0419', name: '东花市大街网格', street: '东华门街道', community: '某社区', owner: '周琳', sup: '何静', status: '启用' },
  { code: 'G-0420', name: '建国门内大街网格', street: '建国门街道', community: '某社区', owner: '孙洁', sup: '马涛', status: '启用' },
  { code: 'G-0421', name: '金宝街北网格', street: '东华门街道', community: '某社区', owner: '', sup: '—', status: '待定责' },
];

function rowEl({ code, name, street, community, owner, sup, status }, mk) {
  // 与真实页面一致（rev27）：首两列「网格名称」「网格编号(data-code)」，后有来源列；
  // 原始行是裸 <tr>（无 data-grid-row），仅新增行携带该属性
  const tr = mk('tr');
  const td = (cls, text) => { const n = mk('td'); if (cls) n.className = cls; n.textContent = text; tr.appendChild(n); return n; };
  td('gc-grid-name', name);
  const tdC = td('gc-td-code', code);
  tdC.setAttribute('data-code', code);
  td('', street);
  td('', community);
  const tdO = td(owner ? 'gc-td-name' : 'gc-td-dash', owner || '—（空）');
  tdO.setAttribute('data-cell', 'owner'); tdO.setAttribute('data-grid', code);
  const tdS = td('', sup || '—');
  tdS.setAttribute('data-cell', 'sup'); tdS.setAttribute('data-grid', code);
  const tdSt = mk('td');
  const chip = mk('span');
  chip.className = status === '启用' ? 'gc-chip gc-chip--green' : 'gc-chip gc-chip--muted';
  chip.textContent = status;
  tdSt.appendChild(chip); tr.appendChild(tdSt);
  td('gc-td-code', '2026-09-08');
  td('', '平台同步');
  const tdA = mk('td'); tdA.className = 'gc-td-actions';
  const eb = mk('button');
  eb.setAttribute('data-gc-bind', ''); eb.setAttribute('data-grid', code);
  eb.setAttribute('data-owner', owner || ''); eb.setAttribute('data-sup', sup || '—');
  eb.textContent = '编辑'; tdA.appendChild(eb);
  const tb = mk('button');
  tb.setAttribute('data-gc-toggle', ''); tb.setAttribute('data-grid', code);
  tb.textContent = status === '启用' ? '停用' : '启用';
  tdA.appendChild(tb);
  const db = mk('button');
  db.setAttribute('data-gc-del', ''); db.setAttribute('data-grid', code);
  db.textContent = '删除'; tdA.appendChild(db);
  tr.appendChild(tdA);
  return tr;
}

let ctx;
beforeEach(() => {
  const doc = createDocument();
  const click = createDispatch(doc);
  const mk = (tag) => doc.createElement(tag);
  const body = doc.body;

  // 以下按真实页面 DOM 顺序构建；space-edit-js 位于全部元素之后（页面 </body> 前）
  const toolbar = mk('div'); toolbar.className = 'gc-toolbar';
  const input = mk('input'); input.setAttribute('id', 'gc-q-grid'); toolbar.appendChild(input);
  const searchBtn = mk('button'); searchBtn.setAttribute('data-gc-search', ''); toolbar.appendChild(searchBtn);
  const importBtn = mk('button'); importBtn.setAttribute('data-gc-grid-import', ''); importBtn.textContent = '⇪ 批量导入'; toolbar.appendChild(importBtn);
  const newBtn = mk('button'); newBtn.setAttribute('data-gc-grid-new', ''); newBtn.textContent = '＋ 新增网格'; toolbar.appendChild(newBtn);
  body.appendChild(toolbar);

  const scroll = mk('div'); scroll.className = 'gc-table-scroll';
  const table = mk('table'); table.className = 'gc-table gc-table--grid';
  const tbody = mk('tbody');
  for (const r of ROWS) tbody.appendChild(rowEl(r, mk));
  table.appendChild(tbody); scroll.appendChild(table); body.appendChild(scroll);

  const scrim = mk('div'); scrim.setAttribute('data-gc-scrim', ''); scrim.hidden = true; body.appendChild(scrim);

  const bind = mk('aside'); bind.setAttribute('data-gc-drawer', 'bind'); bind.hidden = true;
  const bindTitle = mk('h2'); bindTitle.setAttribute('id', 'gc-bind-title'); bind.appendChild(bindTitle);
  const bindClose = mk('button'); bindClose.setAttribute('data-gc-close', ''); bind.appendChild(bindClose);
  for (const [id, tag] of [['gc-b-grid', 'input'], ['gc-b-owner', 'select'], ['gc-b-sup', 'select'], ['gc-b-reason', 'input']]) {
    const f = mk(tag); f.setAttribute('id', id); bind.appendChild(f);
  }
  const bindSave = mk('button'); bindSave.setAttribute('data-gc-bind-save', ''); bind.appendChild(bindSave);
  body.appendChild(bind);

  // 两步式新增抽屉：① 街道在 step2 容器外，② 网格下拉/编号回显/社区/原因在容器内（is-off 置灰）
  const create = mk('aside'); create.setAttribute('data-gc-drawer', 'create'); create.hidden = true;
  const createTitle = mk('h2'); createTitle.setAttribute('id', 'gc-create-title'); create.appendChild(createTitle);
  const createClose = mk('button'); createClose.setAttribute('data-gc-close', ''); create.appendChild(createClose);
  const streetSel = mk('select'); streetSel.setAttribute('id', 'gc-n-street'); create.appendChild(streetSel);
  const step2 = mk('div'); step2.setAttribute('id', 'gc-n-step2'); step2.classList.add('gc-n-step2'); step2.classList.add('is-off'); create.appendChild(step2);
  for (const [id, tag] of [['gc-n-name', 'select'], ['gc-n-code', 'input'], ['gc-n-community', 'select'], ['gc-n-reason', 'input']]) {
    const f = mk(tag); f.setAttribute('id', id); step2.appendChild(f);
  }
  const createSave = mk('button'); createSave.setAttribute('data-gc-create-save', ''); create.appendChild(createSave);
  body.appendChild(create);

  // 批量导入抽屉：textarea + 预览 + 变更原因
  const imp = mk('aside'); imp.setAttribute('data-gc-drawer', 'import'); imp.hidden = true;
  const impClose = mk('button'); impClose.setAttribute('data-gc-close', ''); imp.appendChild(impClose);
  const ta = mk('textarea'); ta.setAttribute('id', 'gc-i-text'); imp.appendChild(ta);
  const preview = mk('div'); preview.setAttribute('data-gc-import-preview', ''); preview.hidden = true; imp.appendChild(preview);
  const iReason = mk('input'); iReason.setAttribute('id', 'gc-i-reason'); imp.appendChild(iReason);
  const impSave = mk('button'); impSave.setAttribute('data-gc-import-save', ''); imp.appendChild(impSave);
  body.appendChild(imp);

  // 脚本在真实页面中位于全部 DOM 之后执行 —— 夹具保持同一顺序
  let tid = 0;
  new Function('document', 'setTimeout', 'clearTimeout', extractScript(fs.readFileSync(PAGE, 'utf8')))(
    doc, () => ++tid, () => {},
  );
  // gc-footer-js 晚于 space-edit-js（真实页面顺序）：状态自动升级 + 页脚阻断复检
  new Function('document', 'setTimeout', 'clearTimeout', extractFooter(fs.readFileSync(PAGE, 'utf8')))(
    doc, () => ++tid, () => {},
  );

  ctx = {
    doc, click, input, searchBtn, newBtn, importBtn, scrim, bind, create, imp,
    tbody, step2, streetSel, ta, preview, iReason,
    rows: () => [...tbody.children],
    byCode: (code) => tbody.children.find((tr) => {
      const td = tr.querySelector('td[data-code]');
      return td && td.textContent.trim() === code;
    }) || null,
    codeOf: (tr) => { const td = tr.querySelector('td[data-code]'); return td ? td.textContent.trim() : ''; },
    bindBtn: (code) => doc.querySelectorAll('[data-gc-bind]').find((b) => ctx.codeOf(b.closest('tr')) === code),
    delBtn: (code) => doc.querySelectorAll('[data-gc-del]').find((b) => ctx.codeOf(b.closest('tr')) === code),
    toggleBtn: (code) => doc.querySelectorAll('[data-gc-toggle]').find((b) => ctx.codeOf(b.closest('tr')) === code),
    cell: (code, field) => doc.querySelector(`td[data-cell="${field}"][data-grid="${code}"]`),
    field: (id) => doc.getElementById(id),
    set: (id, v) => { doc.getElementById(id).value = v; },
  };
});

describe('网格查询', () => {
  test('输入关键词即时过滤，清空后恢复全部', () => {
    ctx.set('gc-q-grid', '东华门');
    ctx.click(ctx.input, 'input');
    assert.equal(ctx.byCode('G-0419').hidden, false);
    assert.equal(ctx.byCode('G-0421').hidden, false, 'G-0421 同属东华门街道，应命中');
    assert.equal(ctx.byCode('G-0418').hidden, true);

    ctx.set('gc-q-grid', '   ');
    ctx.click(ctx.input, 'input');
    for (const tr of ctx.rows()) assert.equal(tr.hidden, false);
  });

  test('按网格名称同样可查', () => {
    ctx.set('gc-q-grid', '朝阳门南小街');
    ctx.click(ctx.input, 'input');
    assert.equal(ctx.byCode('G-0418').hidden, false);
    assert.equal(ctx.byCode('G-0419').hidden, true);
  });

  test('点击「查询」按钮同样生效（大小写不敏感）', () => {
    ctx.set('gc-q-grid', 'g-0420');
    ctx.click(ctx.searchBtn, 'click');
    assert.equal(ctx.byCode('G-0420').hidden, false);
    assert.equal(ctx.byCode('G-0418').hidden, true);
  });

  test('无匹配时全部隐藏（空态）', () => {
    ctx.set('gc-q-grid', '不存在的网格');
    ctx.click(ctx.input, 'input');
    for (const tr of ctx.rows()) assert.equal(tr.hidden, true);
  });
});

describe('网格行编辑', () => {
  test('点「编辑」打开抽屉并预填当前值，标题统一为「编辑」', () => {
    ctx.click(ctx.bindBtn('G-0418'), 'click');
    assert.equal(ctx.bind.hidden, false);
    assert.equal(ctx.scrim.hidden, false);
    assert.equal(ctx.field('gc-bind-title').textContent, '网格 G-0418 · 编辑');
    assert.equal(ctx.field('gc-b-grid').value, 'G-0418');
    assert.equal(ctx.field('gc-b-owner').value, '刘洋');
    assert.equal(ctx.field('gc-b-sup').value, '陈督');
    assert.equal(ctx.field('gc-b-reason').value, '');
  });

  test('变更原因为必填：为空时聚焦该字段且不改数据、抽屉保持打开', () => {
    ctx.click(ctx.bindBtn('G-0418'), 'click');
    ctx.set('gc-b-owner', '张强');
    ctx.set('gc-b-reason', '   ');
    ctx.click(ctx.doc.querySelector('[data-gc-bind-save]'), 'click');
    assert.equal(ctx.cell('G-0418', 'owner').textContent, '刘洋');
    assert.equal(ctx.bind.hidden, false, '抽屉应保持打开');
  });

  test('填写原因后保存：单元格即时更新、抽屉关闭，无任何弹层', () => {
    ctx.click(ctx.bindBtn('G-0418'), 'click');
    ctx.set('gc-b-owner', '张强');
    ctx.set('gc-b-sup', '何静');
    ctx.set('gc-b-reason', '主责调岗');
    ctx.click(ctx.doc.querySelector('[data-gc-bind-save]'), 'click');
    assert.equal(ctx.cell('G-0418', 'owner').textContent, '张强');
    assert.ok(ctx.cell('G-0418', 'owner').classList.contains('gc-td-name'));
    assert.equal(ctx.cell('G-0418', 'sup').textContent, '何静');
    assert.equal(ctx.bind.hidden, true);
    assert.equal(ctx.scrim.hidden, true);
  });

  test('清空主责：单元格显示空态占位', () => {
    ctx.click(ctx.bindBtn('G-0419'), 'click');
    ctx.set('gc-b-owner', '');
    ctx.set('gc-b-sup', '');
    ctx.set('gc-b-reason', '换绑测试');
    ctx.click(ctx.doc.querySelector('[data-gc-bind-save]'), 'click');
    assert.equal(ctx.cell('G-0419', 'owner').textContent, '—（空）');
    assert.ok(ctx.cell('G-0419', 'owner').classList.contains('gc-td-dash'));
    assert.equal(ctx.cell('G-0419', 'sup').textContent, '—');
  });
});

describe('空网格编辑', () => {
  test('G-0421 同样以「编辑」打开，保存后写入主责与监督', () => {
    ctx.click(ctx.bindBtn('G-0421'), 'click');
    assert.equal(ctx.field('gc-bind-title').textContent, '网格 G-0421 · 编辑');
    ctx.set('gc-b-owner', '孙洁');
    ctx.set('gc-b-sup', '马涛');
    ctx.set('gc-b-reason', '为空网格指定主责');
    ctx.click(ctx.doc.querySelector('[data-gc-bind-save]'), 'click');
    assert.equal(ctx.cell('G-0421', 'owner').textContent, '孙洁');
    assert.equal(ctx.cell('G-0421', 'sup').textContent, '马涛');
  });
});

describe('抽屉互斥与关闭', () => {
  test('打开新增抽屉会关闭编辑抽屉；② 区初始置灰；点遮罩全部关闭', () => {
    ctx.click(ctx.bindBtn('G-0418'), 'click');
    ctx.click(ctx.newBtn, 'click');
    assert.equal(ctx.create.hidden, false);
    assert.equal(ctx.bind.hidden, true);
    assert.equal(ctx.streetSel.value, '');
    assert.ok(ctx.step2.classList.contains('is-off'), '未选街道时 ② 区应置灰');

    ctx.click(ctx.scrim, 'click');
    assert.equal(ctx.create.hidden, true);
    assert.equal(ctx.scrim.hidden, true);
  });

  test('打开批量导入抽屉同样互斥，关闭后清空', () => {
    ctx.click(ctx.bindBtn('G-0418'), 'click');
    ctx.click(ctx.importBtn, 'click');
    assert.equal(ctx.imp.hidden, false);
    assert.equal(ctx.bind.hidden, true);
    assert.equal(ctx.ta.value, '');
    assert.equal(ctx.preview.hidden, true);

    ctx.click(ctx.scrim, 'click');
    assert.equal(ctx.imp.hidden, true);
  });
});

describe('网格新增（两步式：① 街道 → ② 网格下拉 + 编号回显）', () => {
  function pickStreet(street) {
    ctx.streetSel.value = street;
    ctx.click(ctx.streetSel, 'change');
  }
  const nameSel = () => ctx.field('gc-n-name');
  const nameOpts = () => nameSel().children.map((o) => o.textContent).filter((t) => t !== '请选择网格…');

  test('未选街道直接保存：不新增行、抽屉保持打开、聚焦 ① 街道', () => {
    ctx.click(ctx.newBtn, 'click');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.create.hidden, false, '抽屉应保持打开');
    assert.equal(ctx.doc.activeElement, ctx.streetSel, '应聚焦 ① 所属街道');
  });

  test('选街道后 ② 区解禁：网格下拉来自清单（排除已创建），编号不预生成（等选网格回显）', () => {
    ctx.click(ctx.newBtn, 'click');
    pickStreet('朝阳门街道');
    assert.ok(!ctx.step2.classList.contains('is-off'), '选择街道后 ② 区应解禁');
    assert.ok(nameOpts().includes('朝内大街北网格'), '清单中未创建的「朝内大街北网格」应出现');
    assert.ok(!nameOpts().includes('朝阳门南小街网格'), '清单中已创建的网格不应再出现');
    assert.ok(nameOpts().includes('东花市大街网格'), '字典在册但该街道未创建的网格可选');
    assert.equal(ctx.field('gc-n-code').value, '', '编号不应自动生成，等选网格后回显');
  });

  test('选择网格后编号按名称回显（清单内名称↔编号一一对应）', () => {
    ctx.click(ctx.newBtn, 'click');
    pickStreet('朝阳门街道');
    nameSel().value = '朝内大街北网格';
    ctx.click(nameSel(), 'change');
    assert.equal(ctx.field('gc-n-code').value, 'G-0401', '编号应回显清单编号 G-0401');

    nameSel().value = '';
    ctx.click(nameSel(), 'change');
    assert.equal(ctx.field('gc-n-code').value, '', '清空选择后编号应清空');
  });

  test('切换街道：网格下拉重置、编号清空', () => {
    ctx.click(ctx.newBtn, 'click');
    pickStreet('朝阳门街道');
    nameSel().value = '朝内大街北网格';
    ctx.click(nameSel(), 'change');
    assert.equal(ctx.field('gc-n-code').value, 'G-0401');

    pickStreet('东华门街道');
    assert.equal(nameSel().value, '', '切换街道后网格选择应重置');
    assert.equal(ctx.field('gc-n-code').value, '', '切换街道后编号应清空');
    assert.deepEqual(nameOpts(), ['东华门大街网格', '王府井西街网格'], '东华门清单应排除已创建的金宝街北网格');
  });

  test('网格必选：未选网格保存时聚焦网格下拉、不新增行', () => {
    ctx.click(ctx.newBtn, 'click');
    pickStreet('朝阳门街道');
    ctx.set('gc-n-reason', '演示');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.create.hidden, false);
    assert.equal(ctx.doc.activeElement, nameSel());
  });

  test('变更原因必填：为空时聚焦原因、不新增行', () => {
    ctx.click(ctx.newBtn, 'click');
    pickStreet('朝阳门街道');
    nameSel().value = '朝内大街北网格';
    ctx.click(nameSel(), 'change');
    ctx.set('gc-n-reason', ' ');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.create.hidden, false);
    assert.equal(ctx.doc.activeElement, ctx.field('gc-n-reason'));
  });

  test('合法新增：追加一行（名称/编号两列、待定责、无主责、手动来源），可立即再编辑', () => {
    ctx.click(ctx.newBtn, 'click');
    pickStreet('朝阳门街道');
    nameSel().value = '朝内大街北网格';
    ctx.click(nameSel(), 'change');
    ctx.set('gc-n-community', '某社区');
    ctx.set('gc-n-reason', '演示：清单下拉创建');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');

    assert.equal(ctx.rows().length, 5);
    assert.equal(ctx.create.hidden, true);
    assert.equal(ctx.scrim.hidden, true);

    const tr = ctx.byCode('G-0401');
    assert.ok(tr, '新行应存在且编号为清单回显值 G-0401');
    assert.equal(tr.querySelector('td.gc-grid-name').textContent, '朝内大街北网格');
    assert.equal(tr.children[2].textContent, '朝阳门街道');
    assert.equal(tr.children[3].textContent, '某社区');
    assert.equal(ctx.cell('G-0401', 'owner').textContent, '—（空）', '新建默认无主责');
    const chip = tr.querySelector('.gc-chip');
    assert.equal(chip.textContent, '待定责', '新建默认待定责');
    assert.equal(tr.children[8].textContent, '手动', '来源应为手动');

    ctx.click(ctx.bindBtn('G-0401'), 'click');
    assert.equal(ctx.field('gc-bind-title').textContent, '网格 G-0401 · 编辑');
  });
});

describe('批量导入（编号按清单回显，清单外按序补号）', () => {
  function input(text) {
    ctx.ta.value = text;
    ctx.click(ctx.ta, 'input');
  }

  test('实时预览：可导入 / 跳过与原因（街道不存在或已停用、同街道同名）', () => {
    ctx.click(ctx.importBtn, 'click');
    input([
      '朝阳门街道,新网格A',
      '不存在的街道,网格X',
      '朝阳门街道,朝阳门南小街网格',
    ].join('\n'));

    assert.equal(ctx.preview.hidden, false);
    const text = ctx.preview.textContent;
    assert.ok(text.includes('可导入 1 个'), '应有 1 行可导入');
    assert.ok(text.includes('跳过 2 行'), '应有 2 行跳过');
    assert.ok(text.includes('街道不存在或已停用'));
    assert.ok(text.includes('该街道下已有同名网格'));
    assert.ok(text.includes('朝阳门街道 → 新网格A'));
  });

  test('顿号与 Tab 分隔同样可解析；空行忽略', () => {
    ctx.click(ctx.importBtn, 'click');
    input('朝阳门街道、Tab网格\n\n东华门街道\t金宝街西网格');
    const text = ctx.preview.textContent;
    assert.ok(text.includes('可导入 2 个'));
    assert.ok(!text.includes('跳过'), '无跳过行');
  });

  test('确认导入：清单内名称回显清单编号，清单外按序自动补号', () => {
    ctx.click(ctx.importBtn, 'click');
    input('朝阳门街道,朝内大街北网格\n朝阳门街道,清单外新网格');
    ctx.set('gc-i-reason', '演示：批量导入');
    ctx.click(ctx.doc.querySelector('[data-gc-import-save]'), 'click');

    assert.equal(ctx.rows().length, 6);
    assert.equal(ctx.imp.hidden, true);

    const inCatalog = ctx.byCode('G-0401');
    assert.ok(inCatalog, '清单内名称应回显清单编号 G-0401');
    assert.equal(inCatalog.querySelector('td.gc-grid-name').textContent, '朝内大街北网格');

    const outCatalog = ctx.rows().find((tr) => tr.querySelector('td.gc-grid-name')?.textContent === '清单外新网格');
    assert.ok(outCatalog, '清单外名称应成功导入');
    assert.equal(ctx.codeOf(outCatalog), 'G-0422', '清单外名称应按现有最大编号 G-0421 +1 补号');
    assert.equal(outCatalog.querySelector('.gc-chip').textContent, '待定责');
    assert.equal(outCatalog.children[8].textContent, '手动');
  });

  test('无可导入行时确认导入：聚焦数据框、不新增行', () => {
    ctx.click(ctx.importBtn, 'click');
    input('不存在的街道,网格X');
    ctx.set('gc-i-reason', '演示');
    ctx.click(ctx.doc.querySelector('[data-gc-import-save]'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.imp.hidden, false, '抽屉应保持打开');
    assert.equal(ctx.doc.activeElement, ctx.ta);
  });

  test('变更原因必填：为空时聚焦原因、不导入', () => {
    ctx.click(ctx.importBtn, 'click');
    input('朝阳门街道,导入网格A');
    ctx.set('gc-i-reason', ' ');
    ctx.click(ctx.doc.querySelector('[data-gc-import-save]'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.imp.hidden, false);
    assert.equal(ctx.doc.activeElement, ctx.field('gc-i-reason'));
  });

  test('导入行可立即再编辑（编辑入口按行内编号定位）', () => {
    ctx.click(ctx.importBtn, 'click');
    input('朝阳门街道,朝内大街北网格');
    ctx.set('gc-i-reason', '演示');
    ctx.click(ctx.doc.querySelector('[data-gc-import-save]'), 'click');

    ctx.click(ctx.bindBtn('G-0401'), 'click');
    assert.equal(ctx.field('gc-bind-title').textContent, '网格 G-0401 · 编辑');
  });
});

describe('网格删除', () => {
  test('点「删除」移除对应行（document 级委托），其余行不受影响', () => {
    ctx.click(ctx.delBtn('G-0419'), 'click');
    assert.equal(ctx.rows().length, 3);
    assert.equal(ctx.byCode('G-0419'), null);
    assert.ok(ctx.byCode('G-0418'));
    assert.ok(ctx.byCode('G-0421'));
  });

  test('新增行的删除按钮同样生效', () => {
    ctx.click(ctx.newBtn, 'click');
    pickStreetForDel('朝阳门街道');
    ctx.set('gc-n-reason', '删除测试');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    assert.equal(ctx.rows().length, 5);

    ctx.click(ctx.delBtn('G-0401'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.byCode('G-0401'), null);
  });

  function pickStreetForDel(street) {
    ctx.streetSel.value = street;
    ctx.click(ctx.streetSel, 'change');
    const sel = ctx.field('gc-n-name');
    sel.value = '朝内大街北网格';
    ctx.click(sel, 'change');
  }
});

describe('网格启停', () => {
  test('启用行点「停用」：chip 变灰显示停用，按钮变「启用」', () => {
    ctx.click(ctx.toggleBtn('G-0418'), 'click');
    const chip = ctx.byCode('G-0418').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--off'));
    assert.equal(chip.textContent, '停用');
    assert.equal(ctx.toggleBtn('G-0418').textContent, '启用');
  });

  test('停用行再点「启用」：恢复启用态，按钮变回「停用」', () => {
    ctx.click(ctx.toggleBtn('G-0418'), 'click');
    ctx.click(ctx.toggleBtn('G-0418'), 'click');
    const chip = ctx.byCode('G-0418').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--green'));
    assert.equal(chip.textContent, '启用');
    assert.equal(ctx.toggleBtn('G-0418').textContent, '停用');
  });

  test('待定责行（无主责）点「启用」：状态不变，按钮仍为「启用」', () => {
    ctx.click(ctx.toggleBtn('G-0421'), 'click');
    const chip = ctx.byCode('G-0421').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--muted'));
    assert.equal(chip.textContent, '待定责');
    assert.equal(ctx.toggleBtn('G-0421').textContent, '启用');
  });

  test('待定责行补主责后自动启用，启停按钮同步为「停用」', () => {
    ctx.click(ctx.bindBtn('G-0421'), 'click');
    ctx.set('gc-b-owner', '孙洁');
    ctx.set('gc-b-sup', '马涛');
    ctx.set('gc-b-reason', '为空网格指定主责');
    ctx.click(ctx.doc.querySelector('[data-gc-bind-save]'), 'click');
    const chip = ctx.byCode('G-0421').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--green'));
    assert.equal(chip.textContent, '启用');
    assert.equal(ctx.toggleBtn('G-0421').textContent, '停用');
  });

  test('新增行（无主责）保持待定责，启停按钮为「启用」', () => {
    ctx.click(ctx.newBtn, 'click');
    ctx.streetSel.value = '朝阳门街道';
    ctx.click(ctx.streetSel, 'change');
    const sel = ctx.field('gc-n-name');
    sel.value = '朝内大街北网格';
    ctx.click(sel, 'change');
    ctx.set('gc-n-reason', '启停测试');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');

    const tb = ctx.toggleBtn('G-0401');
    assert.ok(tb, '新行应有启停按钮');
    const chip = ctx.byCode('G-0401').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--muted'));
    assert.equal(chip.textContent, '待定责');
    assert.equal(tb.textContent, '启用');
  });
});

describe('页面结构回归（读取真实页面 HTML）', () => {
  const html = fs.readFileSync(PAGE, 'utf8');

  test('space-edit-js 必须位于新增/导入抽屉之后（防止脚本早执行丢失监听）', () => {
    const s = html.indexOf('<script id="space-edit-js">');
    const d = html.indexOf('data-gc-drawer="create"');
    const i = html.indexOf('data-gc-drawer="import"');
    assert.ok(s > d, `script@${s} 应晚于 create-drawer@${d}`);
    assert.ok(s > i, `script@${s} 应晚于 import-drawer@${i}`);
  });

  test('rev27 清单口径：表格首两列「网格名称」「网格编号」、② 网格下拉、编号只读回显', () => {
    assert.ok(html.includes('<th>网格名称</th>'), '表头应有「网格名称」');
    assert.ok(html.includes('<th>网格编号</th>'), '表头应有「网格编号」');
    assert.ok(!html.includes('<th>网格</th>'), '不应再是合并的「网格」列');
    assert.ok(html.includes('② 网格（下拉选择，来自外部平台网格清单；清单中已创建的不再出现）'));
    assert.ok(html.includes('id="gc-n-code" placeholder="选择网格后回显编号，如 G-0401" readonly'), '编号应只读回显');
    assert.ok(html.includes('GRID_CATALOG'), '网格清单字典应存在');
    assert.ok(html.includes('朝内大街北网格') && html.includes('G-0401'), '清单演示数据应存在');
    assert.ok(html.includes('td[data-code]'), '编号列应携带 data-code 定位属性');
    assert.ok(!html.includes('gc-td-sub'), 'rev26 的首列小字编码结构应已移除');
  });

  test('rev26 保留口径：① 所属街道 → ② 区置灰、批量导入抽屉与 URL 参数', () => {
    assert.ok(html.includes('① 所属街道（必选，启用中的街道；含手动创建的街道）'));
    assert.ok(html.includes('gc-n-step2'), '两步式 ② 区容器应存在');
    assert.ok(html.includes('data-gc-grid-import'), '工具栏应有批量导入按钮');
    assert.ok(html.includes('data-gc-drawer="import"'), '批量导入抽屉应存在');
    assert.ok(html.includes('data-gc-import-save'));
    assert.ok(html.includes('街道名称,网格名称'), '导入格式说明');
    assert.ok(html.includes("qs.get('import')"), '草稿页应支持 ?import=1 自动开抽屉');
  });

  test('操作统一为「编辑」，无换绑/定责操作文案，无 toast 弹层', () => {
    assert.ok(!html.includes('换绑'), '不应再出现「换绑」');
    assert.ok(!html.includes('「定责'), '不应再出现「定责」操作入口');
    assert.ok(!html.includes('编辑 / 定责'));
    assert.ok(!html.includes('· 定责'));
    assert.ok(!html.includes('gc-toast'), '不应有 toast 弹层');
  });

  test('草稿页固定句保留：一个事件同一时刻只对应一个网格责任人。', () => {
    assert.ok(html.includes('一个事件同一时刻只对应一个网格责任人。'));
  });

  test('rev15 交互口径：生效版行编辑/新增带上下文跳转（?edit=/ ?create=1 / ?import=1）', () => {
    const live = fs.readFileSync(LIVE, 'utf8');
    for (const code of ['G-0418', 'G-0417', 'G-0419', 'G-0421']) {
      assert.ok(live.includes(`space-responsibility-draft.html?edit=${code}`), `live 编辑应带 ${code} 参数`);
    }
    assert.ok(live.includes('space-responsibility-draft.html?create=1'), 'live 新增网格应带 create 参数');
    assert.ok(live.includes('space-responsibility-draft.html?import=1'), 'live 批量导入应带 import 参数');
    assert.ok(html.includes("qs.get('edit')") && html.includes("qs.get('create')"), '草稿页应支持 URL 参数自动开抽屉');
  });

  test('rev15 文案口径：四层冗余说明已删、预置草稿已复位', () => {
    assert.ok(!html.includes('改动将先写入草稿'), '蓝色横幅应删除');
    assert.ok(!html.includes('编辑中：网格主责与协同监督'), '编辑工作台卡应删除');
    assert.ok(!html.includes('草稿编辑中：直接编辑'), '卡片角标应删除');
    assert.ok(!html.includes('发布请走「发布前预览」'), '页脚说明文字应换成 CTA');
    assert.ok(html.includes('data-dom-id="cta-go-preview"'), '页脚应有去发布前预览 CTA');
    assert.ok(!html.includes('待发布'), '不应预置待发布状态（P36 差异表=3 行）');
    assert.ok(html.includes('data-grid="G-0421" data-orig="—（空）">—（空）<'), 'G-0421 应与生效版一致为空');
    const live = fs.readFileSync(LIVE, 'utf8');
    assert.ok(!live.includes('无未发布草稿'), '生效版绿色横幅应删除');
  });

  test('rev24 启停口径：行级启停按钮、一致性角标与页脚豁免', () => {
    assert.ok(html.includes('data-gc-toggle'), '应存在行级启停按钮');
    assert.equal((html.match(/data-gc-toggle data-grid="G-\d{4}">/g) || []).length, 4, '四行静态网格都应有启停按钮');
    assert.ok(html.includes('草稿编辑中：新增先选街道再命名，支持批量导入；可编辑、启停、删除'), '卡头应有 rev26 口径角标');
    assert.ok(html.includes('停用网格不参与派发，不阻断'), '页脚应豁免显式停用行');
  });

  test('live 页：网格名称/编号两列、行操作均为「编辑」、固定句与匹配预览保留', () => {
    const live = fs.readFileSync(LIVE, 'utf8');
    assert.equal((live.match(/<td class="gc-grid-name">/g) || []).length, 5, 'live 五行都应有网格名称');
    assert.equal((live.match(/<td class="gc-td-code" data-code="G-\d+">/g) || []).length, 5, 'live 五行都应有网格编号');
    assert.ok(live.includes('编号随名称回显'), 'live 卡头应说明编号回显口径');
    assert.ok(!live.includes('>定责<'), 'live 行按钮不应再有「定责」');
    assert.ok(!live.includes('编辑 / 定责'));
    assert.ok(live.includes('一个事件同一时刻只对应一个网格责任人。'));
    assert.ok(live.includes('空间匹配失败不能直接立案派发，也不等于不予立案。'));
    assert.ok(live.includes('space-match-success.html'));
  });
});
