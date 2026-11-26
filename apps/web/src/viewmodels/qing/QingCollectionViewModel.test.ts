/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { registerTranslations, setLocale } from "@element-hq/web-shared-components";
import translations from "../../i18n/strings/zh_Hans.json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QingCollectionViewModel, type QingResource } from "./QingCollectionViewModel";
import { hub } from "../../qing/hub";

describe("Qing collection workflows", () => {
    const models: QingCollectionViewModel[] = [];
    const back = vi.fn();

    beforeEach(() => {
        registerTranslations("zh", translations);
        setLocale("zh");
        const methods: Record<string, (...args: never[]) => Promise<unknown>> = hub;
        for (const key of Object.keys(methods)) vi.spyOn(methods, key).mockResolvedValue({ items: [] });
    });
    afterEach(() => {
        for (const vm of models.splice(0)) vm.dispose();
        vi.useRealTimers();
        vi.restoreAllMocks();
        setLocale("en");
        back.mockClear();
    });

    async function open(resource: QingResource): Promise<QingCollectionViewModel> {
        const vm = new QingCollectionViewModel({ resource, persona: "office", id: "job/1", onBack: back });
        models.push(vm);
        vm.refresh();
        await vi.waitFor(() => expect(vm.getSnapshot().loading).toBe(false));
        return vm;
    }

    it("loads and edits a vault fact without duplicating its server metadata", async () => {
        vi.mocked(hub.memoryVault).mockResolvedValue({ items: [{ name: "fact.md", title: "偏好" }] });
        vi.mocked(hub.vaultNote).mockResolvedValue({ content: "# 旧标题\ncreated_at: yesterday\n\n喜欢茶" });
        const vm = await open("vault");
        vm.activate("fact.md", "open");
        await vi.waitFor(() => expect(vm.getSnapshot().editing).toBe(true));
        expect(vm.getSnapshot().fields[0].value).toBe("喜欢茶");
        vm.setField("content", "偏好\n喜欢绿茶");
        vm.save();
        await vi.waitFor(() => expect(hub.saveVaultNote).toHaveBeenCalledWith("office", "fact.md", "偏好\n喜欢绿茶"));
        await vi.waitFor(() => expect(vm.getSnapshot().editing).toBe(false));
    });

    it("confirms a vault deletion and preserves the chosen persona", async () => {
        vi.mocked(hub.memoryVault).mockResolvedValue({ items: [{ name: "note.md" }] });
        vi.mocked(hub.vaultNote).mockResolvedValue({ content: "正文" });
        const vm = await open("vault");
        vm.activate("note.md", "open");
        await vi.waitFor(() => expect(vm.getSnapshot().busy).toBe(false));
        vm.toolbar("delete-note");
        vm.confirm(false);
        expect(hub.deleteVaultNote).not.toHaveBeenCalled();
        vm.toolbar("delete-note");
        vm.confirm(true);
        await vi.waitFor(() => expect(hub.deleteVaultNote).toHaveBeenCalledWith("office", "note.md"));
    });

    it("debounces vault queries and releases its pending timer on disposal", async () => {
        const vm = await open("vault");
        vi.useFakeTimers();
        vm.search("茶");
        vm.search("绿茶");
        await vi.advanceTimersByTimeAsync(250);
        expect(hub.memoryVault).toHaveBeenLastCalledWith("office", "绿茶");
        vm.search("待取消");
        vm.dispose();
        await vi.advanceTimersByTimeAsync(250);
        expect(hub.memoryVault).toHaveBeenCalledTimes(2);
    });

    it("ignores a response arriving after the resource was disposed", async () => {
        let resolve: (value: unknown) => void = () => undefined;
        vi.mocked(hub.memoryVault).mockReturnValue(
            new Promise((done) => {
                resolve = done;
            }),
        );
        const vm = new QingCollectionViewModel({ resource: "vault", persona: "office", onBack: back });
        vm.refresh();
        vm.dispose();
        resolve({ items: [{ name: "late.md" }] });
        await Promise.resolve();
        await Promise.resolve();
        expect(vm.getSnapshot().rows).toEqual([]);
    });

    it("warns before leaving unsaved edits", async () => {
        const vm = await open("favorites");
        vm.toolbar("add-favorite");
        vm.setField("name", "待保存");
        vm.back();
        expect(vm.getSnapshot().confirmation).toContain("未保存");
        vm.confirm(false);
        expect(vm.getSnapshot().editing).toBe(true);
        vm.back();
        vm.confirm(true);
        expect(vm.getSnapshot().editing).toBe(false);
    });

    it("edits a weekly schedule and runs the saved routine", async () => {
        vi.mocked(hub.routine).mockResolvedValue({
            job: { name: "晨报", prompt: "总结日程", schedule: "30 7 * * *", enabled: true },
        });
        const vm = await open("routine");
        vm.setField("mode", "weekly");
        vm.setField("weekday", "3");
        vm.setField("time", "08:10");
        vm.toolbar("run");
        expect(vm.getSnapshot().error).toContain("先保存");
        vm.save();
        await vi.waitFor(() =>
            expect(hub.updateRoutine).toHaveBeenCalledWith("job/1", "office", {
                name: "晨报",
                prompt: "总结日程",
                schedule: "10 8 * * 3",
                enabled: true,
            }),
        );
        await vi.waitFor(() => expect(vm.getSnapshot().busy).toBe(false));
        vm.toolbar("run");
        vm.confirm(true);
        await vi.waitFor(() => expect(hub.runRoutine).toHaveBeenCalledWith("job/1", "office"));
        await vi.waitFor(() => expect(vm.getSnapshot().busy).toBe(false));

        vm.toolbar("delete-routine");
        vm.confirm(true);
        await vi.waitFor(() => expect(hub.deleteRoutine).toHaveBeenCalledWith("job/1", "office"));
        await vi.waitFor(() => expect(back).toHaveBeenCalled());
    });

    it("rejects invalid routine fields without submitting", async () => {
        vi.mocked(hub.routine).mockResolvedValue({
            job: { name: "任务", prompt: "做事", schedule: "0 7 * * *", enabled: false },
        });
        const vm = await open("routine");
        vm.setField("mode", "custom");
        vm.setField("schedule", "70 30 * * *");
        vm.save();
        await vi.waitFor(() => expect(vm.getSnapshot().error).toContain("有效"));
        expect(hub.updateRoutine).not.toHaveBeenCalled();
    });

    it("keeps a routine editable if execution history is unavailable", async () => {
        vi.mocked(hub.routine).mockResolvedValue({ job: { name: "任务", prompt: "内容", schedule: "15 * * * *" } });
        vi.mocked(hub.routineHistory).mockRejectedValue(new Error("offline"));
        const vm = await open("routine");
        expect(vm.getSnapshot().editing).toBe(true);
        expect(vm.getSnapshot().error).toContain("执行历史");
    });

    it("requires confirmation to revoke an active device", async () => {
        vi.mocked(hub.devices).mockResolvedValue({
            items: [
                { id: "phone", name: "手机", revoked: 0 },
                { id: "old", revoked: 1 },
            ],
        });
        const vm = await open("devices");
        expect(vm.getSnapshot().rows[1].actions).toEqual([]);
        vm.activate("phone", "revoke");
        expect(hub.revokeDevice).not.toHaveBeenCalled();
        vm.confirm(true);
        await vi.waitFor(() => expect(hub.revokeDevice).toHaveBeenCalledWith("phone"));
    });

    it("filters audit records by their actor", async () => {
        vi.mocked(hub.audit).mockResolvedValue({
            items: [
                { id: 1, actor: "hermes", action: "query.calendar" },
                { id: 2, actor: "phone" },
            ],
        });
        const vm = await open("audit");
        vm.search("hermes");
        expect(vm.getSnapshot().rows).toHaveLength(1);
        expect(vm.getSnapshot().rows[0].meta).toContain("hermes");
    });

    it("formats vault index status as human summary while keeping raw JSON", async () => {
        vi.mocked(hub.memoryVault).mockResolvedValue({
            items: [{ name: "rule.md", title: "规则", content: "# 规则\n\n第一条内容", updated_at: "2026-11-26" }],
        });
        vi.mocked(hub.memoryVaultStatus).mockResolvedValue({
            ok: true,
            coverage: 99,
            files: 167,
            total: 168,
            entities: 4691,
            pending: 0,
            failed: 0,
        });
        const vm = await open("vault");
        expect(vm.getSnapshot().rows[0].description).toBe("第一条内容");
        expect(vm.getSnapshot().rows[0].meta).toBe("2026-11-26");
        vm.toolbar("index");
        await vi.waitFor(() => expect(vm.getSnapshot().result).toContain("索引正常"));
        expect(vm.getSnapshot().result).toContain("覆盖率 99%");
        expect(vm.getSnapshot().rawResult).toContain('"entities": 4691');
    });

    it("shows diagnosis details", async () => {
        vi.mocked(hub.diagnose).mockResolvedValue({
            items: [{ key: "matrix", label: "聊天服务", detail: "连接正常", status: "good" }],
        });
        const vm = await open("diagnose");
        expect(vm.getSnapshot().rows[0].description).toContain("连接正常");
    });

    it("validates a favorite URL and then saves it", async () => {
        const vm = await open("favorites");
        vm.toolbar("add-favorite");
        vm.setField("name", "文档");
        vm.setField("url", "file:///tmp/doc");
        vm.save();
        await vi.waitFor(() => expect(vm.getSnapshot().busy).toBe(false));
        expect(hub.serviceFavAdd).not.toHaveBeenCalled();
        vm.setField("url", "https://docs.example/");
        vm.save();
        await vi.waitFor(() => expect(hub.serviceFavAdd).toHaveBeenCalledWith("文档", "https://docs.example/"));
    });

    it("reorders the complete favorite list even while searching", async () => {
        vi.mocked(hub.serviceFavs).mockResolvedValue({
            items: [
                { id: 1, name: "甲" },
                { id: 2, name: "乙" },
            ],
        });
        const vm = await open("favorites");
        vm.search("乙");
        vm.activate("2", "up");
        await vi.waitFor(() => expect(hub.serviceFavOrder).toHaveBeenCalledWith([2, 1]));
    });

    it("edits a candidate in the selected scope", async () => {
        vi.mocked(hub.agentBundle).mockResolvedValue({
            candidates: [{ key: "one", model: "m1", base_url: "https://api.example/" }],
        });
        const vm = await open("models");
        vm.activate("one", "candidate");
        vm.setField("model", "m2");
        vm.setField("scope", "all");
        vm.save();
        await vi.waitFor(() =>
            expect(hub.updateCandidate).toHaveBeenCalledWith(
                "one",
                "office",
                expect.objectContaining({ model: "m2" }),
                "all",
            ),
        );
    });

    it("writes auxiliary model settings using the mobile payload", async () => {
        vi.mocked(hub.agentBundle).mockResolvedValue({
            auxiliary: [{ key: "compression", model: "small", base_url: "https://api.example/" }],
        });
        const vm = await open("models");
        vm.activate("compression", "auxiliary");
        vm.setField("scope", "all");
        vm.save();
        await vi.waitFor(() =>
            expect(hub.saveAuxiliary).toHaveBeenCalledWith(
                "office",
                expect.objectContaining({ key: "compression", scope: "all" }),
            ),
        );
    });

    it("resolves fallback identifiers to model endpoint records", async () => {
        vi.mocked(hub.agentBundle).mockResolvedValue({
            candidates: [{ key: "backup", model: "small", base_url: "https://api.example/", key_env: "KEY" }],
        });
        const vm = await open("models");
        vm.toolbar("fallback");
        vm.setField("chain", "backup");
        vm.save();
        await vi.waitFor(() =>
            expect(hub.saveFallback).toHaveBeenCalledWith("office", [
                { provider: "custom", model: "small", base_url: "https://api.example/", key_env: "KEY" },
            ]),
        );
    });

    it("loads endpoint models into a selectable field", async () => {
        vi.mocked(hub.agentBundle).mockResolvedValue({ candidates: [{ key: "a", base_url: "https://api.example/" }] });
        vi.mocked(hub.endpointModels).mockResolvedValue({ models: ["small", "large"] });
        const vm = await open("models");
        vm.activate("a", "candidate");
        vm.toolbar("endpoint-models");
        await vi.waitFor(() =>
            expect(vm.getSnapshot().fields.find((field) => field.id === "model")?.options).toHaveLength(2),
        );
    });

    it("connects a catalog entry with its server-defined fields", async () => {
        vi.mocked(hub.connectorCatalog).mockResolvedValue({
            items: [{ id: "mail", name: "邮箱", mode: "native", fields: [{ key: "address", label: "地址" }] }],
        });
        const vm = await open("connectors");
        vm.toolbar("catalog");
        vm.activate("mail", "configure");
        vm.setField("address", "user@example.org");
        vm.save();
        await vi.waitFor(() => expect(hub.saveConnector).toHaveBeenCalledWith("mail", { address: "user@example.org" }));
    });

    it("adds an MCP server and can refresh its tools", async () => {
        vi.mocked(hub.mcpServers).mockResolvedValue({ items: [{ id: 4, name: "文档", tools: [] }] });
        const vm = await open("connectors");
        vm.toolbar("add-mcp");
        vm.setField("name", "文档");
        vm.setField("url", "https://mcp.example/");
        vm.save();
        await vi.waitFor(() =>
            expect(hub.addMcpServer).toHaveBeenCalledWith("文档", "https://mcp.example/", undefined),
        );
        await vi.waitFor(() => expect(vm.getSnapshot().busy).toBe(false));
        vm.activate("4", "refresh");
        await vi.waitFor(() => expect(hub.refreshMcpServer).toHaveBeenCalledWith(4));
    });

    it("calls an MCP tool and keeps its result visible", async () => {
        vi.mocked(hub.mcpServers).mockResolvedValue({
            items: [{ id: 9, tools: [{ name: "search", description: "搜索" }] }],
        });
        vi.mocked(hub.mcpCall).mockResolvedValue({ result: "找到了" });
        const vm = await open("connectors");
        vm.activate("9", "tools");
        vm.setField("arguments", '{"q":"茶"}');
        vm.save();
        await vi.waitFor(() => expect(hub.mcpCall).toHaveBeenCalledWith(9, "search", { q: "茶" }));
        await vi.waitFor(() => expect(vm.getSnapshot().busy).toBe(false));
        expect(vm.getSnapshot().result).toContain("找到了");
        expect(vm.getSnapshot().editing).toBe(true);
    });
});
