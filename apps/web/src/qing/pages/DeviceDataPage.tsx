/*
Qing PC · 设备数据
手机端采集、X2 汇总的数据在 PC 上只读回看：
通知 / 短信 / 日历 / 通讯录 / App 使用时长。
接口：/query/notifications、/query/sms、/query/calendar、/query/contacts、/query/usage
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf } from "../hub";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

type Tab = "notifications" | "sms" | "calendar" | "contacts" | "usage";

const TABS: { id: Tab; label: string }[] = [
    { id: "notifications", label: "通知" },
    { id: "sms", label: "短信" },
    { id: "calendar", label: "日历" },
    { id: "contacts", label: "通讯录" },
    { id: "usage", label: "使用时长" },
];

function shortTime(v: any): string {
    const s = `${v ?? ""}`.replace("T", " ");
    return s.length >= 16 ? s.slice(5, 16) : s;
}

export const DeviceDataPage: React.FC<{ onBack?: () => void; onOpenHub?: () => void }> = ({ onBack, onOpenHub }) => {
    const [tab, setTab] = useState<Tab>("notifications");
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setMeta("");
        try {
            if (tab === "notifications") {
                const d = await hub.notifications(200);
                setItems(itemsOf(d));
            } else if (tab === "sms") {
                const d = await hub.sms(200);
                setItems(itemsOf(d));
            } else if (tab === "calendar") {
                const d = await hub.calendar();
                setItems(itemsOf(d));
                if (d?.from && d?.to) setMeta(`范围 ${shortTime(d.from)} → ${shortTime(d.to)}`);
            } else if (tab === "contacts") {
                const d = await hub.contacts(300);
                setItems(itemsOf(d));
            } else {
                const d = await hub.deviceUsage();
                setItems(itemsOf(d));
                if (d?.date) setMeta(`日期 ${d.date}`);
            }
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, [tab]);

    useEffect(() => {
        void load();
    }, [load, tick]);

    const renderRow = (item: any, i: number) => {
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
                            {item.person || item.address || "未知号码"}
                        </span>
                        <span style={{ fontSize: 11, color: item.direction === "in" ? p.accent : p.textDim, marginLeft: "auto" }}>
                            {item.direction === "in" ? "收" : "发"} · {shortTime(item.sent_at)}
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
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: p.text }}>{item.title || "无标题"}</div>
                    <div style={{ fontSize: 11.5, color: p.accent, marginTop: 3 }}>
                        {item.all_day ? "全天" : `${shortTime(item.start_at)} → ${shortTime(item.end_at)}`}
                    </div>
                    {item.location && item.location !== "None" && (
                        <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>地点 {item.location}</div>
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
                        <span style={{ fontSize: 13, color: p.text }}>{item.name || "未命名"}</span>
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
                        {item.minutes ? `${item.minutes} 分钟` : item.duration_s ? `${Math.round(item.duration_s / 60)} 分钟` : "—"}
                    </span>
                </div>
            </Card>
        );
    };

    return (
        <>
            <PageHeader
                title="设备数据"
                subtitle={meta || "手机采集 · PC 只读"}
                onBack={onBack}
                right={
                    <>
                        {onOpenHub && <Button onClick={onOpenHub}>连接设置</Button>}
                        <Button onClick={() => setTick((t) => t + 1)}>刷新</Button>
                    </>
                }
            />

            <div style={{ display: "flex", gap: 6, padding: "0 24px 12px", flexShrink: 0, flexWrap: "wrap" }}>
                {TABS.map((t) => (
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

            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : items.length === 0 ? (
                <Empty text="没有数据。手机端开启对应权限并同步后才会出现。" />
            ) : (
                <Scroll>
                    <div style={{ fontSize: 11.5, color: p.textDim, marginBottom: 8 }}>共 {items.length} 条</div>
                    {items.map(renderRow)}
                </Scroll>
            )}
        </>
    );
};
