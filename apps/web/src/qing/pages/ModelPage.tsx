/* Qing PC · 模型与推理（当前模型 / 候选池 / 一键切换），对应 settings_agent/model_page.dart */

import React, { useCallback, useEffect, useState } from "react";
import { hub, loadConfig, saveConfig } from "../hub";
import { PersonaPicker } from "../PersonaPicker";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const ModelPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
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
        setLoading(true);
        setError(null);
        try {
            setData(await hub.agentModel(persona));
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
        // 写回全局，其他页面沿用上次选择
        saveConfig({ ...loadConfig(), persona: id });
    };

    const testOne = async (key: string) => {
        setBusy(`test:${key}`);
        setTestMsg(null);
        try {
            const r = await hub.testCandidate(key, persona);
            setTestMsg(`测试通过${r?.ms ? `，${r.ms}ms` : ""}：${r?.model || key}`);
        } catch (e) {
            setTestMsg(`测试失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const removeOne = async (c: any) => {
        if (!window.confirm(`删除候选「${c.label || c.key}」？只从当前人设移除。`)) return;
        setBusy(`del:${c.key}`);
        try {
            await hub.deleteCandidate(c.key, persona);
            await load();
        } catch (e) {
            window.alert(`删除失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const editLabel = async () => {
        const cur = data?.model || {};
        const next = window.prompt("主模型备注（只改名称，不影响端点与模型）", cur.label || "");
        if (next === null) return;
        setBusy("label");
        try {
            await hub.setModelLabel(persona, cur.base_url, cur.model, next.trim());
            await load();
        } catch (e) {
            window.alert(`修改失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const addOne = async () => {
        if (!nk.trim() || !nm.trim() || !nb.trim()) {
            window.alert("标识、模型、端点三项必填。");
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
            window.alert(`新增失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const swap = async (key: string) => {
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

    if (loading)
        return (
            <>
                <PageHeader title="模型与推理" onBack={onBack} />
                <Loading />
            </>
        );
    if (error && !data)
        return (
            <>
                <PageHeader title="模型与推理" onBack={onBack} />
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
                title="模型与推理"
                subtitle={data?.label ? `人设 ${data.label}（${data.persona}）` : undefined}
                right={
                    <>
                        <PersonaPicker value={persona} onChange={changePersona} compact />
                        <Button onClick={() => setTick((t) => t + 1)}>刷新</Button>
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
                    <div style={{ fontSize: 11.5, color: p.textDim }}>当前模型</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, color: p.text, marginTop: 2 }}>
                        {cur.label || cur.model || "未配置"}
                    </div>
                    <div style={{ fontSize: 12, color: p.textDim, marginTop: 4, wordBreak: "break-all" }}>
                        {[cur.model, cur.base_url].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <Button disabled={busy === "label"} onClick={() => void editLabel()}>
                            {busy === "label" ? "…" : "改备注"}
                        </Button>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11.5, color: p.textDim }}>
                        {cur.api_mode ? <span>{cur.api_mode}</span> : null}
                        {cur.key_env ? <span>{cur.key_env}</span> : null}
                        <span style={{ color: cur.has_key ? p.accent : p.danger }}>
                            {cur.has_key ? "密钥已配置" : "缺少密钥"}
                        </span>
                    </div>
                </Card>

                {candidates.length > 0 && (
                    <>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>
                                候选池（{candidates.length}）
                            </span>
                            <span style={{ marginLeft: "auto" }}>
                                <Button onClick={() => setAdding((v) => !v)}>{adding ? "取消" : "新增候选"}</Button>
                            </span>
                        </div>
                        {testMsg && (
                            <div style={{ fontSize: 12, color: testMsg.startsWith("测试通过") ? p.accent : p.danger, marginBottom: 8 }}>
                                {testMsg}
                            </div>
                        )}
                        {adding && (
                            <Card style={{ marginBottom: 10 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    {[
                                        ["标识 key", nk, setNk, "dso"],
                                        ["备注", nl, setNl, "DeepSeek官方"],
                                        ["模型", nm, setNm, "deepseek-flash"],
                                        ["端点", nb, setNb, "https://api.deepseek.com/v1"],
                                    ].map(([label, val, set, ph]: any) => (
                                        <div key={label}>
                                            <div style={{ fontSize: 11, color: p.textDim, marginBottom: 3 }}>{label}</div>
                                            <input
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
                                        密钥变量名（可选）
                                    </div>
                                    <input
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
                                        {busy === "add" ? "提交中…" : "加入候选池"}
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
                                            <span style={{ fontSize: 11.5, color: p.accent, flexShrink: 0 }}>使用中</span>
                                        ) : busy === c.key ? (
                                            <span style={{ fontSize: 11.5, color: p.textDim, flexShrink: 0 }}>切换中…</span>
                                        ) : (
                                            <span style={{ fontSize: 11.5, color: p.textDim, flexShrink: 0 }}>切换</span>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: p.textDim, alignItems: "center" }}>
                                        {c.key_env ? <span>{c.key_env}</span> : null}
                                        {c.has_key === false && <span style={{ color: p.danger }}>无密钥</span>}
                                        {c.shared_endpoint && <span>共享端点</span>}
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
                                                {busy === `test:${c.key}` ? "测试中" : "测试"}
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
                                                删除
                                            </button>
                                        </span>
                                    </div>
                                </Card>
                            );
                        })}
                    </>
                )}

                {Array.isArray(data?.fallback) && data.fallback.length > 0 && (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: "16px 0 8px" }}>备用链</div>
                        {data.fallback.map((f: any, i: number) => (
                            <div
                                key={i}
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
