/*
Copyright 2022-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, autoUpdater, desktopCapturer, ipcMain, net, powerSaveBlocker, TouchBar, nativeImage, session } from "electron";

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

const initialisePromiseWithResolvers = Promise.withResolvers<void>();
export const initialisePromise = initialisePromiseWithResolvers.promise;

ipcMain.once("initialise", () => {
    initialisePromiseWithResolvers.resolve();
});
