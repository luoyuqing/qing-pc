/*
Qing PC · 凭据
模型端点的 API Key 增删改（写 X2 的系统级 .env）。
GET /agent/credentials、POST /agent/credentials、DELETE /agent/credentials/{name}
只显示状态，不回显密钥内容。
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf } from "../hub";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const CredentialsPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setItems(itemsOf(await hub.agentCredentials()));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async () => {
        if (!name.trim() || !value.trim()) {
            window.alert("名称和值都要填。");
            return;
        }
        setBusy("__add__");
        try {
            await hub.setCredential(name.trim(), value.trim());
            setName("");
            setValue("");
            setAdding(false);
            await load();
        } catch (e) {
            window.alert(`保存失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const remove = async (item: any) => {
        if (!window.confirm(`删除凭据 ${item.name}？依赖它的模型将不可用。`)) return;
        setBusy(item.name);
        try {
            await hub.deleteCredential(item.name);
            await load();
        } catch (e) {
            window.alert(`删除失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const field = (label: string, val: string, onChange: (v: string) => void, ph: string, pw?: boolean) => (
        <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>{label}</div>
            <input
                type={pw ? "password" : "text"}
                value={val}
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
                title="凭据"
                subtitle="模型端点的 API Key（只显示状态，不回显内容）"
                onBack={onBack}
                right={
                    <>
                        <Button onClick={() => setAdding((v) => !v)}>{adding ? "取消" : "新增"}</Button>
                        <Button onClick={() => void load()}>刷新</Button>
                    </>
                }
            />

            {adding && (
                <div style={{ padding: "0 24px 14px", flexShrink: 0, maxWidth: 560 }}>
                    {field("变量名", name, setName, "DEEPSEEK_API_KEY")}
                    {field("值", value, setValue, "sk-…", true)}
                    <Button variant="primary" disabled={busy === "__add__"} onClick={() => void save()}>
                        {busy === "__add__" ? "写入中…" : "写入 .env"}
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
                <Empty text="还没有凭据。" />
            ) : (
                <Scroll>
                    {items.map((c, i) => (
                        <Card key={c.name || i} style={{ marginBottom: 6, padding: "9px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span
                                    style={{
                                        fontSize: 13,
                                        color: p.text,
                                        fontFamily: "ui-monospace, monospace",
                                        flex: 1,
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {c.name}
                                </span>
                                <span style={{ fontSize: 11, color: c.resolved ? p.accent : p.danger, flexShrink: 0 }}>
                                    {c.resolved ? "已解析" : "缺失"}
                                </span>
                                <span style={{ fontSize: 11, color: p.textDim, flexShrink: 0 }}>
                                    {c.in_system ? "系统级" : c.in_user ? "用户级" : ""}
                                </span>
                                <Button disabled={busy === c.name} onClick={() => void remove(c)}>
                                    {busy === c.name ? "…" : "删除"}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </Scroll>
            )}
        </>
    );
};
