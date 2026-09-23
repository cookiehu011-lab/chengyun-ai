// 「空间与责任 · 草稿」网格编辑（space-edit-js）单元测试
// 覆盖：查询过滤 / 行编辑 / 空网格编辑 / 新增（校验 + 查重）/ 删除 / 启停 / 页面结构回归
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
  { code: 'G-0418', street: '朝阳门街道', community: '某社区', owner: '刘洋', sup: '陈督', status: '启用' },
  { code: 'G-0419', street: '东华门街道', community: '某社区', owner: '周琳', sup: '何静', status: '启用' },
  { code: 'G-0420', street: '建国门街道', community: '某社区', owner: '孙洁', sup: '马涛', status: '启用' },
  { code: 'G-0421', street: '朝阳门街道', community: '某社区', owner: '', sup: '—', status: '待定责' },
];

function rowEl({ code, street, community, owner, sup, status }, mk) {
  // 与真实页面一致：原始行是裸 <tr>（无 data-grid-row），仅新增行携带该属性
  const tr = mk('tr');
  const td = (cls, text) => { const n = mk('td'); if (cls) n.className = cls; n.textContent = text; tr.appendChild(n); return n; };
  td('gc-td-code', code);
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

  const create = mk('aside'); create.setAttribute('data-gc-drawer', 'create'); create.hidden = true;
  const createTitle = mk('h2'); createTitle.setAttribute('id', 'gc-create-title'); create.appendChild(createTitle);
  const createClose = mk('button'); createClose.setAttribute('data-gc-close', ''); create.appendChild(createClose);
  for (const [id, tag] of [['gc-n-code', 'input'], ['gc-n-street', 'select'], ['gc-n-community', 'input'], ['gc-n-owner', 'select'], ['gc-n-sup', 'select'], ['gc-n-status', 'select']]) {
    const f = mk(tag); f.setAttribute('id', id); create.appendChild(f);
  }
  const createSave = mk('button'); createSave.setAttribute('data-gc-create-save', ''); create.appendChild(createSave);
  body.appendChild(create);

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
    doc, click, input, searchBtn, newBtn, scrim, bind, create,
    tbody,
    rows: () => [...tbody.children],
    byCode: (code) => tbody.children.find((tr) => tr.children[0] && tr.children[0].textContent.trim() === code) || null,
    bindBtn: (code) => doc.querySelectorAll('[data-gc-bind]').find((b) => b.getAttribute('data-grid') === code),
    delBtn: (code) => doc.querySelectorAll('[data-gc-del]').find((b) => b.getAttribute('data-grid') === code),
    toggleBtn: (code) => doc.querySelectorAll('[data-gc-toggle]').find((b) => b.getAttribute('data-grid') === code),
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
    assert.equal(ctx.byCode('G-0418').hidden, true);
    assert.equal(ctx.byCode('G-0421').hidden, true);

    ctx.set('gc-q-grid', '   ');
    ctx.click(ctx.input, 'input');
    for (const tr of ctx.rows()) assert.equal(tr.hidden, false);
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
  test('打开新增抽屉会关闭编辑抽屉；点遮罩全部关闭', () => {
    ctx.click(ctx.bindBtn('G-0418'), 'click');
    ctx.click(ctx.newBtn, 'click');
    assert.equal(ctx.create.hidden, false);
    assert.equal(ctx.bind.hidden, true);
    assert.equal(ctx.field('gc-n-code').value, '');
    assert.equal(ctx.field('gc-n-status').value, '待定责');

    ctx.click(ctx.scrim, 'click');
    assert.equal(ctx.create.hidden, true);
    assert.equal(ctx.scrim.hidden, true);
  });
});

