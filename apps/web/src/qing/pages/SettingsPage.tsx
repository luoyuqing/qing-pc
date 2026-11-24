/*
Qing PC · 设置
对齐手机端 settings_view.dart 的菜单结构：助理 / 服务器 / 运维 / 设备 / 应用。
助理与服务器相关页面直接读 device-hub；应用类跳到 Element 原生设置（不重复实现）。
*/

import React, { useCallback, useEffect, useState } from "react";
import { DEFAULT_BASE_URL, hub, loadConfig, saveConfig } from "../hub";
import { DataView } from "../DataView";
import { Button, Card, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";
import { ListPage } from "./ListPage";
import { ModelPage } from "./ModelPage";
import { UsagePage } from "./UsagePage";
import { ServerPage } from "./ServerPage";
import { isSpacePanelVisible, setSpacePanelVisible } from "../spacePanel";

type Route =
    | "root"
    | "memory"
    | "model"
    | "credentials"
    | "plugins"
    | "usage"
    | "server"
    | "mcp"
    | "connectors"
    | "skills"
    | "personas"
    | "diagnose"
    | "audit"
    | "vault"
    | "devices"
    | "hub";

interface MenuItem {
    route?: Route;
    label: string;
    desc: string;
    /** 跳到 Element 原生设置 */
    element?: boolean;
    /** 就地开关，不进子页 */
    toggle?: "spacePanel";
}

const GROUPS: { title: string; items: MenuItem[] }[] = [
    {
        title: "助理",
        items: [
            { route: "memory", label: "记忆", desc: "画像 · 技能 · 例程 · 会话数" },
            { route: "model", label: "模型与推理", desc: "端点 · 模型 · 候选池 · 备用链" },
            { route: "credentials", label: "凭据", desc: "模型端点的 API Key 状态" },
            { route: "plugins", label: "插件与能力", desc: "X2 上已安装 / 内置的插件" },
            { route: "usage", label: "用量", desc: "请求数 · Tokens · 预估花费" },
        ],
    },
    {
        title: "服务器",
        items: [
            { route: "server", label: "服务器状态", desc: "CPU、内存、磁盘实时占用" },
            { route: "mcp", label: "连接应用", desc: "MCP 服务与其工具" },
            { route: "connectors", label: "连接器", desc: "内置数据源（B站、知乎等）" },
            { route: "skills", label: "技能", desc: "已装的技能包与说明" },
            { route: "personas", label: "人设", desc: "多套人设及其数据规模" },
        ],
    },
    {
        title: "运维",
        items: [
            { route: "diagnose", label: "诊断", desc: "配置、模型、凭据自检" },
            { route: "audit", label: "审计日志", desc: "最近的操作记录" },
            { route: "vault", label: "记忆库索引", desc: "文件覆盖率与实体数" },
        ],
    },
    {
        title: "设备与连接",
        items: [
            { route: "hub", label: "设备数据", desc: "device-hub 地址与配对令牌" },
            { route: "devices", label: "已配对设备", desc: "令牌、权限与最近活跃" },
        ],
    },
    {
        title: "界面",
        items: [{ toggle: "spacePanel", label: "Element 空间栏", desc: "默认收起，避免和左侧导航重复占位" }],
    },
    {
        title: "应用（Element 原生）",
        items: [
            { element: true, label: "外观与主题", desc: "主题、字号、布局" },
            { element: true, label: "通知", desc: "系统通知与提示音" },
            { element: true, label: "聊天与安全", desc: "加密、会话默认项" },
            { element: true, label: "关于与更新", desc: "版本信息" },
        ],
    },
];

const HubForm: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const initial = loadConfig();
    const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
    const [token, setToken] = useState(initial.token);
    const [persona, setPersona] = useState(initial.persona);
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [testing, setTesting] = useState(false);
    const [personas, setPersonas] = useState<{ id: string; label: string }[]>([]);
    const [personaLoading, setPersonaLoading] = useState(true);
    const [personaErr, setPersonaErr] = useState<string | null>(null);
    const p = palette();

    // 人设列表来自服务端；拿不到就退回手填，不让用户卡住
    const fetchPersonas = useCallback(async () => {
        setPersonaLoading(true);
        setPersonaErr(null);
        try {
            const data = await hub.personas();
            const raw = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
            setPersonas(
                raw
                    .map((x: any) => ({ id: `${x?.id ?? ""}`, label: `${x?.label || x?.id || ""}` }))
                    .filter((x: { id: string }) => x.id),
            );
        } catch (e) {
            setPersonas([]);
            setPersonaErr((e as Error).message);
        }
        setPersonaLoading(false);
    }, []);

    useEffect(() => {
        void fetchPersonas();
    }, [fetchPersonas]);

    const field = (
        label: string,
        value: string,
        onChange: (v: string) => void,
        placeholder?: string,
        password?: boolean,
    ) => (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>{label}</div>
            <input
                type={password ? "password" : "text"}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    fontSize: 13.5,
                    borderRadius: 8,
                    outline: "none",
                    border: `1px solid ${p.border}`,
                    background: p.bgAlt,
                    color: p.text,
                }}
            />
        </div>
    );

    const test = async () => {
        setTesting(true);
        setStatus(null);
        saveConfig({ baseUrl, token, persona });
        try {
            const h = await hub.health();
            // /health 不校验令牌，令牌错了也会返回 200，所以必须再打一个需要鉴权的接口，
            // 否则会出现「连接成功」但各页全 401 的假象。
            await hub.personas();
            setStatus({ ok: true, text: `连接成功（device-hub ${h?.version ?? "ok"}，令牌有效）` });
            void fetchPersonas();
        } catch (e) {
            const msg = (e as Error).message;
            if (/HTTP 401/.test(msg)) {
                setStatus({
                    ok: false,
                    text: "地址通了，但令牌无效（HTTP 401）。令牌是 48 位十六进制字符串，不是 6 位配对码。请重新获取后填入。",
                });
            } else {
                setStatus({ ok: false, text: `连接失败：${msg}` });
            }
        }
        setTesting(false);
    };

    return (
        <>
            <PageHeader title="设备数据" subtitle="device-hub 连接与助理身份" onBack={onBack} />
            <Scroll>
                <div style={{ maxWidth: 560 }}>
                    {field("服务地址", baseUrl, setBaseUrl, DEFAULT_BASE_URL)}
                    {field("访问令牌", token, setToken, "配对时下发的 Bearer token", true)}

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>人设</div>
                        {personas.length > 0 ? (
                            <select
                                value={persona}
                                onChange={(e) => setPersona(e.target.value)}
                                style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "9px 12px",
                                    fontSize: 13.5,
                                    borderRadius: 8,
                                    outline: "none",
                                    border: `1px solid ${p.border}`,
                                    background: p.bgAlt,
                                    color: p.text,
                                    cursor: "pointer",
                                }}
                            >
                                {!personas.some((x) => x.id === persona) && (
                                    <option value={persona}>{persona}（当前值，已不在服务端列表）</option>
                                )}
                                {personas.map((x) => (
                                    <option key={x.id} value={x.id}>
                                        {x.label === x.id ? x.label : `${x.label}（${x.id}）`}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={persona}
                                    placeholder="default"
                                    onChange={(e) => setPersona(e.target.value)}
                                    style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        padding: "9px 12px",
                                        fontSize: 13.5,
                                        borderRadius: 8,
                                        outline: "none",
                                        border: `1px solid ${p.border}`,
                                        background: p.bgAlt,
                                        color: p.text,
                                    }}
                                />
                                <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 5 }}>
                                    {personaLoading
                                        ? "正在读取人设列表…"
                                        : personaErr
                                          ? `读不到人设列表：${personaErr}。填对令牌后点「保存并测试」会变成下拉。`
                                          : "读不到人设列表，只能手填。先填上面的地址和令牌，点「保存并测试」成功后会变成下拉。"}
                                </div>
                            </>
                        )}
                        <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 6, lineHeight: 1.6 }}>
                            决定读哪一套助理的数据：记忆、技能、例程、会话与模型配置都按人设隔离。
                            切换后回各页点「刷新」即可看到对应数据。
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <Button variant="primary" disabled={testing} onClick={() => void test()}>
                            {testing ? "测试中…" : "保存并测试"}
                        </Button>
                        <Button
                            onClick={() => {
                                saveConfig({ baseUrl, token, persona });
                                setStatus({ ok: true, text: "已保存" });
                            }}
                        >
                            仅保存
                        </Button>
                    </div>
                    {status && (
                        <div
                            style={{
                                marginTop: 16,
                                fontSize: 12.5,
                                color: status.ok ? p.accent : p.danger,
                                wordBreak: "break-word",
                            }}
                        >
                            {status.text}
                        </div>
                    )}
                    <div style={{ marginTop: 26, fontSize: 12, color: p.textDim, lineHeight: 1.7 }}>
                        通知、短信、通讯录、日历、定位与 App 使用时长仍由 Android 端采集上报，
                        PC 通过 device-hub 读取同一份数据。
                        <br />
                        聊天沿用 Element 的 Matrix 会话，与手机版共用同一批房间。
                    </div>
                </div>
            </Scroll>
        </>
    );
};

const VaultPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [data, setData] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);
    const p = palette();
    React.useEffect(() => {
        hub.memoryVaultStatus()
            .then(setData)
            .catch((e) => setErr((e as Error).message));
    }, []);
    return (
        <>
            <PageHeader title="记忆库索引" subtitle="文件覆盖率与实体抽取" onBack={onBack} />
            <Scroll>
                {err ? (
                    <div style={{ color: p.danger, fontSize: 13 }}>{err}</div>
                ) : data ? (
                    <>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                            {[
                                ["覆盖率", `${data.coverage ?? 0}%`],
                                ["文件", `${data.files ?? 0}/${data.total ?? 0}`],
                                ["待处理", `${data.pending ?? 0}`],
                                ["失败", `${data.failed ?? 0}`],
                                ["实体数", `${data.entities ?? 0}`],
                            ].map(([k, v]) => (
                                <div
                                    key={k}
                                    style={{
                                        flex: "1 1 100px",
                                        padding: "12px 14px",
                                        borderRadius: 10,
                                        background: p.bgAlt,
                                        border: `1px solid ${p.border}`,
                                    }}
                                >
                                    <div style={{ fontSize: 11.5, color: p.textDim }}>{k}</div>
                                    <div style={{ fontSize: 18, fontWeight: 600, color: p.text }}>{v}</div>
                                </div>
                            ))}
                        </div>
                        <DataView data={data} />
                    </>
                ) : (
                    <div style={{ fontSize: 12, color: p.textDim }}>加载中…</div>
                )}
            </Scroll>
        </>
    );
};

