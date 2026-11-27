/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/* Qing PC · 简报（晨报 / 晚报），数据来自 device-hub GET /briefing/day */

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { scheduleFields } from "../schedule";
import { textOf } from "../data";
import { delay } from "../delay";
import { hub, itemsOf, loadConfig } from "../hub";
import { Markdown } from "../Markdown";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Pill, Scroll } from "../ui";
import { palette } from "../theme";

function today(): string {
    const d = new Date();
    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
    const dd = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function shift(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
    const dd = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}

export const BriefingPage: React.FC = (): React.ReactNode => {
    const requestId = useRef(0);
    const poll = useRef<AbortController | null>(null);
    const [notice, setNotice] = useState("");
    const [routines, setRoutines] = useState<Record<string, unknown>[]>([]);
    const [stats, setStats] = useState<Record<string, number>>({});
    const [date, setDate] = useState(today());
    const [kind, setKind] = useState<string>(new Date().getHours() >= 17 ? "evening" : "morning");
    const [items, setItems] = useState<any[]>([]);
    const [todos, setTodos] = useState<any[]>([]);
    const [pending, setPending] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [tick, setTick] = useState(0);
    const [view, setView] = useState<"day" | "history">("day");
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [openedHistory, setOpenedHistory] = useState<any | null>(null);
    const p = palette();

    const load = useCallback(async () => {
        const id = ++requestId.current;
        setLoading(true);
        setError(null);
        try {
            const [data, routineData] = await Promise.all([
                hub.briefingDay(date),
                hub.routines(loadConfig().persona).catch(() => []),
            ]);
            if (id !== requestId.current) return;
            const list = itemsOf(data);
            setRoutines(itemsOf(routineData));
            setStats(data.stats || {});
            setItems(list);
            setTodos(Array.isArray(data?.todos) ? data.todos : []);
            setPending(Array.isArray(data?.pending) ? data.pending.map((x: any) => `${x}`) : []);
            const kinds = list.map((x) => x.kind);
            setKind((currentKind) =>
                kinds.length && !kinds.includes(currentKind)
                    ? kinds.includes("morning")
                        ? "morning"
                        : kinds[0]
                    : currentKind,
            );
        } catch (e) {
            if (id === requestId.current) setError((e as Error).message);
        }
        if (id === requestId.current) setLoading(false);
    }, [date]);

    useEffect(() => {
        void load();
        return () => {
            // This ref is a request generation counter, not a DOM node.
            // oxlint-disable-next-line react-hooks/exhaustive-deps
            requestId.current++;
        };
    }, [load, tick]);
    useEffect(() => {
        setRequesting(false);
        return () => {
            poll.current?.abort();
        };
    }, [date]);

    const openHistory = async (): Promise<void> => {
        setError(null);
        setView("history");
        setOpenedHistory(null);
        if (history.length) return;
        setHistoryLoading(true);
        try {
            setHistory(itemsOf(await hub.briefingHistory()));
        } catch (e) {
            setError((e as Error).message);
        }
        setHistoryLoading(false);
    };

    const current = items.find((x) => x.kind === kind);
    const visiblePending = current?.content ? [] : pending.filter((x) => x === kind);
    const isToday = date === today();
    const schedule = routines
        .filter((routine) =>
            /晨报|早报|晚报|早间简报|晚间简报/.test(`${textOf(routine.name)} ${textOf(routine.prompt)}`),
        )
        .map((routine) => {
            const fields = scheduleFields(textOf(routine.schedule_expr ?? routine.schedule));
            return `${textOf(routine.name) || _t("qing|text_700c9aca")} · ${fields.mode === "daily" ? fields.time : fields.schedule} · ${routine.enabled === false ? _t("qing|text_eb0c326b") : _t("qing|text_dfb80223")}`;
        })
        .join(" / ");

    const toggleTodo = async (todo: any): Promise<void> => {
        if (typeof todo.id !== "number") return;
        const next = !todo.done;
        setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: next } : t)));
        try {
            await hub.setTodoDone(todo.id, next);
        } catch (e) {
            setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: !next } : t)));
            setError((e as Error).message);
        }
    };

    const askNow = async (): Promise<void> => {
        if (requesting || !isToday) return;
        const controller = new AbortController();
        poll.current = controller;
        const before = current?.created_at;
        setRequesting(true);
        setNotice("");
        setError(null);
        try {
            await hub.requestBriefing(kind);
            const deadline = Date.now() + 120000;
            while (Date.now() < deadline && !controller.signal.aborted) {
                await delay(3000, controller.signal);
                let data;
                try {
                    data = await hub.briefingDay(date);
                } catch {
                    // A transient read failure does not cancel the server-side generation.
                    continue;
                }
                if (controller.signal.aborted) return;
                const list = itemsOf(data);
                const match = list.find(
                    (item) => item.kind === kind && item.generated !== true && item.created_at !== before,
                );
                if (match) {
                    setItems(list);
                    setTodos(itemsOf(data.todos));
                    setPending(Array.isArray(data.pending) ? data.pending : []);
                    setHistory([]);
                    setNotice(_t("qing|text_15041002"));
                    return;
                }
            }
            if (!controller.signal.aborted) setNotice(_t("qing|text_7e4503e4"));
        } catch (error) {
            if (!controller.signal.aborted) setError((error as Error).message);
        } finally {
            if (!controller.signal.aborted) setRequesting(false);
        }
    };

    if (view === "history") {
        if (openedHistory) {
            return (
                <>
                    <PageHeader
                        title={`${openedHistory.day || ""} · ${openedHistory.kind === "evening" ? _t("qing|text_c9a6878c") : _t("qing|text_88da32f8")}`}
                        onBack={() => setOpenedHistory(null)}
                    />
                    <Scroll>
                        <Markdown text={`${openedHistory.content || ""}`} />
                    </Scroll>
                </>
            );
        }
        return (
            <>
                <PageHeader
                    title={_t("qing|text_5a1f73c2")}
                    subtitle={_t("qing|text_de939c13", { v0: history.length })}
                    onBack={() => setView("day")}
                />
                {error && <ErrorBox message={error} onRetry={() => void openHistory()} />}
                {historyLoading ? (
                    <Loading />
                ) : history.length === 0 ? (
                    <Empty text={_t("qing|text_6f774163")} />
                ) : (
                    <Scroll>
                        {history.map((h, i) => (
                            <Card
                                key={h.id ?? `${h.day}-${h.kind}-${h.persona}`}
                                onClick={() => setOpenedHistory(h)}
                                style={{ marginBottom: 8, padding: "10px 14px" }}
                            >
                                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                                    <span style={{ fontSize: 13, color: p.text, fontWeight: 500 }}>{h.day}</span>
                                    <span style={{ fontSize: 11, color: p.accent }}>
                                        {h.kind === "evening" ? _t("qing|text_c9a6878c") : _t("qing|text_88da32f8")}
                                    </span>
                                    <span style={{ fontSize: 11, color: p.textDim, marginLeft: "auto" }}>
                                        {h.persona}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        fontSize: 11.5,
                                        color: p.textDim,
                                        marginTop: 4,
                                        lineHeight: 1.55,
                                        maxHeight: 40,
                                        overflow: "hidden",
                                    }}
                                >
                                    {`${h.content || ""}`.replace(/[#>*\n]/g, " ").slice(0, 120)}
                                </div>
                            </Card>
                        ))}
                    </Scroll>
                )}
            </>
        );
    }

    return (
        <>
            <PageHeader
                title={_t("qing|text_700c9aca")}
                subtitle={
                    current?.generated
                        ? _t("qing|text_f0e33040", { v0: date })
                        : current
                          ? _t("qing|text_39bead27", { v0: date })
                          : date
                }
                right={
                    <>
                        <Button onClick={() => void openHistory()}>{_t("qing|text_b0385cfe")}</Button>
                        <Button onClick={() => setDate(shift(date, -1))}>{_t("qing|text_8b0f9494")}</Button>
                        <Button disabled={isToday} onClick={() => setDate(shift(date, 1))}>
                            {_t("qing|text_af19ac0d")}
                        </Button>
                    </>
                }
            />

            <div
                style={{
                    display: "flex",
                    gap: 8,
                    padding: "0 24px 10px",
                    flexShrink: 0,
                    overflowX: "auto",
                }}
            >
                {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
                    const dd = `${d.getDate()}`.padStart(2, "0");
                    const key = `${d.getFullYear()}-${mm}-${dd}`;
                    const label =
                        i === 0
                            ? _t("qing|text_d5f5a7a0")
                            : i === 1
                              ? _t("qing|text_0c184871")
                              : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
                    const active = key === date;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setDate(key)}
                            style={{
                                flex: "0 0 auto",
                                width: 52,
                                padding: "6px 0",
                                borderRadius: 12,
                                cursor: "pointer",
                                border: `1px solid ${active ? "transparent" : p.border}`,
                                background: active ? p.accent : p.bgAlt,
                                color: active ? "#fff" : p.textDim,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 2,
                            }}
                        >
                            <span style={{ fontSize: 10.5 }}>{label}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: active ? "#fff" : p.text }}>{dd}</span>
                        </button>
                    );
                })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 24px 12px", flexShrink: 0 }}>
                <Pill label={_t("qing|text_88da32f8")} active={kind === "morning"} onClick={() => setKind("morning")} />
                <Pill label={_t("qing|text_c9a6878c")} active={kind === "evening"} onClick={() => setKind("evening")} />
                <div style={{ flex: 1 }} />
                <Button variant="primary" disabled={requesting || !isToday} onClick={() => void askNow()}>
                    {requesting ? _t("qing|text_43d2661b") : _t("qing|text_622f9911")}
                </Button>
            </div>

            {notice && (
                <div role="status" style={{ padding: "0 24px 12px" }}>
                    {notice}
                </div>
            )}
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : (
                <Scroll>
                    <div style={{ color: p.textDim, marginBottom: 12 }}>{schedule || _t("qing|text_c00fb926")}</div>
                    <div style={{ color: p.textDim, marginBottom: 12 }}>
                        {_t("qing|text_a6328025")}
                        {stats.sessions ?? 0} {_t("qing|text_92819b89")}{" "}
                        {stats.todos_open ?? todos.filter((todo) => !todo.done).length} {_t("qing|text_15465dbc")}{" "}
                        {stats.notifications ?? 0}
                    </div>
                    {visiblePending.length > 0 && (
                        <Card style={{ marginBottom: 14, background: p.accentSoft, borderColor: "transparent" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: p.text, marginBottom: 4 }}>
                                {_t("qing|text_49933a19")}
                            </div>
                            {visiblePending.map((x) => (
                                <div key={x} style={{ fontSize: 12, color: p.textDim }}>
                                    · {x}
                                </div>
                            ))}
                        </Card>
                    )}

                    {current?.content ? <Markdown text={current.content} /> : <Empty text={_t("qing|text_1295bb6b")} />}

                    {todos.length > 0 && (
                        <div style={{ marginTop: 26 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: p.text, marginBottom: 8 }}>
                                {_t("qing|text_52fdbbae")}
                            </div>
                            {todos.map((todo, i) => (
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
                                    key={todo.id ?? i}
                                    onClick={() => void toggleTodo(todo)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "7px 2px",
                                        cursor: "pointer",
                                        fontSize: 13.5,
                                        color: todo.done ? p.textDim : p.text,
                                        textDecoration: todo.done ? "line-through" : "none",
                                    }}
                                >
                                    <span style={{ color: todo.done ? p.accent : p.textDim, fontSize: 15 }}>
                                        {todo.done ? "✓" : "○"}
                                    </span>
                                    <span>{todo.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Scroll>
            )}
        </>
    );
};