describe('网格新增', () => {
  test('编码为空：聚焦编码字段，不新增行', () => {
    ctx.click(ctx.newBtn, 'click');
    ctx.set('gc-n-code', '   ');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.create.hidden, false, '抽屉应保持打开');
  });

  test('编码查重：小写输入归一后命中已有网格，不新增行', () => {
    ctx.click(ctx.newBtn, 'click');
    ctx.set('gc-n-code', 'g-0419');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.create.hidden, false);
  });

  test('合法新增：追加一行，带编辑/删除按钮，主责单元格可再编辑', () => {
    ctx.click(ctx.newBtn, 'click');
    ctx.set('gc-n-code', 'G-0422');
    ctx.set('gc-n-street', '朝阳门街道');
    ctx.set('gc-n-community', '某社区');
    ctx.set('gc-n-owner', '张强');
    ctx.set('gc-n-sup', '陈督');
    ctx.set('gc-n-status', '待定责');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');

    assert.equal(ctx.rows().length, 5);
    assert.equal(ctx.create.hidden, true);

    const tr = ctx.byCode('G-0422');
    assert.ok(tr, '新行应存在');
    assert.equal(tr.children[0].textContent, 'G-0422');
    assert.equal(ctx.cell('G-0422', 'owner').textContent, '张强');
    assert.equal(ctx.cell('G-0422', 'sup').textContent, '陈督');
    assert.ok(ctx.bindBtn('G-0422'), '新行应有编辑按钮');
    assert.equal(ctx.bindBtn('G-0422').getAttribute('data-owner'), '张强');
    assert.ok(ctx.delBtn('G-0422'), '新行应有删除按钮');

    // 新行可立即再编辑（document 级委托）
    ctx.click(ctx.bindBtn('G-0422'), 'click');
    assert.equal(ctx.field('gc-bind-title').textContent, '网格 G-0422 · 编辑');
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
    ctx.set('gc-n-code', 'G-0423');
    ctx.set('gc-n-owner', '周琳');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    assert.equal(ctx.rows().length, 5);

    ctx.click(ctx.delBtn('G-0423'), 'click');
    assert.equal(ctx.rows().length, 4);
    assert.equal(ctx.byCode('G-0423'), null);
  });

  test('编辑抽屉的保存按钮不触发删除委托', () => {
    ctx.click(ctx.bindBtn('G-0418'), 'click');
    ctx.set('gc-b-reason', '仅编辑');
    ctx.click(ctx.doc.querySelector('[data-gc-bind-save]'), 'click');
    assert.equal(ctx.rows().length, 4, '行数不应变化');
  });
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

  test('停用行补充主责后保持停用，不被自动升级为启用', () => {
    ctx.click(ctx.toggleBtn('G-0419'), 'click');
    ctx.click(ctx.bindBtn('G-0419'), 'click');
    ctx.set('gc-b-owner', '张强');
    ctx.set('gc-b-reason', '主责调整');
    ctx.click(ctx.doc.querySelector('[data-gc-bind-save]'), 'click');
    assert.equal(ctx.cell('G-0419', 'owner').textContent, '张强');
    const chip = ctx.byCode('G-0419').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--off'), '停用行不应被自动升级');
  });

  test('新增行带启停按钮：有主责的待定责新行保存后自动启用', () => {
    ctx.click(ctx.newBtn, 'click');
    ctx.set('gc-n-code', 'G-0422');
    ctx.set('gc-n-owner', '张强');
    ctx.set('gc-n-status', '待定责');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    const tb = ctx.toggleBtn('G-0422');
    assert.ok(tb, '新行应有启停按钮');
    const chip = ctx.byCode('G-0422').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--green'));
    assert.equal(chip.textContent, '启用');
    assert.equal(tb.textContent, '停用');
  });

  test('新增无主责行保持待定责，启停按钮为「启用」', () => {
    ctx.click(ctx.newBtn, 'click');
    ctx.set('gc-n-code', 'G-0423');
    ctx.set('gc-n-status', '待定责');
    ctx.click(ctx.doc.querySelector('[data-gc-create-save]'), 'click');
    const tb = ctx.toggleBtn('G-0423');
    assert.ok(tb, '新行应有启停按钮');
    const chip = ctx.byCode('G-0423').querySelector('.gc-chip');
    assert.ok(chip.classList.contains('gc-chip--muted'));
    assert.equal(chip.textContent, '待定责');
    assert.equal(tb.textContent, '启用');
  });
});

describe('页面结构回归（读取真实页面 HTML）', () => {
  const html = fs.readFileSync(PAGE, 'utf8');

  test('space-edit-js 必须位于新增抽屉之后（防止脚本早执行丢失监听）', () => {
    const s = html.indexOf('<script id="space-edit-js">');
    const d = html.indexOf('data-gc-drawer="create"');
    assert.ok(s > d, `script@${s} 应晚于 create-drawer@${d}`);
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

  test('rev15 交互口径：生效版行编辑/新增带上下文跳转（?edit=/ ?create=1）', () => {
    const live = fs.readFileSync(LIVE, 'utf8');
    for (const code of ['G-0418', 'G-0417', 'G-0419', 'G-0421']) {
      assert.ok(live.includes(`space-responsibility-draft.html?edit=${code}`), `live 编辑应带 ${code} 参数`);
    }
    assert.ok(live.includes('space-responsibility-draft.html?create=1'), 'live 新增网格应带 create 参数');
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
    assert.ok(html.includes('草稿编辑中：可新增、编辑、启停、删除网格'), '卡头应有启停角标');
    assert.ok(html.includes('停用网格不参与派发，不阻断'), '页脚应豁免显式停用行');
  });

  test('live 页：行操作均为「编辑」，固定句与匹配预览保留', () => {
    const live = fs.readFileSync(LIVE, 'utf8');
    assert.ok(!live.includes('>定责<'), 'live 行按钮不应再有「定责」');
    assert.ok(!live.includes('编辑 / 定责'));
    assert.ok(live.includes('一个事件同一时刻只对应一个网格责任人。'));
    assert.ok(live.includes('空间匹配失败不能直接立案派发，也不等于不予立案。'));
    assert.ok(live.includes('space-match-success.html'));
  });
});
