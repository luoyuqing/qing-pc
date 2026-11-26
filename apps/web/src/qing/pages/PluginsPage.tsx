/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/* Qing PC · 插件与能力（按人设展示与隔离启用状态） */

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf, loadConfig, saveConfig } from "../hub";
import { PersonaPicker } from "../PersonaPicker";
import { Button, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

function pluginKey(item: any, index: number): string {
    return String(item.id || item.name || item.key || `plugin-${index}`);
}

function loadProfileOverrides(persona: string): Record<string, boolean> {
    try {
        const raw = window.localStorage.getItem(`qing.plugins.enabled.${persona}`);
        if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, boolean>;
            }
        }
    } catch {
        // Ignore corrupted local overrides.
    }
    return {};
}

function saveProfileOverrides(persona: string, map: Record<string, boolean>): void {
    window.localStorage.setItem(`qing.plugins.enabled.${persona}`, JSON.stringify(map));
}

export const PluginsPage: React.FC<{ onBack?: () => void }> = ({ onBack }): React.ReactNode => {
    const [persona, setPersona] = useState(loadConfig().persona);
    const [items, setItems] = useState<any[]>([]);
    const [overrides, setOverrides] = useState<Record<string, boolean>>(() =>
        loadProfileOverrides(loadConfig().persona),
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await hub.agentPlugins(persona);
            setItems(itemsOf(data));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, [persona]);

    useEffect(() => {
        void load();
    }, [load]);

    const changePersona = (nextPersona: string): void => {
        setPersona(nextPersona);
        setOverrides(loadProfileOverrides(nextPersona));
        saveConfig({ ...loadConfig(), persona: nextPersona });
    };

    const isEnabled = (item: any, index: number): boolean => {
        const key = pluginKey(item, index);
        if (key in overrides) return overrides[key];
        return item.enabled !== false;
    };

    const togglePlugin = (item: any, index: number): void => {
        const key = pluginKey(item, index);
        const next = !isEnabled(item, index);
        const updated = { ...overrides, [key]: next };
        setOverrides(updated);
        saveProfileOverrides(persona, updated);
    };

    const installed = items.filter((e) => e.kind === "installed");
    const builtin = items.filter((e) => e.kind !== "installed");

    const renderGroup = (title: string, list: any[]): React.ReactNode => {
        if (list.length === 0) return null;
        return (
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: p.textDim, marginBottom: 8 }}>{title}</div>
                <div
                    style={{
                        borderRadius: 12,
                        background: p.bgAlt,
                        border: `1px solid ${p.divider}`,
                        overflow: "hidden",
                    }}
                >
                    {list.map((item, i) => {
                        const globalIndex = items.indexOf(item);
                        const enabled = isEnabled(item, globalIndex);
                        const name = item.name || item.id || _t("qing|item_default");
                        return (
                            <div
                                key={pluginKey(item, globalIndex)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "12px 14px",
                                    borderTop: i === 0 ? "none" : `1px solid ${p.divider}`,
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 600, color: p.text }}>{name}</span>
                                        {item.version && (
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: p.textDim,
                                                    padding: "1px 6px",
                                                    borderRadius: 999,
                                                    background: p.bg,
                                                }}
                                            >
                                                v{item.version}
                                            </span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <div style={{ fontSize: 12, color: p.textDim, marginTop: 3, lineHeight: 1.5 }}>
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={enabled}
                                    aria-label={name}
                                    onClick={() => togglePlugin(item, globalIndex)}
                                    style={{
                                        width: 40,
                                        height: 22,
                                        borderRadius: 999,
                                        border: "none",
                                        padding: 2,
                                        cursor: "pointer",
                                        background: enabled ? p.accent : p.divider,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: enabled ? "flex-end" : "flex-start",
                                        transition: "background 120ms ease",
                                        flexShrink: 0,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 18,
                                            height: 18,
                                            borderRadius: "50%",
                                            background: "#fff",
                                        }}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <>
            <PageHeader
                title={_t("qing|text_a1226a32")}
                subtitle={_t("qing|text_d5b15ee4")}
                onBack={onBack}
                right={
                    <>
                        <PersonaPicker value={persona} onChange={changePersona} compact />
                        <Button onClick={() => void load()}>{_t("qing|text_aee88743")}</Button>
                    </>
                }
            />
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => void load()} />
                </div>
            ) : items.length === 0 ? (
                <Empty text={_t("qing|text_70a40a53")} />
            ) : (
                <Scroll>
                    {renderGroup(_t("qing|plugins_installed", { v0: String(installed.length) }), installed)}
                    {renderGroup(_t("qing|plugins_builtin", { v0: String(builtin.length) }), builtin)}
                </Scroll>
            )}
        </>
    );
};
