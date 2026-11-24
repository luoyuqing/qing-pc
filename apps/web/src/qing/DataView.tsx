/*
Qing PC · 通用数据渲染
device-hub 各接口结构不一，这里做「结构化但不硬编码字段」的兜底渲染：
已知字段给中文名，未知字段原样展示，数组渲染成卡片，嵌套对象可展开。
好处是接口加字段不会白屏，也不会因为猜错字段名而整页空白。
*/

import React, { useState } from "react";
import { palette } from "./theme";

const LABELS: Record<string, string> = {
    ok: "状态",
    error: "错误",
    host: "主机",
    os: "系统",
    arch: "架构",
    cpu: "CPU",
    cores: "核心数",
    freq_mhz: "频率(MHz)",
    load: "负载",
    avg: "平均",
    pct: "占用",
    mem: "内存",
    mem_mb: "已用(MB)",
    mem_limit_mb: "上限(MB)",
    pct_of_ram: "占内存",
    disk: "磁盘",
    mount: "挂载点",
    net: "网络",
    iface: "网卡",
    name: "名称",
    key: "标识",
    kind: "类型",
    model: "模型",
    base_url: "端点",
    api_mode: "协议",
    mode: "模式",
    resolved: "实际解析",
    candidates: "候选池",
    fallback: "备用链",
    auxiliary: "辅助模型",
    credentials: "凭据",
    has_key: "已配密钥",
    label: "标签",
    status: "状态",
    calls: "调用数",
    input_tokens: "输入 Tokens",
    output_tokens: "输出 Tokens",
    cost_usd: "预估花费($)",
    totals: "合计",
    by_model: "按模型",
    by_persona: "按人设",
    persona: "人设",
    count: "数量",
    active: "启用",
    note: "备注",
    version: "版本",
    uptime: "运行时长",
    containers: "容器",
    services: "服务",
    image: "镜像",
    latency_ms: "延迟(ms)",
};

function pretty(key: string): string {
    return LABELS[key] || key.replace(/[_-]/g, " ");
}

function isPrimitive(v: any): boolean {
    return v === null || ["string", "number", "boolean"].includes(typeof v);
}

function fmt(v: any): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "是" : "否";
    if (typeof v === "number") return Number.isInteger(v) ? `${v}` : v.toFixed(2);
    return `${v}`;
}

const Row: React.FC<{ k: string; v: any; depth: number }> = ({ k, v, depth }) => {
    const p = palette();
    const [open, setOpen] = useState(false);

    if (isPrimitive(v)) {
        return (
            <div style={{ display: "flex", gap: 12, padding: "5px 0", fontSize: 13 }}>
                <div style={{ width: 132, flexShrink: 0, color: p.textDim }}>{pretty(k)}</div>
                <div style={{ color: p.text, wordBreak: "break-all" }}>{fmt(v)}</div>
            </div>
        );
    }

    const summary = Array.isArray(v) ? `[${v.length} 项]` : `{${Object.keys(v).length} 字段}`;

    return (
        <div style={{ padding: "4px 0" }}>
            <div
                onClick={() => setOpen((o) => !o)}
                style={{ display: "flex", gap: 12, fontSize: 13, cursor: "pointer", alignItems: "center" }}
            >
                <div style={{ width: 132, flexShrink: 0, color: p.textDim }}>{pretty(k)}</div>
                <div style={{ color: p.accent }}>{summary}</div>
                <div style={{ color: p.textDim, fontSize: 11 }}>{open ? "收起" : "展开"}</div>
            </div>
            {open && (
                <div style={{ marginLeft: 16, paddingLeft: 12, borderLeft: `1px solid ${p.border}`, marginTop: 4 }}>
                    <DataView data={v} depth={depth + 1} />
                </div>
            )}
        </div>
    );
};

export const DataView: React.FC<{ data: any; depth?: number }> = ({ data, depth = 0 }) => {
    const p = palette();

    if (data === null || data === undefined) {
        return <div style={{ fontSize: 12, color: p.textDim }}>无数据</div>;
    }
    if (isPrimitive(data)) {
        return <div style={{ fontSize: 13, color: p.text, wordBreak: "break-all" }}>{fmt(data)}</div>;
    }

    if (Array.isArray(data)) {
        const allObjects = data.every((x) => x && typeof x === "object" && !Array.isArray(x));
        if (data.length === 0) return <div style={{ fontSize: 12, color: p.textDim }}>空列表</div>;

        if (!allObjects || depth > 2) {
            return (
                <div>
                    {data.map((item, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "8px 10px",
                                marginBottom: 6,
                                borderRadius: 8,
                                background: p.bgAlt,
                                border: `1px solid ${p.border}`,
                            }}
                        >
                            <DataView data={item} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div>
                {data.map((item, i) => {
                    const keys = Object.keys(item);
                    const titleKey = ["name", "label", "model", "key", "id", "mount", "iface"].find((k) => keys.includes(k));
                    return (
                        <div
                            key={i}
                            style={{
                                padding: 10,
                                marginBottom: 8,
                                borderRadius: 10,
                                background: p.bgAlt,
                                border: `1px solid ${p.border}`,
                            }}
                        >
                            {titleKey && (
                                <div style={{ fontSize: 13.5, fontWeight: 600, color: p.text, marginBottom: 4 }}>
                                    {fmt(item[titleKey])}
                                </div>
                            )}
                            <DataView
                                data={Object.fromEntries(keys.filter((k) => k !== titleKey).map((k) => [k, item[k]]))}
                                depth={depth + 1}
                            />
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div>
            {Object.entries(data).map(([k, v]) => (
                <Row key={k} k={k} v={v} depth={depth} />
            ))}
        </div>
    );
};
