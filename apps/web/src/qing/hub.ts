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
        // 必须有超时：device-hub 不可达时 TCP 可能长时间挂起，
        // 没有 signal 的话页面会永远停在「加载中」。
        response = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers,
            signal: AbortSignal.timeout(10000),
        });
    } catch (e) {
        const err = e as Error;
        if (err.name === "TimeoutError" || err.name === "AbortError") {
            throw new HubError(`${baseUrl} 响应超时（10 秒），检查地址与网络`);
        }
        throw new HubError(`无法连接 ${baseUrl}：${err.message}`);
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

    // ---- 服务器 ----
    serverStatus: (): Promise<any> => request("/server/status"),
    serverHistory: (range = "24h"): Promise<any> => request(`/server/history?range=${encodeURIComponent(range)}`),
    serverServiceDetail: (key: string): Promise<any> => request(`/server/service?key=${encodeURIComponent(key)}`),

    // ---- 用量 ----
    usageSummary: (): Promise<any> => request("/usage/summary"),

    // ---- 模型与推理 ----
    agentModel: (persona?: string): Promise<any> =>
        request(`/agent/model${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    agentCandidates: (persona?: string): Promise<any> =>
        request(`/agent/candidates${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    agentFallback: (persona?: string): Promise<any> =>
        request(`/agent/fallback${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    agentAuxiliary: (persona?: string): Promise<any> =>
        request(`/agent/auxiliary${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    switchModel: (key: string, persona?: string): Promise<any> =>
        request("/agent/model/switch", { method: "POST", body: JSON.stringify({ key, persona }) }),

    // ---- 凭据 / 插件 ----
    agentCredentials: (): Promise<any> => request("/agent/credentials"),
    agentPlugins: (): Promise<any> => request("/agent/plugins"),

    // ---- 记忆 ----
    memory: (persona?: string): Promise<any> =>
        request(`/memory${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    memoryVault: (persona?: string): Promise<any> =>
        request(`/memory/vault${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    memoryVaultStatus: (): Promise<any> => request("/memory/vault/status"),

    // ---- 人设 / 技能 ----
    personas: (): Promise<any> => request("/personas"),
    persona: (persona?: string): Promise<any> =>
        request(`/persona${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    skills: (persona?: string): Promise<any> =>
        request(`/skills${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),

    // ---- 连接器 / MCP ----
    connectors: (): Promise<any> => request("/connectors"),
    mcpServers: (): Promise<any> => request("/mcp/servers"),
    mcpCall: (server: string, tool: string, args: any): Promise<any> =>
        request("/mcp/call", { method: "POST", body: JSON.stringify({ server, tool, args }) }),

    // ---- 设备 / 审计 / 诊断 ----
    devices: (): Promise<any> => request("/query/devices"),
    audit: (): Promise<any> => request("/audit"),
    diagnose: (): Promise<any> => request("/diagnose"),
    retention: (): Promise<any> => request("/admin/retention"),
};


/** 把接口返回的 items 安全地取成数组 */
export function itemsOf(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
}
