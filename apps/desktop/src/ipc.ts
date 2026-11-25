/*
Copyright 2022-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, autoUpdater, BrowserWindow, desktopCapturer, ipcMain, net, powerSaveBlocker, TouchBar, nativeImage, session } from "electron";

import IpcMainEvent = Electron.IpcMainEvent;
import { randomArray } from "./utils.js";
import { consumeDisplayMediaCallback } from "./displayMediaCallback.js";
import Store, { clearData } from "./store.js";
import { getConfig } from "./config.js";

let focusHandlerAttached = false;
ipcMain.on("loudNotification", function (): void {
    if (process.platform === "win32" || process.platform === "linux") {
        if (global.mainWindow && !global.mainWindow.isFocused() && !focusHandlerAttached) {
            global.mainWindow.flashFrame(true);
            global.mainWindow.once("focus", () => {
                global.mainWindow?.flashFrame(false);
                focusHandlerAttached = false;
            });
            focusHandlerAttached = true;
        }
    }
});

let powerSaveBlockerId: number | null = null;
ipcMain.on("app_onAction", function (_ev: IpcMainEvent, payload) {
    switch (payload.action) {
        case "call_state": {
            if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
                if (payload.state === "ended") {
                    powerSaveBlocker.stop(powerSaveBlockerId);
                    powerSaveBlockerId = null;
                }
            } else {
                if (powerSaveBlockerId === null && payload.state === "connected") {
                    powerSaveBlockerId = powerSaveBlocker.start("prevent-display-sleep");
                }
            }
            break;
        }
    }
});

ipcMain.on("ipcCall", async function (_ev: IpcMainEvent, payload) {
    const store = Store.instance;
    if (!global.mainWindow || !store) return;

    const args = payload.args || [];
    let ret: any;
    let error: string | { message: string; name?: string } | undefined;

    switch (payload.name) {
        case "getUpdateFeedUrl":
            ret = autoUpdater.getFeedURL();
            break;
        case "setLanguage":
            global.appLocalization.setAppLocale(args[0]);
            break;
        case "getAppVersion":
            ret = app.getVersion();
            break;
        case "focusWindow":
            if (global.mainWindow.isMinimized()) {
                global.mainWindow.restore();
            } else {
                global.mainWindow.show();
                global.mainWindow.focus();
            }
            break;

        case "navigateBack":
            if (global.mainWindow.webContents.canGoBack()) {
                global.mainWindow.webContents.goBack();
            }
            break;
        case "navigateForward":
            if (global.mainWindow.webContents.canGoForward()) {
                global.mainWindow.webContents.goForward();
            }
            break;
        case "setSpellCheckEnabled":
            if (typeof args[0] !== "boolean") return;

            session.defaultSession.setSpellCheckerEnabled(args[0]);
            store.set("spellCheckerEnabled", args[0]);
            break;

        case "getSpellCheckEnabled":
            ret = store.get("spellCheckerEnabled");
            break;

        case "setSpellCheckLanguages":
            try {
                session.defaultSession.setSpellCheckerLanguages(args[0]);
            } catch (er) {
                console.log("There were problems setting the spellcheck languages", er);
            }
            break;

        case "getSpellCheckLanguages":
            ret = session.defaultSession.getSpellCheckerLanguages();
            break;
        case "getAvailableSpellCheckLanguages":
            ret = session.defaultSession.availableSpellCheckerLanguages;
            break;

        case "getPickleKey":
            try {
                ret = (await store.getSecret(`${args[0]}|${args[1]}`)) ?? null;
            } catch (e) {
                // An error is thrown if we can't initialise safeStorage, or if a stored secret exists
                // but can't be decrypted this launch (SafeStorageDecryptionError, e.g. the OS keychain
                // is temporarily unavailable). Report this to the renderer as an error rather than as
                // an absent pickle key: the two need very different handling. An absent key means a
                // new one can safely be created, whereas here we must NOT destroy the existing secret
                // (see createPickleKey below) and the read may well succeed if retried once the
                // keychain is readable again. See element-web#32521 / #32715.
                console.error("Failed to get pickle key", e);
                error = {
                    name: e instanceof Error ? e.name : "Error",
                    message: e instanceof Error ? e.message : String(e),
                };
            }
            break;

        case "createPickleKey":
            try {
                // Never overwrite a pickle key that already exists but is currently undecryptable.
                // Overwriting it with a freshly-generated key would turn a transient keychain failure
                // into permanent session and encryption-key loss. Preserve it so the existing session
                // can be restored on a later launch once the keychain is readable again.
                if (await store.isSecretUndecryptable(`${args[0]}|${args[1]}`)) {
                    console.warn("Refusing to overwrite an existing undecryptable pickle key; preserving it");
                    ret = null;
                } else {
                    const pickleKey = await randomArray(32);
                    await store.setSecret(`${args[0]}|${args[1]}`, pickleKey);
                    ret = pickleKey;
                }
            } catch (e) {
                console.error("Failed to create pickle key", e);
                ret = null;
            }
            break;

        case "destroyPickleKey":
            try {
                await store.deleteSecret(`${args[0]}|${args[1]}`);
            } catch (e) {
                console.error("Failed to destroy pickle key", e);
            }
            break;
        case "getDesktopCapturerSources":
            try {
                ret = (await desktopCapturer.getSources(args[0])).map((source) => ({
                    id: source.id,
                    name: source.name,
                    thumbnailURL: source.thumbnail.toDataURL(),
                }));
            } catch (e) {
                console.error("Failed to get desktop capturer sources", e);
                ret = [];
            }
            break;
        case "callDisplayMediaCallback":
            consumeDisplayMediaCallback()?.({ video: args[0] });
            ret = null;
            break;

        case "clearStorage":
            await clearData(global.mainWindow.webContents.session);
            ret = null;
            break;

        case "breadcrumbs": {
            if (process.platform === "darwin") {
                const { TouchBarPopover, TouchBarButton } = TouchBar;

                const recentsBar = new TouchBar({
                    items: args[0].map((r: { roomId: string; avatarUrl: string | null; initial: string }) => {
                        const defaultColors = ["#0DBD8B", "#368bd6", "#ac3ba8"];
                        let total = 0;
                        for (let i = 0; i < r.roomId.length; ++i) {
                            total += r.roomId.charCodeAt(i);
                        }

                        const button = new TouchBarButton({
                            label: r.initial,
                            backgroundColor: defaultColors[total % defaultColors.length],
                            click: (): void => {
                                void global.mainWindow?.loadURL(`vector://vector/webapp/#/room/${r.roomId}`);
                            },
                        });
                        if (r.avatarUrl) {
                            void global.mainWindow?.webContents.session
                                .fetch(r.avatarUrl)
                                .then((resp) => {
                                    if (!resp.ok) return;
                                    return resp.arrayBuffer();
                                })
                                .then((arrayBuffer) => {
                                    if (!arrayBuffer) return;
                                    const buffer = Buffer.from(arrayBuffer);
                                    button.icon = nativeImage.createFromBuffer(buffer);
                                    button.label = "";
                                    button.backgroundColor = "";
                                });
                        }
                        return button;
                    }),
                });

                const touchBar = new TouchBar({
                    items: [
                        new TouchBarPopover({
                            label: "Recents",
                            showCloseButton: true,
                            items: recentsBar,
                        }),
                    ],
                });
                global.mainWindow.setTouchBar(touchBar);
            }
            break;
        }

        default:
            global.mainWindow.webContents.send("ipcReply", {
                id: payload.id,
                error: "Unknown IPC Call: " + payload.name,
            });
            return;
    }

    global.mainWindow?.webContents.send("ipcReply", {
        id: payload.id,
        reply: ret,
        error,
    });
});

ipcMain.handle("getConfig", getConfig);

/**
 * 清助理 · device-hub 请求代理
 *
 * 渲染进程跑在 vector://vector 源下，直接 fetch 公网 device-hub 属于跨域请求；
 * device-hub 目前不返回 CORS 头（预检 OPTIONS 返回 501），浏览器会直接拒绝，
 * 表现为 "Failed to fetch"。主进程不受同源策略约束，这里代为转发。
 *
 * 顺带的好处：请求走 Chromium 网络栈（net.fetch），会自动使用系统代理设置。
 */
