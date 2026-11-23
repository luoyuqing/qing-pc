/*
Qing PC · device-hub 客户端
与手机端 lib/utils/device_hub/* 使用同一套接口与 Bearer 鉴权，
保证 PC 与手机读写同一份数据。
*/

export interface HubConfig {
    baseUrl: string;
    token: string;
    persona: string;
}

export const DEFAULT_BASE_URL = "http://192.168.1.10:8787";

const STORAGE_KEY = "qing.hub.config";

export function loadConfig(): HubConfig {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<HubConfig>;
            return {
                baseUrl: (parsed.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
                token: parsed.token || "",
                persona: parsed.persona || "default",
            };
        }
    } catch {
        // 配置损坏时退回默认值，不阻塞界面
    }
    return { baseUrl: DEFAULT_BASE_URL, token: "", persona: "default" };
}

export function saveConfig(config: HubConfig): void {
    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            baseUrl: config.baseUrl.trim().replace(/\/+$/, ""),
            token: config.token.trim(),
            persona: config.persona.trim() || "default",
        }),
    );
}

export class HubError extends Error {}

async function request(path: string, init?: RequestInit): Promise<any> {
    const { baseUrl, token } = loadConfig();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (init?.body) headers["Content-Type"] = "application/json; charset=utf-8";

    let response: Response;
    try {
        response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    } catch (e) {
        throw new HubError(`无法连接 ${baseUrl}：${(e as Error).message}`);
    }
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new HubError(`HTTP ${response.status} ${body.slice(0, 200)}`.trim());
    }
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export const hub = {
    health: (): Promise<any> => request("/health"),

    briefingDay: (date: string): Promise<any> => request(`/briefing/day?date=${encodeURIComponent(date)}`),

    requestBriefing: (kind?: string): Promise<any> =>
        request("/briefing/request", { method: "POST", body: JSON.stringify(kind ? { kind } : {}) }),

    setTodoDone: (id: number, done: boolean): Promise<any> =>
        request(`/todos/${id}`, { method: "PATCH", body: JSON.stringify({ done }) }),

    routines: (persona: string): Promise<any> => request(`/routines?persona=${encodeURIComponent(persona)}`),

    sessions: (persona: string, limit = 30): Promise<any> =>
        request(`/tasks/sessions?persona=${encodeURIComponent(persona)}&limit=${limit}`),

    sessionMessages: (id: string, persona: string, limit = 120): Promise<any> =>
        request(`/tasks/sessions/${encodeURIComponent(id)}/messages?persona=${encodeURIComponent(persona)}&limit=${limit}`),

    memoryBundle: (persona: string): Promise<any> => request(`/memory/bundle?persona=${encodeURIComponent(persona)}`),

    // 服务目录：与手机端 services_page.dart 一致
    serviceCatalog: (): Promise<any> => request("/svc/catalog"),

    serviceFavs: (): Promise<any> => request("/svc/fav/list"),

    serviceTicket: (serviceId: string): Promise<any> =>
        request("/svc/ticket", { method: "POST", body: JSON.stringify({ service_id: serviceId }) }),
};

/** 把接口返回的 items 安全地取成数组 */
export function itemsOf(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
}
