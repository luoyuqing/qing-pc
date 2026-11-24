/*
Qing PC · 服务
目录由 device-hub 下发（GET /svc/catalog），点本机服务先换 60 秒一次性票据再打开。
外网收藏走 /svc/fav/list，直接打开。
与手机端 services_page.dart 同一套接口与域名白名单。
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub, itemsOf } from "../hub";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

const ALLOWED_HOST = "3585616.xyz";

function isAllowedHost(host: string): boolean {
    const h = host.toLowerCase();
    return h === ALLOWED_HOST || h.endsWith(`.${ALLOWED_HOST}`);
}

/**
 * 本机服务：交给内置窗口（主进程开），票据 URL 不进系统浏览器的地址栏和历史。
 * 手机端同样是用内置 WebView 打开的，这里保持一致。
 */
function openServiceWindow(url: string): void {
    const bridge = (window as unknown as { qingOpenService?: (u: string) => Promise<boolean> }).qingOpenService;
    if (typeof bridge === "function") {
        void bridge(url).catch((e: Error) => window.alert(`打开失败：${e.message}`));
        return;
    }
    // 只有在没有主进程能力（例如浏览器里调试）时才退回系统浏览器
    window.open(url, "_blank", "noopener,noreferrer");
}

/** 外网收藏本身就是公网页面，交给系统浏览器即可 */
function openExternal(url: string): void {
    window.open(url, "_blank", "noopener,noreferrer");
}

const GROUP_TITLES: Record<string, string> = {
    local: "本机服务",
    web: "外网服务",
};

export const ServicesPage: React.FC = () => {
    const [services, setServices] = useState<any[]>([]);
    const [favs, setFavs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [catalog, favList] = await Promise.all([hub.serviceCatalog(), hub.serviceFavs()]);
            // /svc/catalog 返回的是 {services:[...]}，不是 {items:[...]}；
            // 之前用 itemsOf() 解析，拿到空数组，本机服务整组丢失。
            const list: any[] = Array.isArray(catalog)
                ? catalog
                : Array.isArray(catalog?.services)
                  ? catalog.services
                  : itemsOf(catalog);
            setServices(
                list.filter((item) => {
                    const host = `${item.hostname || ""}`;
                    return !host || isAllowedHost(host);
                }),
            );
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
        setBusy(service.id);
        setError(null);
        try {
            const data = await hub.serviceTicket(`${service.id}`);
            const url = `${data?.url || ""}`;
            if (!url) throw new Error("服务端未返回入口地址");
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
                throw new Error("服务端返回的入口地址不在白名单内");
            }
            openServiceWindow(url);
        } catch (e) {
            setError((e as Error).message);
        }
        setBusy(null);
    };

    const groups: { key: string; items: any[] }[] = [];
    for (const item of services) {
        const key = `${item.group || "local"}`;
        const bucket = groups.find((g) => g.key === key);
        if (bucket) bucket.items.push(item);
        else groups.push({ key, items: [item] });
    }

    return (
        <>
            <PageHeader
                title="服务"
                subtitle="本机服务与外网收藏，目录由服务端下发"
                right={<Button onClick={() => setTick((t) => t + 1)}>刷新</Button>}
            />
            {loading ? (
                <Loading />
            ) : error && services.length === 0 ? (
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

                    {groups.length === 0 && favs.length === 0 && <Empty text="服务目录为空。" />}

                    {groups.map((group) => (
                        <div key={group.key} style={{ marginBottom: 22 }}>
                            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8 }}>
                                {GROUP_TITLES[group.key] || group.key}
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: 10,
                                }}
                            >
                                {group.items.map((item) => (
                                    <Card
                                        key={item.id}
                                        onClick={() => void openService(item)}
                                        style={{ opacity: busy === item.id ? 0.6 : 1 }}
                                    >
                                        <div style={{ fontSize: 14, fontWeight: 600, color: p.text }}>
                                            {item.name || item.id}
                                        </div>
                                        {item.desc && (
                                            <div style={{ fontSize: 12, color: p.textDim, marginTop: 4 }}>
                                                {item.desc}
                                            </div>
                                        )}
                                        {busy === item.id && (
                                            <div style={{ fontSize: 11, color: p.accent, marginTop: 6 }}>换票中…</div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}

                    {favs.length > 0 && (
                        <div>
                            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8 }}>外网收藏</div>
                            {favs.map((fav, i) => (
                                <Card
                                    key={fav.id ?? i}
                                    onClick={() => fav.url && openExternal(`${fav.url}`)}
                                    style={{ marginBottom: 8, padding: "11px 14px" }}
                                >
                                    <div style={{ fontSize: 13.5, color: p.text }}>{fav.name || fav.url}</div>
                                    <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>{fav.url}</div>
                                </Card>
                            ))}
                        </div>
                    )}
                </Scroll>
            )}
        </>
    );
};
