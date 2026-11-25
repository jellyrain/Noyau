# Windows 与 Linux 平台支持调查

核对日期为 2026-11-25。Electron 45.5.0、Node.js 24.22.3 LTS 和 26.13.1 LTS 均已发布 Windows、Linux 的 x64 与 ARM64 运行时。对 Noyau，四种组合都有构建起点；能否承诺某一操作系统版本，还取决于最终产物能否在该版本的原生环境运行。本次核对上游资料，尚无 Noyau 端到端实测记录。[Electron 发布文件][electron-assets] · [Node.js 24 发布文件][node24-assets] · [Node.js 26 发布文件][node26-assets]

## 运行时与系统库

- **桌面 App。** Electron 45.5.0 内含 Chromium 156.0.8078.109 和 Node.js 24.22.3。其平台说明列出 Windows 10 及以上；Linux 列举 Ubuntu、Debian、Fedora，要求相应版本同时受 Chromium 与发行方支持，且发行方支持无需付费订阅。该说明没有给出两种架构通用的桌面 glibc 下限。选择 Linux 最低版本时还要核对最终包的图形库、NSS 等依赖；例如 Debian 打包工具的依赖表包含 GTK 和 NSS。[Electron 版本][electron-release] · [平台说明][electron-platform] · [Debian 包依赖源码][deb-deps]
- **独立 Server。** Node.js 24.22.3 与 26.13.1 都把 Windows 10 起的 x64 列为 Tier 1、ARM64 列为 Tier 2；两级都有上游测试，失败会阻止发布，Tier 2 可能因基础设施问题延迟提供二进制。GNU/Linux 的 glibc 构建在两个架构上均为 Tier 1，表列内核 ≥ 4.18、glibc ≥ 2.28，官方二进制另需 libstdc++ ≥ 6.0.25（`GLIBCXX_3.4.25`）；26.13.1 还需要 `libatomic`。这些数值适用于相应 Node.js 二进制，Electron、原生扩展和发行版生命周期需单独核对。[Node.js 24 平台表及脚注][node24] · [Node.js 26 平台表及脚注][node26]
- **Fastify。** v5 要求 Node.js ≥ 20。v5.12.8 的单元测试矩阵在 `ubuntu-latest`、`windows-latest` 和 `macos-latest` 上运行 Node.js 20、22、24、26。Linux 和 Windows 的这两个标签使用 x64，该测试没有单列 Windows 10 客户端或这两个系统的 ARM64。[Fastify v5 迁移说明][fastify-min] · [v5.12.8 工作流][fastify-ci] · [GitHub 标准镜像][hosted]

## 原生端到端验收环境

| 目标系统 | 可用环境及剩余缺口 |
| --- | --- |
| Windows 10 x64 | GitHub 标准 x64 镜像 `windows-2022`、`windows-2025` 运行 Windows Server。要验收 Windows 10 客户端，可用指定版本的 x64 真机或同架构虚拟机；记录系统版本、内部版本号和版本类别（如 Pro 或 LTSC）。[镜像对应关系][images] · [自托管要求][self-hosted] |
| Windows 10 ARM64 | Electron 的 ARM 教程以 6.x 为例，指引在 Windows 10 1903+ ARM 设备测试；45.5.0 的 README 仍写 Windows 10+，但其引用的 Google Chrome 要求列明 ARM 须 Windows 11+。微软说明 Windows 10 ARM 仅可模拟 x86，x64 安装器或辅助进程也可能成为阻碍。该组合保留为**待实测**：需要能运行指定 Windows 10 版本的 ARM64 环境，以原生安装包、辅助进程和独立 Server 完成验收；标准 runner 只提供 Windows 11 ARM64。[Electron ARM 教程][electron-arm] · [Electron 平台说明][electron-platform] · [Chrome 要求][chrome] · [微软模拟说明][emulation] · [标准镜像][hosted] |
| Windows 11 x64 / ARM64 | ARM64 可用标准 `windows-11-arm`。x64 客户端可用同架构自托管环境；GitHub 另列 Base Windows 11 Desktop 大型 runner 镜像，须符合组织套餐和计费条件。桌面交互测试需有可用的桌面会话。[标准镜像][hosted] · [大型镜像][larger] · [套餐条件][plans] · [Windows UI 测试][win-ui] |
| Ubuntu x64 / ARM64 | GitHub 列出 `ubuntu-22.04`、`ubuntu-24.04`、`ubuntu-26.04` 及各自后缀为 `-arm` 的标准镜像。22.04 和 24.04 的标准安全维护分别到 2027 年 5 月和 2029 年 5 月。可在同版本、同架构 VM 测 Server；桌面 App 还需显示环境。[标准镜像][hosted] · [Ubuntu 生命周期][ubuntu] · [Electron 无显示器 CI][xvfb] |
| Debian / Fedora，x64 与 ARM64 | 可选的明确版本包括 Debian 13 stable、Debian 12 oldstable（已转入 LTS）和 Fedora Workstation 45。GitHub 标准镜像没有列出这两个发行版。若承诺其桌面或 Server，使用相应版本、同架构的虚拟机或设备运行最终产物。Ubuntu 上的容器可以核对发行版用户态依赖，仍与宿主共享内核。[Debian 生命周期][debian] · [Fedora 45][fedora] · [标准镜像][hosted] · [容器与虚拟机][containers] |

