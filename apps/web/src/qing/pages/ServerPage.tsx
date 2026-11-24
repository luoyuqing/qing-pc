/*
Qing PC · 服务器状态
对齐手机端 server_status_page.dart：
主机概览（负载/温度/运行时长）· CPU（总体+每核）· 内存 · 磁盘 · 网络
服务与容器（systemd unit / docker container 的 CPU、内存、线程、运行时长）
24 小时趋势（/server/history）+ 自动刷新（30s / 60s / 关）
*/

import React, { useCallback, useEffect, useRef, useState } from "react";
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
    return `${(Number(mb || 0) / 1024).toFixed(1)} GB`;
}

function uptime(s: number): string {
    if (!s) return "—";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d} 天 ${h} 小时`;
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分`;
}

function rate(bps: number): string {
    const v = Number(bps || 0);
    if (v >= 1048576) return `${(v / 1048576).toFixed(1)} MB/s`;
    if (v >= 1024) return `${(v / 1024).toFixed(0)} KB/s`;
    return `${v} B/s`;
}

/** 24 小时趋势：两条折线（CPU% / 内存%），纯 SVG，不引图表库 */
const Trend: React.FC<{ points: any[] }> = ({ points }) => {
    const p = palette();
    if (!points || points.length < 2) {
        return <div style={{ fontSize: 12, color: p.textDim }}>趋势数据不足。</div>;
    }
    const W = 100;
    const H = 32;
    const n = points.length;
    const x = (i: number) => (i / (n - 1)) * W;
    const line = (get: (pt: any) => number) =>
        points
            .map((pt, i) => {
                const v = Math.max(0, Math.min(100, get(pt)));
                return `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${(H - (v / 100) * H).toFixed(2)}`;
            })
            .join(" ");

    return (
        <>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                style={{ width: "100%", height: 120, display: "block" }}
            >
                <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={p.border} strokeWidth="0.2" strokeDasharray="1 1" />
                <path
                    d={line((pt) => Number(pt.cpu || 0))}
                    fill="none"
                    stroke={p.accent}
                    strokeWidth="0.6"
                    vectorEffect="non-scaling-stroke"
                />
                <path
                    d={line((pt) => Number(pt.mem_pct || 0))}
                    fill="none"
                    stroke="#e0a030"
                    strokeWidth="0.6"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
            <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: p.textDim, marginTop: 6 }}>
                <span style={{ color: p.accent }}>— CPU</span>
                <span style={{ color: "#e0a030" }}>— 内存</span>
                <span>共 {n} 个采样点</span>
            </div>
        </>
    );
};

