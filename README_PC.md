# Qing Windows 迁移工作版

本目录包含完整上游客户端源码与 Windows 适配改动。真实后端联调尚未完成；不能把客户端编译通过等同于全功能已验收。

## 本批改动

- 宽度达到 1100 时显示桌面导航：聊天、简报、任务、记忆、服务、设置；小窗口保留原有导航。
- 简报、任务、记忆、服务与设置从聊天双栏分离，聊天继续沿用原会话双栏。
- Windows 初始窗口调整为 1280×800，标题改为 Qing Assistant。
- 服务页右上角增加“配置服务网关”，持久化 HTTPS 网关和明确列出的允许服务域名，不再把配对令牌发送到原作者固定的服务网关。
- Windows 服务页面接入 flutter_inappwebview / WebView2，包含后退、刷新、进度、主页面错误提示、导航域名校验与 Cookie 清理分支。移动端继续使用原有 WebView。
- 非 Android 平台不显示手机本机授权和同步按钮；电脑配对名称改为 Qing PC。服务端若向电脑发送手机采集命令，明确返回不支持，而非调用不存在的 Android 插件。
- 添加网关配置测试、桌面导航组件测试和手动触发的 Windows GitHub Actions 构建工作流。
- Windows 录音接入现有 record_windows 实现，使用 AAC；视频接入 video_player_win，不再只提供下载。实际麦克风、视频编码和通话仍需设备测试。
- 电脑文件索引支持用户选择目录、撤销授权、本机自检及响应后端 files 查询。只读元数据，限制深度、数量和查询时间，不跟随符号链接。
- Windows 更新优先使用后端 `/app/release` 的 `windows_url` / `windows_size`，GitHub 回退只选择名称包含 Windows 平台标识的 ZIP/MSIX/EXE。没有桌面产物时明确提示，不下载 APK。
- EXE 名称改为 qing.exe，资源信息和窗口标题显示 Qing Assistant。

## 接现有后端

1. 在原有 Matrix 登录页面填写自己的 Matrix 地址并登录。
2. 在设置的设备数据页填写 device-hub 地址，保存并使用服务端生成的新设备配对码，独立配对电脑。不要复制手机设备令牌。
3. 在服务页右上角“配置服务网关”中填写提供 `/svc/catalog`、`/svc/ticket` 等接口的 HTTPS 地址。该地址可以不同于 device-hub。
4. 逐个列出实际服务域名及登录票据可能跳转到的域名，不支持通配符，未列出的域名不会打开。保存后自动刷新目录。
5. 手机数据仍由原 Android 客户端采集。后端必须能把手机采集请求路由到手机；PC 配对本身不会替代手机采集。

未配置网关时，服务页会提示配置，不会自动连接原作者域名。现有服务端是否允许同一账号的 PC 使用手机数据，仍需联调确认。

## 构建

使用 `.fvmrc` 指定的 Flutter 3.47.8、Windows C++ 编译工具（含 ATL）、Windows SDK、CMake、NASM、NuGet、Rust stable 和 WebView2 Runtime。依赖已经解析并更新 pubspec.lock。建议使用短目录，如 C:\src\qing，避免原生插件路径超过 Windows 限制。也可将父目录映射到盘符后，在其子目录中构建；不要直接从映射盘根目录构建。

```powershell
flutter doctor -v
flutter config --enable-windows-desktop
flutter pub get
flutter test test/service_gateway_config_test.dart test/qing_desktop_shell_test.dart test/desktop_files_test.dart
flutter build windows --release
```

构建后分发整个 `build/windows/x64/runner/Release` 文件夹，不能只复制其中的 EXE。`.github/workflows/qing-windows.yml` 可在你自己的仓库里手动触发，产物同样是整个 Release 文件夹，不是安装向导。当前没有推送或触发任何远程工作流。

## 验证记录与剩余工作

2026-11-20：已安装 Git、Flutter 3.47.8（Dart 3.13.7）、Visual Studio Build Tools、Windows SDK、ATL、Rust，并准备了 CMake、NASM、NuGet。新增的 6 项 Flutter 测试全部通过，覆盖域名校验、网关地址校验、桌面导航、文件索引及目录设置页；早期 17 项独立网关检查也通过。

Windows Release 最终构建成功，产物为 qing.exe 及完整依赖。新增文件选择接口错误已修正，修正后的全量 Flutter 静态分析无 error，仍有上游警告和样式提示。直接运行 dart analyze 会被上游 `dart_code_linter: latest` 插件配置阻塞。构建过程中处理了工具缺失、依赖下载失败、Windows 长路径、中文代码页及 ATL 组件缺失问题。程序已完成本地启动检查，进入登录界面。

仍需实机验收：录音、视频、通话、通知、WebView2 与票据登录、后台与更新，以及全部业务的真实后端回归。手机通知、短信、通讯录、日历、定位、使用时长依赖原 Android 采集端和后端多设备路由，电脑端没有伪造对应数据。详细功能矩阵见目录外的 Qing-PC迁移评估.md。

请保留上游 LICENSE、LICENSES 和现有版权文件。
