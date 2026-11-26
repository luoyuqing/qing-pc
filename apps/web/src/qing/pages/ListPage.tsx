/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/* Qing PC · 通用列表页：把 device-hub 的 {items:[...]} 渲染成可读列表 */

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatHumanResult } from "../data";
import { friendlyError } from "../status";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export interface Column {
    key: string;
    label?: string;
    /** 自定义渲染，默认直接取值 */
    render?: (item: any) => React.ReactNode;
    /** 作为卡片标题的字段 */
    title?: boolean;
}

interface Props {
    title: string;
    subtitle?: string;
    loader: () => Promise<any>;
    columns: Column[];
    /** 列表为空时的文案 */
    emptyText?: string;
    /** 顶部额外说明 */
    hint?: string;
    /** 每张卡片的强调色（默认主色） */
    onItemClick?: (item: any) => void;
    onBack?: () => void;
}

function pick(item: any, col: Column): React.ReactNode {
    if (col.render) return col.render(item);
    const v = item?.[col.key];
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? _t("qing|text_b5141d3d") : _t("qing|text_0c70665b");
    if (Array.isArray(v)) return v.length ? v.join("、") : "—";
    if (typeof v === "object") return formatHumanResult(v);
    return `${v}`;
}

export const ListPage: React.FC<Props> = ({
    title,
    subtitle,
    loader,
    columns,
    emptyText,
    hint,
    onItemClick,
    onBack,
}): React.ReactNode => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();
    // 用 ref 存 loader，避免父组件每次渲染传新函数导致无限重载
    const loaderRef = useRef(loader);
    loaderRef.current = loader;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await loaderRef.current();
            const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
            setItems(list);
        } catch (e) {
            setError(friendlyError(e));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load, tick]);

    const titleCol = columns.find((c) => c.title) || columns[0];
    const restCols = columns.filter((c) => c !== titleCol);

    return (
        <>
            <PageHeader
                title={title}
                subtitle={subtitle}
                onBack={onBack}
                right={<Button onClick={() => setTick((t) => t + 1)}>{_t("qing|text_aee88743")}</Button>}
            />
            {hint && (
                <div style={{ padding: "0 24px 10px", fontSize: 12, color: p.textDim, lineHeight: 1.6 }}>{hint}</div>
            )}
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : items.length === 0 ? (
                <Empty text={emptyText || _t("qing|text_ef3763ae")} />
            ) : (
                <Scroll>
                    {items.map((item, i) => (
                        <Card
                            key={item?.id ?? item?.name ?? item?.key ?? i}
                            onClick={onItemClick ? () => onItemClick(item) : undefined}
                            style={{ marginBottom: 8 }}
                        >
                            {titleCol && (
                                <div style={{ fontSize: 14, fontWeight: 600, color: p.text, marginBottom: 4 }}>
                                    {pick(item, titleCol)}
                                </div>
                            )}
                            {restCols.map((col) => {
                                const val = pick(item, col);
                                if (val === "—" || val === "" || val === null) return null;
                                return (
                                    <div
                                        key={col.key}
                                        style={{ fontSize: 12.5, color: p.textDim, marginTop: 3, lineHeight: 1.55 }}
                                    >
                                        {col.label && <span style={{ opacity: 0.75 }}>{col.label}：</span>}
                                        <span style={{ color: p.text }}>{val}</span>
                                    </div>
                                );
                            })}
                        </Card>
                    ))}
                </Scroll>
            )}
        </>
    );
};
