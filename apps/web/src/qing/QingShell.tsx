/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 主导航
左侧竖排：聊天 / 简报 / 任务 / 服务 / 设置。
五项对应手机版底部导航，归档在设置的聊天入口下。
以浮层形式叠在 Element 原有三栏布局之上，不改动其 flex 结构：
- 聊天：不遮挡，Element 原生界面
- 其余：整块面板覆盖内容区，Element 组件保持挂载，切回时不丢状态
*/

import { _t } from "../languageHandler";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { subscribeRoomChanges } from "./room-listeners";
import { Loading } from "./ui";
import { palette, QING } from "./theme";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { QING_ARCHIVE_TAG } from "../stores/room-list-v3/isRoomVisible";
// 副作用导入：默认收起 Element 的空间栏，只留 Qing 一条一级导航
import "./spacePanel";

const BriefingPage = lazy(() => import("./pages/BriefingPage").then((module) => ({ default: module.BriefingPage })));
const TasksPage = lazy(() => import("./pages/TasksPage").then((module) => ({ default: module.TasksPage })));
const ServicesPage = lazy(() => import("./pages/ServicesPage").then((module) => ({ default: module.ServicesPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

export type QingTab = "chat" | "briefing" | "tasks" | "services" | "settings";

interface IconProps {
    active: boolean;
}

const ChatIcon: React.FC<IconProps> = ({ active }): React.ReactNode => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-5.3a8.3 8.3 0 0 1-1-4A8.4 8.4 0 0 1 12.4 3 8.4 8.4 0 0 1 21 11.5Z" />
    </svg>
);

const BriefingIcon: React.FC<IconProps> = ({ active }): React.ReactNode => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5.5" />
    </svg>
);

const TasksIcon: React.FC<IconProps> = ({ active }): React.ReactNode => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <path d="M8 12.2l2.6 2.6L16.2 9" />
    </svg>
);

const ServicesIcon: React.FC<IconProps> = ({ active }): React.ReactNode => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
);

const SettingsIcon: React.FC<IconProps> = ({ active }): React.ReactNode => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
);

/** 与手机端一致的五项主导航。 */
function getTABS(): { id: QingTab; label: string; icon: React.FC<IconProps> }[] {
    return [
        { id: "chat", label: _t("qing|text_4b3510b8"), icon: ChatIcon },
        { id: "briefing", label: _t("qing|text_700c9aca"), icon: BriefingIcon },
        { id: "tasks", label: _t("qing|text_5253040d"), icon: TasksIcon },
        { id: "services", label: _t("qing|text_ec309ab2"), icon: ServicesIcon },
        { id: "settings", label: _t("qing|text_df3d58c7"), icon: SettingsIcon },
    ];
}

/** 导航上的未读角标 */
const Badge: React.FC<{ n: number; color: string }> = ({ n, color }): React.ReactNode =>
    n > 0 ? (
        <span
            style={{
                position: "absolute",
                top: 2,
                right: 2,
                minWidth: 15,
                height: 15,
                padding: "0 4px",
                borderRadius: 8,
                background: color,
                color: "#fff",
                fontSize: 9.5,
                lineHeight: "15px",
                textAlign: "center",
                fontWeight: 600,
                boxSizing: "border-box",
            }}
        >
            {n > 99 ? "99+" : n}
        </span>
    ) : null;

export const QingShell: React.FC = (): React.ReactNode => {
    const [tab, setTab] = useState<QingTab>("chat");
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        const client = MatrixClientPeg.get();
        if (!client) return;
        const calculate = (): void => {
            const count = client
                .getRooms()
                .filter((room) => room.getMyMembership() === "join" && !room.tags[QING_ARCHIVE_TAG])
                .reduce((total, room) => total + room.getUnreadNotificationCount(), 0);
            setUnread(count);
        };
        calculate();
        return subscribeRoomChanges(client, calculate);
    }, []);
    useEffect(() => {
        document.body.classList.toggle("qing-business-open", tab !== "chat");
        const content = document.querySelector<HTMLElement>(".mx_QingShell_elementContent");
        if (!content) return;
        content.inert = tab !== "chat";
        return () => {
            content.inert = false;
            document.body.classList.remove("qing-business-open");
        };
    }, [tab]);
    const openRoom = (roomId: string): void => {
        window.location.hash = `#/room/${encodeURIComponent(roomId)}`;
        setTab("chat");
    };
    const p = palette();

    return (
        <>
            <nav
                aria-label={_t("qing|text_9bae6804")}
                className="mx_QingShell_rail"
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
                {getTABS().map(({ id, label, icon: Icon }) => {
                    const active = tab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            title={label}
                            onClick={() => setTab(id)}
                            aria-current={active ? "page" : undefined}
                            style={{
                                position: "relative",
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
                                color: active ? p.accent : p.textDim,
                                transition: "background 120ms ease, color 120ms ease",
                            }}
                        >
                            <Icon active={active} />
                            <span style={{ fontSize: 11, lineHeight: 1 }}>{label}</span>
                            {id === "chat" && <Badge n={unread} color={p.danger} />}
                        </button>
                    );
                })}
            </nav>

            {tab !== "chat" && (
                <div
                    className="mx_QingShell_panel"
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
                    <Suspense fallback={<Loading />}>
                        {tab === "briefing" && <BriefingPage />}
                        {tab === "tasks" && <TasksPage onOpenRoom={openRoom} />}
                        {tab === "services" && <ServicesPage />}
                        {tab === "settings" && (
                            <SettingsPage
                                onNavigateElement={() => setTab("chat")}
                                onNavigateTab={(t) => setTab(t)}
                                onOpenRoom={openRoom}
                            />
                        )}
                    </Suspense>
                </div>
            )}
        </>
    );
};
