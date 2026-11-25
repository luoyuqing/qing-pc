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

/** 主进程代理接口（preload 暴露）。没有它就只能退回浏览器 fetch。 */
interface QingHubBridge {
    request(req: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }): Promise<{ ok: boolean; status: number; body: string }>;
}

function hubBridge(): QingHubBridge | undefined {
    return (window as unknown as { qingHub?: QingHubBridge }).qingHub;
}

async function request(path: string, init?: RequestInit): Promise<any> {
    const { baseUrl, token } = loadConfig();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (init?.body) headers["Content-Type"] = "application/json; charset=utf-8";

    const url = `${baseUrl}${path}`;
    let status = 0;
    let text = "";

    try {
        const bridge = hubBridge();
        if (bridge?.request) {
            // 走 Electron 主进程：渲染进程的 origin 是 vector://vector，
            // 对公网 device-hub 属于跨域；主进程不受同源策略约束。
            const res = await bridge.request({
                url,
                method: init?.method ?? "GET",
                headers,
                body: typeof init?.body === "string" ? init.body : undefined,
            });
            status = res.status;
            text = res.body;
        } else {
            // 没有主进程代理时（例如在浏览器里调试）才用 fetch
            const response = await fetch(url, {
                ...init,
                headers,
                signal: AbortSignal.timeout(10000),
            });
            status = response.status;
            text = await response.text();
        }
    } catch (e) {
        const err = e as Error;
        const msg = err?.message || String(e);
        if (err.name === "TimeoutError" || err.name === "AbortError" || /timed out|timeout/i.test(msg)) {
            throw new HubError(`${baseUrl} 响应超时（10 秒），检查地址与网络`);
        }
        if (/Failed to fetch|NetworkError|ERR_/i.test(msg)) {
            throw new HubError(
                `无法连接 ${baseUrl}：${msg}（若地址可访问，可能是跨域被拦，PC 端应走主进程代理）`,
            );
        }
        throw new HubError(`请求 ${baseUrl} 失败：${msg}`);
    }

    if (status < 200 || status >= 300) {
        throw new HubError(`HTTP ${status} ${text.slice(0, 200)}`.trim());
    }
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export const hub = {
    health: (): Promise<any> => request("/health"),

    /** 用 6 位配对码换长期令牌，与手机端同一流程，返回 {token, device_id} */
    pair: (code: string, deviceName: string): Promise<any> =>
        request("/pair", {
            method: "POST",
            body: JSON.stringify({ code, device_name: deviceName }),
        }),

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
    switchModel: (candidate: string, persona?: string): Promise<any> =>
        // 注意参数名是 candidate，不是 key（见手机端 switchModel）
        request("/agent/model/switch", {
            method: "POST",
            body: JSON.stringify({ persona, candidate }),
        }),

    // ---- 凭据 / 插件 ----
    agentCredentials: (): Promise<any> => request("/agent/credentials"),
    agentPlugins: (): Promise<any> => request("/agent/plugins"),

    // ---- 记忆 ----
    memory: (persona?: string): Promise<any> =>
        request(`/memory${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    saveMemory: (persona: string, kind: "memory" | "profile", content: string): Promise<any> =>
        request("/memory", { method: "POST", body: JSON.stringify({ persona, kind, content }) }),
    memoryVault: (persona?: string): Promise<any> =>
        request(`/memory/vault${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    memoryVaultStatus: (): Promise<any> => request("/memory/vault/status"),

    // ---- 技能 ----
    skills: (persona?: string): Promise<any> =>
        request(`/skills${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    skillContent: (path: string, persona?: string): Promise<any> =>
        request(
            `/skills/${encodeURIComponent(path)}${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`,
        ),
    saveSkill: (path: string, persona: string, content: string): Promise<any> =>
        request(`/skills/${encodeURIComponent(path)}`, {
            method: "POST",
            body: JSON.stringify({ persona, content }),
        }),
    deleteSkill: (path: string, persona: string): Promise<any> =>
        request(`/skills/${encodeURIComponent(path)}?persona=${encodeURIComponent(persona)}`, {
            method: "DELETE",
        }),

    // ---- 人设 ----
    personas: (): Promise<any> => request("/personas"),
    persona: (persona?: string): Promise<any> =>
        request(`/persona${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    savePersona: (persona: string, key: string, content: string): Promise<any> =>
        request("/persona", { method: "POST", body: JSON.stringify({ persona, key, content }) }),

    // ---- 定时任务 ----
    routines: (persona?: string): Promise<any> =>
        request(`/routines${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    routine: (id: string, persona?: string): Promise<any> =>
        request(`/routines/${encodeURIComponent(id)}${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),
    updateRoutine: (
        id: string,
        persona: string,
        patch: { name?: string; prompt?: string; schedule?: string; enabled?: boolean },
    ): Promise<any> =>
        request(`/routines/${encodeURIComponent(id)}?persona=${encodeURIComponent(persona)}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        }),

    // ---- 连接器 / MCP ----
    connectors: (): Promise<any> => request("/connectors"),
    saveConnector: (name: string, config: any): Promise<any> =>
        request("/connectors", { method: "POST", body: JSON.stringify({ name, config }) }),
    mcpServers: (): Promise<any> => request("/mcp/servers"),
    addMcpServer: (name: string, url: string, token?: string): Promise<any> =>
        request("/mcp/servers", { method: "POST", body: JSON.stringify({ name, url, token }) }),
    deleteMcpServer: (id: number): Promise<any> => request(`/mcp/servers/${id}`, { method: "DELETE" }),
    mcpCall: (server: string, tool: string, args: any): Promise<any> =>
        request("/mcp/call", { method: "POST", body: JSON.stringify({ server, tool, args }) }),

    // ---- 数据与隐私 ----
    retention: (): Promise<any> => request("/admin/retention"),
    setRetention: (notifyDays: number, locationDays: number): Promise<any> =>
        request("/admin/retention", {
            method: "POST",
            body: JSON.stringify({ notify_days: notifyDays, location_days: locationDays }),
        }),

    // ---- 设备 / 审计 / 诊断 ----
    devices: (): Promise<any> => request("/query/devices"),
    audit: (): Promise<any> => request("/audit"),
    diagnose: (persona?: string): Promise<any> =>
        request(`/diagnose${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),

    // ---- 手机数据（Android 上报，PC 只读） ----
    notifications: (limit = 100): Promise<any> => request(`/query/notifications?limit=${limit}`),
    sms: (limit = 100): Promise<any> => request(`/query/sms?limit=${limit}`),
    calendar: (): Promise<any> => request("/query/calendar"),
    contacts: (limit = 200): Promise<any> => request(`/query/contacts?limit=${limit}`),
    deviceUsage: (date?: string): Promise<any> =>
        request(`/query/usage${date ? `?date=${encodeURIComponent(date)}` : ""}`),

    // ---- 简报历史 ----
    briefingHistory: (persona?: string): Promise<any> =>
        request(`/briefing/history${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`),

    // ---- 模型测试与端点 ----
    testModel: (key?: string, persona?: string): Promise<any> =>
        request("/agent/model/test", { method: "POST", body: JSON.stringify({ key, persona }) }),
    testFallback: (persona?: string): Promise<any> =>
        request("/agent/fallback/test", { method: "POST", body: JSON.stringify({ persona }) }),
    endpointModels: (baseUrl: string): Promise<any> =>
        request(`/agent/endpoint/models?base_url=${encodeURIComponent(baseUrl)}`),

    // ---- 凭据 / 辅助模型 ----
    setCredential: (name: string, value: string): Promise<any> =>
        request("/agent/credentials", { method: "POST", body: JSON.stringify({ name, value }) }),
    deleteCredential: (name: string): Promise<any> =>
        request(`/agent/credentials/${encodeURIComponent(name)}`, { method: "DELETE" }),
    saveAuxiliary: (persona: string, payload: any): Promise<any> =>
        request("/agent/auxiliary", { method: "POST", body: JSON.stringify({ persona, ...payload }) }),

    // ---- 候选池增删改 / 备注 / 备用链 ----
    addCandidate: (payload: any, persona: string): Promise<any> =>
        request("/agent/candidates", { method: "POST", body: JSON.stringify({ persona, ...payload }) }),
    updateCandidate: (key: string, persona: string, fields: any, scope = "persona"): Promise<any> =>
        request(
            `/agent/candidates/${encodeURIComponent(key)}?persona=${encodeURIComponent(persona)}&scope=${scope}`,
            { method: "PATCH", body: JSON.stringify(fields) },
        ),
    deleteCandidate: (key: string, persona: string, scope = "persona"): Promise<any> =>
        request(
            `/agent/candidates/${encodeURIComponent(key)}?persona=${encodeURIComponent(persona)}&scope=${scope}`,
            { method: "DELETE" },
        ),
    testCandidate: (key: string, persona: string): Promise<any> =>
        request(`/agent/candidates/${encodeURIComponent(key)}/test`, {
            method: "POST",
            body: JSON.stringify({ persona }),
        }),
    /** 只改主模型备注：同端点同模型，复用 switch 接口重写 label */
    setModelLabel: (persona: string, baseUrl: string, model: string, label: string): Promise<any> =>
        request("/agent/model/switch", {
            method: "POST",
            body: JSON.stringify({
                persona,
                base_url: baseUrl,
                model,
                label,
                provider: "custom",
                api_mode: "chat_completions",
            }),
        }),
    saveFallback: (persona: string, chain: any[]): Promise<any> =>
        request("/agent/fallback", { method: "POST", body: JSON.stringify({ persona, chain }) }),
};


/** 把接口返回的 items 安全地取成数组 */
export function itemsOf(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
}
