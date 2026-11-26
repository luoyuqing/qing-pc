/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 任务
对齐手机端 tasks_page.dart 的三个 Tab：最近会话 / 收藏 / 定时任务。
- 会话：最近 30 段真实聊天，点开可读记录，可星标收藏
- 收藏：星标过的会话（本机持久化，不受最近 30 条限制）
- 定时：详情、计划编辑、启停、立即执行与执行历史
*/

import { _t } from "../../languageHandler";
import { favoriteKey, importFavorites, readFavorites } from "../favorites";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { QingPanel } from "../QingPanel";
import { type TaskSession, type FavSession } from "../task-types";
import { recordOf, textOf } from "../data";
import { hub, itemsOf, loadConfig, saveConfig } from "../hub";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { Markdown } from "../Markdown";
import { PersonaPicker } from "../PersonaPicker";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

type Tab = "sessions" | "favs" | "routines";

const FAV_KEY = "qing.pc.favSessions";

export const TasksPage: React.FC<{ onBack?: () => void; onOpenRoom?: (roomId: string) => void }> = ({
    onBack,
    onOpenRoom,
}): React.ReactNode => {
    const [persona, setPersona] = useState(loadConfig().persona);
    const [tab, setTab] = useState<Tab>("sessions");
    const [sessions, setSessions] = useState<TaskSession[]>([]);
    const [routines, setRoutines] = useState<any[]>([]);
    const favKey = favoriteKey(loadConfig().baseUrl, MatrixClientPeg.get()?.getUserId() ?? "", persona);
    const [legacy, setLegacy] = useState(() => readFavorites(FAV_KEY));
    const [favs, setFavs] = useState<FavSession[]>(() => readFavorites(favKey));
    const [query, setQuery] = useState("");
    const [routineId, setRoutineId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [digest, setDigest] = useState("");
    const messagesRequest = useRef(0);
    const loadRequest = useRef(0);
    const [opened, setOpened] = useState<TaskSession | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        const id = ++loadRequest.current;
        setLoading(true);
        setError(null);
        try {
            const [sessionsData, routinesData, digestData] = await Promise.all([
                hub.sessions(persona),
                hub.routines(persona),
                hub.sessionDigest(persona).catch(() => ({ summary: _t("qing|text_6dc233fc") })),
            ]);
            if (id !== loadRequest.current) return;
            setSessions(itemsOf(sessionsData));
            setRoutines(itemsOf(routinesData));
            const summary = recordOf(digestData);
            setDigest(textOf(summary.summary ?? summary.content));
        } catch (e) {
            if (id === loadRequest.current) setError((e as Error).message);
        }
        if (id === loadRequest.current) setLoading(false);
    }, [persona]);

    useEffect(() => {
        void load();
        return () => {
            // This ref is a request generation counter, not a DOM node.
            // oxlint-disable-next-line react-hooks/exhaustive-deps
            loadRequest.current++;
            // This ref is a request generation counter, not a DOM node.
            // oxlint-disable-next-line react-hooks/exhaustive-deps
            messagesRequest.current++;
        };
    }, [load, tick]);
    useEffect(() => {
        setFavs(readFavorites(favKey));
    }, [favKey]);

    const changePersona = (id: string): void => {
        setPersona(id);
        setOpened(null);
        saveConfig({ ...loadConfig(), persona: id });
    };

    const open = async (session: TaskSession): Promise<void> => {
        const id = ++messagesRequest.current;
        setOpened(session);
        setMessages([]);
        setHasMore(false);
        setMessagesLoading(true);
        setError(null);
        try {
            const response = await hub.sessionMessages(session.id, persona);
            if (id !== messagesRequest.current) return;
            setMessages(itemsOf(response));
            setHasMore(response?.has_more === true);
        } catch (e) {
            if (id === messagesRequest.current) setError((e as Error).message);
        }
        if (id === messagesRequest.current) setMessagesLoading(false);
    };

    const moreMessages = async (): Promise<void> => {
        if (!opened || messagesLoading) return;
        const cursor = textOf(messages[0]?.cursor);
        if (!cursor) {
            setError(_t("qing|text_80b84801"));
            return;
        }
        const id = messagesRequest.current;
        setMessagesLoading(true);
        try {
            const response = await hub.sessionMessages(opened.id, persona, 120, cursor);
            if (id !== messagesRequest.current) return;
            setMessages((current) => [...itemsOf(response), ...current]);
            setHasMore(response?.has_more === true);
            setError(null);
        } catch (error) {
            if (id === messagesRequest.current) setError((error as Error).message);
        }
        if (id === messagesRequest.current) setMessagesLoading(false);
    };

    const openInChat = async (session: TaskSession): Promise<void> => {
        if (!session.room_id) {
            setError(_t("qing|text_455a479a"));
            return;
        }
        const client = MatrixClientPeg.get();
        if (!client?.getRoom(session.room_id)) {
            setError(_t("qing|text_a2270f30"));
            return;
        }
        setBusy(`resume:${session.id}`);
        try {
            if (!session.is_current) {
                if (/\s/.test(session.id)) throw new Error(_t("qing|text_3e3f3b0f"));
                await client.sendTextMessage(session.room_id, `!resume ${session.id} --cross-room`);
            }
            onOpenRoom?.(session.room_id);
            if (!onOpenRoom) window.location.hash = `#/room/${encodeURIComponent(session.room_id)}`;
        } catch (error) {
            setError((error as Error).message);
        }
        setBusy(null);
    };

    const toggleFav = (s: TaskSession): void => {
        const id = s.id;
        const exists = favs.some((f) => f.id === id);
        const next = exists
            ? favs.filter((f) => f.id !== id)
            : [{ ...s, id, name: s.name || _t("qing|text_a6328025"), is_current: false }, ...favs];
        setFavs(next);
        localStorage.setItem(favKey, JSON.stringify(next));
    };

    const toggleRoutine = async (r: any): Promise<void> => {
        setBusy(r.id);
        try {
            await hub.updateRoutine(r.id, persona, { enabled: !r.enabled });
            await load();
        } catch (e) {
            setError(_t("qing|text_dc167877", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    if (routineId)
        return (
            <QingPanel
                key={`${persona}-${routineId}`}
                resource="routine"
                persona={persona}
                id={routineId}
                onBack={() => {
                    setRoutineId(null);
                    void load();
                }}
            />
        );

    // 会话详情
    if (opened) {
        return (
            <>
                <PageHeader
                    title={opened.name || _t("qing|text_a6328025")}
                    subtitle={[
                        opened.platform,
                        opened.message_count ? _t("qing|text_291fae13", { v0: opened.message_count }) : null,
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                    onBack={() => {
                        messagesRequest.current++;
                        setOpened(null);
                        setMessages([]);
                    }}
                    right={
                        <>
                            <Button disabled={!opened.room_id || busy !== null} onClick={() => void openInChat(opened)}>
                                {opened.is_current ? _t("qing|text_2f9e1cb9") : _t("qing|text_5e2031c1")}
                            </Button>
                            <Button onClick={() => toggleFav(opened)}>
                                {favs.some((f) => f.id === opened.id)
                                    ? _t("qing|text_dca60869")
                                    : _t("qing|text_60a53514")}
                            </Button>
                        </>
                    }
                />
                {messagesLoading && messages.length === 0 ? (
                    <Loading label={_t("qing|text_3eaf9496")} />
                ) : error ? (
                    <div style={{ padding: "0 24px" }}>
                        <ErrorBox message={error} onRetry={() => void open(opened)} />
                    </div>
                ) : (
                    <Scroll>
                        {hasMore && (
                            <Button disabled={messagesLoading} onClick={() => void moreMessages()}>
                                {messagesLoading ? _t("qing|text_4927a53b") : _t("qing|text_5bf3f2d2")}
                            </Button>
                        )}
                        {messages.length === 0 && <Empty text={_t("qing|text_27abce5b")} />}
                        {messages.map((m, i) => {
                            const body = m.content || m.text || "";
                            if (!body) return null;
                            return (
                                <div
                                    key={m.cursor ?? m.id ?? JSON.stringify(m)}
                                    style={{ padding: "9px 0", borderBottom: `1px solid ${p.border}` }}
                                >
                                    <div style={{ fontSize: 11, color: p.accent, marginBottom: 3 }}>
                                        {m.role || m.sender || _t("qing|text_4da199fa")}
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
    const favSessions = favs.map((f) => sessions.find((s) => s.id === f.id) || { ...f, is_current: false });
    const matches = (session: TaskSession): boolean =>
        !query || (session.name || session.id).toLowerCase().includes(query.toLowerCase());
    const activeRoutines = routines.filter((r) => r.enabled).length;

    return (
        <>
            <PageHeader
                title={_t("qing|text_5253040d")}
                subtitle={_t("qing|text_154c90d9", { v0: sessions.length, v1: routines.length })}
                onBack={onBack}
                right={
                    <>
                        <PersonaPicker value={persona} onChange={changePersona} compact refreshKey={tick} />
                        <Button onClick={() => setTick((t) => t + 1)}>{_t("qing|text_aee88743")}</Button>
                    </>
                }
            />

            <div style={{ display: "flex", gap: 6, padding: "0 24px 12px", flexShrink: 0 }}>
                {(
                    [
                        { id: "sessions", label: _t("qing|text_e9674b5b", { v0: sessions.length }) },
                        { id: "favs", label: _t("qing|text_35be2ff6", { v0: favs.length }) },
                        { id: "routines", label: _t("qing|text_aa90de6e", { v0: routines.length }) },
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

            <div style={{ padding: "0 24px 12px" }}>
                <input
                    type="search"
                    aria-label={_t("qing|text_feb95554")}
                    placeholder={_t("qing|text_cf410043")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : (
                <Scroll>
                    {tab === "favs" && legacy.length > 0 && (
                        <Card style={{ marginBottom: 12 }}>
                            <p>{_t("qing|text_f319f327")}</p>
                            <Button
                                onClick={() => {
                                    const next = importFavorites(favs, legacy);
                                    localStorage.setItem(favKey, JSON.stringify(next));
                                    setFavs(next);
                                    setLegacy([]);
                                }}
                            >
                                {_t("qing|text_0d3156aa")}
                            </Button>
                        </Card>
                    )}
                    {digest && <Card style={{ marginBottom: 12 }}>{digest}</Card>}
                    {tab === "sessions" &&
                        (sessions.length === 0 ? (
                            <Empty text={_t("qing|text_44871b8b")} />
                        ) : (
                            sessions.filter(matches).map((s, i) => (
                                <Card key={s.id ?? i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.target === event.currentTarget &&
                                                    (event.key === "Enter" || event.key === " ")
                                                ) {
                                                    event.preventDefault();
                                                    event.currentTarget.click();
                                                }
                                            }}
                                            onClick={() => void open(s)}
                                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                        >
                                            <div style={{ fontSize: 14, fontWeight: 600, color: p.text }}>
                                                {s.name || _t("qing|text_a91ae603")}
                                            </div>
                                            <div style={{ fontSize: 12, color: p.textDim, marginTop: 3 }}>
                                                {[
                                                    s.platform,
                                                    s.message_count
                                                        ? _t("qing|text_0400ba03", { v0: s.message_count })
                                                        : null,
                                                    s.last_at,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleFav(s)}
                                            title={
                                                favIds.has(s.id) ? _t("qing|text_dca60869") : _t("qing|text_60a53514")
                                            }
                                            style={{
                                                border: "none",
                                                background: "transparent",
                                                cursor: "pointer",
                                                fontSize: 15,
                                                color: favIds.has(s.id) ? "#e0a030" : p.textDim,
                                            }}
                                        >
                                            {favIds.has(s.id) ? "★" : "☆"}
                                        </button>
                                    </div>
                                </Card>
                            ))
                        ))}

                    {tab === "favs" &&
                        (favSessions.length === 0 ? (
                            <Empty text={_t("qing|text_1cc53d69")} />
                        ) : (
                            favSessions.filter(matches).map((s, i) => (
                                <Card key={s.id ?? i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.target === event.currentTarget &&
                                                    (event.key === "Enter" || event.key === " ")
                                                ) {
                                                    event.preventDefault();
                                                    event.currentTarget.click();
                                                }
                                            }}
                                            onClick={() => void open(s)}
                                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                        >
                                            <div style={{ fontSize: 14, fontWeight: 600, color: p.text }}>
                                                {s.name || _t("qing|text_a6328025")}
                                            </div>
                                            <div style={{ fontSize: 12, color: p.textDim, marginTop: 3 }}>
                                                {_t("qing|text_d4024568")}
                                            </div>
                                        </div>
                                        <Button onClick={() => toggleFav(s)}>{_t("qing|text_6135d415")}</Button>
                                    </div>
                                </Card>
                            ))
                        ))}

                    {tab === "routines" &&
                        (routines.length === 0 ? (
                            <Empty text={_t("qing|text_84d9014f")} />
                        ) : (
                            <>
                                <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8 }}>
                                    {_t("qing|text_76e547a8")}
                                    {routines.length} {_t("qing|text_b3f89eea")}
                                    {activeRoutines} {_t("qing|text_3a116815")}
                                </div>
                                {routines.map((r, i) => (
                                    <Card
                                        key={r.id ?? i}
                                        onClick={r.id ? () => setRoutineId(r.id) : undefined}
                                        style={{ marginBottom: 8 }}
                                    >
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
                                            <Button disabled={busy === r.id} onClick={() => void toggleRoutine(r)}>
                                                {busy === r.id
                                                    ? "…"
                                                    : r.enabled
                                                      ? _t("qing|text_4e6fd0e2")
                                                      : _t("qing|text_f4f0ead1")}
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
