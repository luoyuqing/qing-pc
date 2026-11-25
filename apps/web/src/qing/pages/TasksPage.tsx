/*
Qing PC · 任务
对齐手机端 tasks_page.dart 的三个 Tab：最近会话 / 收藏 / 定时任务。
- 会话：最近 30 段真实聊天，点开可读记录，可星标收藏
- 收藏：星标过的会话（本机持久化，不受最近 30 条限制）
- 定时：GET /routines，可启停（PATCH /routines/{id}）
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf, loadConfig } from "../hub";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { Markdown } from "../Markdown";
import { PersonaPicker } from "../PersonaPicker";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

type Tab = "sessions" | "favs" | "routines";

const FAV_KEY = "qing.pc.favSessions";

interface FavSession {
    id: string;
    name: string;
}

function readFavs(): FavSession[] {
    try {
        const raw = window.localStorage.getItem(FAV_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter((x) => x && x.id) : [];
    } catch {
        return [];
    }
}

function writeFavs(list: FavSession[]): void {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(list));
}

export const TasksPage: React.FC<{ onBack?: () => void; onOpenRoom?: (roomId: string) => void }> = ({
    onBack,
    onOpenRoom,
}) => {
    const [persona, setPersona] = useState(loadConfig().persona);
    const [tab, setTab] = useState<Tab>("sessions");
    const [sessions, setSessions] = useState<any[]>([]);
    const [routines, setRoutines] = useState<any[]>([]);
    const [favs, setFavs] = useState<FavSession[]>(readFavs());
    const [opened, setOpened] = useState<any | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setSessions(itemsOf(await hub.sessions(persona)));
            setRoutines(itemsOf(await hub.routines(persona)));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, [persona]);

    useEffect(() => {
        void load();
    }, [load, tick]);

    const changePersona = (id: string) => {
        setPersona(id);
        setOpened(null);
    };

    const open = async (session: any) => {
        setOpened(session);
        setMessages([]);
        setMessagesLoading(true);
        setError(null);
        try {
            setMessages(itemsOf(await hub.sessionMessages(`${session.id}`, persona)));
        } catch (e) {
            setError((e as Error).message);
        }
        setMessagesLoading(false);
    };

    /** 按会话名到 Matrix 房间里找同名的，找到就跳过去 */
    const openInChat = (session: any) => {
        const name = `${session?.name || ""}`.trim();
        if (!name) {
            window.alert("这个会话没有名字，无法匹配房间。");
            return;
        }
        let client: any;
        try {
            client = MatrixClientPeg.safeGet();
        } catch {
            return;
        }
        const rooms: any[] = client.getRooms?.() || [];
        const hit =
            rooms.find((r) => (r.name || "").trim() === name) ||
            rooms.find((r) => (r.name || "").includes(name)) ||
            rooms.find((r) => name.includes((r.name || "").trim()) && (r.name || "").trim().length > 1);
        if (!hit) {
            window.alert(`没找到名为「${name}」的聊天房间。`);
            return;
        }
        if (onOpenRoom) onOpenRoom(hit.roomId);
        else window.location.hash = `#/room/${encodeURIComponent(hit.roomId)}`;
    };

    const toggleFav = (s: any) => {
        const id = `${s.id}`;
        const exists = favs.some((f) => f.id === id);
        const next = exists
            ? favs.filter((f) => f.id !== id)
            : [...favs, { id, name: s.name || "会话" }];
        setFavs(next);
        writeFavs(next);
    };

    const toggleRoutine = async (r: any) => {
        setBusy(r.id);
        try {
            await hub.updateRoutine(r.id, persona, { enabled: !r.enabled });
            await load();
        } catch (e) {
            window.alert(`操作失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    // 会话详情
    if (opened) {
        return (
            <>
                <PageHeader
                    title={opened.name || "会话"}
                    subtitle={[opened.platform, opened.message_count ? `${opened.message_count} 条` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    onBack={() => {
                        setOpened(null);
                        setMessages([]);
                    }}
                    right={
                        <>
                            <Button onClick={() => openInChat(opened)}>去聊天</Button>
                            <Button onClick={() => toggleFav(opened)}>
                                {favs.some((f) => f.id === `${opened.id}`) ? "取消收藏" : "收藏"}
                            </Button>
                        </>
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

    const favIds = new Set(favs.map((f) => f.id));
    const favSessions = favs.map((f) => sessions.find((s) => `${s.id}` === f.id) || f);
    const activeRoutines = routines.filter((r) => r.enabled).length;

    return (
        <>
            <PageHeader
                title="任务"
                subtitle={`会话 · ${sessions.length}　定时 · ${routines.length}`}
                onBack={onBack}
                right={
                    <>
                        <PersonaPicker value={persona} onChange={changePersona} compact />
                        <Button onClick={() => setTick((t) => t + 1)}>刷新</Button>
                    </>
                }
            />

            <div style={{ display: "flex", gap: 6, padding: "0 24px 12px", flexShrink: 0 }}>
                {(
                    [
                        { id: "sessions", label: `会话 · ${sessions.length}` },
                        { id: "favs", label: `收藏 · ${favs.length}` },
                        { id: "routines", label: `定时 · ${routines.length}` },
                    ] as { id: Tab; label: string }[]
                ).map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: "6px 14px",
                            fontSize: 12.5,
                            borderRadius: 8,
                            cursor: "pointer",
                            border: `1px solid ${tab === t.id ? p.accent : p.border}`,
                            background: tab === t.id ? p.accentSoft : "transparent",
                            color: tab === t.id ? p.accent : p.textDim,
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : (
                <Scroll>
                    {tab === "sessions" &&
                        (sessions.length === 0 ? (
                            <Empty text="还没有聊天会话。" />
                        ) : (
                            sessions.map((s, i) => (
                                <Card key={s.id ?? i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div
                                            onClick={() => void open(s)}
                                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                        >
                                            <div style={{ fontSize: 14, fontWeight: 600, color: p.text }}>
                                                {s.name || "未命名会话"}
                                            </div>
                                            <div style={{ fontSize: 12, color: p.textDim, marginTop: 3 }}>
                                                {[
                                                    s.platform,
                                                    s.message_count ? `${s.message_count} 条消息` : null,
                                                    s.last_at,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleFav(s)}
                                            title={favIds.has(`${s.id}`) ? "取消收藏" : "收藏"}
                                            style={{
                                                border: "none",
                                                background: "transparent",
                                                cursor: "pointer",
                                                fontSize: 15,
                                                color: favIds.has(`${s.id}`) ? "#e0a030" : p.textDim,
                                            }}
                                        >
                                            {favIds.has(`${s.id}`) ? "★" : "☆"}
                                        </button>
                                    </div>
                                </Card>
                            ))
                        ))}

                    {tab === "favs" &&
                        (favSessions.length === 0 ? (
                            <Empty text="还没有收藏。在会话列表里点 ☆ 收藏。" />
                        ) : (
                            favSessions.map((s: any, i) => (
                                <Card key={s.id ?? i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div
                                            onClick={() => void open(s)}
                                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                        >
                                            <div style={{ fontSize: 14, fontWeight: 600, color: p.text }}>
                                                {s.name || "会话"}
                                            </div>
                                            <div style={{ fontSize: 12, color: p.textDim, marginTop: 3 }}>
                                                点击打开
                                            </div>
                                        </div>
                                        <Button onClick={() => toggleFav(s)}>移除</Button>
                                    </div>
                                </Card>
                            ))
                        ))}

                    {tab === "routines" &&
                        (routines.length === 0 ? (
                            <Empty text="这个人设还没有定时任务。" />
                        ) : (
                            <>
                                <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8 }}>
                                    共 {routines.length} 个，启用 {activeRoutines} 个
                                </div>
                                {routines.map((r, i) => (
                                    <Card key={r.id ?? i} style={{ marginBottom: 8 }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                            <div
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 13.5,
                                                        fontWeight: 600,
                                                        color: r.enabled ? p.text : p.textDim,
                                                    }}
                                                >
                                                    {r.name || r.id}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11.5,
                                                        color: p.textDim,
                                                        marginTop: 3,
                                                        fontFamily: "ui-monospace, monospace",
                                                    }}
                                                >
                                                    {r.schedule || r.schedule_expr || "—"}
                                                    {r.schedule_kind ? ` · ${r.schedule_kind}` : ""}
                                                </div>
                                                {r.prompt && (
                                                    <div
                                                        style={{
                                                            fontSize: 11.5,
                                                            color: p.textDim,
                                                            marginTop: 5,
                                                            lineHeight: 1.55,
                                                            maxHeight: 46,
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {`${r.prompt}`.slice(0, 140)}
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                disabled={busy === r.id}
                                                onClick={() => void toggleRoutine(r)}
                                            >
                                                {busy === r.id ? "…" : r.enabled ? "停用" : "启用"}
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </>
                        ))}
                </Scroll>
            )}
        </>
    );
};
