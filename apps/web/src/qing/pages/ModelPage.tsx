/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/* Qing PC · 模型与推理（当前模型 / 候选池 / 一键切换），对应 settings_agent/model_page.dart */

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { statusLabel } from "../status";
import { confirmAction, editText } from "../dialogs";
import { QingPanel } from "../QingPanel";
import { HubError, hub, loadConfig, saveConfig } from "../hub";
import { PersonaPicker } from "../PersonaPicker";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const ModelPage: React.FC<{ onBack?: () => void }> = ({ onBack }): React.ReactNode => {
    const generation = useRef(0);
    const [configure, setConfigure] = useState(false);
    const [persona, setPersona] = useState(loadConfig().persona);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [testMsg, setTestMsg] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [nk, setNk] = useState("");
    const [nl, setNl] = useState("");
    const [nm, setNm] = useState("");
    const [nb, setNb] = useState("");
    const [ne, setNe] = useState("");
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        const id = ++generation.current;
        setData(null);
        setLoading(true);
        setError(null);
        try {
            try {
                const bundle = await hub.agentBundle(persona);
                if (id === generation.current) setData(bundle);
            } catch (error) {
                if (!(error instanceof HubError) || error.status !== 404) throw error;
                const model = await hub.agentModel(persona);
                if (id === generation.current) setData(model);
            }
        } catch (e) {
            if (id === generation.current) setError((e as Error).message);
        }
        if (id === generation.current) setLoading(false);
    }, [persona]);

    useEffect(() => {
        void load();
        return () => {
            // This counter invalidates a request after switching persona or leaving.
            // oxlint-disable-next-line react-hooks/exhaustive-deps
            generation.current++;
        };
    }, [load, tick]);

    const changePersona = (id: string): void => {
        setPersona(id);
        // 写回全局，其他页面沿用上次选择
        saveConfig({ ...loadConfig(), persona: id });
    };

    const testOne = async (key: string): Promise<void> => {
        setBusy(`test:${key}`);
        setTestMsg(null);
        try {
            const r = await hub.testCandidate(key, persona);
            setTestMsg(_t("qing|text_d072a03c", { v0: r?.ms ? `，${r.ms}ms` : "", v1: r?.model || key }));
        } catch (e) {
            setTestMsg(_t("qing|text_dd2d597f", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const removeOne = async (c: any): Promise<void> => {
        if (!(await confirmAction(_t("qing|text_ed061054", { v0: c.label || c.key })))) return;
        setBusy(`del:${c.key}`);
        try {
            await hub.deleteCandidate(c.key, persona);
            await load();
        } catch (e) {
            setError(_t("qing|text_7fa791d8", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const editLabel = async (): Promise<void> => {
        const cur = data?.model || {};
        const next = await editText(_t("qing|text_832148a8"), cur.label || "");
        if (next === null) return;
        setBusy("label");
        try {
            await hub.setModelLabel(persona, cur.base_url, cur.model, next.trim());
            await load();
        } catch (e) {
            setError(_t("qing|text_2ecda40c", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const addOne = async (): Promise<void> => {
        if (!nk.trim() || !nm.trim() || !nb.trim()) {
            setError(_t("qing|text_7f192585"));
            return;
        }
        setBusy("add");
        try {
            await hub.addCandidate(
                {
                    key: nk.trim(),
                    label: nl.trim() || nk.trim(),
                    model: nm.trim(),
                    base_url: nb.trim(),
                    key_env: ne.trim() || undefined,
                    scope: "persona",
                },
                persona,
            );
            setNk("");
            setNl("");
            setNm("");
            setNb("");
            setNe("");
            setAdding(false);
            await load();
        } catch (e) {
            setError(_t("qing|text_3d845429", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const swap = async (key: string): Promise<void> => {
        setBusy(key);
        setError(null);
        try {
            await hub.switchModel(key, persona);
            await new Promise((r) => setTimeout(r, 600));
            setTick((t) => t + 1);
        } catch (e) {
            setError((e as Error).message);
        }
        setBusy(null);
    };

    if (configure)
        return (
            <QingPanel
                key={persona}
                resource="models"
                persona={persona}
                onBack={() => {
                    setConfigure(false);
                    void load();
                }}
            />
        );

    if (loading)
        return (
            <>
                <PageHeader title={_t("qing|text_f8db5bcd")} onBack={onBack} />
                <Loading />
            </>
        );
    if (error && !data)
        return (
            <>
                <PageHeader title={_t("qing|text_f8db5bcd")} onBack={onBack} />
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            </>
        );

    const cur = data?.model || {};
    const candidates: any[] = Array.isArray(data?.candidates) ? data.candidates : [];

    return (
        <>
            <PageHeader
                onBack={onBack}
                title={_t("qing|text_f8db5bcd")}
                subtitle={data?.label ? _t("qing|text_c920049f", { v0: data.label, v1: data.persona }) : undefined}
                right={
                    <>
                        <PersonaPicker value={persona} onChange={changePersona} compact />
                        <Button onClick={() => setConfigure(true)}>{_t("qing|text_1e943ab8")}</Button>
                        <Button onClick={() => setTick((t) => t + 1)}>{_t("qing|text_aee88743")}</Button>
                    </>
                }
            />
            <Scroll>
                {error && (
                    <div style={{ marginBottom: 12 }}>
                        <ErrorBox message={error} />
                    </div>
                )}

                <Card style={{ marginBottom: 14, background: p.accentSoft, borderColor: "transparent" }}>
                    <div style={{ fontSize: 11.5, color: p.textDim }}>{_t("qing|text_52f79fed")}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, color: p.text, marginTop: 2 }}>
                        {cur.label || cur.model || _t("qing|text_80a57e03")}
                    </div>
                    <div style={{ fontSize: 12, color: p.textDim, marginTop: 4, wordBreak: "break-all" }}>
                        {[cur.model, cur.base_url].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <Button disabled={busy === "label"} onClick={() => void editLabel()}>
                            {busy === "label" ? "…" : _t("qing|text_12a0d18f")}
                        </Button>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11.5, color: p.textDim }}>
                        {cur.api_mode ? <span>{statusLabel(cur.api_mode)}</span> : null}
                        {cur.key_env ? <span>{cur.key_env}</span> : null}
                        <span style={{ color: cur.has_key ? p.accent : p.danger }}>
                            {cur.has_key ? _t("qing|text_7e358a91") : _t("qing|text_3bb6c086")}
                        </span>
                    </div>
                </Card>

                <>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>
                            {_t("qing|text_eea80913")}
                            {candidates.length}）
                        </span>
                        <span style={{ marginLeft: "auto" }}>
                            <Button onClick={() => setAdding((v) => !v)}>
                                {adding ? _t("qing|text_2cd0f3be") : _t("qing|text_b8671d78")}
                            </Button>
                        </span>
                    </div>
                    {testMsg && (
                        <div
                            style={{
                                fontSize: 12,
                                color: testMsg.startsWith(_t("qing|text_016bf26f")) ? p.accent : p.danger,
                                marginBottom: 8,
                            }}
                        >
                            {testMsg}
                        </div>
                    )}
                    {adding && (
                        <Card style={{ marginBottom: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {[
                                    [_t("qing|text_66e7500a"), nk, setNk, "dso"],
                                    [_t("qing|text_daede988"), nl, setNl, _t("qing|text_8c719ba1")],
                                    [_t("qing|text_c98e118e"), nm, setNm, "deepseek-flash"],
                                    [_t("qing|text_52fff168"), nb, setNb, "https://api.deepseek.com/v1"],
                                ].map(([label, val, set, ph]: any) => (
                                    <div key={label}>
                                        <div style={{ fontSize: 11, color: p.textDim, marginBottom: 3 }}>{label}</div>
                                        <input
                                            aria-label={label}
                                            value={val}
                                            onChange={(e) => set(e.target.value)}
                                            placeholder={ph}
                                            style={{
                                                width: "100%",
                                                boxSizing: "border-box",
                                                padding: "6px 9px",
                                                fontSize: 12.5,
                                                borderRadius: 7,
                                                border: `1px solid ${p.border}`,
                                                background: p.bg,
                                                color: p.text,
                                                outline: "none",
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, color: p.textDim, marginBottom: 3 }}>
                                    {_t("qing|text_3b3585b2")}
                                </div>
                                <input
                                    aria-label={_t("qing|text_3b3585b2")}
                                    value={ne}
                                    onChange={(e) => setNe(e.target.value)}
                                    placeholder="DEEPSEEK_API_KEY"
                                    style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        padding: "6px 9px",
                                        fontSize: 12.5,
                                        borderRadius: 7,
                                        border: `1px solid ${p.border}`,
                                        background: p.bg,
                                        color: p.text,
                                        outline: "none",
                                    }}
                                />
                            </div>
                            <div style={{ marginTop: 10 }}>
                                <Button variant="primary" disabled={busy === "add"} onClick={() => void addOne()}>
                                    {busy === "add" ? _t("qing|text_18931020") : _t("qing|text_ba47514d")}
                                </Button>
                            </div>
                        </Card>
                    )}
                    {candidates.map((c) => {
                        const active = c.is_current || c.key === cur.key;
                        return (
                            <Card
                                key={c.key}
                                onClick={active || busy ? undefined : () => void swap(c.key)}
                                style={{
                                    marginBottom: 8,
                                    opacity: busy && busy !== c.key ? 0.55 : 1,
                                    borderColor: active ? p.accent : p.border,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 600, color: p.text }}>
                                            {c.label || c.model || c.key}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11.5,
                                                color: p.textDim,
                                                marginTop: 3,
                                                wordBreak: "break-all",
                                            }}
                                        >
                                            {[c.model, c.base_url].filter(Boolean).join(" · ")}
                                        </div>
                                    </div>
                                    {active ? (
                                        <span style={{ fontSize: 11.5, color: p.accent, flexShrink: 0 }}>
                                            {_t("qing|text_fa48e893")}
                                        </span>
                                    ) : busy === c.key ? (
                                        <span style={{ fontSize: 11.5, color: p.textDim, flexShrink: 0 }}>
                                            {_t("qing|text_ad0196c8")}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: 11.5, color: p.textDim, flexShrink: 0 }}>
                                            {_t("qing|text_eff514b8")}
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 10,
                                        marginTop: 6,
                                        fontSize: 11,
                                        color: p.textDim,
                                        alignItems: "center",
                                    }}
                                >
                                    {c.key_env ? <span>{c.key_env}</span> : null}
                                    {c.has_key === false && (
                                        <span style={{ color: p.danger }}>{_t("qing|text_69415a73")}</span>
                                    )}
                                    {c.shared_endpoint && <span>{_t("qing|text_c3196258")}</span>}
                                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void testOne(c.key);
                                            }}
                                            disabled={busy === `test:${c.key}`}
                                            style={{
                                                fontSize: 11,
                                                padding: "2px 8px",
                                                borderRadius: 6,
                                                cursor: "pointer",
                                                border: `1px solid ${p.border}`,
                                                background: "transparent",
                                                color: p.textDim,
                                            }}
                                        >
                                            {busy === `test:${c.key}`
                                                ? _t("qing|text_458748c7")
                                                : _t("qing|text_6aa8f49c")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void removeOne(c);
                                            }}
                                            disabled={busy === `del:${c.key}`}
                                            style={{
                                                fontSize: 11,
                                                padding: "2px 8px",
                                                borderRadius: 6,
                                                cursor: "pointer",
                                                border: `1px solid ${p.border}`,
                                                background: "transparent",
                                                color: p.danger,
                                            }}
                                        >
                                            {_t("qing|text_2f9daa82")}
                                        </button>
                                    </span>
                                </div>
                            </Card>
                        );
                    })}
                </>

                {Array.isArray(data?.fallback) && data.fallback.length > 0 && (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: "16px 0 8px" }}>
                            {_t("qing|text_f40bbf98")}
                        </div>
                        {data.fallback.map((f: any, i: number) => (
                            <div
                                key={typeof f === "string" ? f : f.key || f.model}
                                style={{ fontSize: 12.5, color: p.textDim, padding: "4px 0" }}
                            >
                                {i + 1}. {typeof f === "string" ? f : f.label || f.model || f.key || JSON.stringify(f)}
                            </div>
                        ))}
                    </>
                )}
            </Scroll>
        </>
    );
};
