无论使用哪种语言编写的技能，都用中文与用户交流，包括提问、进度更新和最终答复。

需要搭建或调整开发环境（如配置运行时、创建虚拟环境、修改环境变量），或安装、升级、卸载依赖包时，请给出执行目录和具体步骤（含所需命令），交由用户执行。

## Agent skills

### Issue tracker

在 GitHub Issues 发布规格、创建或读取工单时，按 `docs/agents/issue-tracker.md` 操作。

### Triage labels

分诊议题时，按 `docs/agents/triage-labels.md` 选择对应的 GitHub 标签。

### Domain docs

本仓库采用单一上下文布局。探索代码或提出设计变更前，按 `docs/agents/domain.md` 查阅术语表和相关架构决策。

## 分支约定

日常开发以 `dev` 为基础，功能和修复 PR 的目标分支为 `dev`。改动在 `dev` 上稳定后，再合入 `main`。

## 提交规范

提交标题遵循 Conventional Commits，格式为 `type: 中文摘要`。类型用小写英文，半角冒号后加一个空格。摘要和可选正文均用中文描述改动。

- `fix: 修复空数据导致的导入失败`
- `feat: 支持批量导入数据`
- `docs: 补充开发分支约定`
