/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 设置

菜单顺序与结构严格对齐手机端 settings_view.dart：
一长条列表，两条分隔线（安全之后、隐私前后），没有自定义分组标题。

1  聊天备份      2  账号管理      3  修改主题      4  通知
5  记忆          6  设备数据      7  服务器状态    8  服务
9  模型与推理   10  凭据         11  插件与能力   12  用量
13 连接应用     14  数据与隐私   15  设备
16 聊天         17  安全
--- 分隔 ---
18 隐私
--- 分隔 ---
19 退出登录
*/

import { _t } from "../../languageHandler";
import React, { useState } from "react";
import { isSpacePanelVisible, setSpacePanelVisible } from "../spacePanel";
import { UserTab } from "../../components/views/dialogs/UserTab";
import { QingPanel } from "../QingPanel";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { DEFAULT_BASE_URL, hub, loadConfig, saveConfig } from "../hub";
import { friendlyError } from "../status";
import { Button, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";
import { PluginsPage } from "./PluginsPage";
import { ModelPage } from "./ModelPage";
import { UsagePage } from "./UsagePage";
import { ServerPage } from "./ServerPage";
import { MemoryPage } from "./MemoryPage";
import { McpPage } from "./McpPage";
import { PrivacyPage } from "./PrivacyPage";
import { DeviceDataPage } from "./DeviceDataPage";
import { CredentialsPage } from "./CredentialsPage";

type Route =
    | "root"
    | "memory"
    | "device-data"
    | "hub"
    | "server"
    | "model"
    | "credentials"
    | "plugins"
    | "usage"
    | "mcp"
    | "privacy"
    | "devices"
    | "audit"
    | "diagnose";

type MenuAction = "element" | "tab" | "logout" | "route";

interface MenuItem {
    label: string;
    desc?: string;
    action: MenuAction;
    route?: Route;
    danger?: boolean;
    elementTab?: UserTab;
}

function getMENU(): (MenuItem | "divider" | string)[] {
    return [
        // ---- Qing 管理（本机 / X2 上的真实功能）----
        _t("qing|text_3639c03f"),
        { label: _t("qing|text_2e412e23"), desc: _t("qing|text_ef51c8c2"), action: "route", route: "server" },
        { label: _t("qing|text_7a6335b3"), desc: _t("qing|text_65aa356d"), action: "route", route: "memory" },
        { label: _t("qing|text_f8db5bcd"), desc: _t("qing|text_b8336954"), action: "route", route: "model" },
        { label: _t("qing|text_2dfe17d7"), desc: _t("qing|text_5511157b"), action: "route", route: "credentials" },
        { label: _t("qing|text_a1226a32"), desc: _t("qing|text_f2e4ea11"), action: "route", route: "plugins" },
        { label: _t("qing|text_42723e8b"), desc: _t("qing|text_396f6bab"), action: "route", route: "usage" },
        { label: _t("qing|text_61766385"), desc: _t("qing|text_acf5b92b"), action: "route", route: "device-data" },
        { label: _t("qing|text_b1bea287"), desc: _t("qing|text_46107fe2"), action: "route", route: "mcp" },
        { label: _t("qing|text_ebdc835e"), desc: _t("qing|text_8307a884"), action: "route", route: "privacy" },

        { label: _t("qing|text_1df28f61"), desc: _t("qing|text_4860c010"), action: "route", route: "devices" },
        { label: _t("qing|text_b119a5b0"), desc: _t("qing|text_37deeea2"), action: "route", route: "audit" },
        { label: _t("qing|text_de94f8b3"), desc: _t("qing|text_cd743d68"), action: "route", route: "diagnose" },

        // ---- Element 自带设置（放最后）----
        _t("qing|text_9dc52899"),
        {
            label: _t("qing|text_ec008db5"),
            elementTab: UserTab.Encryption,
            desc: _t("qing|text_4149ecb2"),
            action: "element",
        },
        {
            label: _t("qing|text_eba54690"),
            elementTab: UserTab.Account,
            desc: _t("qing|text_fb7c3438"),
            action: "element",
        },
        {
            label: _t("qing|text_bbdf68b6"),
            elementTab: UserTab.Appearance,
            desc: _t("qing|text_f61d2446"),
            action: "element",
        },
        {
            label: _t("qing|text_4b6ded8a"),
            elementTab: UserTab.Notifications,
            desc: _t("qing|text_5ae17875"),
            action: "element",
        },
        {
            label: _t("qing|text_4b3510b8"),
            elementTab: UserTab.Preferences,
            desc: _t("qing|text_9d968683"),
            action: "element",
        },
        {
            label: _t("qing|text_afb63a62"),
            elementTab: UserTab.Security,
            desc: _t("qing|text_3a6f1df1"),
            action: "element",
        },
        {
            label: _t("qing|text_86651d17"),
            elementTab: UserTab.Preferences,
            desc: _t("qing|text_1dc27134"),
            action: "element",
        },

        "divider",
        { label: _t("qing|text_3ab8cc15"), action: "logout", danger: true },
    ];
}

const CopyButton: React.FC<{ value: string }> = ({ value }): React.ReactNode => {
    const [copied, setCopied] = useState(false);
    const copy = (): void => {
        if (!value || !navigator.clipboard?.writeText) return;
        void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <Button disabled={!value} onClick={copy}>
            {copied ? _t("qing|copied") : _t("qing|copy")}
        </Button>
    );
};

/** device-hub 连接：地址 + 配对码（与手机端一致，不要求手抄 48 位令牌） */
const HubForm: React.FC<{ onBack: () => void; onPaired: () => void }> = ({ onBack, onPaired }): React.ReactNode => {
    const initial = loadConfig();
    const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
    const [code, setCode] = useState("");
    const [token, setToken] = useState(initial.token);
    const [advanced, setAdvanced] = useState(false);
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const p = palette();

    const box: React.CSSProperties = {
        width: "100%",
        boxSizing: "border-box",
        padding: "9px 12px",
        fontSize: 13.5,
        borderRadius: 8,
        outline: "none",
        border: `1px solid ${p.border}`,
        background: p.bgAlt,
        color: p.text,
    };

    const doPair = async (): Promise<void> => {
        if (!/^\d{6}$/.test(code.trim())) {
            setStatus({ ok: false, text: _t("qing|text_53daa573") });
            return;
        }
        setBusy(true);
        setStatus(null);
        try {
            const r = await hub.pair(code.trim(), "Qing PC", baseUrl.trim());
            if (!r?.token) throw new Error(_t("qing|text_625ba281"));
            saveConfig({ baseUrl, token: r.token, persona: initial.persona });
            setToken(r.token);
            setStatus({
                ok: true,
                text: _t("qing|text_db15c3eb", {
                    v0: r.device_id ? _t("qing|text_3534292b", { v0: r.device_id }) : "",
                }),
            });
            setCode("");
            onPaired();
        } catch (e) {
            setStatus({ ok: false, text: _t("qing|text_990729ee", { v0: friendlyError(e) }) });
        }
        setBusy(false);
    };

    const test = async (): Promise<void> => {
        setBusy(true);
        setStatus(null);
        saveConfig({ baseUrl, token, persona: initial.persona });
        try {
            const h = await hub.health();
            await hub.personas();
            setStatus({ ok: true, text: _t("qing|text_0e58a688", { v0: h?.version ?? "ok" }) });
        } catch (e) {
            setStatus({
                ok: false,
                text: friendlyError(e),
            });
        }
        setBusy(false);
    };

    return (
        <>
            <PageHeader title={_t("qing|text_61766385")} subtitle={_t("qing|text_6394f154")} onBack={onBack} />
            <Scroll>
                <div style={{ maxWidth: 560 }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>
                            {_t("qing|text_e0153852")}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                aria-label={_t("qing|text_e0153852")}
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder={DEFAULT_BASE_URL}
                                style={{ ...box, flex: 1 }}
                            />
                            <CopyButton value={baseUrl} />
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>
                            {_t("qing|text_5cfc08a6")}
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <input
                                aria-label={_t("qing|text_5cfc08a6")}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder={_t("qing|text_7ce6963f")}
                                inputMode="numeric"
                                style={{ ...box, width: 160, letterSpacing: 4, fontSize: 16 }}
                            />
                            <Button variant="primary" disabled={busy} onClick={() => void doPair()}>
                                {busy ? _t("qing|text_d3d21191") : _t("qing|text_7c5cc4dd")}
                            </Button>
                        </div>
                        <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 6, lineHeight: 1.6 }}>
                            {_t("qing|text_f47e1375")}
                        </div>
                    </div>

                    <div style={{ marginBottom: 6 }}>
                        <button
                            type="button"
                            onClick={() => setAdvanced((v) => !v)}
                            style={{ fontSize: 12, color: p.accent, cursor: "pointer" }}
                        >
                            {advanced ? _t("qing|text_07e5d282") : _t("qing|text_752778e5")}
                        </button>
                    </div>
                    {advanced && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>
                                {_t("qing|text_c4e928b0")}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    type="password"
                                    aria-label={_t("qing|text_70133285")}
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    style={{ ...box, flex: 1 }}
                                />
                                <CopyButton value={token} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <Button disabled={busy} onClick={() => void test()}>
                            {_t("qing|text_0a98a48e")}
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={() => {
                                saveConfig({ baseUrl, token, persona: initial.persona });
                                setStatus({ ok: true, text: _t("qing|text_1bd91a7d") });
                            }}
                        >
                            {_t("qing|text_0adada7d")}
                        </Button>
                    </div>

                    {token && (
                        <Button
                            disabled={busy}
                            onClick={() => {
                                saveConfig({ baseUrl, token: "", persona: initial.persona });
                                setToken("");
                                setStatus({ ok: true, text: _t("qing|text_b04db03c") });
                            }}
                        >
                            {_t("qing|text_0c02ceca")}
                        </Button>
                    )}

                    {status && (
                        <div
                            role={status.ok ? "status" : "alert"}
                            style={{
                                marginTop: 14,
                                fontSize: 12.5,
                                color: status.ok ? p.accent : p.danger,
                                wordBreak: "break-word",
                            }}
                        >
                            {status.text}
                        </div>
                    )}

                    <div style={{ marginTop: 24, fontSize: 11.5, color: p.textDim, lineHeight: 1.7 }}>
                        {_t("qing|text_2438ea54")}
                    </div>
                </div>
            </Scroll>
        </>
    );
};

const Divider: React.FC = (): React.ReactNode => {
    const p = palette();
    return <div style={{ height: 1, background: p.border, margin: "10px 0" }} />;
};

export const SettingsPage: React.FC<{
    onNavigateElement: () => void;
    onNavigateTab?: (tab: "services") => void;
    onOpenRoom?: (roomId: string) => void;
}> = ({ onNavigateElement, onNavigateTab, onOpenRoom }): React.ReactNode => {
    const [spacePanel, setSpacePanel] = useState(isSpacePanelVisible);
    const [route, setRoute] = useState<Route>("root");
    const p = palette();
    const back = (): void => setRoute("root");

    if (route === "hub") return <HubForm onBack={back} onPaired={back} />;
    if (route === "memory") return <MemoryPage onBack={back} initialPersona={loadConfig().persona} />;
    if (route === "device-data") return <DeviceDataPage onBack={back} onOpenHub={() => setRoute("hub")} />;
    if (route === "server") return <ServerPage onBack={back} />;
    if (route === "model") return <ModelPage onBack={back} />;
    if (route === "credentials") return <CredentialsPage onBack={back} />;
    if (route === "usage") return <UsagePage onBack={back} />;
    if (route === "mcp") return <McpPage onBack={back} />;
    if (route === "privacy") return <PrivacyPage onBack={back} />;

    if (route === "plugins") return <PluginsPage onBack={back} />;

    if (route === "devices" || route === "audit" || route === "diagnose")
        return <QingPanel key={route} resource={route} persona={loadConfig().persona} onBack={back} />;

    /**
     * Element 自带设置是 Modal（UserSettingsDialog），只能通过 dispatcher 触发。
     * 同步 fire，不延迟——延迟会让组件先卸载，实测时机不可靠。
     * 优先用 Element 注册在 window 上的单例，其次退回 import 的实例。
     */
    const openElementSettings = (initialTabId = UserTab.Account): void => {
        dis.dispatch({ action: Action.ViewUserSettings, initialTabId });
        onNavigateElement();
    };
    const logout = (): void => {
        dis.dispatch({ action: "logout" });
        onNavigateElement();
    };

    return (
        <>
            <PageHeader title={_t("qing|text_df3d58c7")} />
            <Scroll>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
                    <input
                        type="checkbox"
                        checked={spacePanel}
                        onChange={(event) => {
                            setSpacePanel(event.target.checked);
                            setSpacePanelVisible(event.target.checked);
                        }}
                    />
                    {_t("qing|space_panel")}
                </label>
                <div
                    style={{
                        borderRadius: 12,
                        background: p.bgAlt,
                        border: `1px solid ${p.divider}`,
                        overflow: "hidden",
                    }}
                >
                    {getMENU().map((item, i) => {
                        if (item === "divider") return <Divider key="divider" />;
                        if (typeof item === "string") {
                            const title = item.slice(6);
                            return (
                                <div
                                    key={item}
                                    style={{
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: p.textDim,
                                        padding: i === 0 ? "12px 14px 6px" : "16px 14px 6px",
                                        borderTop: i === 0 ? "none" : `1px solid ${p.divider}`,
                                        letterSpacing: 0.3,
                                    }}
                                >
                                    {title}
                                </div>
                            );
                        }
                        return (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                    if (item.action === "route" && item.route) setRoute(item.route);
                                    else if (item.action === "element") openElementSettings(item.elementTab);
                                    else if (item.action === "tab") onNavigateTab?.("services");
                                    else if (item.action === "logout") logout();
                                }}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "11px 14px",
                                    border: "none",
                                    borderTop: `1px solid ${p.divider}`,
                                    background: "transparent",
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: 13.5,
                                            fontWeight: 500,
                                            color: item.danger ? p.danger : p.text,
                                        }}
                                    >
                                        {item.label}
                                    </div>
                                    {item.desc && (
                                        <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>
                                            {item.desc}
                                        </div>
                                    )}
                                </div>
                                {!item.danger && <span style={{ color: p.textDim, fontSize: 14 }}>›</span>}
                            </button>
                        );
                    })}
                </div>
                <div style={{ height: 20 }} />
            </Scroll>
        </>
    );
};
