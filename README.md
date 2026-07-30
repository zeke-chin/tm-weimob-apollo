# tm-weimob-apollo

基于 TypeScript、React、Vite 和 `vite-plugin-monkey` 开发的油猴脚本项目，支持在 Tampermonkey、Violentmonkey 等用户脚本管理器中运行。

开发模式下，Vite 会把代码变更推送到真实目标网页。React 组件和 CSS 支持热更新，通常不需要重新构建或反复安装脚本。

## 技术栈

- TypeScript
- React
- Vite
- [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)
- Tampermonkey 或 Violentmonkey
- pnpm

## 开始开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置目标网页

编辑 `vite.config.ts` 中的 `userscript.match`：

```ts
userscript: {
  match: ['https://目标网站.example.com/*'],
}
```

当前脚手架的默认配置是：

```ts
match: ['https://www.google.com/']
```

开始实际开发前，应把它替换为脚本需要运行的网站地址。只有匹配 `match` 规则的网页才会执行脚本。

如果需要调用油猴 API，可以在同一位置声明权限：

```ts
userscript: {
  match: ['https://目标网站.example.com/*'],
  grant: ['GM_getValue', 'GM_setValue'],
}
```

### 3. 启动开发服务器

```bash
pnpm dev
```

首次启动时，浏览器通常会打开开发版 `.user.js` 的安装页面：

1. 在 Tampermonkey 或 Violentmonkey 中安装开发脚本。
2. 确认开发脚本已启用。
3. 打开与 `userscript.match` 匹配的目标网页。
4. 修改 `src/App.tsx` 或样式文件并保存，观察网页自动更新。

开发脚本只需要安装一次，但开发期间必须保持 `pnpm dev` 运行。

## 热更新

项目已经启用 Vite HMR 和 React Fast Refresh：

- 修改 React 组件后，组件会自动更新。
- 修改 CSS 后，样式会自动更新。
- 某些入口文件、用户脚本元数据或不支持 HMR 的模块发生变化时，可能需要刷新目标网页或重新安装开发脚本。

在入口中增加事件监听器、定时器或 `MutationObserver` 时，应在热更新销毁阶段清理副作用，避免重复注册：

```ts
const controller = new AbortController()

function handleClick(event: MouseEvent) {
  console.log(event.target)
}

window.addEventListener('click', handleClick, {
  signal: controller.signal,
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    controller.abort()
  })
}
```

## 构建发布版本

```bash
pnpm build
```

构建产物位于 `dist/`，默认用户脚本文件为：

```text
dist/tm-weimob-apollo.user.js
```

发布前应使用目标用户实际使用的用户脚本管理器进行一次完整验证。

## 可用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动开发服务器和热更新 |
| `pnpm build` | 执行 TypeScript 检查并构建 `.user.js` |
| `pnpm preview` | 启动 Vite 产物预览服务 |

## 项目结构

```text
tm-weimob-apollo/
├── src/
│   ├── App.tsx          # React 主组件
│   ├── App.css          # 组件样式
│   ├── index.css        # 全局样式
│   ├── main.tsx         # 用户脚本入口和 React 挂载
│   └── assets/          # 静态资源
├── package.json         # 依赖和项目命令
├── tsconfig.json        # TypeScript 配置入口
└── vite.config.ts       # Vite 与用户脚本元数据配置
```

后续功能增多时，建议把目标网站相关逻辑集中到独立目录：

```text
src/
├── adapters/            # 读取和操作目标网页
├── selectors/           # DOM 选择器
├── features/            # 业务功能
├── storage/             # 用户配置和持久化
└── app/                 # React 界面
```

## 样式隔离

当前项目使用普通全局 CSS。油猴脚本运行在真实网页中，全局样式可能影响目标网站，目标网站的样式也可能影响脚本界面。

开发悬浮面板等独立 UI 时，建议使用 Shadow DOM 隔离样式。`vite-plugin-monkey` 支持通过 `?style` 导入样式节点，并对 Shadow DOM 内的样式执行 HMR。

## 热更新故障排查

如果保存代码后目标网页没有更新，请依次确认：

1. `pnpm dev` 仍在运行，终端中没有编译错误。
2. 用户脚本管理器中的开发脚本已经安装并启用。
3. 当前网页地址符合 `userscript.match`。
4. 安装开发脚本后至少刷新过一次目标网页。
5. 浏览器允许用户脚本管理器访问目标网站。
6. 目标网站的 CSP 或浏览器安全策略没有拦截本地开发服务器和 WebSocket。

仍然无法连接时，可以先重新启动 `pnpm dev`，然后刷新目标网页并检查浏览器开发者工具中的 Console 和 Network 面板。
