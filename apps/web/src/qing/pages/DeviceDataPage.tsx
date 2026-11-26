/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 设备数据
手机端采集、X2 汇总的数据在 PC 上只读回看：
通知 / 短信 / 日历 / 通讯录 / App 使用时长。
接口：/query/notifications、/query/sms、/query/calendar、/query/contacts、/query/usage
*/

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { hub, itemsOf } from "../hub";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

type Tab = "notifications" | "sms" | "calendar" | "contacts" | "usage";

function getTABS(): { id: Tab; label: string }[] {
    return [
        { id: "notifications", label: _t("qing|text_4b6ded8a") },
        { id: "sms", label: _t("qing|text_81a4ceb7") },
        { id: "calendar", label: _t("qing|text_a00f295c") },
        { id: "contacts", label: _t("qing|text_06657c27") },
        { id: "usage", label: _t("qing|text_1e583ca1") },
    ];
}

function shortTime(v: any): string {
    const s = `${v ?? ""}`.replace("T", " ");
    return s.length >= 16 ? s.slice(5, 16) : s;
}

export const DeviceDataPage: React.FC<{ onBack?: () => void; onOpenHub?: () => void }> = ({
    onBack,
    onOpenHub,
}): React.ReactNode => {
    const generation = useRef(0);
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<Tab>("notifications");
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        const id = ++generation.current;
        setLoading(true);
        setItems([]);
        setError(null);
        setMeta("");
        try {
            if (tab === "notifications") {
                const d = await hub.notifications(200);
                if (id !== generation.current) return;
                setItems(itemsOf(d));
            } else if (tab === "sms") {
                const d = await hub.sms(200);
                if (id !== generation.current) return;
                setItems(itemsOf(d));
            } else if (tab === "calendar") {
                const d = await hub.calendar();
                if (id !== generation.current) return;
                setItems(itemsOf(d));
                if (d?.from && d?.to) setMeta(_t("qing|text_cd9d870c", { v0: shortTime(d.from), v1: shortTime(d.to) }));
            } else if (tab === "contacts") {
                const d = await hub.contacts(300);
                if (id !== generation.current) return;
                setItems(itemsOf(d));
            } else {
                const d = await hub.deviceUsage();
                if (id !== generation.current) return;
                setItems(itemsOf(d));
                if (d?.date) setMeta(_t("qing|text_77568772", { v0: d.date }));
            }
        } catch (e) {
            if (id === generation.current) setError((e as Error).message);
        }
        if (id === generation.current) setLoading(false);
    }, [tab]);

    useEffect(() => {
        void load();
        return () => {
            // This counter invalidates requests when changing category or leaving the page.
            // oxlint-disable-next-line react-hooks/exhaustive-deps
            generation.current++;
        };
    }, [load, tick]);

    const renderRow = (item: any, i: number): React.ReactNode => {
        if (tab === "notifications") {
            return (
                <Card key={i} style={{ marginBottom: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 12, color: p.accent, flexShrink: 0 }}>{item.app_name || "—"}</span>
                        <span style={{ fontSize: 11.5, color: p.textDim, marginLeft: "auto" }}>
                            {shortTime(item.posted_at)}
                        </span>
                    </div>
                    <div style={{ fontSize: 13, color: p.text, marginTop: 3 }}>{item.title || ""}</div>
                    <div style={{ fontSize: 12, color: p.textDim, marginTop: 2, lineHeight: 1.55 }}>
                        {item.text || ""}
                    </div>
                </Card>
            );
        }
        if (tab === "sms") {
            return (
                <Card key={i} style={{ marginBottom: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 12.5, color: p.text, fontFamily: "ui-monospace, monospace" }}>
                            {item.person || item.address || _t("qing|text_7f1ff040")}
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                color: item.direction === "in" ? p.accent : p.textDim,
                                marginLeft: "auto",
                            }}
                        >
                            {item.direction === "in" ? _t("qing|text_339bacf4") : _t("qing|text_05b5d32c")} ·{" "}
                            {shortTime(item.sent_at)}
                        </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: p.textDim, marginTop: 4, lineHeight: 1.6 }}>
                        {item.body || ""}
                    </div>
                </Card>
            );
        }
        if (tab === "calendar") {
            return (
                <Card key={i} style={{ marginBottom: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: p.text }}>
                        {item.title || _t("qing|text_8c974da9")}
                    </div>
                    <div style={{ fontSize: 11.5, color: p.accent, marginTop: 3 }}>
                        {item.all_day
                            ? _t("qing|text_0b97c851")
                            : `${shortTime(item.start_at)} → ${shortTime(item.end_at)}`}
                    </div>
                    {item.location && item.location !== "None" && (
                        <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>
                            {_t("qing|text_253ac66f")}
                            {item.location}
                        </div>
                    )}
                    {item.description && item.description !== "None" && (
                        <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 4, lineHeight: 1.55 }}>
                            {item.description}
                        </div>
                    )}
                </Card>
            );
        }
        if (tab === "contacts") {
            let phones = "";
            try {
                const arr = JSON.parse(item.phones || "[]");
                phones = Array.isArray(arr) ? arr.join(" / ") : "";
            } catch {
                phones = `${item.phones || ""}`;
            }
            return (
                <Card key={i} style={{ marginBottom: 6, padding: "9px 14px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, color: p.text }}>{item.name || _t("qing|text_67bee6ac")}</span>
                        <span
                            style={{
                                fontSize: 11.5,
                                color: p.textDim,
                                marginLeft: "auto",
                                fontFamily: "ui-monospace, monospace",
                            }}
                        >
                            {phones}
                        </span>
                    </div>
                    {item.organization && (
                        <div style={{ fontSize: 11, color: p.textDim, marginTop: 2 }}>{item.organization}</div>
                    )}
                </Card>
            );
        }
        // usage
        return (
            <Card key={i} style={{ marginBottom: 6, padding: "9px 14px" }}>
                <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 13, color: p.text }}>{item.app_name || item.package || "—"}</span>
                    <span style={{ fontSize: 12, color: p.accent, marginLeft: "auto" }}>
                        {item.minutes
                            ? _t("qing|text_f3087105", { v0: item.minutes })
                            : item.duration_s
                              ? _t("qing|text_f3087105", { v0: Math.round(item.duration_s / 60) })
                              : "—"}
                    </span>
                </div>
            </Card>
        );
    };

    return (
        <>
            <PageHeader
                title={_t("qing|text_61766385")}
                subtitle={meta || _t("qing|text_db5d3f37")}
                onBack={onBack}
                right={
                    <>
                        {onOpenHub && <Button onClick={onOpenHub}>{_t("qing|text_8d072162")}</Button>}
                        <Button onClick={() => setTick((t) => t + 1)}>{_t("qing|text_aee88743")}</Button>
                    </>
                }
            />

            <div style={{ display: "flex", gap: 6, padding: "0 24px 12px", flexShrink: 0, flexWrap: "wrap" }}>
                {getTABS().map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: "6px 13px",
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
                    aria-label={_t("qing|text_788f984c")}
                    placeholder={_t("qing|text_02cc3573")}
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
            ) : items.length === 0 ? (
                <Empty text={_t("qing|text_4199709c")} />
            ) : (
                <Scroll>
                    <div style={{ fontSize: 11.5, color: p.textDim, marginBottom: 8 }}>
                        {_t("qing|text_76e547a8")}
                        {items.length} {_t("qing|text_f004f1d8")}
                    </div>
                    {items
                        .filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase()))
                        .map(renderRow)}
                </Scroll>
            )}
        </>
    );
};
