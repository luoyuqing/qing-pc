/* Qing PC · 任务（最近会话与消息记录） */

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf, loadConfig } from "../hub";
import { Markdown } from "../Markdown";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const TasksPage: React.FC = () => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [opened, setOpened] = useState<any | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const loadSessions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const persona = loadConfig().persona;
            setSessions(itemsOf(await hub.sessions(persona)));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void loadSessions();
    }, [loadSessions, tick]);

    const open = async (session: any) => {
        setOpened(session);
        setMessages([]);
        setMessagesLoading(true);
        setError(null);
        try {
            const persona = loadConfig().persona;
            setMessages(itemsOf(await hub.sessionMessages(`${session.id}`, persona)));
        } catch (e) {
            setError((e as Error).message);
        }
        setMessagesLoading(false);
    };

    if (opened) {
        return (
            <>
                <PageHeader
                    title={opened.name || "会话"}
                    subtitle={[opened.platform, opened.message_count ? `${opened.message_count} 条` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    right={
                        <Button
                            onClick={() => {
                                setOpened(null);
                                setMessages([]);
                            }}
                        >
                            返回
                        </Button>
                    }
                />
                {messagesLoading ? (
                    <Loading label="加载会话…" />
                ) : error ? (
                    <div style={{ padding: "0 24px" }}>
                        <ErrorBox message={error} onRetry={() => void open(opened)} />
                    </div>
                ) : (
                    <Scroll>
                        {messages.length === 0 && <Empty text="没有消息记录。" />}
                        {messages.map((m, i) => {
                            const body = m.content || m.text || "";
                            if (!body) return null;
                            return (
                                <div key={i} style={{ padding: "9px 0", borderBottom: `1px solid ${p.border}` }}>
                                    <div style={{ fontSize: 11, color: p.accent, marginBottom: 3 }}>
                                        {m.role || m.sender || "消息"}
                                    </div>
                                    <Markdown text={`${body}`} />
                                </div>
                            );
                        })}
                    </Scroll>
                )}
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="任务"
                subtitle="最近会话与运行记录"
                right={<Button onClick={() => setTick((t) => t + 1)}>刷新</Button>}
            />
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : sessions.length === 0 ? (
                <Empty text="暂无会话。" />
            ) : (
                <Scroll>
                    {sessions.map((s, i) => (
                        <Card key={s.id ?? i} onClick={() => void open(s)} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: p.text }}>{s.name || "未命名会话"}</div>
                            <div style={{ fontSize: 12, color: p.textDim, marginTop: 3 }}>
                                {[s.platform, s.message_count ? `${s.message_count} 条消息` : null, s.last_at]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </div>
                        </Card>
                    ))}
                </Scroll>
            )}
        </>
    );
};