export const SettingsPage: React.FC<{ onNavigateElement: () => void }> = ({ onNavigateElement }) => {
    const [route, setRoute] = useState<Route>("root");
    const [spacePanelOn, setSpacePanelOn] = useState(isSpacePanelVisible());
    const p = palette();
    const back = () => setRoute("root");

    if (route === "hub") return <HubForm onBack={back} />;
    if (route === "model") return <ModelPage onBack={back} />;
    if (route === "usage") return <UsagePage onBack={back} />;
    if (route === "server") return <ServerPage onBack={back} />;
    if (route === "vault") return <VaultPage onBack={back} />;

    if (route === "memory")
        return (
            <ListPage
                title="记忆"
                subtitle="人设画像与数据规模"
                onBack={back}
                loader={() => hub.memoryBundle(loadConfig().persona)}
                columns={[
                    { key: "label", title: true },
                    { key: "id", label: "标识" },
                    { key: "skill_count", label: "技能" },
                    { key: "routine_count", label: "例程" },
                    { key: "session_count", label: "会话" },
                    {
                        key: "memory_updated_at",
                        label: "记忆更新",
                        render: (x) => `${x.memory_updated_at ?? "—"}`.replace("T", " ").slice(0, 16),
                    },
                ]}
            />
        );

    if (route === "credentials")
        return (
            <ListPage
                title="凭据"
                subtitle="模型端点的 API Key（只显示状态，不回显密钥）"
                onBack={back}
                loader={() => hub.agentCredentials()}
                columns={[
                    { key: "name", title: true },
                    { key: "resolved", label: "已解析", render: (x) => (x.resolved ? "是" : "否") },
                    { key: "in_system", label: "系统级", render: (x) => (x.in_system ? "是" : "否") },
                    { key: "in_user", label: "用户级", render: (x) => (x.in_user ? "是" : "否") },
                    { key: "shadowed", label: "被覆盖", render: (x) => (x.shadowed ? "是" : "否") },
                ]}
            />
        );

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

    if (route === "mcp")
        return (
            <ListPage
                title="连接应用"
                subtitle="MCP 服务（凭据留在 X2，不上手机）"
                onBack={back}
                loader={() => hub.mcpServers()}
                columns={[
                    { key: "name", title: true },
                    { key: "url", label: "地址" },
                    { key: "tools", label: "工具数", render: (x) => (Array.isArray(x.tools) ? x.tools.length : "—") },
                    { key: "last_error", label: "最近错误" },
                ]}
            />
        );

    if (route === "connectors")
        return (
            <ListPage
                title="连接器"
                subtitle="内置数据源"
                onBack={back}
                loader={() => hub.connectors()}
                columns={[
                    { key: "name", title: true, render: (x) => x.meta?.name || x.name },
                    { key: "capability", label: "能力", render: (x) => x.meta?.capability || "—" },
                    { key: "mode", label: "模式", render: (x) => x.meta?.mode || "—" },
                    { key: "enabled", label: "状态", render: (x) => (x.enabled ? "启用" : "停用") },
                ]}
            />
        );

    if (route === "skills")
        return (
            <ListPage
                title="技能"
                subtitle="已安装的技能包"
                onBack={back}
                loader={() => hub.skills(loadConfig().persona)}
                columns={[
                    { key: "name", title: true },
                    { key: "description", label: "说明" },
                    {
                        key: "updated_at",
                        label: "更新",
                        render: (x) => `${x.updated_at ?? "—"}`.replace("T", " ").slice(0, 16),
                    },
                ]}
            />
        );

    if (route === "personas")
        return (
            <ListPage
                title="人设"
                subtitle="多套人设及其数据规模"
                onBack={back}
                loader={() => hub.personas()}
                columns={[
                    { key: "label", title: true },
                    { key: "id", label: "标识" },
                    { key: "skill_count", label: "技能" },
                    { key: "routine_count", label: "例程" },
                    { key: "session_count", label: "会话" },
                ]}
            />
        );

    if (route === "diagnose")
        return (
            <ListPage
                title="诊断"
                subtitle="配置、模型、凭据自检结果"
                onBack={back}
                loader={() => hub.diagnose()}
                columns={[
                    {
                        key: "label",
                        title: true,
                        render: (x) =>
                            `${x.status === "ok" ? "✓ " : x.status === "warn" ? "! " : "✕ "}${x.label || x.key}`,
                    },
                    { key: "detail", label: "详情" },
                    { key: "status", label: "状态" },
                ]}
            />
        );

    if (route === "audit")
        return (
            <ListPage
                title="审计日志"
                subtitle="最近的操作记录"
                onBack={back}
                loader={() => hub.audit()}
                columns={[
                    { key: "action", title: true },
                    { key: "actor", label: "来源" },
                    { key: "detail", label: "详情" },
                    {
                        key: "at",
                        label: "时间",
                        render: (x) => `${x.at ?? "—"}`.replace("T", " ").slice(0, 19),
                    },
                ]}
            />
        );

    if (route === "devices")
        return (
            <ListPage
                title="已配对设备"
                subtitle="令牌、权限与最近活跃"
                onBack={back}
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

    // 根菜单
    return (
        <>
            <PageHeader title="设置" subtitle="助理 · 服务器 · 设备 · 应用" />
            <Scroll>
                {GROUPS.map((group) => (
                    <div key={group.title} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8 }}>{group.title}</div>
                        {group.items.map((item) => {
                            const isToggle = item.toggle === "spacePanel";
                            return (
                                <Card
                                    key={item.label}
                                    onClick={() => {
                                        if (isToggle) {
                                            const next = !spacePanelOn;
                                            setSpacePanelOn(next);
                                            setSpacePanelVisible(next);
                                        } else if (item.element) {
                                            onNavigateElement();
                                        } else if (item.route) {
                                            setRoute(item.route);
                                        }
                                    }}
                                    style={{ marginBottom: 6, padding: "11px 14px" }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13.5, fontWeight: 500, color: p.text }}>
                                                {item.label}
                                            </div>
                                            <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>
                                                {item.desc}
                                            </div>
                                        </div>
                                        {isToggle ? (
                                            <span
                                                style={{
                                                    fontSize: 12,
                                                    color: spacePanelOn ? p.accent : p.textDim,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {spacePanelOn ? "已显示" : "已收起"}
                                            </span>
                                        ) : (
                                            <span style={{ color: p.textDim, fontSize: 14 }}>›</span>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ))}
            </Scroll>
        </>
    );
};
