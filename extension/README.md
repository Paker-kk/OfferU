# OfferU Browser Extension (MV3)

## 概述
OfferU 浏览器插件用于在招聘网站页面手动采集岗位信息，并同步到本机 OfferU 服务。

关键约束：
- 仅支持用户手动触发采集。
- 仅做页面 DOM 只读提取，不做自动化操作。
- 默认后端地址为 `http://127.0.0.1:8000`。

## 技术栈
- WXT
- TypeScript
- Manifest V3
- Vitest

## 开发与构建
在 `extension` 目录执行：

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` 会执行两步：
1. `wxt build` 产出 `.output/chrome-mv3`
2. `scripts/sync-root-build.mjs` 将浏览器加载所需文件同步到 `extension` 根目录

## 加载方式（Chrome/Edge）
1. 打开扩展管理页，启用开发者模式。
2. 选择“加载已解压的扩展程序”。
3. 选择目录：`extension`

注意：插件加载依赖 `extension` 根目录的构建产物，构建后应至少存在：
- `manifest.json`
- `background.js`
- `content-scripts/content.js`
- `popup.html`
- `assets/` 与 `chunks/`

## 常用脚本
- `npm run dev`：WXT 开发模式
- `npm run typecheck`：TS 类型检查
- `npm test`：单元测试
- `npm run build`：生产构建并同步到根目录
- `npm run zip`：打包产物
- `npm run build:legacy`：旧构建链路（tsc + 静态复制）

## 目录说明
- `src/`：核心源码（background/content/popup）
- `entrypoints/`：WXT 入口
- `static/`：静态资源与基础 manifest
- `scripts/sync-root-build.mjs`：构建产物同步脚本
- `tests/`：测试用例

## 排障
### 1) 扩展无法加载
优先检查 `extension` 根目录是否存在 `manifest.json`，以及 `content-scripts/content.js` 是否存在。

### 2) 报错“无法为脚本加载 JavaScript”
通常是构建产物路径缺失或未同步，重新执行：

```bash
npm run build
```

### 3) 同步失败
确认本机 OfferU 后端服务已启动，且地址可访问：`http://127.0.0.1:8000`。
