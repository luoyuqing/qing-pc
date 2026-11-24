/* Qing PC · 服务器状态（对应手机端 settings_device_hub/server_status_page.dart） */

import React, { useCallback, useEffect, useState } from "react";
import { hub } from "../hub";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

const Bar: React.FC<{ pct: number; label: string; right?: string; danger?: number }> = ({
    pct,
    label,
    right,
    danger = 85,
}) => {
    const p = palette();
    const val = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
    const color = val >= danger ? p.danger : val >= 60 ? "#e0a030" : p.accent;
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ color: p.text }}>{label}</span>
                <span style={{ color: p.textDim }}>{right ?? `${val.toFixed(1)}%`}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: p.bgAlt, overflow: "hidden" }}>
                <div style={{ width: `${val}%`, height: "100%", background: color, borderRadius: 3 }} />
            </div>
        </div>
    );
};

function gb(mb: number): string {
    return `${(mb / 1024).toFixed(1)} GB`;
}

function uptime(s: number): string {
    if (!s) return "—";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return d > 0 ? `${d} 天 ${h} 小时` : `${h} 小时`;
}

export const ServerPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await hub.serverStatus());
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
                <PageHeader title="服务器状态" onBack={onBack} />
                <Loading />
            </>
        );
    if (error)
        return (
            <>
                <PageHeader title="服务器状态" onBack={onBack} />
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            </>
        );

    const host = data?.host || {};
    const cpu = data?.cpu || {};
    const mem = data?.mem || {};
    const disks: any[] = Array.isArray(data?.disk) ? data.disk : [];

    return (
        <>
            <PageHeader
                onBack={onBack}
                title="服务器状态"
                subtitle={host.name ? `${host.name} · ${host.os || ""}` : undefined}
                right={<Button onClick={() => setTick((t) => t + 1)}>刷新</Button>}
            />
            <Scroll>
                <Card style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>CPU</div>
                    <Bar pct={cpu.usage_pct} label={`总体 ${cpu.cores ? `${cpu.cores} 核` : ""}`} />
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: p.textDim }}>
                        {cpu.freq_mhz ? <span>频率 {cpu.freq_mhz} MHz</span> : null}
                        {cpu.temp_c !== undefined ? <span>温度 {cpu.temp_c}°C</span> : null}
                        {Array.isArray(cpu.load) ? <span>负载 {cpu.load.join(" / ")}</span> : null}
                    </div>
                    {Array.isArray(cpu.per_core) && cpu.per_core.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                            {cpu.per_core.map((v: number, i: number) => (
                                <Bar key={i} pct={v} label={`核心 ${i}`} />
                            ))}
                        </div>
                    )}
                </Card>

                <Card style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>内存</div>
                    <Bar
                        pct={mem.pct}
                        label="已用"
                        right={`${gb(mem.used_mb || 0)} / ${gb(mem.total_mb || 0)}`}
                    />
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: p.textDim }}>
                        {mem.available_mb !== undefined ? <span>可用 {gb(mem.available_mb)}</span> : null}
                        {mem.cache_mb !== undefined ? <span>缓存 {gb(mem.cache_mb)}</span> : null}
                        {mem.swap_total_mb !== undefined ? (
                            <span>
                                Swap {gb(mem.swap_used_mb || 0)} / {gb(mem.swap_total_mb)}
                            </span>
                        ) : null}
                    </div>
                </Card>

                {disks.length > 0 && (
                    <Card style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>磁盘</div>
                        {disks.map((d, i) => (
                            <Bar
                                key={i}
                                pct={d.pct}
                                label={`${d.mount || "?"}（${d.fs || ""}）`}
                                right={`${d.used_gb ?? "?"} / ${d.size_gb ?? "?"} GB`}
                            />
                        ))}
                    </Card>
                )}

                <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 4 }}>
                    {host.kernel ? `内核 ${host.kernel} · ` : ""}
                    {host.arch || ""}
                    {host.uptime_s ? ` · 运行 ${uptime(host.uptime_s)}` : ""}
                    {data?.sampled_at ? ` · 采样 ${`${data.sampled_at}`.replace("T", " ").slice(0, 19)}` : ""}
                </div>
            </Scroll>
        </>
    );
};
