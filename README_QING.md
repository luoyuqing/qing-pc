# Qing PC · Windows 桌面端（基于 Element）

> 清助理的桌面客户端。聊天沿用 **Element**（Matrix 官方客户端）的完整能力，
> 业务页与手机版（[luoyuqing/qing](https://github.com/luoyuqing/qing)）共用同一套 Matrix 服务端与 device-hub。

本仓库是 [element-hq/element-web](https://github.com/element-hq/element-web) monorepo 的私有分支，
在 `apps/web` 内新增 `src/qing/` 业务层，并按清助理的品牌与导航改造。

---

## 与上一代的关系

|             | 上一代 `qing-pc`（Flutter） | 本代（Element）                                               |
| ----------- | --------------------------- | ------------------------------------------------------------- |
| 底座        | Flutter + FluffyChat        | Element Web（TypeScript / React 19 / Webpack + Nx）+ Electron |
| Matrix 内核 | `matrix-dart-sdk`           | `matrix-js-sdk`（Element 官方）                               |
| 聊天体验    | 自绘                        | Element 原生（端到端加密、线程、空间、通话、搜索）            |
| 桌面产物    | exe + DLL 目录              | Electron 免安装包 / 安装包                                    |

## 五个 Tab（与手机版底部导航一致）

| Tab      | 实现                                       | 数据来源                                                           |
| -------- | ------------------------------------------ | ------------------------------------------------------------------ |
| **聊天** | Element 原生界面                           | Matrix（`matrix-js-sdk`）                                          |
| **简报** | `apps/web/src/qing/pages/BriefingPage.tsx` | `GET /briefing/day`、`POST /briefing/request`、`PATCH /todos/{id}` |
| **任务** | `TasksPage.tsx`                            | `GET /tasks/sessions`、`/tasks/sessions/{id}/messages`             |
| **服务** | `ServicesPage.tsx`                         | `GET /svc/catalog`、`POST /svc/ticket`、`GET /svc/fav/list`        |
| **设置** | `SettingsPage.tsx`                         | device-hub 地址 / Bearer token / 人设 + 连通性自检                 |

导航实现见 `apps/web/src/qing/QingShell.tsx`：以浮层形式叠在 Element 三栏布局之上，
不改动其 flex 结构，切回「聊天」时 Element 组件保持挂载、不丢状态。
业务页面按需加载；覆盖聊天时禁用底层交互，未读数随 Matrix 房间事件更新。

任务页提供会话搜索、摘要、翻页、按账号/人设隔离的收藏、跨房间恢复，以及定时任务编辑、执行和历史。
设置中的记忆库、模型、用量、连接应用、MCP、设备、审计与诊断入口与手机版共用 device-hub 协议。
归档位于设置的次级入口，一级导航仍为五项。Qing 文案已接入 Element i18n，提供简体中文和英文。

## 首次使用

1. 登录：填自建 homeserver（tuwunel）地址，用手机版同一账号。
2. 左侧「设置」：填 device-hub 地址（默认 `http://192.168.1.10:8787`）与配对 token → **保存并测试**。
3. 「简报 / 任务 / 服务」即刻可用。

## 构建

```bash
pnpm install --frozen-lockfile
# 首次构建使用仓库原有的 Qing 默认配置；已有自定义配置时保留它
test -f apps/web/config.json || cp apps/web/qing.config.json apps/web/config.json
# 清除旧哈希 bundle，避免重复构建把历史资源一起打进包
rm -rf apps/web/webapp
pnpm --filter element-web exec nx build            # -> apps/web/webapp
# webapp 是生成目录，复制前清掉旧输出，避免产生 webapp/webapp 嵌套
rm -rf apps/desktop/webapp
cp -r apps/web/webapp apps/desktop/webapp
pnpm exec nx run element-desktop:build:ts
pnpm exec nx run element-desktop:build:res
cd apps/desktop && pnpm exec asar p webapp webapp.asar
pnpm exec electron-builder --win zip --x64 --publish never   # -> apps/desktop/dist
```

Linux 交叉打包需 Wine。Windows x64 Seshat 预编译依赖由工作区的 `supportedArchitectures` 安装，
打包结束会校验其 Windows PE 格式。Linux/macOS 交叉打包跳过不支持跨编译的可选智能卡模块，
因此该 ZIP 不提供 PKCS#11/X.509 智能卡登录；常规 Matrix 登录与本地消息搜索保留。
需要智能卡时，在 Windows PowerShell 中原生构建（需 Node 22、pnpm、Python 和 Visual Studio C++ 构建工具）：

```powershell
pnpm install --frozen-lockfile
if (!(Test-Path apps/web/config.json)) { Copy-Item apps/web/qing.config.json apps/web/config.json }
if (Test-Path apps/web/webapp) { Remove-Item -Recurse -Force apps/web/webapp }
pnpm --filter element-web exec nx build
if (Test-Path apps/desktop/webapp) { Remove-Item -Recurse -Force apps/desktop/webapp }
Copy-Item -Recurse apps/web/webapp apps/desktop/webapp
pnpm exec nx run element-desktop:build:ts
pnpm exec nx run element-desktop:build:res
Set-Location apps/desktop
pnpm exec asar p webapp webapp.asar
pnpm exec electron-builder --win zip --x64 --publish never
```

CI：`.github/workflows/qing-pc-windows.yml`（`windows-latest` + Node 22 + pnpm），
推送到 `main` / `element` 触发，打 `v*` 标签自动挂 Release。

## 品牌与图标

- 产品名：`apps/desktop/element.io/release/build.json` → `Qing PC`
- Web 品牌：`apps/web/qing.config.json` → `brand: "Qing PC"`（首次构建复制为 `config.json`）
- 图标：`apps/desktop/build/icon.ico`、`icon.png`、`icon.icon/Assets/element.png`、
  `apps/web/res/vector-icons/*.png` —— 全部由手机版 iOS 1024 图标派生，与 App 一致。

## 已知限制

- Electron 中本机服务使用内置独立窗口；Web 环境使用浏览器新窗口。服务白名单和票据协议保持原样。
- 通知、短信、通讯录、日历和应用时长由 Android 端采集，PC 通过已有查询接口读取。
  手机的定位/文件采集、应用锁、生物识别、系统分享入口和 APK 更新不迁移为网页功能。
- 单实例多账号切换及手机专属聊天气泡配色尚未实现，可先使用不同桌面实例/系统用户和 Element 原生主题。
- 业务协议测试使用模拟 device-hub；真实私有服务需要使用者自己的账号与配对信息联调。

## 许可

上游 Element Web 采用 AGPL-3.0 / GPL-3.0 / 商业三重许可，本分支沿用 AGPL-3.0，
详见 `LICENSE-AGPL-3.0`、`LICENSE-GPL-3.0`。修改说明见本文件与提交记录。
