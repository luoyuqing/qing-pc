/*
Qing PC · 记忆
对齐手机端 memory_page.dart：四个 Tab（记忆 / 画像 / 技能 / 人设），顶部可切人设。
记忆与画像可直接编辑保存（服务端保存前自动 .bak 备份）；技能可查看、编辑、删除。
接口：GET /memory、POST /memory、GET/POST/DELETE /skills、GET /persona
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub } from "../hub";
import { PersonaPicker, invalidatePersonaCache } from "../PersonaPicker";
import { DataView } from "../DataView";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

type Tab = "memory" | "profile" | "skills" | "persona";

const TABS: { id: Tab; label: string }[] = [
    { id: "memory", label: "记忆" },
    { id: "profile", label: "画像" },
    { id: "skills", label: "技能" },
    { id: "persona", label: "人设" },
];

const TextEditor: React.FC<{
    title: string;
    hint: string;
    value: string;
    onChange: (v: string) => void;
    onSave: () => void;
    saving: boolean;
    saved: string | null;
}> = ({ title, hint, value, onChange, onSave, saving, saved }) => {
    const p = palette();
    return (
        <>
            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8, lineHeight: 1.6 }}>{hint}</div>
            <textarea
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
                    {saving ? "保存中…" : `保存${title}`}
                </Button>
                {saved && <span style={{ fontSize: 12, color: p.accent }}>{saved}</span>}
            </div>
        </>
    );
};

export const MemoryPage: React.FC<{ onBack?: () => void; initialPersona?: string }> = ({
    onBack,
    initialPersona,
}) => {
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
        setLoading(true);
        setError(null);
        try {
            const m = await hub.memory(persona);
            setBundle(m);
            setMemoryText(m?.memory?.content ?? "");
            setProfileText(m?.profile?.content ?? "");

            const s = await hub.skills(persona);
            setSkills(Array.isArray(s) ? s : Array.isArray(s?.items) ? s.items : []);

            const pd = await hub.persona(persona).catch(() => null);
            setPersonaData(pd);
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, [persona]);

    useEffect(() => {
        void load();
    }, [load]);

    const changePersona = (id: string) => {
        setPersona(id);
        setSkillOpen(null);
        setSavedMsg(null);
        invalidatePersonaCache();
    };

    const save = async (kind: "memory" | "profile") => {
        setSaving(true);
        setSavedMsg(null);
        try {
            await hub.saveMemory(persona, kind, kind === "memory" ? memoryText : profileText);
            setSavedMsg(`${kind === "memory" ? "记忆" : "画像"}已保存`);
            setTimeout(() => setSavedMsg(null), 3000);
        } catch (e) {
            window.alert(`保存失败：${(e as Error).message}`);
        }
        setSaving(false);
    };

    const openSkill = async (path: string) => {
        setSkillOpen(path);
        setSkillText("");
        try {
            const d = await hub.skillContent(path, persona);
            setSkillText(d?.content ?? "");
        } catch (e) {
            window.alert(`读取技能失败：${(e as Error).message}`);
        }
    };

    const saveSkill = async () => {
        if (!skillOpen) return;
        setSaving(true);
        try {
            await hub.saveSkill(skillOpen, persona, skillText);
            setSavedMsg("技能已保存");
            setTimeout(() => setSavedMsg(null), 3000);
            await load();
        } catch (e) {
            window.alert(`保存失败：${(e as Error).message}`);
        }
        setSaving(false);
    };

    const savePersonaItem = async () => {
        if (!personaKey) return;
        setSaving(true);
        try {
            await hub.savePersona(persona, personaKey, personaText);
            setSavedMsg("人设设定已保存");
            setTimeout(() => setSavedMsg(null), 3000);
            const pd = await hub.persona(persona).catch(() => null);
            setPersonaData(pd);
        } catch (e) {
            window.alert(`保存失败：${(e as Error).message}`);
        }
        setSaving(false);
    };

    const removeSkill = async (path: string) => {
        if (!window.confirm(`删除技能 ${path}？此操作不可撤销。`)) return;
        try {
            await hub.deleteSkill(path, persona);
            if (skillOpen === path) setSkillOpen(null);
            await load();
        } catch (e) {
            window.alert(`删除失败：${(e as Error).message}`);
        }
    };

    const header = (
        <PageHeader
            title="记忆"
            subtitle="记忆 · 画像 · 技能 · 人设"
            onBack={onBack}
            right={<PersonaPicker value={persona} onChange={changePersona} />}
        />
    );

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
            <div style={{ display: "flex", gap: 6, padding: "0 24px 12px", flexShrink: 0 }}>
                {TABS.map((t) => (
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
                        title="记忆"
                        hint="MEMORY.md —— 助理的长期记忆。每条之间用空行分隔，保存前服务端会自动备份 .bak。"
                        value={memoryText}
                        onChange={setMemoryText}
                        onSave={() => void save("memory")}
                        saving={saving}
                        saved={savedMsg}
                    />
                )}

                {tab === "profile" && (
                    <TextEditor
                        title="画像"
                        hint="USER.md —— 助理眼中的你：偏好、习惯与背景，她会照此调整回答方式。"
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
                                    <Button onClick={() => setSkillOpen(null)}>← 返回列表</Button>
                                    <span style={{ fontSize: 12.5, color: p.textDim }}>{skillOpen}</span>
                                </div>
                                <textarea
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
                                        {saving ? "保存中…" : "保存技能"}
                                    </Button>
                                    {savedMsg && <span style={{ fontSize: 12, color: p.accent }}>{savedMsg}</span>}
                                </div>
                            </>
                        ) : skills.length === 0 ? (
                            <Empty text="这个人设还没装任何技能。" />
                        ) : (
                            skills.map((s, i) => (
                                <Card key={s.path || s.name || i} style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div
                                            onClick={() => void openSkill(s.path || s.name)}
                                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                        >
                                            <div style={{ fontSize: 13.5, fontWeight: 500, color: p.text }}>
                                                {s.name}
                                            </div>
                                            <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2, lineHeight: 1.5 }}>
                                                {s.description || "（无描述）"}
                                            </div>
                                        </div>
                                        <Button onClick={() => void removeSkill(s.path || s.name)}>删除</Button>
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
                                    <Button onClick={() => setPersonaKey(null)}>← 返回列表</Button>
                                    <span style={{ fontSize: 12.5, color: p.textDim }}>{personaKey}</span>
                                </div>
                                <textarea
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
                                        {saving ? "保存中…" : "保存设定"}
                                    </Button>
                                    {savedMsg && <span style={{ fontSize: 12, color: p.accent }}>{savedMsg}</span>}
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 12, color: p.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                                    「{personaData?.label || persona}」的设定（Hermes config.yaml）。点开可改，
                                    改动写回服务端配置。
                                </div>
                                {(personaData?.items || []).length === 0 ? (
                                    <Empty text="没读到人设设定。" />
                                ) : (
                                    (personaData?.items || []).map((it: any) => (
                                        <Card key={it.key} style={{ marginBottom: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div
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
                                                                主设定
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
                                                    编辑
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
