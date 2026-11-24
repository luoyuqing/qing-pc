/*
Qing PC · 人设切换器

手机端不是「全局一个人设」，而是每个页面各自在标题栏放一个切换菜单
（见 qing-src/lib/pages/memory/memory_page.dart 的 PopupMenuButton，onSelected → _switchPersona），
切完本页立刻重新拉数据。这里保持同样的交互：页内独立切换，同时把选择写回全局配置当默认值，
换页时沿用上次的选择。
*/

import React, { useEffect, useState } from "react";
import { hub } from "./hub";
import { palette } from "./theme";

export interface Persona {
    id: string;
    label: string;
}

let cache: Persona[] | null = null;
let inflight: Promise<Persona[]> | null = null;

export async function loadPersonas(): Promise<Persona[]> {
    if (cache) return cache;
    if (!inflight) {
        inflight = hub
            .personas()
            .then((data) => {
                const raw = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
                const list: Persona[] = raw
                    .map((x: any) => ({ id: `${x?.id ?? ""}`, label: `${x?.label || x?.id || ""}` }))
                    .filter((x: Persona) => x.id);
                cache = list;
                return list;
            })
            .catch(() => [])
            .finally(() => {
                inflight = null;
            });
    }
    return inflight;
}

export function invalidatePersonaCache(): void {
    cache = null;
}

export const PersonaPicker: React.FC<{
    value: string;
    onChange: (id: string) => void;
    /** 卡片内使用时可以关掉底色 */
    compact?: boolean;
}> = ({ value, onChange, compact }) => {
    const [items, setItems] = useState<Persona[]>(cache ?? []);
    const [open, setOpen] = useState(false);
    const p = palette();

    useEffect(() => {
        let alive = true;
        void loadPersonas().then((list) => {
            if (alive) setItems(list);
        });
        return () => {
            alive = false;
        };
    }, []);

    const current = items.find((x) => x.id === value);
    const text = current ? current.label : value;

    if (items.length === 0) {
        // 拉不到列表就不显示切换器，避免误导
        return null;
    }

    return (
        <div style={{ position: "relative", flexShrink: 0 }}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: compact ? "4px 8px" : "5px 10px",
                    fontSize: 12,
                    borderRadius: 8,
                    cursor: "pointer",
                    border: `1px solid ${open ? p.accent : p.border}`,
                    background: p.bgAlt,
                    color: p.text,
                    maxWidth: 160,
                }}
                title="切换人设"
            >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
                <span style={{ color: p.textDim, fontSize: 10 }}>▾</span>
            </button>
            {open && (
                <>
                    {/* 点外面关闭 */}
                    <div
                        onClick={() => setOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 40, background: "transparent" }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            right: 0,
                            minWidth: 160,
                            zIndex: 41,
                            borderRadius: 10,
                            border: `1px solid ${p.border}`,
                            background: p.bg,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                            overflow: "hidden",
                        }}
                    >
                        {items.map((x) => (
                            <div
                                key={x.id}
                                onClick={() => {
                                    setOpen(false);
                                    onChange(x.id);
                                }}
                                style={{
                                    padding: "8px 12px",
                                    fontSize: 12.5,
                                    cursor: "pointer",
                                    color: x.id === value ? p.accent : p.text,
                                    background: x.id === value ? p.accentSoft : "transparent",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                }}
                            >
                                <span>{x.label}</span>
                                {x.id === value && <span>✓</span>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
