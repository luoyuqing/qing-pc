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
    const [switchNotice, setSwitchNotice] = useState<string | null>(null);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editLabelVal, setEditLabelVal] = useState("");
    const [editModelVal, setEditModelVal] = useState("");
    const [editBaseVal, setEditBaseVal] = useState("");
    const [editKeyEnvVal, setEditKeyEnvVal] = useState("");
    const [adding, setAdding] = useState(false);
    const [nk, setNk] = useState("");
    const [nl, setNl] = useState("");
    const [nm, setNm] = useState("");
    const [nb, setNb] = useState("");
    const [ne, setNe] = useState("");
    const [tick, setTick] = useState(0);
    const [editingFallback, setEditingFallback] = useState(false);
    const [fallbackDraft, setFallbackDraft] = useState<
        { key: string; label: string; model: string; base_url: string; provider: string; key_env: string }[]
    >([]);
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

    const swap = async (key: string, label?: string): Promise<void> => {
        setBusy(key);
        setError(null);
        setSwitchNotice(null);
        try {
            await hub.switchModel(key, persona);
            await new Promise((r) => setTimeout(r, 600));
            setTick((t) => t + 1);
            setSwitchNotice(_t("qing|model_switched", { v0: label || key }));
        } catch (e) {
            setError((e as Error).message);
        }
        setBusy(null);
    };

    const startEditCandidate = (c: any): void => {
        setEditingKey(c.key);
        setEditLabelVal(c.label || "");
        setEditModelVal(c.model || "");
        setEditBaseVal(c.base_url || "");
        setEditKeyEnvVal(c.key_env || "");
    };

    const saveEditCandidate = async (c: any): Promise<void> => {
        if (!editModelVal.trim() || !editBaseVal.trim()) {
            setError(_t("qing|text_7f192585"));
            return;
        }
        setBusy(`edit:${c.key}`);
        setError(null);
        try {
            await hub.updateCandidate(
                c.key,
                persona,
                {
                    label: editLabelVal.trim() || c.key,
                    model: editModelVal.trim(),
                    base_url: editBaseVal.trim(),
                    key_env: editKeyEnvVal.trim() || undefined,
                    api_mode: c.api_mode || "chat_completions",
                },
                "persona",
            );
            setEditingKey(null);
            await load();
        } catch (e) {
            setError(_t("qing|text_2ecda40c", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const startEditFallback = (): void => {
        const list = Array.isArray(data?.fallback) ? data.fallback : [];
        setFallbackDraft(
            list.map((f: any, idx: number) =>
                typeof f === "string"
                    ? { key: f, label: f, model: f, base_url: "", provider: "custom", key_env: "" }
                    : {
                          key: f.key || f.model || `fb-${idx}`,
                          label: f.label || f.model || f.key || "",
                          model: f.model || f.key || "",
                          base_url: f.base_url || "",
                          provider: f.provider || "custom",
                          key_env: f.key_env || "",
                      },
            ),
        );
        setEditingFallback(true);
    };

    const toggleFallbackCandidate = (c: any): void => {
        const cid = c.key || c.model;
        setFallbackDraft((prev) => {
            const exists = prev.some(
                (item) => item.key === cid || (item.model === c.model && item.base_url === c.base_url),
            );
            if (exists) {
                return prev.filter(
                    (item) => !(item.key === cid || (item.model === c.model && item.base_url === c.base_url)),
                );
            }
            return [
                ...prev,
                {
                    key: cid,
                    label: c.label || c.model || cid,
                    model: c.model || cid,
                    base_url: c.base_url || "",
                    provider: c.provider || "custom",
                    key_env: c.key_env || "",
                },
            ];
        });
    };

    const moveFallbackDraft = (index: number, delta: -1 | 1): void => {
        setFallbackDraft((prev) => {
            const nextIndex = index + delta;
            if (nextIndex < 0 || nextIndex >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    };

    const saveFallbackDraft = async (): Promise<void> => {
        setBusy("fallback");
        setError(null);
        try {
            const chain = fallbackDraft.map((item) => ({
                provider: item.provider || "custom",
                model: item.model,
                base_url: item.base_url,
                key_env: item.key_env,
            }));
            await hub.saveFallback(persona, chain);
            setEditingFallback(false);
            setSwitchNotice(_t("qing|text_1bd91a7d"));
            await load();
        } catch (e) {
            setError(_t("qing|text_2ecda40c", { v0: (e as Error).message }));
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
    const auxiliaryList: any[] = Array.isArray(data?.auxiliary)
        ? data.auxiliary
        : data?.auxiliary && typeof data.auxiliary === "object"
          ? Object.entries(data.auxiliary).map(([k, v]: [string, any]) => ({
                key: k,
                ...(typeof v === "object" && v !== null ? v : {}),
            }))
          : [];

    const inputStyle: React.CSSProperties = {
        width: "100%",
        boxSizing: "border-box",
        padding: "6px 9px",
        fontSize: 12.5,
        borderRadius: 7,
        border: `1px solid ${p.divider}`,
        background: p.bg,
        color: p.text,
        outline: "none",
    };

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
                {switchNotice && (
                    <div
                        role="status"
                        style={{
                            marginBottom: 12,
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: p.accentSoft,
                            color: p.accent,
                            fontSize: 13,
                            fontWeight: 500,
                        }}
                    >
                        {switchNotice}
                    </div>
                )}

                <Card style={{ marginBottom: 16, background: p.accentSoft, borderColor: p.divider }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ font: "var(--cpd-font-body-xs-semibold)", color: p.accent }}>
                            {_t("qing|text_52f79fed")}
                        </span>
                        <span
                            style={{
                                marginLeft: "auto",
                                font: "var(--cpd-font-body-xs-semibold)",
                                color: cur.has_key ? p.accent : p.danger,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: p.bg,
                            }}
                        >
                            {cur.has_key ? _t("qing|text_7e358a91") : _t("qing|text_3bb6c086")}
                        </span>
                    </div>
                    <div style={{ font: "var(--cpd-font-body-md-semibold)", color: p.text, marginTop: 4 }}>
                        {cur.label || cur.model || _t("qing|text_80a57e03")}
                    </div>
                    <div
                        style={{
                            font: "var(--cpd-font-body-sm-regular)",
                            color: p.textDim,
                            marginTop: 4,
                            wordBreak: "break-all",
                        }}
                    >
                        {[cur.model, cur.base_url].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                        {cur.api_mode ? (
                            <span style={{ font: "var(--cpd-font-body-xs-regular)", color: p.textDim }}>
                                {statusLabel(cur.api_mode)}
                            </span>
                        ) : null}
                        {cur.key_env ? (
                            <span style={{ font: "var(--cpd-font-body-xs-regular)", color: p.textDim }}>
                                {cur.key_env}
                            </span>
                        ) : null}
                        <span style={{ marginLeft: "auto" }}>
                            <Button disabled={busy === "label"} onClick={() => void editLabel()}>
                                {busy === "label" ? "…" : _t("qing|text_12a0d18f")}
                            </Button>
                        </span>
                    </div>
                </Card>

                <>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ font: "var(--cpd-font-body-sm-semibold)", color: p.text }}>
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
                            role="status"
                            style={{
                                fontSize: 12.5,
                                color: testMsg.startsWith(_t("qing|text_016bf26f")) ? p.accent : p.danger,
                                marginBottom: 10,
                                padding: "8px 12px",
                                borderRadius: 8,
                                background: p.bgAlt,
                                border: `1px solid ${p.divider}`,
                            }}
                        >
                            {testMsg}
                        </div>
                    )}
                    {adding && (
                        <Card style={{ marginBottom: 12, borderColor: p.divider }}>
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
                                            style={inputStyle}
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
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginTop: 10 }}>
                                <Button variant="primary" disabled={busy === "add"} onClick={() => void addOne()}>
                                    {busy === "add" ? _t("qing|text_18931020") : _t("qing|text_ba47514d")}
                                </Button>
                            </div>
                        </Card>
                    )}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                            gap: 12,
                            alignItems: "stretch",
                        }}
                    >
                        {candidates.map((c) => {
                            const active = c.is_current || c.key === cur.key;
                            const selected = selectedKey === c.key;
                            const editing = editingKey === c.key;
                            return (
                                <Card
                                    key={c.key}
                                    onClick={() => setSelectedKey((prev) => (prev === c.key ? null : c.key))}
                                    style={{
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        opacity: busy && busy !== c.key ? 0.6 : 1,
                                        borderColor: active ? p.accent : p.divider,
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        font: "var(--cpd-font-body-md-semibold)",
                                                        color: p.text,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {c.label || c.model || c.key}
                                                </span>
                                                {active && (
                                                    <span
                                                        style={{
                                                            font: "var(--cpd-font-body-xs-semibold)",
                                                            color: p.accent,
                                                            background: p.accentSoft,
                                                            padding: "2px 8px",
                                                            borderRadius: 999,
                                                        }}
                                                    >
                                                        {_t("qing|text_fa48e893")}
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    font: "var(--cpd-font-body-sm-regular)",
                                                    color: p.textDim,
                                                    marginTop: 3,
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                {[c.model, c.base_url].filter(Boolean).join(" · ")}
                                            </div>
                                        </div>
                                        {!active && (
                                            <Button
                                                variant="primary"
                                                disabled={Boolean(busy)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void swap(c.key, c.label || c.model);
                                                }}
                                            >
                                                {busy === c.key
                                                    ? _t("qing|text_ad0196c8")
                                                    : _t("qing|model_switch_btn")}
                                            </Button>
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 10,
                                            marginTop: "auto",
                                            paddingTop: 8,
                                            borderTop: `1px solid ${p.divider}`,
                                            font: "var(--cpd-font-body-xs-regular)",
                                            color: p.textDim,
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        {c.key_env ? <span>{c.key_env}</span> : null}
                                        {c.has_key === false && (
                                            <span style={{ color: p.danger }}>{_t("qing|text_69415a73")}</span>
                                        )}
                                        {c.shared_endpoint && <span>{_t("qing|text_c3196258")}</span>}
                                        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (editing) setEditingKey(null);
                                                    else startEditCandidate(c);
                                                }}
                                                style={{
                                                    font: "var(--cpd-font-body-xs-regular)",
                                                    padding: "3px 9px",
                                                    borderRadius: 6,
                                                    cursor: "pointer",
                                                    border: `1px solid ${p.divider}`,
                                                    background: "transparent",
                                                    color: p.text,
                                                }}
                                            >
                                                {editing ? _t("qing|text_2cd0f3be") : _t("qing|text_05183656")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void testOne(c.key);
                                                }}
                                                disabled={busy === `test:${c.key}`}
                                                style={{
                                                    font: "var(--cpd-font-body-xs-regular)",
                                                    padding: "3px 9px",
                                                    borderRadius: 6,
                                                    cursor: "pointer",
                                                    border: `1px solid ${p.divider}`,
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
                                                    font: "var(--cpd-font-body-xs-regular)",
                                                    padding: "3px 9px",
                                                    borderRadius: 6,
                                                    cursor: "pointer",
                                                    border: `1px solid ${p.divider}`,
                                                    background: "transparent",
                                                    color: p.danger,
                                                }}
                                            >
                                                {_t("qing|text_2f9daa82")}
                                            </button>
                                        </span>
                                    </div>
                                    {selected && !editing && (
                                        <div
                                            style={{
                                                marginTop: 6,
                                                paddingTop: 8,
                                                borderTop: `1px solid ${p.divider}`,
                                                font: "var(--cpd-font-body-xs-regular)",
                                                color: p.textDim,
                                                display: "grid",
                                                gridTemplateColumns: "auto 1fr",
                                                gap: "4px 12px",
                                            }}
                                        >
                                            <span>{_t("qing|text_66e7500a")}</span>
                                            <span style={{ color: p.text, fontFamily: "ui-monospace, monospace" }}>
                                                {c.key}
                                            </span>
                                            {c.api_mode && (
                                                <>
                                                    <span>{_t("qing|text_a9fd1ddb")}</span>
                                                    <span style={{ color: p.text }}>{statusLabel(c.api_mode)}</span>
                                                </>
                                            )}
                                            {c.base_url && (
                                                <>
                                                    <span>{_t("qing|text_52fff168")}</span>
                                                    <span style={{ color: p.text, wordBreak: "break-all" }}>
                                                        {c.base_url}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {editing && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            role="presentation"
                                            style={{
                                                marginTop: 6,
                                                paddingTop: 8,
                                                borderTop: `1px solid ${p.divider}`,
                                                display: "grid",
                                                gap: 8,
                                            }}
                                        >
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                <div>
                                                    <div
                                                        style={{
                                                            font: "var(--cpd-font-body-xs-regular)",
                                                            color: p.textDim,
                                                            marginBottom: 3,
                                                        }}
                                                    >
                                                        {_t("qing|text_daede988")}
                                                    </div>
                                                    <input
                                                        aria-label={_t("qing|text_daede988")}
                                                        value={editLabelVal}
                                                        onChange={(e) => setEditLabelVal(e.target.value)}
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            font: "var(--cpd-font-body-xs-regular)",
                                                            color: p.textDim,
                                                            marginBottom: 3,
                                                        }}
                                                    >
                                                        {_t("qing|text_c98e118e")}
                                                    </div>
                                                    <input
                                                        aria-label={_t("qing|text_c98e118e")}
                                                        value={editModelVal}
                                                        onChange={(e) => setEditModelVal(e.target.value)}
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            font: "var(--cpd-font-body-xs-regular)",
                                                            color: p.textDim,
                                                            marginBottom: 3,
                                                        }}
                                                    >
                                                        {_t("qing|text_52fff168")}
                                                    </div>
                                                    <input
                                                        aria-label={_t("qing|text_52fff168")}
                                                        value={editBaseVal}
                                                        onChange={(e) => setEditBaseVal(e.target.value)}
                                                        style={inputStyle}
                                                    />
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            font: "var(--cpd-font-body-xs-regular)",
                                                            color: p.textDim,
                                                            marginBottom: 3,
                                                        }}
                                                    >
                                                        {_t("qing|text_3b3585b2")}
                                                    </div>
                                                    <input
                                                        aria-label={_t("qing|text_3b3585b2")}
                                                        value={editKeyEnvVal}
                                                        onChange={(e) => setEditKeyEnvVal(e.target.value)}
                                                        style={inputStyle}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <Button
                                                    variant="primary"
                                                    disabled={busy === `edit:${c.key}`}
                                                    onClick={() => void saveEditCandidate(c)}
                                                >
                                                    {busy === `edit:${c.key}`
                                                        ? _t("qing|text_ff509c9b")
                                                        : _t("qing|text_a3030bf8")}
                                                </Button>
                                                <Button onClick={() => setEditingKey(null)}>
                                                    {_t("qing|text_2cd0f3be")}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </>

                {auxiliaryList.length > 0 && (
                    <>
                        <div
                            style={{
                                font: "var(--cpd-font-body-sm-semibold)",
                                color: p.text,
                                margin: "18px 0 8px",
                            }}
                        >
                            {_t("qing|model_auxiliary_title")}
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                                gap: 12,
                                alignItems: "stretch",
                            }}
                        >
                            {auxiliaryList.map((aux, i) => (
                                <Card
                                    key={aux.key || aux.model || i}
                                    style={{
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                    }}
                                >
                                    <div style={{ font: "var(--cpd-font-body-md-semibold)", color: p.text }}>
                                        {aux.label || aux.key || aux.model}
                                    </div>
                                    <div
                                        style={{
                                            font: "var(--cpd-font-body-sm-regular)",
                                            color: p.textDim,
                                            wordBreak: "break-all",
                                        }}
                                    >
                                        {[aux.model, aux.base_url].filter(Boolean).join(" · ") || "—"}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: "auto",
                                            paddingTop: 8,
                                            borderTop: `1px solid ${p.divider}`,
                                            display: "flex",
                                            justifyContent: "flex-end",
                                        }}
                                    >
                                        <Button onClick={() => setConfigure(true)}>{_t("qing|text_05183656")}</Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </>
                )}

                <div style={{ display: "flex", alignItems: "center", margin: "18px 0 8px" }}>
                    <span style={{ font: "var(--cpd-font-body-sm-semibold)", color: p.text }}>
                        {_t("qing|text_f40bbf98")}
                    </span>
                    <span style={{ marginLeft: "auto" }}>
                        <Button onClick={() => (editingFallback ? setEditingFallback(false) : startEditFallback())}>
                            {editingFallback ? _t("qing|text_2cd0f3be") : _t("qing|text_d75d9516")}
                        </Button>
                    </span>
                </div>

                {editingFallback ? (
                    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ font: "var(--cpd-font-body-xs-regular)", color: p.textDim }}>
                            {_t("qing|fallback_list_hint")}
                        </div>
                        {fallbackDraft.length === 0 ? (
                            <div style={{ font: "var(--cpd-font-body-sm-regular)", color: p.textDim }}>
                                {_t("qing|fallback_empty_chain")}
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {fallbackDraft.map((item, i) => (
                                    <div
                                        key={`${item.key}:${item.model}:${item.base_url}`}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "10px 12px",
                                            borderRadius: 8,
                                            border: `1px solid ${p.divider}`,
                                            background: p.bg,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 6,
                                                background: p.accentSoft,
                                                color: p.accent,
                                                font: "var(--cpd-font-body-xs-semibold)",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {i + 1}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    font: "var(--cpd-font-body-md-semibold)",
                                                    color: p.text,
                                                }}
                                            >
                                                {item.label || item.model}
                                            </div>
                                            <div
                                                style={{
                                                    font: "var(--cpd-font-body-xs-regular)",
                                                    color: p.textDim,
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                {[item.model, item.base_url].filter(Boolean).join(" · ")}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <Button
                                                disabled={busy === "fallback" || i === 0}
                                                aria-label={_t("qing|text_f853a70b")}
                                                onClick={() => moveFallbackDraft(i, -1)}
                                            >
                                                ↑
                                            </Button>
                                            <Button
                                                disabled={busy === "fallback" || i === fallbackDraft.length - 1}
                                                aria-label={_t("qing|text_e75e8b4e")}
                                                onClick={() => moveFallbackDraft(i, 1)}
                                            >
                                                ↓
                                            </Button>
                                            <Button
                                                disabled={busy === "fallback"}
                                                onClick={() =>
                                                    setFallbackDraft((prev) => prev.filter((_, idx) => idx !== i))
                                                }
                                            >
                                                {_t("qing|text_2f9daa82")}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {candidates.length > 0 && (
                            <>
                                <div style={{ font: "var(--cpd-font-body-sm-semibold)", color: p.text }}>
                                    {_t("qing|fallback_pick_candidates")}
                                </div>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                                        gap: 8,
                                    }}
                                >
                                    {candidates.map((c) => {
                                        const cid = c.key || c.model;
                                        const checked = fallbackDraft.some(
                                            (item) =>
                                                item.key === cid ||
                                                (item.model === c.model && item.base_url === c.base_url),
                                        );
                                        return (
                                            <label
                                                key={cid}
                                                aria-label={c.label || c.model || cid}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 8,
                                                    padding: "8px 10px",
                                                    borderRadius: 8,
                                                    border: `1px solid ${p.divider}`,
                                                    background: p.bg,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={busy === "fallback"}
                                                    onChange={() => toggleFallbackCandidate(c)}
                                                />
                                                <div style={{ minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            font: "var(--cpd-font-body-sm-semibold)",
                                                            color: p.text,
                                                        }}
                                                    >
                                                        {c.label || c.model || cid}
                                                    </div>
                                                    <div
                                                        style={{
                                                            font: "var(--cpd-font-body-xs-regular)",
                                                            color: p.textDim,
                                                            wordBreak: "break-all",
                                                        }}
                                                    >
                                                        {[c.model, c.base_url].filter(Boolean).join(" · ")}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                            <Button
                                variant="primary"
                                disabled={busy === "fallback"}
                                onClick={() => void saveFallbackDraft()}
                            >
                                {busy === "fallback" ? _t("qing|text_ff509c9b") : _t("qing|text_a3030bf8")}
                            </Button>
                            <Button onClick={() => setEditingFallback(false)}>{_t("qing|text_2cd0f3be")}</Button>
                        </div>
                    </Card>
                ) : Array.isArray(data?.fallback) && data.fallback.length > 0 ? (
                    <div
                        style={{
                            borderRadius: 12,
                            background: p.bgAlt,
                            border: `1px solid ${p.divider}`,
                            overflow: "hidden",
                        }}
                    >
                        {data.fallback.map((f: any, i: number) => (
                            <div
                                key={typeof f === "string" ? f : f.key || f.model || i}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    font: "var(--cpd-font-body-sm-regular)",
                                    color: p.text,
                                    padding: "10px 14px",
                                    borderTop: i === 0 ? "none" : `1px solid ${p.divider}`,
                                }}
                            >
                                <span style={{ font: "var(--cpd-font-body-xs-semibold)", color: p.textDim }}>
                                    {i + 1}.
                                </span>
                                <span>
                                    {typeof f === "string" ? f : f.label || f.model || f.key || JSON.stringify(f)}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ font: "var(--cpd-font-body-sm-regular)", color: p.textDim }}>
                        {_t("qing|fallback_empty_chain")}
                    </div>
                )}
            </Scroll>
        </>
    );
};
