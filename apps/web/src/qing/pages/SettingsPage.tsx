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

import React, { useState } from "react";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { DEFAULT_BASE_URL, hub, loadConfig, saveConfig } from "../hub";
import { Button, Card, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";
import { ListPage } from "./ListPage";
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
    | "devices";

type Action = "element" | "tab" | "logout" | "route";

interface MenuItem {
    label: string;
    desc?: string;
    action: Action;
    route?: Route;
    danger?: boolean;
}

const MENU: (MenuItem | "divider")[] = [
    { label: "聊天备份", desc: "端到端加密密钥备份", action: "element" },
    { label: "账号管理", desc: "头像、昵称、密码", action: "element" },
    { label: "修改主题", desc: "深色/浅色、字号、布局", action: "element" },
    { label: "通知", desc: "系统通知、提示音、免打扰", action: "element" },
    { label: "记忆", desc: "记忆 · 画像 · 技能 · 人设", action: "route", route: "memory" },
    { label: "设备数据", desc: "通知 · 日历 · 通讯录 · 应用时长", action: "route", route: "device-data" },
    { label: "服务器状态", desc: "CPU、内存、磁盘、服务与容器的实时占用", action: "route", route: "server" },
    { label: "服务", desc: "本机管理页面 · 一次性票据打开", action: "tab" },
    { label: "模型与推理", desc: "端点 · 模型 · 候选池 · 备用链（按人设独立）", action: "route", route: "model" },
    { label: "凭据", desc: "模型端点的 API Key 增删改", action: "route", route: "credentials" },
    { label: "插件与能力", desc: "X2 上已安装 / 内置的插件", action: "route", route: "plugins" },
    { label: "用量", desc: "请求数 · Tokens · 预估花费（按模型/人设）", action: "route", route: "usage" },
    { label: "连接应用", desc: "MCP 服务（由 X2 代理，凭据不上手机）", action: "route", route: "mcp" },
    { label: "数据与隐私", desc: "数据保留策略 · 存储位置", action: "route", route: "privacy" },
    { label: "设备", desc: "已配对设备与令牌", action: "route", route: "devices" },
    { label: "聊天", desc: "消息显示、媒体、链接预览", action: "element" },
    { label: "安全", desc: "加密、会话验证、密钥备份", action: "element" },
    "divider",
    { label: "隐私", desc: "已读回执、输入状态、分析", action: "element" },
    "divider",
    { label: "退出登录", action: "logout", danger: true },
];

/** device-hub 连接：地址 + 配对码（与手机端一致，不要求手抄 48 位令牌） */
const HubForm: React.FC<{ onBack: () => void; onPaired: () => void }> = ({ onBack, onPaired }) => {
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

    const doPair = async () => {
        if (!/^\d{6}$/.test(code.trim())) {
            setStatus({ ok: false, text: "配对码是 6 位数字。" });
            return;
        }
        setBusy(true);
        setStatus(null);
        try {
            const r = await hub.pair(code.trim(), "Qing PC");
            if (!r?.token) throw new Error("服务端没有返回令牌");
            saveConfig({ baseUrl, token: r.token, persona: initial.persona });
            setToken(r.token);
            setStatus({ ok: true, text: `配对成功${r.device_id ? `，设备 ${r.device_id} 已登记` : ""}` });
            setCode("");
            onPaired();
        } catch (e) {
            setStatus({ ok: false, text: `配对失败：${(e as Error).message}` });
        }
        setBusy(false);
    };

    const test = async () => {
        setBusy(true);
        setStatus(null);
        saveConfig({ baseUrl, token, persona: initial.persona });
        try {
            const h = await hub.health();
            await hub.personas();
            setStatus({ ok: true, text: `连接成功（device-hub ${h?.version ?? "ok"}，令牌有效）` });
        } catch (e) {
            const msg = (e as Error).message;
            setStatus({
                ok: false,
                text: /HTTP 401/.test(msg) ? "地址通了，但令牌无效（HTTP 401）。" : `连接失败：${msg}`,
            });
        }
        setBusy(false);
    };

    return (
        <>
            <PageHeader title="设备数据" subtitle="连接 X2 上的 device-hub" onBack={onBack} />
            <Scroll>
                <div style={{ maxWidth: 560 }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>device-hub 地址</div>
                        <input
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder={DEFAULT_BASE_URL}
                            style={box}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>配对码</div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <input
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="6 位数字"
                                inputMode="numeric"
                                style={{ ...box, width: 160, letterSpacing: 4, fontSize: 16 }}
                            />
                            <Button variant="primary" disabled={busy} onClick={() => void doPair()}>
                                {busy ? "处理中…" : "配对"}
                            </Button>
                        </div>
                        <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 6, lineHeight: 1.6 }}>
                            配对码在 X2 上生成（`POST /admin/pair-code`）。配对成功后令牌自动写入，不用手抄。
                        </div>
                    </div>

                    <div style={{ marginBottom: 6 }}>
                        <span
                            onClick={() => setAdvanced((v) => !v)}
                            style={{ fontSize: 12, color: p.accent, cursor: "pointer" }}
                        >
                            {advanced ? "收起手动令牌" : "已有令牌？手动填"}
                        </span>
                    </div>
                    {advanced && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>访问令牌（48 位）</div>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                style={box}
                            />
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <Button disabled={busy} onClick={() => void test()}>
                            测试连接
                        </Button>
                        <Button
                            onClick={() => {
                                saveConfig({ baseUrl, token, persona: initial.persona });
                                setStatus({ ok: true, text: "已保存" });
                            }}
                        >
                            仅保存
                        </Button>
                    </div>

                    {status && (
                        <div
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
                        通知、短信、通讯录、日历、定位与 App 使用时长由 Android 端采集上报，
                        PC 通过 device-hub 读取同一份数据。聊天沿用 Element 的 Matrix 会话。
                    </div>
                </div>
            </Scroll>
        </>
    );
};

const Divider: React.FC = () => {
    const p = palette();
    return <div style={{ height: 1, background: p.border, margin: "10px 0" }} />;
};

export const SettingsPage: React.FC<{
    onNavigateElement: () => void;
    onNavigateTab?: (tab: "services") => void;
    onLogout?: () => void;
}> = ({ onNavigateElement, onNavigateTab, onLogout }) => {
    const [route, setRoute] = useState<Route>("root");
    const p = palette();
    const back = () => setRoute("root");

    if (route === "hub") return <HubForm onBack={back} onPaired={back} />;
    if (route === "memory") return <MemoryPage onBack={back} initialPersona={loadConfig().persona} />;
    if (route === "device-data") return <DeviceDataPage onBack={back} onOpenHub={() => setRoute("hub")} />;
    if (route === "server") return <ServerPage onBack={back} />;
    if (route === "model") return <ModelPage onBack={back} />;
    if (route === "credentials") return <CredentialsPage onBack={back} />;
    if (route === "usage") return <UsagePage onBack={back} />;
    if (route === "mcp") return <McpPage onBack={back} />;
    if (route === "privacy") return <PrivacyPage onBack={back} />;

    if (route === "plugins")
        return (
            <ListPage
                title="插件与能力"
                subtitle="X2 上已安装与内置的插件"
                onBack={back}
                loader={() => hub.agentPlugins()}
                columns={[
                    { key: "name", title: true },
                    { key: "version", label: "版本" },
                    { key: "kind", label: "类型" },
                    { key: "description", label: "说明" },
                ]}
            />
        );

    if (route === "devices")
        return (
            <ListPage
                title="设备"
                subtitle="曾经连过 X2 的设备与令牌"
                onBack={back}
                hint="服务端暂未提供吊销接口，需要吊销请到 X2 上处理。"
                loader={() => hub.devices()}
                columns={[
                    { key: "name", title: true },
                    { key: "id", label: "设备 ID" },
                    { key: "scopes", label: "权限" },
                    { key: "revoked", label: "状态", render: (x) => (x.revoked ? "已吊销" : "有效") },
                    {
                        key: "last_seen",
                        label: "最近活跃",
                        render: (x) => `${x.last_seen ?? "—"}`.replace("T", " ").slice(0, 16),
                    },
                ]}
            />
        );

    const logout = async () => {
        if (!window.confirm("退出登录？本机缓存的消息会保留，重新登录即可恢复。")) return;
        try {
            await MatrixClientPeg.safeGet().logout(true);
        } catch {
            /* 网络失败也强制回登录页 */
        }
        onLogout?.();
    };

    return (
        <>
            <PageHeader title="设置" />
            <Scroll>
                {MENU.map((item, i) => {
                    if (item === "divider") return <Divider key={`d${i}`} />;
                    return (
                        <Card
                            key={item.label}
                            onClick={() => {
                                if (item.action === "route" && item.route) setRoute(item.route);
                                else if (item.action === "element") onNavigateElement();
                                else if (item.action === "tab") onNavigateTab?.("services");
                                else if (item.action === "logout") void logout();
                            }}
                            style={{ marginBottom: 6, padding: "11px 14px" }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                            </div>
                        </Card>
                    );
                })}
                <div style={{ height: 20 }} />
            </Scroll>
        </>
    );
};