export const ServerPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [data, setData] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const [autoSec, setAutoSec] = useState(30);
    const timer = useRef<number | null>(null);
    const p = palette();

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const s = await hub.serverStatus();
            setData(s);
            const h = await hub.serverHistory("24h").catch(() => null);
            const pts: any[] = Array.isArray(h?.points) ? h.points : [];
            // 点太多会拖慢渲染，等距抽稀到 240 个以内
            const step = pts.length > 240 ? Math.ceil(pts.length / 240) : 1;
            setHistory(step > 1 ? pts.filter((_, i) => i % step === 0) : pts);
        } catch (e) {
            setError((e as Error).message);
        }
        if (!silent) setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load, tick]);

    useEffect(() => {
        if (timer.current) window.clearInterval(timer.current);
        if (autoSec > 0) {
            timer.current = window.setInterval(() => void load(true), autoSec * 1000);
        }
        return () => {
            if (timer.current) window.clearInterval(timer.current);
        };
    }, [autoSec, load]);

    const header = (
        <PageHeader
            title="服务器状态"
            subtitle={data?.host?.name ? `${data.host.name} · ${data.host.os || ""}` : undefined}
            onBack={onBack}
            right={
                <>
                    <select
                        value={autoSec}
                        onChange={(e) => setAutoSec(Number(e.target.value))}
                        style={{
                            fontSize: 12,
                            padding: "5px 8px",
                            borderRadius: 8,
                            border: `1px solid ${p.border}`,
                            background: p.bgAlt,
                            color: p.text,
                            cursor: "pointer",
                        }}
                    >
                        <option value={30}>每 30 秒</option>
                        <option value={60}>每分钟</option>
                        <option value={0}>不自动刷新</option>
                    </select>
                    <Button onClick={() => setTick((t) => t + 1)}>刷新</Button>
                </>
            }
        />
    );

    if (loading && !data)
        return (
            <>
                {header}
                <Loading />
            </>
        );
    if (error && !data)
        return (
            <>
                {header}
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            </>
        );

    const host = data?.host || {};
    const cpu = data?.cpu || {};
    const mem = data?.mem || {};
    const net = data?.net || {};
    const disks: any[] = Array.isArray(data?.disk) ? data.disk : [];
    const services: any[] = Array.isArray(data?.services) ? data.services : [];
    const temp = Number(cpu.temp_c || 0);

    return (
        <>
            {header}
            <Scroll>
                {error && (
                    <div style={{ marginBottom: 12 }}>
                        <ErrorBox message={error} />
                    </div>
                )}

                <Card style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: p.text }}>
                        {host.name || "X2"} · 家庭服务器
                    </div>
                    <div style={{ display: "flex", gap: 26, marginTop: 10, flexWrap: "wrap" }}>
                        {[
                            ["负载", Array.isArray(cpu.load) ? Number(cpu.load[0] || 0).toFixed(2) : "—"],
                            ["温度", temp > 0 ? `${Math.round(temp)}°C` : "—"],
                            ["运行", uptime(host.uptime_s)],
                            ["核心", cpu.cores ? `${cpu.cores} 核` : "—"],
                        ].map(([k, v]) => (
                            <div key={k as string}>
                                <div style={{ fontSize: 11, color: p.textDim }}>{k}</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: p.text }}>{v}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>CPU</div>
                    <Bar pct={cpu.usage_pct} label={`总体 ${cpu.cores ? `${cpu.cores} 核` : ""}`} />
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: p.textDim }}>
                        {cpu.freq_mhz ? <span>频率 {cpu.freq_mhz} MHz</span> : null}
                        {temp > 0 ? <span>温度 {temp}°C</span> : null}
                        {Array.isArray(cpu.load) ? (
                            <span>负载 {cpu.load.map((x: number) => Number(x).toFixed(2)).join(" / ")}</span>
                        ) : null}
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
                    <Bar pct={mem.pct} label="已用" right={`${gb(mem.used_mb)} / ${gb(mem.total_mb)}`} />
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: p.textDim }}>
                        {mem.available_mb !== undefined ? <span>可用 {gb(mem.available_mb)}</span> : null}
                        {mem.cache_mb !== undefined ? <span>缓存 {gb(mem.cache_mb)}</span> : null}
                        {mem.swap_total_mb ? (
                            <span>
                                Swap {gb(mem.swap_used_mb)} / {gb(mem.swap_total_mb)}
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
                                label={`${d.mount === "/" ? "系统盘" : d.mount || "?"}（${d.fs || ""}）`}
                                right={`${d.used_gb ?? "?"} / ${d.size_gb ?? "?"} GB`}
                            />
                        ))}
                    </Card>
                )}

                {net.iface && (
                    <Card style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>
                            网络 · {net.iface}
                        </div>
                        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
                            {[
                                ["下行", rate(net.rx_bps)],
                                ["上行", rate(net.tx_bps)],
                                ["累计收", gb(net.rx_total_mb)],
                                ["累计发", gb(net.tx_total_mb)],
                            ].map(([k, v]) => (
                                <div key={k as string}>
                                    <div style={{ fontSize: 11, color: p.textDim }}>{k}</div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: p.text }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Card style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>
                        服务与容器{services.length ? `（${services.length}）` : ""}
                    </div>
                    {services.length === 0 ? (
                        <div style={{ fontSize: 12, color: p.textDim }}>没有可显示的服务。</div>
                    ) : (
                        services.map((s, i) => (
                            <div
                                key={s.key || i}
                                style={{ padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${p.border}` }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            padding: "1px 6px",
                                            borderRadius: 4,
                                            background: p.bgAlt,
                                            color: p.textDim,
                                            border: `1px solid ${p.border}`,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {s.kind === "container" ? "容器" : "服务"}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: s.active ? p.text : p.textDim,
                                            flex: 1,
                                            minWidth: 0,
                                        }}
                                    >
                                        {s.name}
                                    </span>
                                    <span style={{ fontSize: 11.5, color: s.active ? p.accent : p.danger }}>
                                        {s.active ? "运行中" : "已停止"}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 14,
                                        marginTop: 4,
                                        fontSize: 11.5,
                                        color: p.textDim,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <span>CPU {Number(s.cpu_pct || 0).toFixed(1)}%</span>
                                    <span>{gb(s.mem_mb)}</span>
                                    {s.mem_limit_mb ? <span>限 {gb(s.mem_limit_mb)}</span> : null}
                                    {s.pids ? <span>{s.pids} 进程</span> : null}
                                    {s.threads ? <span>{s.threads} 线程</span> : null}
                                    {s.uptime_s ? <span>{uptime(s.uptime_s)}</span> : null}
                                </div>
                            </div>
                        ))
                    )}
                </Card>

                <Card style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 8 }}>24 小时趋势</div>
                    <Trend points={history} />
                </Card>

                <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 4 }}>
                    {host.kernel ? `内核 ${host.kernel} · ` : ""}
                    {host.arch || ""}
                    {data?.sampled_at ? ` · 采样 ${`${data.sampled_at}`.replace("T", " ").slice(0, 19)}` : ""}
                </div>
            </Scroll>
        </>
    );
};
