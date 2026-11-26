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
import React, { useCallback, useEffect, useRef, useState } from "react";
import { confirmAction } from "../dialogs";
import { QingPanel } from "../QingPanel";
import { HubError, hub } from "../hub";
import { PersonaPicker, invalidatePersonaCache } from "../PersonaPicker";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

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

    const p = palette();

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
                    <TextEditor
                        title={_t("qing|text_7a6335b3")}
                        hint={_t("qing|text_cd0af8b6")}
                        value={memoryText}
                        onChange={setMemoryText}
                        onSave={() => void save("memory")}
                        saving={saving}
                        saved={savedMsg}
                    />
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
