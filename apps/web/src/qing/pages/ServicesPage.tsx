/*
Qing PC · 服务
对齐手机端 services_page.dart 的两段式布局：
- 本机服务（group=local）：卡片网格，点开先换 60 秒一次性票据，再在**内置窗口**打开
- 外网收藏：列表行，直接交给系统浏览器

打开本机服务时显示等待遮罩（主进程会在页面加载完成后才返回）。
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf } from "../hub";
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

const Spinner: React.FC<{ color: string }> = ({ color }) => (
    <>
        <style>{`@keyframes qing-spin { to { transform: rotate(360deg); } }`}</style>
        <div
            style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2.5px solid ${color}33`,
                borderTopColor: color,
                animation: "qing-spin 0.8s linear infinite",
            }}
        />
    </>
);

export const ServicesPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
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

    const openService = async (service: any) => {
        setOpening(service.id);
        setError(null);
        try {
            const data = await hub.serviceTicket(`${service.id}`);
            const url = `${data?.url || ""}`;
            if (!url) throw new Error("服务端未返回入口地址");
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
                throw new Error("服务端返回的入口地址不在白名单内");
            }
            await openServiceWindow(url);
        } catch (e) {
            setError((e as Error).message);
        }
        setOpening(null);
    };

    const local = services.filter((s) => `${s.group || "local"}` === "local");
    const webCards = services.filter((s) => `${s.group || "local"}` !== "local" && s.type !== "bookmarks");

    return (
        <>
            <PageHeader
                title="服务"
                subtitle="本机管理页面与外网收藏"
                onBack={onBack}
                right={<Button onClick={() => setTick((t) => t + 1)}>刷新</Button>}
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
                        <span style={{ fontSize: 12, color: p.textDim }}>本机服务</span>
                        <span style={{ fontSize: 11, color: p.textDim, marginLeft: 8 }}>
                            一次性票据 · 内置窗口打开
                        </span>
                        <span style={{ fontSize: 11, color: p.textDim, marginLeft: "auto" }}>{local.length} 个</span>
                    </div>
                    {local.length === 0 ? (
                        <Empty text="没有本机服务。" />
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                                gap: 10,
                                marginBottom: 24,
                            }}
                        >
                            {local.map((item) => (
                                <Card
                                    key={item.id}
                                    onClick={() => (opening ? undefined : void openService(item))}
                                    style={{
                                        opacity: opening && opening !== item.id ? 0.5 : 1,
                                        display: "flex",
                                        gap: 12,
                                        alignItems: "center",
                                        padding: "13px 14px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 38,
                                            height: 38,
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
                                </Card>
                            ))}
                        </div>
                    )}

                    {webCards.length > 0 && (
                        <>
                            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 10 }}>外网服务</div>
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
                            <div style={{ fontSize: 12, color: p.textDim, margin: "20px 0 10px" }}>外网收藏</div>
                            {favs.map((fav, i) => (
                                <Card
                                    key={fav.id ?? i}
                                    onClick={() => fav.url && openExternal(`${fav.url}`)}
                                    style={{ marginBottom: 6, padding: "10px 14px" }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 13.5, color: p.text }}>{fav.name || fav.url}</span>
                                        <span
                                            style={{
                                                fontSize: 11,
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
                                    </div>
                                </Card>
                            ))}
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
                        正在打开 {services.find((s) => s.id === opening)?.name || "服务"}…
                    </div>
                    <div style={{ fontSize: 11.5, color: p.textDim }}>正在申请一次性票据并加载页面</div>
                </div>
            )}
        </>
    );
};
