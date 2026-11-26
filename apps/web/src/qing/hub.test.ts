/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_BASE_URL, HubError, hub, itemsOf, loadConfig, saveConfig } from "./hub";

describe("device-hub protocol", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "qingHub");
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("keeps the default endpoint when saved configuration is invalid", () => {
        for (const value of ["null", "{", '{"baseUrl":42,"token":{},"persona":[]}']) {
            localStorage.setItem("qing.hub.config", value);
            expect(loadConfig()).toEqual({ baseUrl: DEFAULT_BASE_URL, token: "", persona: "default" });
        }
    });

    it("normalizes saved values", () => {
        saveConfig({ baseUrl: " https://hub.example/// ", token: " token ", persona: " " });
        expect(loadConfig()).toEqual({ baseUrl: "https://hub.example", token: "token", persona: "default" });
    });

    it("pairs with the newly entered endpoint without sending the previous token", async () => {
        saveConfig({ baseUrl: "https://old.example", token: "old-secret", persona: "default" });
        await hub.pair("123456", "Qing PC", "https://new.example");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://new.example/pair");
        expect(init?.headers).not.toHaveProperty("Authorization");
        expect(init?.body).toBe(JSON.stringify({ code: "123456", device_name: "Qing PC" }));
        expect(loadConfig().baseUrl).toBe("https://old.example");
    });

    it("uses the mobile retention PATCH protocol", async () => {
        await hub.setRetention(30, 14);
        expect(fetchMock).toHaveBeenCalledWith(
            `${DEFAULT_BASE_URL}/admin/retention`,
            expect.objectContaining({
                method: "PATCH",
                body: JSON.stringify({ notify_days: 30, location_days: 14 }),
            }),
        );
    });

    it("encodes the credential name in the query", async () => {
        await hub.deleteCredential("A&B KEY");
        expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_BASE_URL}/agent/credentials?name=A%26B%20KEY&force=0`);
    });

    it("preserves pagination cursors and persona identifiers", async () => {
        await hub.sessionMessages("s/1", "p&1", 120, "older:1/2");
        expect(fetchMock.mock.calls[0][0]).toBe(
            `${DEFAULT_BASE_URL}/tasks/sessions/s%2F1/messages?persona=p%261&limit=120&before=older%3A1%2F2`,
        );
    });

    it("sends authorization and has a bounded request lifetime", async () => {
        saveConfig({ baseUrl: DEFAULT_BASE_URL, token: "test", persona: "default" });
        await hub.health();
        expect(fetchMock.mock.calls[0][1]?.headers).toHaveProperty("Authorization", "Bearer test");
        expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it("preserves HTTP status for compatibility handling", async () => {
        fetchMock.mockResolvedValueOnce(new Response("unsupported", { status: 404 }));
        await expect(hub.memoryBundle("default")).rejects.toMatchObject({ status: 404 });
    });

    it("turns network failures into actionable errors", async () => {
        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        await expect(hub.health()).rejects.toBeInstanceOf(HubError);
    });

    it("rejects non-HTTP endpoints before making a request", async () => {
        await expect(hub.health("file:///etc/passwd")).rejects.toThrow("HTTP");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("handles empty and malformed list envelopes", () => {
        expect(itemsOf(null)).toEqual([]);
        expect(itemsOf({ items: "wrong" })).toEqual([]);
        expect(itemsOf({ items: [1, 2] })).toEqual([1, 2]);
    });
    it.each([
        ["briefing day", () => hub.briefingDay("2026-11-25"), "/briefing/day?date=2026-11-25"],
        ["sessions", () => hub.sessions("office"), "/tasks/sessions?persona=office&limit=30"],
        ["memory bundle", () => hub.memoryBundle("office"), "/memory/bundle?persona=office"],
        ["agent bundle", () => hub.agentBundle("office"), "/agent/bundle?persona=office"],
        ["catalog", () => hub.serviceCatalog(), "/svc/catalog"],
        ["favorites", () => hub.serviceFavs(), "/svc/fav/list"],
        ["vault note", () => hub.vaultNote("office", "fact.md"), "/memory/vault/note?persona=office&name=fact.md"],
        ["routine history", () => hub.routineHistory("job", "office"), "/routines/job/history?persona=office&limit=20"],
        ["digest", () => hub.sessionDigest("office"), "/tasks/sessions/digest?persona=office"],
        ["connector catalog", () => hub.connectorCatalog(), "/catalog"],
        ["server status", () => hub.serverStatus(), "/server/status"],
        ["server history", () => hub.serverHistory("24h"), "/server/history?range=24h"],
        ["service details", () => hub.serverServiceDetail("db"), "/server/service?key=db"],
        ["usage", () => hub.usageSummary("30d"), "/usage/summary?range=30d"],
        ["model", () => hub.agentModel("office"), "/agent/model?persona=office"],
        ["candidates", () => hub.agentCandidates("office"), "/agent/candidates?persona=office"],
        ["fallback", () => hub.agentFallback("office"), "/agent/fallback?persona=office"],
        ["auxiliary", () => hub.agentAuxiliary("office"), "/agent/auxiliary?persona=office"],
        ["credential references", () => hub.agentCredentials(true), "/agent/credentials?with_refs=1"],
        ["plugins", () => hub.agentPlugins(), "/agent/plugins"],
        ["memory", () => hub.memory("office"), "/memory?persona=office"],
        ["vault search", () => hub.memoryVault("office", "tea"), "/memory/vault?persona=office&q=tea&limit=300"],
        ["vault index", () => hub.memoryVaultStatus("office"), "/memory/vault/status?persona=office"],
        ["skills", () => hub.skills("office"), "/skills?persona=office"],
        ["skill text", () => hub.skillContent("daily.md", "office"), "/skills/daily.md?persona=office"],
        ["personas", () => hub.personas(), "/personas"],
        ["persona", () => hub.persona("office"), "/persona?persona=office"],
        ["routines", () => hub.routines("office"), "/routines?persona=office"],
        ["routine", () => hub.routine("job", "office"), "/routines/job?persona=office"],
        ["connectors", () => hub.connectors(), "/connectors"],
        ["MCP servers", () => hub.mcpServers(), "/mcp/servers"],
        ["retention", () => hub.retention(), "/admin/retention"],
        ["devices", () => hub.devices(), "/query/devices"],
        ["audit", () => hub.audit(), "/audit"],
        ["diagnose", () => hub.diagnose("office"), "/diagnose?persona=office"],
        ["notifications", () => hub.notifications(200), "/query/notifications?limit=200"],
        ["SMS", () => hub.sms(200), "/query/sms?limit=200"],
        ["calendar", () => hub.calendar(), "/query/calendar"],
        ["contacts", () => hub.contacts(300), "/query/contacts?limit=300"],
        ["device usage", () => hub.deviceUsage("2026-11-25"), "/query/usage?date=2026-11-25"],
        ["briefing history", () => hub.briefingHistory("office"), "/briefing/history?persona=office"],
        [
            "endpoint discovery",
            () => hub.endpointModels("https://api.test", "KEY"),
            "/agent/endpoint/models?base_url=https%3A%2F%2Fapi.test&key_env=KEY",
        ],
    ] satisfies [string, () => Promise<unknown>, string][])(
        "reads %s using the mobile endpoint",
        async (_name, action, path) => {
            await action();
            expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_BASE_URL}${path}`);
        },
    );

    it.each([
        [() => hub.requestBriefing("morning"), "/briefing/request", "POST", { kind: "morning" }],
        [() => hub.setTodoDone(4, true), "/todos/4", "PATCH", { done: true }],
        [() => hub.serviceTicket("web"), "/svc/ticket", "POST", { service_id: "web" }],
        [
            () => hub.serviceFavAdd("Docs", "https://docs.test"),
            "/svc/fav/add",
            "POST",
            { name: "Docs", url: "https://docs.test", icon: "" },
        ],
        [() => hub.serviceFavDelete(2), "/svc/fav/del", "POST", { id: 2 }],
        [() => hub.serviceFavOrder([2, 1]), "/svc/fav/order", "POST", { ids: [2, 1] }],
        [() => hub.serviceOrder(["b", "a"]), "/svc/order", "POST", { ids: ["b", "a"] }],
        [
            () => hub.saveVaultNote("office", "fact.md", "tea"),
            "/memory/vault/note",
            "POST",
            { persona: "office", name: "fact.md", content: "tea" },
        ],
        [() => hub.runRoutine("job", "office"), "/routines/job/run", "POST", { persona: "office" }],
        [() => hub.refreshMcpServer(3), "/mcp/servers/3/refresh", "POST", {}],
        [
            () => hub.callConnector("weather", { city: "Tokyo" }),
            "/connectors/weather/call",
            "POST",
            { params: { city: "Tokyo" } },
        ],
        [() => hub.switchModel("m1", "office"), "/agent/model/switch", "POST", { persona: "office", candidate: "m1" }],
        [
            () => hub.saveMemory("office", "profile", "preferences"),
            "/memory",
            "POST",
            { persona: "office", kind: "profile", content: "preferences" },
        ],
        [
            () => hub.saveSkill("skill.md", "office", "daily"),
            "/skills/skill.md",
            "POST",
            { persona: "office", content: "daily" },
        ],
        [
            () => hub.savePersona("office", "prompt", "helpful"),
            "/persona",
            "POST",
            { persona: "office", key: "prompt", content: "helpful" },
        ],
        [
            () => hub.updateRoutine("job", "office", { enabled: false }),
            "/routines/job?persona=office",
            "PATCH",
            { enabled: false },
        ],
        [
            () => hub.saveConnector("weather", { key: "secret" }),
            "/connectors",
            "POST",
            { name: "weather", config: { key: "secret" } },
        ],
        [
            () => hub.addMcpServer("tools", "https://tools.test", "token"),
            "/mcp/servers",
            "POST",
            { name: "tools", url: "https://tools.test", token: "token" },
        ],
        [
            () => hub.mcpCall(2, "search", { query: "tea" }),
            "/mcp/call",
            "POST",
            { server_id: 2, tool: "search", arguments: { query: "tea" } },
        ],
        [() => hub.testModel("m1", "office"), "/agent/model/test", "POST", { key: "m1", persona: "office" }],
        [() => hub.testFallback("office"), "/agent/fallback/test", "POST", { persona: "office" }],
        [() => hub.setCredential("KEY", "secret"), "/agent/credentials", "POST", { name: "KEY", value: "secret" }],
        [
            () => hub.saveAuxiliary("office", { key: "compression" }),
            "/agent/auxiliary",
            "POST",
            { persona: "office", key: "compression" },
        ],
        [
            () => hub.addCandidate({ key: "m1" }, "office"),
            "/agent/candidates",
            "POST",
            { persona: "office", key: "m1" },
        ],
        [
            () => hub.updateCandidate("m1", "office", { label: "label" }, "all"),
            "/agent/candidates/m1?persona=office&scope=all",
            "PATCH",
            { label: "label" },
        ],
        [() => hub.testCandidate("m1", "office"), "/agent/candidates/m1/test", "POST", { persona: "office" }],
        [
            () => hub.setModelLabel("office", "https://api.test", "m1", "label"),
            "/agent/model/switch",
            "POST",
            {
                persona: "office",
                base_url: "https://api.test",
                model: "m1",
                label: "label",
                provider: "custom",
                api_mode: "chat_completions",
            },
        ],
        [() => hub.saveFallback("office", []), "/agent/fallback", "POST", { persona: "office", chain: [] }],
    ] satisfies [() => Promise<unknown>, string, string, Record<string, unknown>][])(
        "writes the mobile payload to %s",
        async (action, path, method, body) => {
            await action();
            expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_BASE_URL}${path}`);
            expect(fetchMock.mock.calls[0][1]?.method).toBe(method);
            const payload = fetchMock.mock.calls[0][1]?.body;
            expect(typeof payload).toBe("string");
            expect(JSON.parse(payload as string)).toEqual(body);
        },
    );

    it("encodes all destructive resource identifiers", async () => {
        await hub.deleteVaultNote("office", "file/name");
        expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
            `${DEFAULT_BASE_URL}/memory/vault/note?persona=office&name=file%2Fname`,
        );
        await hub.revokeDevice("phone/1");
        expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${DEFAULT_BASE_URL}/devices/phone%2F1`);
        await hub.deleteMcpServer(3);
        expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${DEFAULT_BASE_URL}/mcp/servers/3`);
        await hub.deleteRoutine("job/1", "office");
        expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${DEFAULT_BASE_URL}/routines/job%2F1?persona=office`);
        expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("DELETE");
        await hub.deleteCandidate("key/1", "office");
        expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
            `${DEFAULT_BASE_URL}/agent/candidates/key%2F1?persona=office&scope=persona`,
        );
        await hub.deleteSkill("skill/name", "office");
        expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${DEFAULT_BASE_URL}/skills/skill%2Fname?persona=office`);
    });

    it("forwards long task timeouts and authorization through Electron", async () => {
        const bridge = vi.fn(async () => ({ status: 200, ok: true, body: "{}" }));
        Object.defineProperty(window, "qingHub", { configurable: true, value: { request: bridge } });
        saveConfig({ baseUrl: DEFAULT_BASE_URL, token: "secret", persona: "office" });
        await hub.saveAuxiliary("office", { model: "m1" });
        expect(bridge).toHaveBeenCalledWith(
            expect.objectContaining({
                timeoutMs: 200000,
                headers: expect.objectContaining({ Authorization: "Bearer secret" }),
            }),
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
