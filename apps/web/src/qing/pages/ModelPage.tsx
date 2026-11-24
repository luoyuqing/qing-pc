/* Qing PC · 模型与推理（当前模型 / 候选池 / 一键切换），对应 settings_agent/model_page.dart */

import React, { useCallback, useEffect, useState } from "react";
import { hub, loadConfig } from "../hub";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const ModelPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await hub.agentModel(loadConfig().persona));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load, tick]);

    const swap = async (key: string) => {
        setBusy(key);
        setError(null);
        try {
            await hub.switchModel(key, loadConfig().persona);
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
                right={<Button onClick={() => setTick((t) => t + 1)}>刷新</Button>}
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>
                            候选池（{candidates.length}）
                        </div>
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
                                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: p.textDim }}>
                                        {c.key_env ? <span>{c.key_env}</span> : null}
                                        {c.has_key === false && <span style={{ color: p.danger }}>无密钥</span>}
                                        {c.shared_endpoint && <span>共享端点</span>}
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
