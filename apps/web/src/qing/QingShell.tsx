/*
Qing PC · 主导航
左侧竖排：聊天 / 归档 / 简报 / 任务 / 服务 / 设置。
前五项对应手机版底部导航，归档按手机端语义单独成项（聊天列表 → 归档）。
以浮层形式叠在 Element 原有三栏布局之上，不改动其 flex 结构：
- 聊天：不遮挡，Element 原生界面
- 其余：整块面板覆盖内容区，Element 组件保持挂载，切回时不丢状态
*/

import React, { useState } from "react";
import { palette, QING } from "./theme";
import { BriefingPage } from "./pages/BriefingPage";
import { TasksPage } from "./pages/TasksPage";
import { ServicesPage } from "./pages/ServicesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ArchivePage } from "./pages/ArchivePage";

export type QingTab = "chat" | "archive" | "briefing" | "tasks" | "services" | "settings";

interface IconProps {
    active: boolean;
}

const ChatIcon: React.FC<IconProps> = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5.3a8.3 8.3 0 0 1-1-4A8.4 8.4 0 0 1 12.4 3 8.4 8.4 0 0 1 21 11.5Z" />
    </svg>
);

const ArchiveIcon: React.FC<IconProps> = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
        <path d="M4.8 8.5v9.2A2.3 2.3 0 0 0 7.1 20h9.8a2.3 2.3 0 0 0 2.3-2.3V8.5" />
        <path d="M9.6 12.4h4.8" />
    </svg>
);

const BriefingIcon: React.FC<IconProps> = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5.5" />
    </svg>
);

const TasksIcon: React.FC<IconProps> = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <path d="M8 12.2l2.6 2.6L16.2 9" />
    </svg>
);

const ServicesIcon: React.FC<IconProps> = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
);

const SettingsIcon: React.FC<IconProps> = ({ active }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
);

const TABS: { id: QingTab; label: string; icon: React.FC<IconProps> }[] = [
    { id: "chat", label: "聊天", icon: ChatIcon },
    { id: "archive", label: "归档", icon: ArchiveIcon },
    { id: "briefing", label: "简报", icon: BriefingIcon },
    { id: "tasks", label: "任务", icon: TasksIcon },
    { id: "services", label: "服务", icon: ServicesIcon },
    { id: "settings", label: "设置", icon: SettingsIcon },
];

export const QingShell: React.FC = () => {
    const [tab, setTab] = useState<QingTab>("chat");
    const [hovered, setHovered] = useState<QingTab | null>(null);
    const p = palette();

    return (
        <>
            <nav
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: QING.railWidth,
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 10,
                    gap: 2,
                    background: p.bgAlt,
                    borderRight: `1px solid ${p.border}`,
                }}
            >
                {TABS.map(({ id, label, icon: Icon }) => {
                    const active = tab === id;
                    const hot = active || hovered === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            title={label}
                            onClick={() => setTab(id)}
                            onMouseEnter={() => setHovered(id)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                width: 48,
                                padding: "7px 0 5px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 3,
                                border: "none",
                                borderRadius: 12,
                                cursor: "pointer",
                                background: active ? p.accentSoft : "transparent",
                                color: hot ? p.accent : p.textDim,
                                transition: "background 120ms ease, color 120ms ease",
                            }}
                        >
                            <Icon active={active} />
                            <span style={{ fontSize: 11, lineHeight: 1 }}>{label}</span>
                        </button>
                    );
                })}
            </nav>

            {tab !== "chat" && (
                <div
                    style={{
                        position: "absolute",
                        left: QING.railWidth,
                        top: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 19,
                        display: "flex",
                        flexDirection: "column",
                        background: p.bg,
                        color: p.text,
                    }}
                >
                    {tab === "archive" && (
                        <ArchivePage
                            onOpenRoom={(roomId) => {
                                window.location.hash = `#/room/${encodeURIComponent(roomId)}`;
                                setTab("chat");
                            }}
                        />
                    )}
                    {tab === "briefing" && <BriefingPage />}
                    {tab === "tasks" && <TasksPage />}
                    {tab === "services" && <ServicesPage />}
                    {tab === "settings" && (
                        <SettingsPage
                            onNavigateElement={() => {
                                window.location.hash = "#/settings";
                                setTab("chat");
                            }}
                        />
                    )}
                </div>
            )}
        </>
    );
};
