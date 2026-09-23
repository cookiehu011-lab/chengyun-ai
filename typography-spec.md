# 城运 AI 平台 — 字体设计规范

## 1. 设计原则

- **清晰可读**：大屏/高密度界面优先保证信息层级清晰。
- **科技稳重**：中文使用现代无衬线体，数字使用等宽字体，避免跳动感。
- **克制统一**：全平台只使用 2 套正文字体 + 1 套等宽字体，字号控制在 7 个层级内。

---

## 2. 字体栈

| 用途 | 字体 | 说明 |
|------|------|------|
| 中文正文/标题 | **Noto Sans SC** | 覆盖 300–700，保证中文显示统一 |
| 西文/数字正文 | **Inter** | 与 Noto Sans SC 搭配，屏幕显示清晰 |
| 指标/编号/代码 | **JetBrains Mono** | 等宽，用于 KPI、趋势、ID 等需要纵向对齐的数字 |
| 系统回退 | system-ui, sans-serif | 字体加载失败时的兜底 |

全局字体声明：

```css
font-family: 'Noto Sans SC', 'Inter', system-ui, sans-serif;
```

等宽数字声明：

```css
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

---

## 3. 字重（Font Weight）

| 字重 | 值 | 使用场景 |
|------|-----|----------|
| Light | 300 | 极少使用，仅大标题装饰 |
| Regular | 400 | 说明文字、辅助文案 |
| Medium | 500 | 按钮文字、标签正文 |
| Semibold | 600 | 模块标题、列表主文、趋势数字 |
| Bold | 700 | 大数字、重点数据、按钮强调 |
| ExtraBold | 800 | 页面大标题、section header、关键指标 |

---

## 4. 字号层级（Type Scale）

| 层级 | 字号 | 字重 | 行高 | 字体 | 使用场景 |
|------|------|------|------|------|----------|
| **H1 页面标题** | 15px | 600 | 1.35 | Noto Sans SC | 顶部导航栏当前模块名，如「治理大屏」 |
| **H2 模块标题** | 13px | 800 | 1.35 | Noto Sans SC | 左侧/右侧卡片 section header，如「生命周期脉冲」 |
| **H3 卡片标题** | 12px | 700–800 | 1.4 | Noto Sans SC | 小卡片标题、AI 研判标题 |
| **XL 大指标** | 26px | 700–800 | 1 | JetBrains Mono | 顶部 KPI 主数字，如「247」「83」 |
| **L 次级指标** | 22–24px | 800 | 1 | JetBrains Mono | 地点签名统计卡片、重点数字 |
| **M 数字/强调** | 13px | 700 | 1 | JetBrains Mono | 列表计数、待处置数量 |
| **Body 正文** | 12–14px | 500–750 | 1.5–1.6 | Noto Sans SC | AI 规律判断、描述文案 |
| **Caption 辅助** | 10–11px | 400–600 | 1.4 | Noto Sans SC | 标签、时间、单位、muted 说明 |
| **Badge 徽章** | 10–11px | 600–700 | 1 | Noto Sans SC | 状态标签、热度标签、AI 推荐 |

---

## 5. 颜色与字体组合

| 文字类型 | 颜色 | 字体 | 示例 |
|----------|------|------|------|
| 主标题/关键数字 | `#162D4D` | Noto Sans SC / JetBrains Mono | 模块标题、KPI 数字 |
| 次级说明 | `#6E8197` | Noto Sans SC | 数据截至、辅助说明 |
| 主强调 | `#326DFF` | Noto Sans SC / JetBrains Mono | 链接、选中态、主指标 |
| 科技强调 | `#24D6D2` | Noto Sans SC | AI 标签、地点签名 header |
| 成功/下降 | `#35B985` | JetBrains Mono / Noto Sans SC | 正向趋势、已结案 |
| 警告/上升 | `#FF7A42` | JetBrains Mono / Noto Sans SC | 待核查、风险提醒 |
| 危险 | `#E45E58` | JetBrains Mono / Noto Sans SC | 严重事件、异常 |
| 深色卡片反白 | `#FFFFFF` / `rgba(255,255,255,0.72)` | Noto Sans SC | AI 规律判断深色卡片 |

---

## 6. 特殊规范

### 6.1 数字等宽
所有 KPI、趋势、编号、计数统一使用 `JetBrains Mono`，保证：
- 多位数字纵向对齐
- 变化趋势（+12 / -0.3h）视觉稳定

### 6.2 科技标签字间距
AI 相关标签、section header 使用适度字间距，增强科技感：

```css
letter-spacing: 0.06em;
```

### 6.3 大写/小写
- 中文标题保持正常大小写。
- 英文缩写保持大写（如 AI、ID、KPI）。
- 避免使用全大写中文。

### 6.4 行数限制
- 标题最多 1 行，超出截断。
- 辅助说明最多 2 行，超出省略。
- AI 规律判断正文可 2–3 行。

---

## 7. 代码参考

```css
/* 全局 */
body {
  font-family: 'Noto Sans SC', 'Inter', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.font-mono {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}
```

```jsx
// KPI 大数字
<span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#162D4D' }}>
  247
</span>

// 模块标题
<span style={{ fontSize: 13, fontWeight: 800, color: '#162D4D' }}>
  生命周期脉冲
</span>

// 辅助说明
<span style={{ fontSize: 11, color: '#6E8197' }}>
  数据截至 08/24 11:38
</span>
```

---

## 8. 禁止事项

- 同一界面不要使用超过 3 种字体。
- 避免使用小于 10px 的字号（极特殊标签除外）。
- 避免在正文使用 ExtraBold（800）。
- 避免数字使用非等宽字体展示变化量。
