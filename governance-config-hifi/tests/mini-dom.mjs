// 零依赖迷你 DOM —— 仅覆盖 space-edit-js 所用 API 子集：
// 选择器（标签/.类/[attr]/[attr="值"]/后代组合）、classList、textContent、
// addEventListener + 冒泡派发、closest、createElement/appendChild/remove、hidden/value。
export class ClassList {
  constructor() { this._set = new Set(); }
  add(...cs) { for (const c of cs) if (c) this._set.add(c); }
  remove(...cs) { for (const c of cs) this._set.delete(c); }
  contains(c) { return this._set.has(c); }
  toArray() { return [...this._set]; }
}

export class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.parent = null;
    this.children = [];
    this.attrs = {};
    this._text = '';
    this.hidden = false;
    this.value = '';
    this.type = '';
    this.listeners = {};
    this.classList = new ClassList();
    this._doc = null;
  }
  get className() { return this.classList.toArray().join(' '); }
  set className(v) { this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(v) { this.children = []; this._text = String(v); }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'id' && this._doc) this._doc._ids.set(String(v), this);
  }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() {
    if (!this.parent) return;
    const i = this.parent.children.indexOf(this);
    if (i >= 0) this.parent.children.splice(i, 1);
    this.parent = null;
  }
  addEventListener(t, fn) { (this.listeners[t] || (this.listeners[t] = [])).push(fn); }
  focus() { if (this._doc) this._doc.activeElement = this; }
  blur() { if (this._doc && this._doc.activeElement === this) this._doc.activeElement = null; }
  matches(sel) { return matchDesc(this, parseSel(sel)); }
  closest(sel) {
    const parts = parseSel(sel);
    for (let n = this; n; n = n.parent) if (n instanceof El && matchDesc(n, parts)) return n;
    return null;
  }
  querySelectorAll(sel) { return collect(this).filter((el) => matchDesc(el, parseSel(sel))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function parseCompound(s) {
  const c = { tag: '', classes: [], attrs: [] };
  let i = 0;
  if (s[0] !== '.' && s[0] !== '[') {
    const t = s.match(/^[a-zA-Z][\w-]*/);
    if (t) { c.tag = t[0].toUpperCase(); i = t[0].length; }
  }
  while (i < s.length) {
    if (s[i] === '.') {
      const m = s.slice(i + 1).match(/^[\w-]+/);
      if (!m) break;
      c.classes.push(m[0]); i += 1 + m[0].length;
    } else if (s[i] === '[') {
      const j = s.indexOf(']', i);
      if (j < 0) break;
      const inner = s.slice(i + 1, j);
      const eq = inner.indexOf('=');
      if (eq >= 0) c.attrs.push({ name: inner.slice(0, eq).trim(), value: inner.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1') });
      else c.attrs.push({ name: inner.trim(), value: undefined });
      i = j + 1;
    } else i++;
  }
  return c;
}

function parseSel(sel) { return sel.trim().split(/\s+/).map(parseCompound); }

function matchCompound(el, c) {
  if (c.tag && el.tagName !== c.tag) return false;
  for (const cls of c.classes) if (!el.classList.contains(cls)) return false;
  for (const a of c.attrs) {
    if (!(a.name in el.attrs)) return false;
    if (a.value !== undefined && el.attrs[a.name] !== a.value) return false;
  }
  return true;
}

function matchDesc(el, parts) {
  if (!(el instanceof El) || !matchCompound(el, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;
  const rest = parts.slice(0, -1);
  for (let a = el.parent; a; a = a.parent) if (matchDesc(a, rest)) return true;
  return false;
}

function collect(root, out = []) {
  for (const c of root.children) { out.push(c); collect(c, out); }
  return out;
}

export function createDocument() {
  const root = new El('#root');
  const body = new El('body');
  root.appendChild(body);
  const doc = {
    _ids: new Map(),
    listeners: {},
    activeElement: null,
    documentElement: root,
    body,
    createElement(tag) { const el = new El(tag); el._doc = doc; return el; },
    getElementById(id) { return doc._ids.get(id) || null; },
    addEventListener(t, fn) { (doc.listeners[t] || (doc.listeners[t] = [])).push(fn); },
    querySelectorAll(sel) { return collect(root).filter((el) => matchDesc(el, parseSel(sel))); },
    querySelector(sel) { return doc.querySelectorAll(sel)[0] || null; },
  };
  body._doc = doc;
  return doc;
}

// 派发事件：从 target 沿 parent 冒泡至 document（模拟真实 click 委托）。
export function createDispatch(doc) {
  return function dispatch(target, type) {
    const ev = { target, preventDefault() {}, stopPropagation() {} };
    const run = (holder) => {
      const ls = holder.listeners && holder.listeners[type];
      if (ls) [...ls].forEach((fn) => fn.call(holder, ev));
    };
    for (let n = target; n instanceof El; n = n.parent) run(n);
    run(doc);
  };
}
