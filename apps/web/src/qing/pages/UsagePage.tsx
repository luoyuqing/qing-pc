/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/* Qing PC · 用量（对应 settings_agent/usage_page.dart，数据来自 /usage/summary） */

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { hub } from "../hub";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

function n(v: any): string {
    const x = Number(v || 0);
    if (x >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
    if (x >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
    return `${x}`;
}

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({
    label,
    value,
    accent,
}): React.ReactNode => {
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

export const UsagePage: React.FC<{ onBack?: () => void }> = ({ onBack }): React.ReactNode => {
    const generation = useRef(0);
    const [range, setRange] = useState("7d");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        const id = ++generation.current;
        setLoading(true);
        setError(null);
        try {
            const response = await hub.usageSummary(range);
            if (id === generation.current) setData(response);
        } catch (e) {
            if (id === generation.current) setError((e as Error).message);
        }
        if (id === generation.current) setLoading(false);
    }, [range]);

    useEffect(() => {
        void load();
        return () => {
            // This counter prevents stale ranges replacing the current selection.
            // oxlint-disable-next-line react-hooks/exhaustive-deps
            generation.current++;
        };
    }, [load, tick]);

    if (loading)
        return (
            <>
                <PageHeader title={_t("qing|text_42723e8b")} onBack={onBack} />
                <Loading />
            </>
        );
    if (error)
        return (
            <>
                <PageHeader title={_t("qing|text_42723e8b")} onBack={onBack} />
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
                title={_t("qing|text_42723e8b")}
                subtitle={[
                    data?.range
                        ? _t("qing|text_3d954408", { v0: `${data.range}`.replace("d", _t("qing|text_4ce3054e")) })
                        : null,
                    data?.since,
                ]
                    .filter(Boolean)
                    .join(" · ")}
                right={
                    <>
                        <select
                            aria-label={_t("qing|text_45d97824")}
                            value={range}
                            onChange={(event) => setRange(event.target.value)}
                        >
                            <option value="today">{_t("qing|text_5c9cf5e0")}</option>
                            <option value="7d">{_t("qing|text_38eefacb")}</option>
                            <option value="30d">{_t("qing|text_84ad2952")}</option>
                        </select>
                        <Button onClick={() => setTick((t) => t + 1)}>{_t("qing|text_aee88743")}</Button>
                    </>
                }
            />
            <Scroll>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <Stat label={_t("qing|text_aaf803e2")} value={n(totals.calls)} />
                    <Stat label={_t("qing|text_afb279f5")} value={n(totals.input_tokens)} />
                    <Stat label={_t("qing|text_a9607217")} value={n(totals.output_tokens)} />
                    <Stat
                        label={_t("qing|text_8751fe3a")}
                        value={`$${Number(totals.cost_usd || 0).toFixed(2)}`}
                        accent
                    />
                </div>

                {byModel.length > 0 && (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>
                            {_t("qing|text_19e7c022")}
                        </div>
                        {byModel.map((m, i) => {
                            const ratio = (Number(m.calls || 0) / maxCalls) * 100;
                            return (
                                <Card key={m.model} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                        <span style={{ color: p.text, fontWeight: 500 }}>
                                            {m.model || _t("qing|text_4d8c1c5b")}
                                        </span>
                                        <span style={{ color: p.textDim }}>
                                            {n(m.calls)} {_t("qing|text_172fb7e6")}
                                        </span>
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
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 14,
                                            marginTop: 6,
                                            fontSize: 11.5,
                                            color: p.textDim,
                                        }}
                                    >
                                        <span>
                                            {_t("qing|text_c404effc")}
                                            {n(m.input_tokens)}
                                        </span>
                                        <span>
                                            {_t("qing|text_4d5f7e15")}
                                            {n(m.output_tokens)}
                                        </span>
                                        <span>${Number(m.cost_usd || 0).toFixed(3)}</span>
                                    </div>
                                </Card>
                            );
                        })}
                    </>
                )}

                {Array.isArray(data?.by_persona) && data.by_persona.length > 0 && (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: "16px 0 8px" }}>
                            {_t("qing|text_2298ff29")}
                        </div>
                        {data.by_persona.map((x: any, i: number) => (
                            <Card key={x.persona} style={{ marginBottom: 8, padding: "10px 14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                    <span style={{ color: p.text }}>{x.persona || "—"}</span>
                                    <span style={{ color: p.textDim }}>
                                        {n(x.calls)} {_t("qing|text_6257886a")}
                                        {Number(x.cost_usd || 0).toFixed(3)}
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
