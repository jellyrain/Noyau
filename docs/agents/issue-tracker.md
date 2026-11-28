# GitHub Issues

Noyau 的议题和规格存放在 `jellyrain/Noyau` 的 GitHub Issues。使用 `gh` 操作。
每次会话首次创建议题前，用 `gh repo view --json nameWithOwner` 核对目标是 `jellyrain/Noyau`。

## 发布与读取

- 发布规格或工单时，用 `gh issue create --title "<标题>" --body-file <正文文件>` 创建议题。
- 读取工单时，用 `gh issue view <编号> --json number,title,body,labels,comments` 获取正文和讨论。
- 查找待处理工单时，用 `gh issue list --state open`，按需加 `--label` 筛选。
- 更新分诊标签时，用 `gh issue edit <编号> --add-label <标签>` 或 `--remove-label <标签>`。
- 关闭议题时，先用 `gh issue comment <编号> --body-file <说明文件>` 留下结论，再用 `gh issue close <编号>` 关闭。

## 子议题与阻塞关系

- 创建子议题时，加 `--parent <父议题编号>`。关联已有议题时，用 `gh issue edit <父议题编号> --add-sub-issue <子议题编号>`。
- 记录前置依赖时，用 `gh issue edit <当前议题编号> --add-blocked-by <前置议题编号>`。所有前置议题关闭后，该项工作即可开始。
- 如果仓库无法使用原生关联，在子议题正文首行写 `Part of #<父议题编号>`，并在父议题任务列表中链接子议题。阻塞关系用 `Blocked by: #<前置议题编号>` 记录。

## Wayfinder

`wayfinder:map` 议题记录笔记、已有决策和待解问题。子议题按类型使用 `wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling` 或 `wayfinder:task`。
按父议题中的顺序，选取第一个仍开放、无人负责且前置工作均已完成的子议题，用 `gh issue edit <编号> --add-assignee @me` 认领。
完成后，在子议题评论里记录结论并关闭，再把结论摘要和链接补到父议题。

PRs as a request surface: no.
