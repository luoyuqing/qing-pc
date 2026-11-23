# Qing PC · Windows 桌面端（基于 Element）

> 清助理的桌面客户端。聊天沿用 **Element**（Matrix 官方客户端）的完整能力，
> 业务页与手机版（[luoyuqing/qing](https://github.com/luoyuqing/qing)）共用同一套 Matrix 服务端与 device-hub。

本仓库是 [element-hq/element-web](https://github.com/element-hq/element-web) monorepo 的私有分支，
在 `apps/web` 内新增 `src/qing/` 业务层，并按清助理的品牌与导航改造。

---

## 与上一代的关系

| | 上一代 `qing-pc`（Flutter） | 本代（Element） |
|---|---|---|
| 底座 | Flutter + FluffyChat | Element Web（TypeScript / React 19 / Vite）+ Electron |
| Matrix 内核 | `matrix-dart-sdk` | `matrix-js-sdk`（Element 官方） |
| 聊天体验 | 自绘 | Element 原生（端到端加密、线程、空间、通话、搜索） |
| 桌面产物 | exe + DLL 目录 | Electron 免安装包 / 安装包 |

## 五个 Tab（与手机版底部导航一致）

| Tab | 实现 | 数据来源 |
|---|---|---|
| **聊天** | Element 原生界面 | Matrix（`matrix-js-sdk`） |
| **简报** | `apps/web/src/qing/pages/BriefingPage.tsx` | `GET /briefing/day`、`POST /briefing/request`、`PATCH /todos/{id}` |
| **任务** | `TasksPage.tsx` | `GET /tasks/sessions`、`/tasks/sessions/{id}/messages` |
| **服务** | `ServicesPage.tsx` | `GET /svc/catalog`、`POST /svc/ticket`、`GET /svc/fav/list` |
| **设置** | `SettingsPage.tsx` | device-hub 地址 / Bearer token / 人设 + 连通性自检 |

导航实现见 `apps/web/src/qing/QingShell.tsx`：以浮层形式叠在 Element 三栏布局之上，
不改动其 flex 结构，切回「聊天」时 Element 组件保持挂载、不丢状态。

## 首次使用

1. 登录：填自建 homeserver（tuwunel）地址，用手机版同一账号。
2. 左侧「设置」：填 device-hub 地址（默认 `http://192.168.1.10:8787`）与配对 token → **保存并测试**。
3. 「简报 / 任务 / 服务」即刻可用。

## 构建

```bash
pnpm install --frozen-lockfile
pnpm --filter element-web exec nx build            # -> apps/web/webapp
cp -r apps/web/webapp apps/desktop/webapp
cd apps/desktop && pnpm exec asar p webapp webapp.asar
pnpm exec electron-builder --win zip --x64 --publish never   # -> apps/desktop/dist
```

CI：`.github/workflows/qing-pc-windows.yml`（`windows-latest` + Node 22 + pnpm），
推送到 `main` / `element` 触发，打 `v*` 标签自动挂 Release。

## 品牌与图标

- 产品名：`apps/desktop/element.io/release/build.json` → `Qing PC`
- Web 品牌：`apps/web/config.sample.json` → `brand: "Qing PC"`
- 图标：`apps/desktop/build/icon.ico`、`icon.png`、`icon.icon/Assets/element.png`、
  `apps/web/res/vector-icons/*.png` —— 全部由手机版 iOS 1024 图标派生，与 App 一致。

## 已知限制

- 服务页的「本机服务」在桌面端用系统浏览器新窗口打开（手机端是内嵌 WebView）。
- 手机通知、短信、通讯录、日历、定位仍由 Android 端采集，PC 通过 device-hub 读取。
- 未做 Element 的 i18n 翻译接入，Qing 面板文案为简体中文硬编码。

## 许可

上游 Element Web 采用 AGPL-3.0 / GPL-3.0 / 商业三重许可，本分支沿用 AGPL-3.0，
详见 `LICENSE-AGPL-3.0`、`LICENSE-GPL-3.0`。修改说明见本文件与提交记录。
