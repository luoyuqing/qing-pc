/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 服务
对齐手机端 services_page.dart 的两段式布局：
- 本机服务（group=local）：卡片网格，点开先换 60 秒一次性票据，再在**内置窗口**打开
- 外网收藏：列表行，直接交给系统浏览器

打开本机服务时显示等待遮罩（主进程会在页面加载完成后才返回）。
*/

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useState } from "react";
import { QingPanel } from "../QingPanel";
import { hub, itemsOf, loadConfig } from "../hub";
import { Button, Card, Empty, ErrorBox, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

const ALLOWED_HOST = "3585616.xyz";

function isAllowedHost(host: string): boolean {
    const h = host.toLowerCase();
    return h === ALLOWED_HOST || h.endsWith(`.${ALLOWED_HOST}`);
}

function openServiceWindow(url: string): Promise<boolean> {
    const bridge = (window as unknown as { qingOpenService?: (u: string) => Promise<boolean> }).qingOpenService;
    if (typeof bridge === "function") return bridge(url);
    // 没有主进程能力时（浏览器调试）退回系统浏览器
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve(true);
}

function openExternal(url: string): void {
    window.open(url, "_blank", "noopener,noreferrer");
}

const ICONS: Record<string, string> = {
    tv: "📺",
    subtitles: "💬",
    cloud: "☁️",
    book: "📖",
    home: "🏠",
    chart: "📊",
    code: "🧩",
    music: "🎵",
    video: "🎬",
    image: "🖼️",
};

const Spinner: React.FC<{ color: string }> = ({ color }): React.ReactNode => (
    <>
        <style>{`@keyframes qing-spin { to { transform: rotate(360deg); } }`}</style>
        <div
            style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: "2.5px solid var(--qing-accent-soft)",
                borderTopColor: color,
                animation: "qing-spin 0.8s linear infinite",
            }}
        />
    </>
);

