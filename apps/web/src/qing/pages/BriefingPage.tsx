/* Qing PC · 简报（晨报 / 晚报），数据来自 device-hub GET /briefing/day */

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf } from "../hub";
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

export const BriefingPage: React.FC = () => {
    const [date, setDate] = useState(today());
    const [kind, setKind] = useState<string>(new Date().getHours() >= 17 ? "evening" : "morning");
    const [items, setItems] = useState<any[]>([]);
    const [todos, setTodos] = useState<any[]>([]);
    const [pending, setPending] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await hub.briefingDay(date);
            const list = itemsOf(data);
            setItems(list);
            setTodos(Array.isArray(data?.todos) ? data.todos : []);
            setPending(Array.isArray(data?.pending) ? data.pending.map((x: any) => `${x}`) : []);
            const kinds = list.map((x) => x.kind);
            if (kinds.length && !kinds.includes(kind)) {
                setKind(kinds.includes("morning") ? "morning" : kinds[0]);
            }
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
        // kind 只用于纠偏，不作为依赖，避免重复拉取
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);

    useEffect(() => {
        void load();
    }, [load, tick]);

    const current = items.find((x) => x.kind === kind);
    const isToday = date === today();

    const toggleTodo = async (todo: any) => {
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

    const askNow = async () => {
        setRequesting(true);
        try {
            await hub.requestBriefing(kind);
            await new Promise((r) => setTimeout(r, 4000));
            setTick((t) => t + 1);
        } catch (e) {
            setError((e as Error).message);
        }
        setRequesting(false);
    };

    return (
        <>
            <PageHeader
                title="简报"
                subtitle={
                    current?.generated
                        ? `${date} · 设备数据兜底版本`
                        : current
                          ? `${date} · 助理生成`
                          : date
                }
                right={
                    <>
                        <Button onClick={() => setDate(shift(date, -1))}>前一天</Button>
                        <Button disabled={!isToday} onClick={() => setDate(shift(date, 1))}>
                            后一天
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
                    const label = i === 0 ? "今天" : i === 1 ? "昨天" : `周${"日一二三四五六"[d.getDay()]}`;
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
                            <span style={{ fontSize: 15, fontWeight: 600, color: active ? "#fff" : p.text }}>
                                {dd}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 24px 12px", flexShrink: 0 }}>
                <Pill label="晨报" active={kind === "morning"} onClick={() => setKind("morning")} />
                <Pill label="晚报" active={kind === "evening"} onClick={() => setKind("evening")} />
                <div style={{ flex: 1 }} />
                <Button variant="primary" disabled={requesting} onClick={askNow}>
                    {requesting ? "生成中…" : "现在写一份"}
                </Button>
            </div>

            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : (
                <Scroll>
                    {pending.length > 0 && (
                        <Card style={{ marginBottom: 14, background: p.accentSoft, borderColor: "transparent" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: p.text, marginBottom: 4 }}>待生成</div>
                            {pending.map((x, i) => (
                                <div key={i} style={{ fontSize: 12, color: p.textDim }}>
                                    · {x}
                                </div>
                            ))}
                        </Card>
                    )}

                    {current?.content ? (
                        <Markdown text={current.content} />
                    ) : (
                        <Empty text="这一天还没有简报。" />
                    )}

                    {todos.length > 0 && (
                        <div style={{ marginTop: 26 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: p.text, marginBottom: 8 }}>待办</div>
                            {todos.map((todo, i) => (
                                <div
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
