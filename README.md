# Noyau

Noyau 是一个 Node.js 与 TypeScript 双端框架。最小笔记产品用同一份产品入口在 Electron 主窗口和 Fastify 本机网页编辑资料。

## 运行最小笔记

在仓库根目录使用 Node.js 24 LTS 和 pnpm 11 安装依赖并构建。

```sh
pnpm install --frozen-lockfile
pnpm --filter @noyau-example/desktop exec install-electron
pnpm build
```

构建会生成 Vue 和 React 两份笔记编辑页。默认使用 Vue，运行 `pnpm desktop --ui=react` 或 `pnpm serve --ui=react` 可选择 React。两端默认使用用户主目录下的 `.noyau/notes`。要指定其他目录，桌面使用 `pnpm desktop --data-dir="资料目录的绝对路径"`，Server 使用 `pnpm serve "资料目录的绝对路径"`。

| 运行端 | 启动命令 | 操作入口 | 退出方式 |
| --- | --- | --- | --- |
| 桌面 App | `pnpm desktop` | Electron 主窗口 | 关闭窗口 |
| 独立 Server | `pnpm serve` | 浏览器打开终端显示的地址，默认 `http://127.0.0.1:3210` | 在终端按 Ctrl+C |

输入标题“首条笔记”和正文“原文 A”，点击“保存”。看到“已保存”后退出，用相同命令和资料目录重开，页面应读回这两个值。两个运行端和两种编辑器可轮流打开同一资料目录。

## 接入 Vue 或 React 页面

先用前端项目自己的构建命令生成静态文件，然后将产品入口的 `page` 指向含有 `index.html` 的构建目录。例如 Vite 的默认输出是 `dist/`。这个目录就是站点根目录，JS 分块、CSS、图片和字体都由当前运行端提供。前端使用根路径部署。浏览器打开或刷新 `/notes/first` 等无扩展名的页面地址时会返回入口 HTML。`/api/` 留给业务请求。用户资料目录放在公开构建目录之外。[Vue 编辑器](src/examples/notes/ui/vue/Editor.vue) · [React 编辑器](src/examples/notes/ui/react/main.jsx)

两个运行端都接收同一份产品入口。把下面的 `product` 传给 `runDesktop(product, directory)` 或 `serve(product, directory, port)` 即可。[笔记产品入口](src/examples/notes/index.ts)

```ts
import { resolve } from 'node:path'
import type { ModularProduct } from '@noyau/extension-contract'
import { noteModule } from './note-module'
import { labels } from './labels'

export const product: ModularProduct = {
  page: resolve('dist'),
  modules: [noteModule, labels],
}
```

## 业务模块和扩展

产品模块和扩展包都导出 `ProductModule`，在共享入口的 `modules` 中显式注册。下面的 `labels` 可以放在产品自己的文件里，也可以由单独的包导出。模块标识须唯一，可以使用 `notes` 或 `@example/labels` 这种形式。同一模块内的操作以名称区分。启动时会检查重复标识和 `requires` 声明的依赖。

```ts
import { InvalidDraft, type ProductModule } from '@noyau/extension-contract'

export const labels: ProductModule = {
  id: '@example/labels',
  operations: {
    rename(input, store) {
      if (!input || typeof input !== 'object' ||
          !('id' in input) || typeof input.id !== 'string' ||
          !('title' in input) || typeof input.title !== 'string') {
        throw new InvalidDraft('标签需要标识和名称')
      }
      store.set(input.id, { title: input.title })
    },
    list(_, store) {
      return store.entries()
    },
  },
}
```

每个操作只校验自己的输入。笔记和标签可以都有 `title`，也可以都有一条键为 `first` 的记录。`store.get(key)`、`set(key, value)`、`delete(key)` 和 `entries()` 只能访问当前模块的 JSON 记录。读取缺失键得到 `undefined`。一次操作可以修改多条记录。同一资料目录内的操作依次执行，操作成功后整体提交，抛错或返回拒绝的 Promise 会整体回滚。操作结束后，其 `store` 随即失效。

Vue 和 React 页面都可以通过同一个浏览器接口调用操作。[笔记操作](src/examples/notes/note-module.ts) · [两个编辑器共用的调用逻辑](src/examples/notes/ui/editor.js)

```ts
import { callOperation } from '@noyau/extension-contract/client'

await callOperation('notes', 'save', { id: 'first', title: '首条笔记', body: '原文 A' })
const { data, version } = await callOperation('notes', 'read', 'first')
await callOperation('@example/labels', 'rename', { id: 'first', title: '工作' })
```

接口通过 `POST /api/modules/<模块标识>/<操作名>` 提交 JSON，两段名称分别进行 URL 编码。成功回执包含 `{ data, version }`，无返回值的操作得到 `data: null`。产品抛出 `InvalidDraft` 时返回 HTTP 400。两端的请求体上限默认都是 1 MiB，产品可通过 `maxDraftBytes` 指定 UTF-8 字节上限。

## 已有产品和资料

旧入口的 `page` 仍可指向单个 HTML 文件，此时只公开该页面。旧的 `initial`、`prepareSave` 和 `GET/POST /api/data` 保持原有读写语义。将已有产品改为模块时，可在入口设置 `legacyRecord: { module: 'notes', key: 'first' }`，让这条记录继续读写原来的 SQLite 资料。保留这组映射，两版程序轮流打开目录时都能读到最新保存的值。

## 验收

构建后在安装了 Google Chrome 的机器上运行 `pnpm test`，无显示器的 Ubuntu 使用 `xvfb-run -a pnpm test`。验收从 Electron 主窗口和 Fastify 的本机网页分别打开 Vue、React 生产构建，验证独立 CSS、页面导航、保存、退出和重开。测试还覆盖模块隔离、并发写入、失败回滚、扩展注册和旧资料读回。[GitHub Actions](.github/workflows/basic-read-write.yml)
