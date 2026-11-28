# Noyau

Noyau 是一个 Node.js 与 TypeScript 双端框架。最小笔记产品用同一份产品入口在 Electron 主窗口和 Fastify 本机网页编辑资料。

## 运行最小笔记

在仓库根目录使用 Node.js 24 LTS 和 pnpm 11 安装依赖并构建。

```sh
pnpm install --frozen-lockfile
pnpm --filter @noyau-example/desktop exec install-electron
pnpm build
```

选择要验证的运行端。两端默认使用用户主目录下的 `.noyau/notes`。要指定其他目录，桌面使用 `pnpm desktop --data-dir="资料目录的绝对路径"`，Server 使用 `pnpm serve "资料目录的绝对路径"`。

| 运行端 | 启动命令 | 操作入口 | 退出方式 |
| --- | --- | --- | --- |
| 桌面 App | `pnpm desktop` | Electron 主窗口 | 关闭窗口 |
| 独立 Server | `pnpm serve` | 浏览器打开终端显示的地址，默认 `http://127.0.0.1:3210` | 在终端按 Ctrl+C |

输入标题“首条笔记”和正文“原文 A”，点击“保存”。看到“已保存”后退出，用相同命令和资料目录重开，页面应读回这两个值。两个端可轮流使用同一目录。

## 接入自己的产品

在[产品入口](src/examples/notes/index.ts)中实现 `Product`，提供编辑页的绝对路径 `page`、新资料的初值 `initial`，以及把当前草稿转换为待保存 JSON 的 `prepareSave`。字段和校验均由产品定义。[笔记编辑页](src/examples/notes/editor.html)演示怎样通过 `GET /api/data` 读到 `{ data, version }`，以及怎样通过 `POST /api/data` 提交 JSON 草稿。收到 HTTP 204 表示该次提交的版本已保存。

[桌面入口](src/examples/desktop/index.cjs)调用 `runDesktop(产品入口, 资料目录)`，[Server 入口](src/examples/server/index.cjs)调用 `serve(产品入口, 资料目录, 端口)`。各示例启动包锁定所选运行端的精确版本。运行端带入同版本的 `@noyau/core` 和 `@noyau/extension-contract`。基本读写仅需这三个框架包。

两端默认接受最大 1 MiB 的单次 JSON 提交。有大正文或其他字段的产品可在同一份产品入口设置 `maxDraftBytes`，以 UTF-8 字节指定上限。超限时编辑页会保留当前草稿。

## 验收

在装有 Google Chrome 的机器上构建后运行 `pnpm test`。无显示器的 Ubuntu 使用 `xvfb-run -a pnpm test`。测试会为每端创建临时资料目录，在真实产品页保存并退出，随后启动新进程读回。推送到 `dev` 或向 `dev` 提交 PR 时，[GitHub Actions](.github/workflows/basic-read-write.yml) 在 Windows x64 与 Ubuntu x64 分别运行两端测试。每项测试日志记录实际解析的框架版本、页面报告的版本和重开后读到的字段。