ipcMain.handle(
    "qingHubRequest",
    async (
        _ev,
        req: { url: string; method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number },
    ): Promise<{ ok: boolean; status: number; body: string }> => {
        let parsed: URL;
        try {
            parsed = new URL(req.url);
        } catch {
            throw new Error(`地址无效：${req.url}`);
        }
        // 只允许 http/https，杜绝 file:// 之类的本地读取
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error(`不支持的协议：${parsed.protocol}`);
        }

        const timeoutMs = Math.min(Math.max(req.timeoutMs ?? 10000, 1000), 60000);
        const res = await net.fetch(req.url, {
            method: req.method ?? "GET",
            headers: req.headers,
            body: req.body,
            signal: AbortSignal.timeout(timeoutMs),
        });
        const body = await res.text();
        return { ok: res.ok, status: res.status, body };
    },
);

/**
 * 清助理 · 本机服务打开
 *
 * 服务端（/__gate）的规则是：一次性票据换一次 302，接着种会话 cookie，裸访问一律 403。
 * 手机端用内置 WebView 打开，票据不会落到浏览器地址栏和历史里。
 *
 * 早期 PC 版直接 window.open 交给系统浏览器，会把 __gate?t=... 暴露在地址栏，
 * 而且那份会话 cookie 会长期留在系统浏览器里 —— 等于在客户端之外多开了一条入口。
 * 这里改成用独立的非持久 partition 开内置窗口，退出即清，与手机端行为一致。
 */
ipcMain.handle("qingOpenService", async (_ev, rawUrl: string): Promise<boolean> => {
    let u: URL;
    try {
        u = new URL(rawUrl);
    } catch {
        throw new Error("入口地址无效");
    }
    if (u.protocol !== "https:") throw new Error("只允许 https 入口");
    const host = u.hostname.toLowerCase();
    if (!(host === "3585616.xyz" || host.endsWith(".3585616.xyz"))) {
        throw new Error(`域名不在白名单内：${host}`);
    }

    const win = new BrowserWindow({
        width: 1100,
        height: 820,
        title: "服务",
        autoHideMenuBar: true,
        backgroundColor: "#fff",
        webPreferences: {
            // 不带 persist: 前缀 → 内存会话，窗口关掉 cookie 即失效
            partition: "qing-services",
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
    });
    // 站内跳转留在窗口内；跳到外部域名直接阻止，避免变成万能浏览器
    win.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const target = new URL(url);
            const h = target.hostname.toLowerCase();
            if (target.protocol === "https:" && (h === "3585616.xyz" || h.endsWith(".3585616.xyz"))) {
                void win.loadURL(url);
            }
        } catch {
            /* 忽略非法地址 */
        }
        return { action: "deny" };
    });
    // 等页面真正加载完再返回，前端据此收起「正在打开…」的等待态。
    // 加个上限，避免个别页面长连接一直不触发 did-finish-load 而卡住 UI。
    await Promise.race([
        win.loadURL(rawUrl),
        new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ]);
    return true;
});

const initialisePromiseWithResolvers = Promise.withResolvers<void>();
export const initialisePromise = initialisePromiseWithResolvers.promise;

ipcMain.once("initialise", () => {
    initialisePromiseWithResolvers.resolve();
});