export const ServicesPage: React.FC<{ onBack?: () => void }> = ({ onBack }): React.ReactNode => {
    const [manage, setManage] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [favs, setFavs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [opening, setOpening] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [catalog, favList] = await Promise.all([hub.serviceCatalog(), hub.serviceFavs()]);
            // /svc/catalog 返回 {services:[...]}，不是 {items:[...]}
            const list: any[] = Array.isArray(catalog)
                ? catalog
                : Array.isArray(catalog?.services)
                  ? catalog.services
                  : itemsOf(catalog);
            setServices(list.filter((item) => !item.hostname || isAllowedHost(`${item.hostname}`)));
            setFavs(itemsOf(favList));
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load, tick]);

    const openService = async (service: any): Promise<void> => {
        setOpening(service.id);
        setError(null);
        try {
            const data = await hub.serviceTicket(`${service.id}`);
            const url = `${data?.url || ""}`;
            if (!url) throw new Error(_t("qing|text_3044e48b"));
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
                throw new Error(_t("qing|text_2c82abf6"));
            }
            await openServiceWindow(url);
        } catch (e) {
            setError((e as Error).message);
        }
        setOpening(null);
    };

    if (manage)
        return (
            <QingPanel
                resource="favorites"
                persona={loadConfig().persona}
                onBack={() => {
                    setManage(false);
                    void load();
                }}
            />
        );

    const moveService = async (id: string, direction: number): Promise<void> => {
        const order = services.filter((item) => `${item.group || "local"}` === "local");
        const index = order.findIndex((item) => String(item.id) === id);
        const next = index + direction;
        if (next < 0 || next >= order.length) return;
        [order[index], order[next]] = [order[next], order[index]];
        try {
            await hub.serviceOrder(order.map((item) => String(item.id)));
            await load();
        } catch (error) {
            setError((error as Error).message);
        }
    };
    const local = services.filter((s) => `${s.group || "local"}` === "local");
    const webCards = services.filter((s) => `${s.group || "local"}` !== "local" && s.type !== "bookmarks");

    return (
        <>
            <PageHeader
                title={_t("qing|text_ec309ab2")}
                subtitle={_t("qing|text_1a4c7b1a")}
                onBack={onBack}
                right={
                    <>
                        <Button onClick={() => setManage(true)}>{_t("qing|text_3c7c1e16")}</Button>
                        <Button onClick={() => setTick((t) => t + 1)}>{_t("qing|text_aee88743")}</Button>
                    </>
                }
            />

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
                    <Spinner color={p.accent} />
                </div>
            ) : error && services.length === 0 && favs.length === 0 ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => setTick((t) => t + 1)} />
                </div>
            ) : (
                <Scroll>
                    {error && (
                        <div style={{ marginBottom: 12 }}>
                            <ErrorBox message={error} />
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: p.textDim }}>{_t("qing|text_e3cc3d39")}</span>
                        <span style={{ fontSize: 11, color: p.textDim, marginLeft: 8 }}>
                            {_t("qing|text_158525e6")}
                        </span>
                        <span style={{ fontSize: 11, color: p.textDim, marginLeft: "auto" }}>
                            {local.length} {_t("qing|text_3a116815")}
                        </span>
                    </div>
                    {local.length === 0 ? (
                        <Empty text={_t("qing|text_0efa7a87")} />
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                                gap: 10,
                                marginBottom: 24,
                            }}
                        >
                            {local.map((item, index) => (
                                <Card
                                    key={item.id}
                                    onClick={() => (opening ? undefined : void openService(item))}
                                    style={{
                                        opacity: opening && opening !== item.id ? 0.5 : 1,
                                        display: "flex",
                                        gap: 12,
                                        alignItems: "center",
                                        padding: "13px 14px",
                                        borderColor: p.divider,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            background: p.accentSoft,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 19,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {ICONS[`${item.icon || ""}`] || "🔗"}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                fontSize: 13.5,
                                                fontWeight: 600,
                                                color: p.text,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.name || item.id}
                                        </div>
                                        {item.desc && (
                                            <div
                                                style={{
                                                    fontSize: 11.5,
                                                    color: p.textDim,
                                                    marginTop: 2,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {item.desc}
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            aria-label={_t("qing|text_f853a70b")}
                                            title={_t("qing|text_f853a70b")}
                                            disabled={index === 0}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void moveService(String(item.id), -1);
                                            }}
                                            style={{
                                                width: 22,
                                                height: 18,
                                                padding: 0,
                                                border: "none",
                                                borderRadius: 4,
                                                background: "transparent",
                                                color: p.textDim,
                                                fontSize: 11,
                                                lineHeight: "18px",
                                                cursor: index === 0 ? "default" : "pointer",
                                                opacity: index === 0 ? 0.25 : 0.8,
                                            }}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={_t("qing|text_e75e8b4e")}
                                            title={_t("qing|text_e75e8b4e")}
                                            disabled={index === local.length - 1}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void moveService(String(item.id), 1);
                                            }}
                                            style={{
                                                width: 22,
                                                height: 18,
                                                padding: 0,
                                                border: "none",
                                                borderRadius: 4,
                                                background: "transparent",
                                                color: p.textDim,
                                                fontSize: 11,
                                                lineHeight: "18px",
                                                cursor: index === local.length - 1 ? "default" : "pointer",
                                                opacity: index === local.length - 1 ? 0.25 : 0.8,
                                            }}
                                        >
                                            ↓
                                        </button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {webCards.length > 0 && (
                        <>
                            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 10 }}>
                                {_t("qing|text_80f4bb7b")}
                            </div>
                            {webCards.map((item) => (
                                <Card
                                    key={item.id}
                                    onClick={() => void openService(item)}
                                    style={{ marginBottom: 8, padding: "11px 14px" }}
                                >
                                    <div style={{ fontSize: 13.5, color: p.text }}>{item.name || item.id}</div>
                                    <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>
                                        {item.hostname || item.desc || ""}
                                    </div>
                                </Card>
                            ))}
                        </>
                    )}

                    {favs.length > 0 && (
                        <>
                            <div style={{ fontSize: 12, fontWeight: 600, color: p.textDim, margin: "20px 0 8px" }}>
                                {_t("qing|text_8fbdb033")}
                            </div>
                            <div
                                style={{
                                    borderRadius: 12,
                                    background: p.bgAlt,
                                    border: `1px solid ${p.divider}`,
                                    overflow: "hidden",
                                }}
                            >
                                {favs.map((fav, i) => (
                                    <button
                                        key={fav.id ?? i}
                                        type="button"
                                        onClick={() => fav.url && openExternal(`${fav.url}`)}
                                        style={{
                                            width: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "11px 14px",
                                            border: "none",
                                            borderTop: i === 0 ? "none" : `1px solid ${p.divider}`,
                                            background: "transparent",
                                            cursor: "pointer",
                                            textAlign: "left",
                                        }}
                                    >
                                        <span style={{ fontSize: 13.5, fontWeight: 500, color: p.text }}>
                                            {fav.name || fav.url}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11.5,
                                                color: p.textDim,
                                                marginLeft: "auto",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                maxWidth: 260,
                                            }}
                                        >
                                            {fav.url}
                                        </span>
                                        <span style={{ fontSize: 12, color: p.textDim }}>↗</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </Scroll>
            )}

            {/* 打开服务的等待遮罩 */}
            {opening && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: p.bg,
                        opacity: 0.86,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 14,
                        zIndex: 30,
                    }}
                >
                    <Spinner color={p.accent} />
                    <div style={{ fontSize: 13, color: p.text }}>
                        {_t("qing|text_48de9f48")}
                        {services.find((s) => s.id === opening)?.name || _t("qing|text_ec309ab2")}…
                    </div>
                    <div style={{ fontSize: 11.5, color: p.textDim }}>{_t("qing|text_18883353")}</div>
                </div>
            )}
        </>
    );
};
