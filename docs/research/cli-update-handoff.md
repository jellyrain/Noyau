# 前台命令行启动的独立 Server 怎样切换版本

Windows 和 Ubuntu 的独立 Server 采用停机升级。部署者在同一个终端停止 Server，运行 `update`，等命令结束后再运行 `serve`。服务在两条命令之间保持停止，首次启动沿用已有的升级确认与回档条件。完整约定见[桌面 App 和独立 Server 在各平台以什么发布包交付？](https://github.com/jellyrain/Noyau/issues/15#issuecomment-7236962556)。

## 曾调研的在线切换方案

选定停机升级前，曾调查过原命令持续运行、由第二个终端请求在线切换的可行性。下文保留该方案的平台依据和 Windows 实验结果。

在这个实验中，另一个本机进程通过 Windows 命名管道向启动器请求切换，Ubuntu 对应的机制是 Unix 域套接字。[Node.js 本机进程间通信](https://nodejs.org/api/net.html#ipc-support)

## 两个平台能提供什么

| 问题 | 官方文档或开源实现 |
| --- | --- |
| 能否在原进程中直接运行新版？ | Ubuntu 的 `execve` 可以替换原进程内的程序并保留 PID，成功后旧代码也随之消失。Node 的 `process.execve` 不支持 Windows。跨平台可让启动器直接派生候选可执行文件、继承标准输入输出并等待退出。Syncthing 的监控进程也等待子进程退出，并区分主动停止和升级。[Linux execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html) · [Node.js process.execve](https://nodejs.org/api/process.html#processexecvefile-args-env) · [Node.js 子进程](https://nodejs.org/api/child_process.html#optionsstdio) · [Syncthing 源码](https://github.com/syncthing/syncthing/blob/main/cmd/syncthing/monitor.go) |
| Ctrl+C 会到谁？ | Ubuntu 普通交互终端向前台进程组发送 SIGINT。Windows 控制台默认把 Ctrl+C 送给所有附着其上的进程，父子可能同时收到。Windows 上用 Node 的 `child.kill('SIGTERM')` 会强制终止目标。建议升级停机走单独的进程间通信通道（IPC），父子收到用户停止时均能重复处理同一请求，启动器取消后续拉起。[Linux 进程组](https://man7.org/linux/man-pages/man2/getpgrp.2.html) · [Windows 控制台事件](https://learn.microsoft.com/en-us/windows/console/ctrl-c-and-ctrl-break-signals) · [Node.js 信号事件](https://nodejs.org/api/process.html#signal-events) |
| 为什么分开存放两版程序？ | Windows 删除有打开句柄或内存映射的文件时受共享方式限制。按照版本解压可以绕开替换在用文件的要求。Squirrel.Windows 有按版本解压、延后清理的实际案例。Noyau 可从 Windows 的 `.zip` 或 Ubuntu 的 `.tar.gz` 准备完整的候选程序及其运行时，固定入口放在版本目录之外。[Windows 文件删除语义](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-deletefilew) · [Squirrel.Windows 更新流程](https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/update-process.md) |

## 在线切换方案的交接顺序

1. **准备候选程序。** 在旧版继续服务时解包并验证候选版本。启动器保存本次使用的启动参数、已解析的资料目录和监听配置。磁盘上的升级记录应能关联这份资料、旧版、候选版和迁移保护点，供强退后重新执行同一命令时使用。
2. **交回端口和资料目录。** 旧版停止接收新写入和后台任务，处理在途操作与连接，关闭监听和资料句柄，释放独占锁并退出。启动器等待旧进程退出。新实例须实际取得同一资料目录的独占权，并成功绑定所需地址及端口。如果有其他实例抢先持锁，交接应暂停并报告冲突。迁移或恢复只能由持锁方进行，桌面 App 接管时也须识别未完成的升级。Node 的 `server.close()` 会等待存量连接结束，长连接需有停机策略。[Node.js server.close](https://nodejs.org/api/net.html#serverclosecallback) · [资料目录与迁移保护点](../../GLOSSARY.md)
3. **验证后再提交。** 第一步迁移前建立完整的迁移保护点。候选版保持业务写入和后台任务关闭，通过 `127.0.0.1` 上的产品正常读取流程，从原资料目录读回预期结果。产品确认就绪后，Noyau 持久记录成功，此时才开放写入和任务。建议固定入口直接依据这条记录选择默认版本，避免另写一个版本指针造成两份结果不一致。[升级成功的定义](../../GLOSSARY.md)

| 中断位置 | 本次或下次启动的行为建议 |
| --- | --- |
| 成功记录提交前 | 确认候选已退出、独占权已取得。若迁移已开始，从保护点恢复全部迁移前资料，再启动旧程序。尚未迁移时可直接使用旧版。恢复中再次中断，保留保护点供下次继续。恢复失败时显示原因并停止，避免旧程序接管半恢复的资料。 |
| 用户按 Ctrl+C 或关闭终端 | 停止当前启动会话。若尚有恢复工作，下次执行同一命令时按持久记录完成。父进程被强杀时，操作系统可能留下子进程。建议子进程在与启动器的控制通道断开时退出。重新启动仍需实际取得资料锁。[Node.js 子进程生命周期](https://nodejs.org/api/child_process.html#optionsdetached) · [Node.js disconnect 事件](https://nodejs.org/api/process.html#event-disconnect) · [Windows 进程终止](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process) |
| 成功记录已提交，包括后续清理中断 | 固定命令继续启动新版和配套资料，保留成功之后已接受的写入。遗留的程序包及保护点可在确认不再使用后清理。[升级成功的定义](../../GLOSSARY.md) |

## 系统服务的边界

前台模式由终端中的启动器负责这次会话。若另行支持系统服务，可让 systemd 或 Windows 服务控制管理器负责启动、停止和按配置重启外层进程。Windows 需实现服务入口或使用服务宿主。版本选择、资料恢复和产品就绪仍由 Noyau 判断。管理员停止服务时，内部启动器也应停止拉起子进程。[systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) · [Windows 服务控制管理器](https://learn.microsoft.com/en-us/windows/win32/services/service-control-manager) · [Windows 服务入口](https://learn.microsoft.com/en-us/windows/win32/services/service-entry-point)

## 实验和待验证的行为

**Windows 前台小实验。** 在 PowerShell 的实际伪终端（PTY）中，用 Node.js v24.22.3 的 `fork` 启动子进程，继承终端并保留 IPC。实验只用一份模拟资料和本机 HTTP 读取接口。

- 升级成功时，启动器 PID 始终为 3676，旧版和新版子进程的 PID 不同。两个子进程先后在同一回环端口 62740 返回原标记和模拟迁移后的标记。重跑固定命令后选中了新版。
- 候选版失败退出时，仍在前台的启动器恢复了模拟资料，随后旧版在原端口重新提供读取。
- 另一轮中，候选版已退出、成功标记尚未写入，启动器也以退出码 52 结束。重跑原入口后自动恢复旧版，经本机接口读回了原标记。
- 两条命令分开运行的实验使用 Windows 命名管道。独立的控制进程请求升级，收到成功结果后退出。原启动器继续运行，另一次 HTTP 请求随即从原端口读回新版资料。
- 在单独的 Ctrl+C 实验中，磁盘日志记录了启动器和子进程都收到 SIGINT，子进程还收到了启动器发来的停止请求。外层 PowerShell 会话随即以 Windows 控制台中断状态退出，这次观测未能确认所有收尾步骤都已执行。

**仍待验证。** 原生 Ubuntu 和两端实际发布包仍需验证。Ctrl+C、关闭终端或强杀启动器以后，需要核对在途写入、退出码及是否残留子进程。整机断电、实际资料迁移、成功记录持久化和资料恢复各阶段中断，需要检查下次使用的程序和资料是否配套。固定启动器自身的更新也需要单独验证。
