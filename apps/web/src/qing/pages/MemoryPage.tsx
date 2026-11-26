/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 记忆
对齐手机端 memory_page.dart：四个 Tab（记忆 / 画像 / 技能 / 人设），顶部可切人设。
记忆与画像可直接编辑保存（服务端保存前自动 .bak 备份）；技能可查看、编辑、删除。
接口：GET /memory、POST /memory、GET/POST/DELETE /skills、GET /persona
*/

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirmAction } from "../dialogs";
import { QingPanel } from "../QingPanel";
import { HubError, hub } from "../hub";
import { PersonaPicker, invalidatePersonaCache } from "../PersonaPicker";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";
import { recordOf, textOf } from "../data";

interface MemoryEntryCard {
    id: string;
    title: string;
    summary: string;
    time?: string;
}

function parseMemoryEntries(markdown: string): MemoryEntryCard[] {
    const trimmed = markdown.trim();
    if (!trimmed) return [];
    const lines = trimmed.split(/\r?\n/);
    const sections: { heading: string; body: string[] }[] = [];
    let current: { heading: string; body: string[] } | null = null;

    for (const line of lines) {
        const h2 = /^##+\s+(.+)$/.exec(line);
        if (h2) {
            if (current && (current.body.join("").trim() || !current.heading.startsWith("# "))) {
                sections.push(current);
            }
            current = { heading: h2[1].trim(), body: [] };
            continue;
        }
        if (/^#\s+/.test(line) && !current) {
            continue;
        }
        if (!current) current = { heading: "", body: [] };
        current.body.push(line);
    }
    if (current && (current.heading || current.body.join("").trim())) {
        sections.push(current);
    }

    if (sections.length === 0) {
        return trimmed
            .split(/\n{2,}/)
            .map((chunk, idx) => {
                const clean = chunk.replace(/^[-*#>\s]+/gm, "").trim();
                return {
                    id: `mem-${idx}`,
                    title: clean.slice(0, 32) || _t("qing|text_7a6335b3"),
                    summary: clean,
                };
            })
            .filter((item) => item.summary);
    }

    return sections
        .map((sec, idx): MemoryEntryCard | null => {
            const dateMatch = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{2})?)\s*(.*)$/.exec(sec.heading);
            const time = dateMatch ? dateMatch[1] : undefined;
            const rawTitle = (dateMatch ? dateMatch[2] : sec.heading).trim();
            const summary = sec.body
                .join(" ")
                .replace(/`([^`]+)`/g, "$1")
                .replace(/\*\*([^*]+)\*\*/g, "$1")
                .replace(/^[-*>]\s+/gm, "")
                .replace(/\s+/g, " ")
                .trim();
            if (!rawTitle && !summary) return null;
            return { id: `mem-${idx}`, title: rawTitle || _t("qing|text_7a6335b3"), summary, time };
        })
        .filter((item): item is MemoryEntryCard => item !== null);
}

type Tab = "memory" | "profile" | "skills" | "persona";

function getTABS(): { id: Tab; label: string }[] {
    return [
        { id: "memory", label: _t("qing|text_7a6335b3") },
        { id: "profile", label: _t("qing|text_6fd5a7cc") },
        { id: "skills", label: _t("qing|text_99aea2f9") },
        { id: "persona", label: _t("qing|text_76241024") },
    ];
}

const TextEditor: React.FC<{
    title: string;
    hint: string;
    value: string;
    onChange: (v: string) => void;
    onSave: () => void;
    saving: boolean;
    saved: string | null;
}> = ({ title, hint, value, onChange, onSave, saving, saved }): React.ReactNode => {
    const p = palette();
    return (
        <>
            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8, lineHeight: 1.6 }}>{hint}</div>
            <textarea
                aria-label={_t("qing|text_2203dc90")}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: 360,
                    padding: 12,
                    fontSize: 13,
                    lineHeight: 1.7,
                    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                    borderRadius: 10,
                    border: `1px solid ${p.border}`,
                    background: p.bgAlt,
                    color: p.text,
                    outline: "none",
                    resize: "vertical",
                }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                <Button variant="primary" disabled={saving} onClick={onSave}>
                    {saving ? _t("qing|text_ff509c9b") : _t("qing|text_ff717242", { v0: title })}
                </Button>
                {saved && <span style={{ fontSize: 12, color: p.accent }}>{saved}</span>}
            </div>
        </>
    );
};

export const MemoryPage: React.FC<{ onBack?: () => void; initialPersona?: string }> = ({
    onBack,
    initialPersona,
}): React.ReactNode => {
    const requestId = useRef(0);
    const [vault, setVault] = useState(false);
    const [persona, setPersona] = useState(initialPersona || "default");
    const [tab, setTab] = useState<Tab>("memory");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bundle, setBundle] = useState<any>(null);

    const [memoryText, setMemoryText] = useState("");
    const [profileText, setProfileText] = useState("");
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);

    const [skills, setSkills] = useState<any[]>([]);
    const [skillOpen, setSkillOpen] = useState<string | null>(null);
    const [skillText, setSkillText] = useState("");
    const [personaData, setPersonaData] = useState<any>(null);
    const [personaKey, setPersonaKey] = useState<string | null>(null);
    const [personaText, setPersonaText] = useState("");
    const [memoryQuery, setMemoryQuery] = useState("");
    const [editingRawMemory, setEditingRawMemory] = useState(false);
    const [copiedRaw, setCopiedRaw] = useState(false);
    const [indexSummary, setIndexSummary] = useState<{ text: string; raw: string } | null>(null);
    const [copiedIndexRaw, setCopiedIndexRaw] = useState(false);

    const p = palette();

    const memoryEntries = useMemo(() => {
        const all = parseMemoryEntries(memoryText);
        const q = memoryQuery.trim().toLowerCase();
        if (!q) return all;
        return all.filter(
            (e) =>
                e.title.toLowerCase().includes(q) ||
                e.summary.toLowerCase().includes(q) ||
                (e.time ?? "").toLowerCase().includes(q),
        );
    }, [memoryText, memoryQuery]);

    const checkIndexStatus = async (): Promise<void> => {
        try {
            const raw = await hub.memoryVaultStatus(persona);
            const status = recordOf(raw);
            const parts: string[] = [status.ok === false ? _t("qing|vault_index_warn") : _t("qing|vault_index_ok")];
            if (status.coverage !== undefined) {
                parts.push(_t("qing|vault_coverage", { v0: `${textOf(status.coverage)}%` }));
            }
            if (status.files !== undefined && status.total !== undefined) {
                parts.push(_t("qing|vault_files", { v0: textOf(status.files), v1: textOf(status.total) }));
            }
            if (status.entities !== undefined) {
                parts.push(_t("qing|vault_entities", { v0: textOf(status.entities) }));
            }
            if (status.pending !== undefined) {
                parts.push(_t("qing|vault_pending", { v0: textOf(status.pending) }));
            }
            if (status.failed !== undefined) {
                parts.push(_t("qing|vault_failed", { v0: textOf(status.failed) }));
            }
            setIndexSummary({ text: parts.join(" · "), raw: JSON.stringify(raw, null, 2) });
        } catch (e) {
            setError(_t("qing|text_2e9c15dc", { v0: (e as Error).message }));
        }
    };

    const copyText = (text: string, onDone: (v: boolean) => void): void => {
        if (!text || !navigator.clipboard?.writeText) return;
        void navigator.clipboard.writeText(text).then(() => {
            onDone(true);
            setTimeout(() => onDone(false), 1800);
        });
    };

    const load = useCallback(async () => {
        const id = ++requestId.current;
        setLoading(true);
        setError(null);
        try {
            let m;
            let s;
            let pd;
            try {
                const bundle = await hub.memoryBundle(persona);
                m = bundle.memory;
                s = bundle.skills;
                pd = { items: bundle.entries };
            } catch (error) {
                if (!(error instanceof HubError) || error.status !== 404) throw error;
                [m, s, pd] = await Promise.all([hub.memory(persona), hub.skills(persona), hub.persona(persona)]);
            }
            if (id !== requestId.current) return;
            setBundle(m);
            setMemoryText(m?.memory?.content ?? "");
            setProfileText(m?.profile?.content ?? "");

            setSkills(Array.isArray(s) ? s : Array.isArray(s?.items) ? s.items : []);

            setPersonaData(pd);
        } catch (e) {
            if (id === requestId.current) setError((e as Error).message);
        }
        if (id === requestId.current) setLoading(false);
    }, [persona]);

    useEffect(() => {
        void load();
        return () => {
            // This ref is a request generation counter, not a DOM node.
            // oxlint-disable-next-line react-hooks/exhaustive-deps
            requestId.current++;
        };
    }, [load]);

    const changePersona = (id: string): void => {
        setBundle(null);
        setPersonaData(null);
        setMemoryText("");
        setProfileText("");
        setPersonaKey(null);
        setPersona(id);
        setSkillOpen(null);
        setSavedMsg(null);
        invalidatePersonaCache();
    };

    const save = async (kind: "memory" | "profile"): Promise<void> => {
        setSaving(true);
        setSavedMsg(null);
        try {
            await hub.saveMemory(persona, kind, kind === "memory" ? memoryText : profileText);
            setSavedMsg(
                _t("qing|text_11ead8b9", {
                    v0: kind === "memory" ? _t("qing|text_7a6335b3") : _t("qing|text_6fd5a7cc"),
                }),
            );
            setTimeout(() => setSavedMsg(null), 3000);
        } catch (e) {
            setError(_t("qing|text_2e9c15dc", { v0: (e as Error).message }));
        }
        setSaving(false);
    };

    const openSkill = async (path: string): Promise<void> => {
        setSkillOpen(path);
        setSkillText("");
        try {
            const d = await hub.skillContent(path, persona);
            setSkillText(d?.content ?? "");
        } catch (e) {
            setError(_t("qing|text_3ee1597b", { v0: (e as Error).message }));
        }
    };

    const saveSkill = async (): Promise<void> => {
        if (!skillOpen) return;
        setSaving(true);
        try {
            await hub.saveSkill(skillOpen, persona, skillText);
            setSavedMsg(_t("qing|text_5e9a9219"));
            setTimeout(() => setSavedMsg(null), 3000);
            await load();
        } catch (e) {
            setError(_t("qing|text_2e9c15dc", { v0: (e as Error).message }));
        }
        setSaving(false);
    };

    const savePersonaItem = async (): Promise<void> => {
        if (!personaKey) return;
        setSaving(true);
        try {
            await hub.savePersona(persona, personaKey, personaText);
            setSavedMsg(_t("qing|text_8addfe75"));
            setTimeout(() => setSavedMsg(null), 3000);
            setPersonaData(await hub.persona(persona));
        } catch (e) {
            setError(_t("qing|text_2e9c15dc", { v0: (e as Error).message }));
        }
        setSaving(false);
    };

    const removeSkill = async (path: string): Promise<void> => {
        if (!(await confirmAction(_t("qing|text_e001d395", { v0: path })))) return;
        try {
            await hub.deleteSkill(path, persona);
            if (skillOpen === path) setSkillOpen(null);
            await load();
        } catch (e) {
            setError(_t("qing|text_7fa791d8", { v0: (e as Error).message }));
        }
    };

    const header = (
        <PageHeader
            title={_t("qing|text_7a6335b3")}
            subtitle={_t("qing|text_65aa356d")}
            onBack={onBack}
            right={
                <>
                    <PersonaPicker value={persona} onChange={changePersona} />
                    <Button onClick={() => setVault(true)}>{_t("qing|text_bdb0c9ab")}</Button>
                </>
            }
        />
    );

    if (vault) return <QingPanel key={persona} resource="vault" persona={persona} onBack={() => setVault(false)} />;

    if (loading && !bundle) {
        return (
            <>
                {header}
                <Loading />
            </>
        );
    }
    if (error && !bundle) {
        return (
            <>
                {header}
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => void load()} />
                </div>
            </>
        );
    }

    return (
        <>
            {header}
            {error && <ErrorBox message={error} onRetry={() => void load()} />}
            <div style={{ display: "flex", gap: 6, padding: "0 24px 12px", flexShrink: 0 }}>
                {getTABS().map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: "6px 14px",
                            fontSize: 12.5,
                            borderRadius: 8,
                            cursor: "pointer",
                            border: `1px solid ${tab === t.id ? p.accent : p.border}`,
                            background: tab === t.id ? p.accentSoft : "transparent",
                            color: tab === t.id ? p.accent : p.textDim,
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <Scroll>
                {tab === "memory" && (
                    <>
                        {editingRawMemory ? (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                    <Button onClick={() => setEditingRawMemory(false)}>
                                        {_t("qing|text_3534cbca")}
                                    </Button>
                                    <span style={{ font: "var(--cpd-font-body-xs-regular)", color: p.textDim }}>
                                        {_t("qing|text_cd0af8b6")}
                                    </span>
                                </div>
                                <TextEditor
                                    title={_t("qing|text_7a6335b3")}
                                    hint={_t("qing|text_cd0af8b6")}
                                    value={memoryText}
                                    onChange={setMemoryText}
                                    onSave={() => void save("memory")}
                                    saving={saving}
                                    saved={savedMsg}
                                />
                            </>
                        ) : (
                            <>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 12,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <input
                                        type="search"
                                        aria-label={_t("qing|text_44ce7ae9")}
                                        placeholder={_t("qing|text_44ce7ae9")}
                                        value={memoryQuery}
                                        onChange={(e) => setMemoryQuery(e.target.value)}
                                        style={{
                                            flex: 1,
                                            minWidth: 180,
                                            padding: "7px 12px",
                                            font: "var(--cpd-font-body-sm-regular)",
                                            borderRadius: 8,
                                            border: `1px solid ${p.divider}`,
                                            background: p.bgAlt,
                                            color: p.text,
                                            outline: "none",
                                        }}
                                    />
                                    <Button onClick={() => void load()}>{_t("qing|text_aee88743")}</Button>
                                    <Button onClick={() => void checkIndexStatus()}>{_t("qing|text_11676e8a")}</Button>
                                    <Button disabled={!memoryText} onClick={() => copyText(memoryText, setCopiedRaw)}>
                                        {copiedRaw ? _t("qing|copied") : _t("qing|copy_raw")}
                                    </Button>
                                    <Button onClick={() => setEditingRawMemory(true)}>
                                        {_t("qing|text_05183656")}
                                    </Button>
                                </div>

                                {indexSummary && (
                                    <Card style={{ marginBottom: 12 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: 10,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    font: "var(--cpd-font-body-sm-regular)",
                                                    color: p.text,
                                                }}
                                            >
                                                {indexSummary.text}
                                            </span>
                                            <Button onClick={() => copyText(indexSummary.raw, setCopiedIndexRaw)}>
                                                {copiedIndexRaw ? _t("qing|copied") : _t("qing|copy_raw")}
                                            </Button>
                                        </div>
                                    </Card>
                                )}

                                {memoryEntries.length === 0 ? (
                                    <Empty text={_t("qing|text_70a40a53")} />
                                ) : (
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                            gap: 12,
                                            alignItems: "stretch",
                                        }}
                                    >
                                        {memoryEntries.map((entry) => (
                                            <Card
                                                key={entry.id}
                                                style={{
                                                    height: "100%",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 6,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        font: "var(--cpd-font-body-md-semibold)",
                                                        color: p.text,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {entry.title}
                                                </div>
                                                <div
                                                    style={{
                                                        font: "var(--cpd-font-body-sm-regular)",
                                                        color: p.textDim,
                                                        flex: 1,
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 3,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {entry.summary || "—"}
                                                </div>
                                                {entry.time && (
                                                    <div
                                                        style={{
                                                            font: "var(--cpd-font-body-xs-regular)",
                                                            color: p.textDim,
                                                            paddingTop: 6,
                                                            borderTop: `1px solid ${p.divider}`,
                                                        }}
                                                    >
                                                        {entry.time}
                                                    </div>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {tab === "profile" && (
                    <TextEditor
                        title={_t("qing|text_6fd5a7cc")}
                        hint={_t("qing|text_bf934d74")}
                        value={profileText}
                        onChange={setProfileText}
                        onSave={() => void save("profile")}
                        saving={saving}
                        saved={savedMsg}
                    />
                )}

                {tab === "skills" && (
                    <>
                        {skillOpen ? (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <Button onClick={() => setSkillOpen(null)}>{_t("qing|text_3534cbca")}</Button>
                                    <span style={{ fontSize: 12.5, color: p.textDim }}>{skillOpen}</span>
                                </div>
                                <textarea
                                    aria-label={_t("qing|text_2203dc90")}
                                    value={skillText}
                                    onChange={(e) => setSkillText(e.target.value)}
                                    spellCheck={false}
                                    style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        minHeight: 420,
                                        padding: 12,
                                        fontSize: 13,
                                        lineHeight: 1.7,
                                        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                                        borderRadius: 10,
                                        border: `1px solid ${p.border}`,
                                        background: p.bgAlt,
                                        color: p.text,
                                        outline: "none",
                                        resize: "vertical",
                                    }}
                                />
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                                    <Button variant="primary" disabled={saving} onClick={() => void saveSkill()}>
                                        {saving ? _t("qing|text_ff509c9b") : _t("qing|text_c6b2eeca")}
                                    </Button>
                                    {savedMsg && <span style={{ fontSize: 12, color: p.accent }}>{savedMsg}</span>}
                                </div>
                            </>
                        ) : skills.length === 0 ? (
                            <Empty text={_t("qing|text_f3b039b4")} />
                        ) : (
                            skills.map((s, i) => (
                                <Card key={s.path || s.name || i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.target === event.currentTarget &&
                                                    (event.key === "Enter" || event.key === " ")
                                                ) {
                                                    event.preventDefault();
                                                    event.currentTarget.click();
                                                }
                                            }}
                                            onClick={() => void openSkill(s.path || s.name)}
                                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                        >
                                            <div style={{ fontSize: 13.5, fontWeight: 500, color: p.text }}>
                                                {s.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11.5,
                                                    color: p.textDim,
                                                    marginTop: 2,
                                                    lineHeight: 1.5,
                                                }}
                                            >
                                                {s.description || _t("qing|text_0042f188")}
                                            </div>
                                        </div>
                                        <Button onClick={() => void removeSkill(s.path || s.name)}>
                                            {_t("qing|text_2f9daa82")}
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        )}
                    </>
                )}

                {tab === "persona" && (
                    <>
                        {personaKey ? (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <Button onClick={() => setPersonaKey(null)}>{_t("qing|text_3534cbca")}</Button>
                                    <span style={{ fontSize: 12.5, color: p.textDim }}>{personaKey}</span>
                                </div>
                                <textarea
                                    aria-label={_t("qing|text_2203dc90")}
                                    value={personaText}
                                    onChange={(e) => setPersonaText(e.target.value)}
                                    spellCheck={false}
                                    style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        minHeight: 420,
                                        padding: 12,
                                        fontSize: 13,
                                        lineHeight: 1.7,
                                        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                                        borderRadius: 10,
                                        border: `1px solid ${p.border}`,
                                        background: p.bgAlt,
                                        color: p.text,
                                        outline: "none",
                                        resize: "vertical",
                                    }}
                                />
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                                    <Button variant="primary" disabled={saving} onClick={() => void savePersonaItem()}>
                                        {saving ? _t("qing|text_ff509c9b") : _t("qing|text_8d6347cd")}
                                    </Button>
                                    {savedMsg && <span style={{ fontSize: 12, color: p.accent }}>{savedMsg}</span>}
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 12, color: p.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                                    「{personaData?.label || persona}
                                    {_t("qing|text_9616ac54")}
                                </div>
                                {(personaData?.items || []).length === 0 ? (
                                    <Empty text={_t("qing|text_602266d7")} />
                                ) : (
                                    (personaData?.items || []).map((it: any) => (
                                        <Card key={it.key} style={{ marginBottom: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.target === event.currentTarget &&
                                                            (event.key === "Enter" || event.key === " ")
                                                        ) {
                                                            event.preventDefault();
                                                            event.currentTarget.click();
                                                        }
                                                    }}
                                                    onClick={() => {
                                                        setPersonaKey(it.key);
                                                        setPersonaText(it.content || "");
                                                    }}
                                                    style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                                >
                                                    <div style={{ fontSize: 13.5, fontWeight: 500, color: p.text }}>
                                                        {it.label || it.key}
                                                        {it.primary && (
                                                            <span
                                                                style={{
                                                                    marginLeft: 8,
                                                                    fontSize: 10,
                                                                    padding: "1px 6px",
                                                                    borderRadius: 4,
                                                                    background: p.accentSoft,
                                                                    color: p.accent,
                                                                }}
                                                            >
                                                                {_t("qing|text_d7995523")}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 11.5,
                                                            color: p.textDim,
                                                            marginTop: 4,
                                                            lineHeight: 1.5,
                                                            maxHeight: 40,
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {`${it.content || ""}`.slice(0, 120)}
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => {
                                                        setPersonaKey(it.key);
                                                        setPersonaText(it.content || "");
                                                    }}
                                                >
                                                    {_t("qing|text_05183656")}
                                                </Button>
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </>
                        )}
                    </>
                )}
            </Scroll>
        </>
    );
};
