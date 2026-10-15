# CHANGELOG

## V1.1（2026-10-15）

> 版本基线对照：
> - **V1.0 部署产物提交**：`2adeb63`（dist 仓，标签 `v1.0`，即线上 gh-pages 原 HEAD）
> - **V1.0 源码基线提交**：`5ad7011`（主仓，标签 `v1.0-src`，分支 `release/v1.0`，冻结不再改动）
> - 本次及后续修改在 `release/v1.1` 分支进行，**验收通过前不合并到 main**。

### 全局 / 顶栏
- 原来：顶栏右侧依次为「实时运行中」状态、皮肤切换、身份选择器，页面无任何版本标识。
- 改成：皮肤切换与身份选择器之间新增灰色小字「**原型版本 V1.1**」（全站所有页面可见）；V1.0 不补此标识。

### 工程与部署（不影响页面功能）
- 原来：只有单一版本部署在根路径；构建产物仅存在于 `dist/`，重新构建即被覆盖；无变更记录。
- 改成：
  - 新增 `v1.0` / `v1.0-src` 标签与冻结分支 `release/v1.0`、开发分支 `release/v1.1`；
  - V1.0 构建产物完整副本保留在 `v1.0-dist-backup/`（本地未跟踪目录，已加入 `.gitignore`），**不用重新构建即可直接恢复**；
  - 双版本同时在线，供评审对比：
    - V1.1（原地址）：https://cookiehu011-lab.github.io/chengyun-ai/
    - V1.0（对照）：https://cookiehu011-lab.github.io/chengyun-ai/v1/
- V1.0 子路径部署方式：使用**同一源码提交**（`release/v1.0` = `5ad7011`），仅改构建基座参数（`FIGMA_PUBLIC_URL=/chengyun-ai/v1`）重新构建，**V1.0 源码零改动**。
- 维护注意：`vite build` 会清空 `dist/`，每次构建部署后需把 `v1.0-dist-backup/` 重新拷回 `dist/v1/` 再提交推送（`rsync -a --exclude .git v1.0-dist-backup/ dist/v1/`）。

---

## 回退说明（原地址恢复为 V1.0）

操作约 1 分钟，CDN 生效约 3–4 分钟；V1.1 代码保留在 `release/v1.1` 分支与 dist 本地 `main` 分支，不会丢失。

1. 把 V1.0 部署产物提交直接覆盖线上 gh-pages：

   ```bash
   cd /Users/cookieqi/Downloads/Untitled/dist
   git push origin v1.0:gh-pages --force
   ```

2. 等 CDN 生效后验证（应输出 V1.0 的 `assets/index-CYFU4JRy.js`）：

   ```bash
   curl -s https://cookiehu011-lab.github.io/chengyun-ai/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
   ```

3. 重新上线 V1.1（dist 仓 `main` 分支停在 V1.1 部署提交）：

   ```bash
   cd /Users/cookieqi/Downloads/Untitled/dist
   git push origin main:gh-pages --force
   ```

4. 极端情况（本地 dist 仓损坏）时，用免重建副本恢复：

   ```bash
   cd /Users/cookieqi/Downloads/Untitled
   rsync -a --exclude .git v1.0-dist-backup/ dist/
   cd dist && git add -A && git commit -m "restore v1.0 artifacts" && git push origin HEAD:gh-pages --force
   ```

> 说明：方式 1 会让 gh-pages 整体回到 V1.0 提交（该提交不含 `v1/` 目录），`/v1/` 子路径会暂时 404，属预期；重新上线 V1.1 后自动恢复。
