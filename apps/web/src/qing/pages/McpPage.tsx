/*
Qing PC · 连接应用（MCP）
对齐手机端 connectors/mcp 页面：列出 MCP 服务器及其工具，可新增、删除。
凭据留在 X2，PC 只下发地址与可选 token。
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf } from "../hub";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const McpPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setItems(itemsOf(await hub.mcpServers()));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const add = async () => {
        if (!name.trim() || !url.trim()) {
            window.alert("名称和地址都要填。");
            return;
        }
        setBusy("__add__");
        try {
            await hub.addMcpServer(name.trim(), url.trim(), token.trim() || undefined);
            setName("");
            setUrl("");
            setToken("");
            setAdding(false);
            await load();
        } catch (e) {
            window.alert(`添加失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const remove = async (item: any) => {
        if (!window.confirm(`删除 MCP 服务「${item.name}」？`)) return;
        setBusy(item.id);
        try {
            await hub.deleteMcpServer(Number(item.id));
            await load();
        } catch (e) {
            window.alert(`删除失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const input = (label: string, value: string, onChange: (v: string) => void, ph?: string, pw?: boolean) => (
        <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>{label}</div>
            <input
                type={pw ? "password" : "text"}
                value={value}
                placeholder={ph}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    fontSize: 13,
                    borderRadius: 8,
                    border: `1px solid ${p.border}`,
                    background: p.bgAlt,
                    color: p.text,
                    outline: "none",
                }}
            />
        </div>
    );

    return (
        <>
            <PageHeader
                title="连接应用"
                subtitle="MCP 服务与其工具（凭据留在 X2）"
                onBack={onBack}
                right={
                    <>
                        <Button onClick={() => setAdding((v) => !v)}>{adding ? "取消" : "添加"}</Button>
                        <Button onClick={() => void load()}>刷新</Button>
                    </>
                }
            />

            {adding && (
                <div style={{ padding: "0 24px 14px", flexShrink: 0, maxWidth: 560 }}>
                    {input("名称", name, setName, "DeepWiki")}
                    {input("地址", url, setUrl, "https://mcp.deepwiki.com/mcp")}
                    {input("令牌（可选）", token, setToken, "留空表示无需鉴权", true)}
                    <Button variant="primary" disabled={busy === "__add__"} onClick={() => void add()}>
                        {busy === "__add__" ? "添加中…" : "确认添加"}
                    </Button>
                </div>
            )}

            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => void load()} />
                </div>
            ) : items.length === 0 ? (
                <Empty text="还没有 MCP 服务。点右上角「添加」。" />
            ) : (
                <Scroll>
                    {items.map((item, i) => (
                        <Card key={item.id ?? i} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: p.text }}>
                                        {item.name || `#${item.id}`}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11.5,
                                            color: p.textDim,
                                            marginTop: 3,
                                            wordBreak: "break-all",
                                        }}
                                    >
                                        {item.url}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 4 }}>
                                        {Array.isArray(item.tools)
                                            ? `${item.tools.length} 个工具：${item.tools
                                                  .slice(0, 4)
                                                  .map((t: any) => t.name)
                                                  .join("、")}${item.tools.length > 4 ? "…" : ""}`
                                            : "工具未加载"}
                                    </div>
                                    {item.last_error && (
                                        <div style={{ fontSize: 11.5, color: p.danger, marginTop: 4 }}>
                                            {`${item.last_error}`.slice(0, 120)}
                                        </div>
                                    )}
                                </div>
                                <Button disabled={busy === item.id} onClick={() => void remove(item)}>
                                    {busy === item.id ? "…" : "删除"}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </Scroll>
            )}
        </>
    );
};
