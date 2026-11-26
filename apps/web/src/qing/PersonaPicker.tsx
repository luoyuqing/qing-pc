/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 人设切换器

手机端不是「全局一个人设」，而是每个页面各自在标题栏放一个切换菜单
（见 qing-src/lib/pages/memory/memory_page.dart 的 PopupMenuButton，onSelected → _switchPersona），
切完本页立刻重新拉数据。这里保持同样的交互：页内独立切换，同时把选择写回全局配置当默认值，
换页时沿用上次的选择。
*/

import { _t } from "../languageHandler";
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
    /** 外部刷新触发：当人设列表为空时重试拉取 */
    refreshKey?: number;
}> = ({ value, onChange, compact, refreshKey }): React.ReactNode => {
    const [items, setItems] = useState<Persona[]>(cache ?? []);
    const p = palette();

    useEffect(() => {
        if (items.length > 0 && refreshKey) return;
        let alive = true;
        void loadPersonas().then((list) => {
            if (alive) setItems(list);
        });
        return () => {
            alive = false;
        };
    }, [refreshKey, items.length]);

    if (items.length === 0) return null;
    return (
        <select
            aria-label={_t("qing|text_8eea4548")}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            style={{
                padding: compact ? "4px 8px" : "5px 10px",
                borderRadius: 8,
                border: `1px solid ${p.border}`,
                background: p.bgAlt,
                color: p.text,
                maxWidth: 180,
            }}
        >
            {items.map((item) => (
                <option key={item.id} value={item.id}>
                    {item.label}
                </option>
            ))}
        </select>
    );
};
