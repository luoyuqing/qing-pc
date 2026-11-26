/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 凭据
模型端点的 API Key 增删改（写 X2 的系统级 .env）。
GET /agent/credentials、POST /agent/credentials、DELETE /agent/credentials?name=...&force=0
只显示状态，不回显密钥内容。
*/

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../dialogs";
import { hub, itemsOf } from "../hub";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const CredentialsPage: React.FC<{ onBack?: () => void }> = ({ onBack }): React.ReactNode => {
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [editName, setEditName] = useState("");
    const [editValue, setEditValue] = useState("");
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setItems(itemsOf(await hub.agentCredentials(true)));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async (): Promise<void> => {
        if (!name.trim() || !value.trim()) {
            setError(_t("qing|text_2a076c67"));
            return;
        }
        setBusy("__add__");
        setError(null);
        setNotice(null);
        try {
            await hub.setCredential(name.trim(), value.trim());
            setName("");
            setValue("");
            setAdding(false);
            setNotice(_t("qing|text_1bd91a7d"));
            await load();
        } catch (e) {
            setError(_t("qing|text_2e9c15dc", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const startEdit = (item: any): void => {
        setAdding(false);
        setEditingItem(item);
        setEditName(item.name || "");
        setEditValue("");
        setError(null);
        setNotice(null);
    };

    const saveEdit = async (): Promise<void> => {
        if (!editingItem) return;
        const nextName = editName.trim();
        const nextValue = editValue.trim();
        if (!nextName || !nextValue) {
            setError(_t("qing|text_2a076c67"));
            return;
        }
        setBusy(`edit:${editingItem.name}`);
        setError(null);
        setNotice(null);
        try {
            await hub.setCredential(nextName, nextValue);
            if (nextName !== editingItem.name) {
                const hasRefs = Array.isArray(editingItem.references) && editingItem.references.length > 0;
                await hub.deleteCredential(editingItem.name, hasRefs);
            }
            setEditingItem(null);
            setEditName("");
            setEditValue("");
            setNotice(_t("qing|text_1bd91a7d"));
            await load();
        } catch (e) {
            setError(_t("qing|text_2e9c15dc", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const remove = async (item: any): Promise<void> => {
        if (!(await confirmAction(_t("qing|text_d6c458eb", { v0: item.name })))) return;
        setBusy(item.name);
        try {
            await hub.deleteCredential(item.name, Array.isArray(item.references) && item.references.length > 0);
            await load();
        } catch (e) {
            setError(_t("qing|text_7fa791d8", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const field = (
        label: string,
        val: string,
        onChange: (v: string) => void,
        ph: string,
        pw?: boolean,
    ): React.ReactNode => (
        <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>{label}</div>
            <input
                type={pw ? "password" : "text"}
                aria-label={label}
                autoComplete="off"
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
                title={_t("qing|text_2dfe17d7")}
                subtitle={_t("qing|text_a201d8cb")}
                onBack={onBack}
                right={
                    <>
                        <Button
                            onClick={() => {
                                setEditingItem(null);
                                setAdding((v) => !v);
                            }}
                        >
                            {adding ? _t("qing|text_2cd0f3be") : _t("qing|text_0006d696")}
                        </Button>
                        <Button onClick={() => void load()}>{_t("qing|text_aee88743")}</Button>
                    </>
                }
            />

            {notice && (
                <div style={{ padding: "0 24px 10px" }}>
                    <div
                        role="status"
                        style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: p.accentSoft,
                            color: p.accent,
                            fontSize: 12.5,
                        }}
                    >
                        {notice}
                    </div>
                </div>
            )}

            {adding && (
                <div style={{ padding: "0 24px 14px", flexShrink: 0, maxWidth: 560 }}>
                    <Card style={{ borderColor: p.divider }}>
                        {field(_t("qing|text_9d9d7637"), name, setName, "DEEPSEEK_API_KEY")}
                        {field(_t("qing|text_cda1d55c"), value, setValue, "sk-…", true)}
                        <Button variant="primary" disabled={busy === "__add__"} onClick={() => void save()}>
                            {busy === "__add__" ? _t("qing|text_a5969ce3") : _t("qing|text_3fe20a6a")}
                        </Button>
                    </Card>
                </div>
            )}

            {editingItem && (
                <div style={{ padding: "0 24px 14px", flexShrink: 0, maxWidth: 560 }}>
                    <Card style={{ borderColor: p.accent }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: p.text, marginBottom: 10 }}>
                            {_t("qing|cred_edit_title", { v0: editingItem.name })}
                        </div>
                        {field(_t("qing|text_9d9d7637"), editName, setEditName, "DEEPSEEK_API_KEY")}
                        {field(_t("qing|cred_new_value"), editValue, setEditValue, "sk-…", true)}
                        <div style={{ display: "flex", gap: 8 }}>
                            <Button
                                variant="primary"
                                disabled={busy === `edit:${editingItem.name}`}
                                onClick={() => void saveEdit()}
                            >
                                {busy === `edit:${editingItem.name}`
                                    ? _t("qing|text_a5969ce3")
                                    : _t("qing|text_a3030bf8")}
                            </Button>
                            <Button onClick={() => setEditingItem(null)}>{_t("qing|text_2cd0f3be")}</Button>
                        </div>
                    </Card>
                </div>
            )}

            <div style={{ padding: "0 24px 12px" }}>
                <input
                    type="search"
                    aria-label={_t("qing|text_7fc00d2a")}
                    placeholder={_t("qing|text_de63bc02")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    style={{
                        width: "100%",
                        maxWidth: 400,
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        fontSize: 13,
                        borderRadius: 8,
                        border: `1px solid ${p.divider}`,
                        background: p.bgAlt,
                        color: p.text,
                        outline: "none",
                    }}
                />
            </div>
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => void load()} />
                </div>
            ) : items.length === 0 ? (
                <Empty text={_t("qing|text_cfb0e315")} />
            ) : (
                <Scroll>
                    {items
                        .filter((item) => `${item.name}`.toLowerCase().includes(query.toLowerCase()))
                        .map((c, i) => (
                            <Card
                                key={c.name || i}
                                style={{ marginBottom: 8, padding: "11px 14px", borderColor: p.divider }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 500,
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
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: c.resolved ? p.accent : p.danger,
                                            padding: "2px 8px",
                                            borderRadius: 999,
                                            background: p.bg,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {c.resolved ? _t("qing|text_769054c1") : _t("qing|text_65364e6f")}
                                    </span>
                                    <span style={{ fontSize: 11, color: p.textDim, flexShrink: 0 }}>
                                        {c.in_system
                                            ? _t("qing|text_72bf5d29")
                                            : c.in_user
                                              ? _t("qing|text_e1da6a10")
                                              : ""}
                                        {Array.isArray(c.references) && c.references.length > 0
                                            ? _t("qing|text_6d95c8bd", { v0: c.references.length })
                                            : ""}
                                    </span>
                                    <Button disabled={Boolean(busy)} onClick={() => startEdit(c)}>
                                        {_t("qing|text_05183656")}
                                    </Button>
                                    <Button disabled={busy === c.name} onClick={() => void remove(c)}>
                                        {busy === c.name ? "…" : _t("qing|text_2f9daa82")}
                                    </Button>
                                </div>
                            </Card>
                        ))}
                </Scroll>
            )}
        </>
    );
};
