/* Qing PC · 用量（对应 settings_agent/usage_page.dart，数据来自 /usage/summary） */

import React, { useCallback, useEffect, useState } from "react";
import { hub } from "../hub";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

function n(v: any): string {
    const x = Number(v || 0);
    if (x >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
    if (x >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
    return `${x}`;
}

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => {
    const p = palette();
    return (
        <div
            style={{
                flex: "1 1 120px",
                padding: "12px 14px",
                borderRadius: 10,
                background: p.bgAlt,
                border: `1px solid ${p.border}`,
            }}
        >
            <div style={{ fontSize: 11.5, color: p.textDim }}>{label}</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: accent ? p.accent : p.text, marginTop: 2 }}>
                {value}
            </div>
        </div>
    );
};

export const UsagePage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await hub.usageSummary());
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load, tick]);

    if (loading)
        return (
            <>
                <PageHeader title="用量" onBack={onBack} />
                <Loading />
            </>
        );
    if (error)
        return (
            <>
                <PageHeader title="用量" onBack={onBack} />
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            </>
        );

    const totals = data?.totals || {};
    const byModel: any[] = Array.isArray(data?.by_model) ? data.by_model : [];
    const maxCalls = Math.max(1, ...byModel.map((m) => Number(m.calls || 0)));

    return (
        <>
            <PageHeader
                onBack={onBack}
                title="用量"
                subtitle={[data?.range ? `近 ${`${data.range}`.replace("d", " 天")}` : null, data?.since]
                    .filter(Boolean)
                    .join(" · ")}
                right={<Button onClick={() => setTick((t) => t + 1)}>刷新</Button>}
            />
            <Scroll>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <Stat label="调用次数" value={n(totals.calls)} />
                    <Stat label="输入 Tokens" value={n(totals.input_tokens)} />
                    <Stat label="输出 Tokens" value={n(totals.output_tokens)} />
                    <Stat label="预估花费" value={`$${Number(totals.cost_usd || 0).toFixed(2)}`} accent />
                </div>

                {byModel.length > 0 && (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>按模型</div>
                        {byModel.map((m, i) => {
                            const ratio = (Number(m.calls || 0) / maxCalls) * 100;
                            return (
                                <Card key={i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                        <span style={{ color: p.text, fontWeight: 500 }}>{m.model || "未知"}</span>
                                        <span style={{ color: p.textDim }}>{n(m.calls)} 次</span>
                                    </div>
                                    <div
                                        style={{
                                            height: 5,
                                            borderRadius: 3,
                                            background: p.bg,
                                            marginTop: 7,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: `${ratio}%`,
                                                height: "100%",
                                                background: p.accent,
                                                borderRadius: 3,
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11.5, color: p.textDim }}>
                                        <span>入 {n(m.input_tokens)}</span>
                                        <span>出 {n(m.output_tokens)}</span>
                                        <span>${Number(m.cost_usd || 0).toFixed(3)}</span>
                                    </div>
                                </Card>
                            );
                        })}
                    </>
                )}

                {Array.isArray(data?.by_persona) && data.by_persona.length > 0 && (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: "16px 0 8px" }}>按人设</div>
                        {data.by_persona.map((x: any, i: number) => (
                            <Card key={i} style={{ marginBottom: 8, padding: "10px 14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                    <span style={{ color: p.text }}>{x.persona || "—"}</span>
                                    <span style={{ color: p.textDim }}>
                                        {n(x.calls)} 次 · ${Number(x.cost_usd || 0).toFixed(3)}
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </>
                )}
            </Scroll>
        </>
    );
};