Windows 10 Home/Pro 常规支持已于 2025-10-14 结束。微软单列 ESU 安全更新和 LTSC 生命周期，Node.js 的支持政策排除已过厂商支持期的系统。评估 Windows 10 时，应指明具体版本和维护渠道；没有找到 Node.js 将 ESU 登记视为恢复其平台支持的声明。[微软生命周期][win10] · [ESU 范围][esu] · [LTSC 日期][win-support] · [Node.js 支持政策][node26]

## 从构建到验收

1. **核对交付格式。** Electron Packager 可面向两系统、两架构生成应用目录。Forge 的 Package 阶段处理应用包和原生模块，Make 阶段用对应 maker 生成分发文件。ZIP maker 可跨平台运行；如选 DEB，构建主机需有 `fakeroot` 和 `dpkg`；如选 MSIX，其文档要求带 Windows SDK 的 Windows 10/11 主机。Node.js 的下载文件只提供独立 Server 的运行时，产品代码和随包依赖仍须一起验收。[Packager 目标][packager] · [Forge 构建阶段][forge] · [ZIP][zip] · [DEB][deb] · [MSIX][msix] · [Node.js 发布文件][node26-assets]
2. **在对应环境执行最终产物。** 在无显示器的 Linux runner，可用 `xvfb-run` 提供 X11 显示给桌面 App；独立 Server 单独在无显示环境启动。Electron 在 Wayland 会话默认使用原生 Wayland，涉及该会话的承诺需在 Wayland 下另验。发布记录可附产物校验值、系统版本、主机与进程架构、显示后端，以及桌面 App 与独立 Server 轮流接管同一资料目录后读回“已保存”写入的结果。[Electron 无显示器 CI][xvfb] · [Electron 的 Wayland 行为][wayland] · [Noyau 双端框架规格与验收标准](https://github.com/jellyrain/Noyau/issues/1)

[electron-assets]: https://github.com/electron/electron/releases/expanded_assets/v45.5.0
[electron-platform]: https://github.com/electron/electron/blob/v45.5.0/README.md#platform-support
[electron-release]: https://releases.electronjs.org/release/v45.5.0
[electron-arm]: https://www.electronjs.org/docs/latest/tutorial/windows-arm
[deb-deps]: https://github.com/electron-userland/electron-installer-debian/blob/master/src/dependencies.js
[node24-assets]: https://nodejs.org/en/blog/release/v24.22.3
[node26-assets]: https://nodejs.org/en/blog/release/v26.13.1
[node24]: https://github.com/nodejs/node/blob/v24.22.3/BUILDING.md#supported-platforms
[node26]: https://github.com/nodejs/node/blob/v26.13.1/BUILDING.md#supported-platforms
[fastify-min]: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/
[fastify-ci]: https://github.com/fastify/fastify/blob/v5.12.8/.github/workflows/ci.yml#L51-L82
[hosted]: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
[images]: https://github.com/actions/runner-images#available-images
[self-hosted]: https://docs.github.com/en/actions/reference/runners/self-hosted-runners
[larger]: https://docs.github.com/en/actions/reference/runners/larger-runners
[plans]: https://docs.github.com/en/actions/concepts/runners/larger-runners
[win-ui]: https://learn.microsoft.com/en-us/azure/devops/pipelines/test/ui-testing-considerations
[chrome]: https://support.google.com/chrome/answer/95346?hl=en
[emulation]: https://learn.microsoft.com/en-us/windows/arm/apps-on-arm-x86-emulation
[win10]: https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro
[esu]: https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates
[win-support]: https://learn.microsoft.com/en-us/windows/release-health/supported-versions-windows-client
[ubuntu]: https://ubuntu.com/about/release-cycle
[debian]: https://www.debian.org/releases/
[fedora]: https://fedoraproject.org/workstation/download/
[containers]: https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/
[packager]: https://electron.github.io/packager/main/
[forge]: https://www.electronforge.io/core-concepts/build-lifecycle
[zip]: https://www.electronforge.io/config/makers/zip
[deb]: https://www.electronforge.io/config/makers/deb
[msix]: https://www.electronforge.io/config/makers/msix
[xvfb]: https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci
[wayland]: https://www.electronjs.org/blog/electron-38-0
