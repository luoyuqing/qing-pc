/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { registerTranslations, setLocale } from "@element-hq/web-shared-components";

import translations from "../../i18n/strings/zh_Hans.json";
import { hub, HubError, saveConfig, loadConfig } from "../hub";
import { invalidatePersonaCache } from "../PersonaPicker";
import { favoriteKey } from "../favorites";
import { TasksPage } from "./TasksPage";
import { BriefingPage } from "./BriefingPage";
import { MemoryPage } from "./MemoryPage";
import { ModelPage } from "./ModelPage";
import { UsagePage } from "./UsagePage";
import { ServicesPage } from "./ServicesPage";
import { SettingsPage } from "./SettingsPage";
import { CredentialsPage } from "./CredentialsPage";
import { PluginsPage } from "./PluginsPage";
import { DeviceDataPage } from "./DeviceDataPage";
import { PrivacyPage } from "./PrivacyPage";
import { ServerPage } from "./ServerPage";
import { UserTab } from "../../components/views/dialogs/UserTab";
import { Action } from "../../dispatcher/actions";
import dis from "../../dispatcher/dispatcher";

const { client, pause, windowOpen } = vi.hoisted(() => ({
    client: { getUserId: () => "@test:matrix", getRoom: vi.fn(), sendTextMessage: vi.fn() },
    pause: vi.fn(),
    windowOpen: vi.fn(),
}));
vi.mock("../../MatrixClientPeg", () => ({ MatrixClientPeg: { get: () => client } }));
vi.mock("../delay", () => ({ delay: pause }));
vi.mock("../QingPanel", () => ({ QingPanel: ({ resource }: { resource: string }) => <div>{resource}</div> }));
vi.mock("../dialogs", () => ({ confirmAction: vi.fn(async () => true), editText: vi.fn(async () => "新备注") }));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    return {
        promise: new Promise<T>((done) => {
            resolve = done;
        }),
        resolve: (value) => resolve(value),
    };
}

describe("Qing page workflows", () => {
    beforeEach(() => {
        localStorage.clear();
        registerTranslations("zh", translations);
        setLocale("zh");
        saveConfig({ baseUrl: "https://hub.example", token: "token", persona: "default" });
        const methods: Record<string, (...args: never[]) => Promise<unknown>> = hub;
        for (const key of Object.keys(methods)) vi.spyOn(methods, key).mockResolvedValue({ items: [] });
        vi.mocked(hub.personas).mockResolvedValue({
            items: [
                { id: "default", label: "办公" },
                { id: "other", label: "其他" },
            ],
        });
        client.getRoom.mockReturnValue({});
        client.sendTextMessage.mockResolvedValue({});
        pause.mockResolvedValue(undefined);
        vi.spyOn(window, "open").mockImplementation(windowOpen);
    });
    afterEach(() => {
        cleanup();
        invalidatePersonaCache();
        vi.restoreAllMocks();
        vi.clearAllMocks();
        setLocale("en");
    });

    it("resumes the real session in its room and preserves pagination cursors", async () => {
        vi.mocked(hub.sessions).mockResolvedValue({ items: [{ id: "saved", name: "项目", room_id: "!real:matrix" }] });
        vi.mocked(hub.sessionMessages)
            .mockResolvedValueOnce({
                items: [{ id: "new", content: "新消息", cursor: "exact:cursor" }],
                has_more: true,
            })
            .mockResolvedValueOnce({ items: [{ id: "old", content: "旧消息" }], has_more: false });
        const open = vi.fn();
        render(<TasksPage onOpenRoom={open} />);
        fireEvent.click(await screen.findByText("项目"));
        fireEvent.click(await screen.findByRole("button", { name: "加载更早消息" }));
        await waitFor(() =>
            expect(hub.sessionMessages).toHaveBeenLastCalledWith("saved", "default", 120, "exact:cursor"),
        );
        await screen.findByText("旧消息");
        fireEvent.click(screen.getByRole("button", { name: "接着聊" }));
        await waitFor(() =>
            expect(client.sendTextMessage).toHaveBeenCalledWith("!real:matrix", "!resume saved --cross-room"),
        );
        expect(open).toHaveBeenCalledWith("!real:matrix");
    });

    it("opens the current session without sending a resume command", async () => {
        vi.mocked(hub.sessions).mockResolvedValue({
            items: [{ id: "current", name: "当前", room_id: "!current:matrix", is_current: true }],
        });
        render(<TasksPage onOpenRoom={vi.fn()} />);
        fireEvent.click(await screen.findByText("当前"));
        fireEvent.click(await screen.findByRole("button", { name: "进入聊天" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "进入聊天" })).not.toBeDisabled());
        expect(client.sendTextMessage).not.toHaveBeenCalled();
    });

    it("imports legacy favorites explicitly and lets the user remove them from this account", async () => {
        localStorage.setItem("qing.pc.favSessions", JSON.stringify([{ id: "old", name: "旧收藏" }]));
        render(<TasksPage />);
        const tab = await screen.findByRole("button", { name: /收藏 · 0/ });
        fireEvent.click(tab);
        expect(screen.queryByText("旧收藏")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "导入旧版收藏" }));
        await screen.findByText("旧收藏");
        const key = favoriteKey("https://hub.example", "@test:matrix", "default");
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual([expect.objectContaining({ id: "old" })]);
        fireEvent.click(screen.getByRole("button", { name: "移除" }));
        expect(screen.queryByText("旧收藏")).not.toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual([]);
    });

    it("favorites a searched session and displays its stored record", async () => {
        vi.mocked(hub.sessions).mockResolvedValue({
            items: [
                { id: "s1", name: "项目会议", room_id: "!meeting:matrix" },
                { id: "s2", name: "其他会话" },
            ],
        });
        render(<TasksPage />);
        await screen.findByText("项目会议");
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "项目" } });
        expect(screen.queryByText("其他会话")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTitle("收藏"));
        fireEvent.click(screen.getByRole("button", { name: /收藏 · 1/ }));
        fireEvent.click(screen.getByText("项目会议"));
        await screen.findByRole("button", { name: "取消收藏" });
        expect(hub.sessionMessages).toHaveBeenCalledWith("s1", "default");
    });

    it("toggles a scheduled task through the selected persona", async () => {
        vi.mocked(hub.routines)
            .mockResolvedValueOnce({ items: [{ id: "r1", name: "日报", enabled: true, schedule: "0 18 * * *" }] })
            .mockResolvedValue({ items: [{ id: "r1", name: "日报", enabled: false, schedule: "0 18 * * *" }] });
        render(<TasksPage />);
        fireEvent.click(await screen.findByRole("button", { name: /定时 · 1/ }));
        fireEvent.click(screen.getByRole("button", { name: "停用" }));
        await waitFor(() => expect(hub.updateRoutine).toHaveBeenCalledWith("r1", "default", { enabled: false }));
        await screen.findByRole("button", { name: "启用" });
        fireEvent.click(screen.getByText("日报", { exact: true }));
        await screen.findByText("routine", { exact: true });
    });

    it("allows returning from an earlier day and disables generation for historical dates", async () => {
        render(<BriefingPage />);
        await screen.findByText("这一天还没有简报。");
        expect(screen.getByRole("button", { name: "后一天" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "前一天" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "后一天" })).not.toBeDisabled());
        expect(screen.getByRole("button", { name: "现在写一份" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "后一天" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "现在写一份" })).not.toBeDisabled());
    });

    it("keeps polling after a transient error and shows the generated briefing", async () => {
        const kind = new Date().getHours() >= 17 ? "evening" : "morning";
        vi.mocked(hub.briefingDay)
            .mockResolvedValueOnce({ items: [] })
            .mockRejectedValueOnce(new Error("temporary"))
            .mockResolvedValue({ items: [{ kind, created_at: "new", content: "生成的简报", generated: false }] });
        render(<BriefingPage />);
        await screen.findByText("这一天还没有简报。");
        fireEvent.click(screen.getByRole("button", { name: "现在写一份" }));
        await screen.findByText("简报已生成");
        expect(hub.requestBriefing).toHaveBeenCalledWith(kind);
        expect(await screen.findByText("生成的简报")).toBeVisible();
    });

    it("loads one memory bundle as cards and saves when editing raw content", async () => {
        vi.mocked(hub.memoryBundle).mockResolvedValue({
            memory: { memory: { content: "旧记忆" }, profile: { content: "画像" } },
            skills: [],
            entries: [],
        });
        render(<MemoryPage initialPersona="default" />);
        await screen.findAllByText("旧记忆");
        expect(screen.queryByRole("textbox", { name: "编辑内容" })).not.toBeInTheDocument();
        expect(hub.memory).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "编辑" }));
        const editor = await screen.findByRole("textbox", { name: "编辑内容" });
        expect(editor).toHaveValue("旧记忆");
        fireEvent.change(editor, { target: { value: "新记忆" } });
        fireEvent.click(screen.getByRole("button", { name: "保存记忆" }));
        await waitFor(() => expect(hub.saveMemory).toHaveBeenCalledWith("default", "memory", "新记忆"));
    });

    it("uses legacy memory APIs only for 404 responses", async () => {
        vi.mocked(hub.memoryBundle).mockRejectedValue(new HubError("missing", 404));
        vi.mocked(hub.memory).mockResolvedValue({ memory: { content: "兼容记忆" } });
        render(<MemoryPage />);
        await screen.findAllByText("兼容记忆");
        expect(hub.skills).toHaveBeenCalledWith("default");
    });

    it("clears the old memory before changing persona and reports a failed save", async () => {
        vi.mocked(hub.memoryBundle)
            .mockResolvedValueOnce({ memory: { memory: { content: "办公记忆" } }, skills: [], entries: [] })
            .mockResolvedValueOnce({ memory: { memory: { content: "其他记忆" } }, skills: [], entries: [] });
        vi.mocked(hub.saveMemory).mockRejectedValue(new Error("无写入权限"));
        render(<MemoryPage />);
        await screen.findAllByText("办公记忆");
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "other" } });
        await screen.findAllByText("其他记忆");
        expect(hub.memoryBundle).toHaveBeenLastCalledWith("other");
        fireEvent.click(screen.getByRole("button", { name: "编辑" }));
        fireEvent.click(screen.getByRole("button", { name: "保存记忆" }));
        await screen.findByText(/无写入权限/);
        expect(hub.saveMemory).toHaveBeenCalledWith("other", "memory", "其他记忆");
    });

    it("shows memory read failures without using legacy endpoints for authorization errors", async () => {
        vi.mocked(hub.memoryBundle).mockRejectedValue(new HubError("无读取权限", 403));
        render(<MemoryPage />);
        await screen.findByText("无读取权限");
        expect(hub.memory).not.toHaveBeenCalled();
    });

    it("lets an empty candidate pool add a model", async () => {
        vi.mocked(hub.agentBundle).mockResolvedValue({ model: {}, candidates: [] });
        render(<ModelPage />);
        fireEvent.click(await screen.findByRole("button", { name: "新增候选" }));
        expect(screen.getByRole("button", { name: "加入候选池" })).toBeVisible();
    });

    it("edits fallback chain via list selection and reordering without a textarea", async () => {
        vi.mocked(hub.agentBundle).mockResolvedValue({
            model: { key: "primary", label: "Primary", model: "m0", base_url: "https://a.test/v1" },
            candidates: [
                { key: "c1", label: "Cand 1", model: "m1", base_url: "https://1.test/v1", key_env: "K1" },
                { key: "c2", label: "Cand 2", model: "m2", base_url: "https://2.test/v1", key_env: "K2" },
            ],
            fallback: [{ key: "c2", label: "Cand 2", model: "m2", base_url: "https://2.test/v1", key_env: "K2" }],
        });
        render(<ModelPage />);
        fireEvent.click(await screen.findByRole("button", { name: "编辑备用链" }));
        const checkboxes = screen.getAllByRole("checkbox");
        expect(checkboxes).toHaveLength(2);
        fireEvent.click(checkboxes[0]);
        const upButtons = screen.getAllByRole("button", { name: "上移" });
        fireEvent.click(upButtons[1]);
        fireEvent.click(screen.getByRole("button", { name: "保存" }));
        await waitFor(() =>
            expect(hub.saveFallback).toHaveBeenCalledWith("default", [
                { provider: "custom", model: "m1", base_url: "https://1.test/v1", key_env: "K1" },
                { provider: "custom", model: "m2", base_url: "https://2.test/v1", key_env: "K2" },
            ]),
        );
    });

    it("switches usage ranges and waits for the selected range to finish", async () => {
        const old = deferred<unknown>();
        vi.mocked(hub.usageSummary)
            .mockResolvedValueOnce({ totals: { calls: 7 } })
            .mockImplementationOnce(() => old.promise)
            .mockResolvedValue({ totals: { calls: 30 } });
        render(<UsagePage />);
        const select = await screen.findByRole("combobox", { name: "用量范围" });
        fireEvent.change(select, { target: { value: "today" } });
        await waitFor(() => expect(hub.usageSummary).toHaveBeenCalledWith("today"));
        // The range selector is restored after the in-flight request resolves.
        old.resolve({ totals: { calls: 1 } });
        const restored = await screen.findByRole("combobox", { name: "用量范围" });
        fireEvent.change(restored, { target: { value: "30d" } });
        await screen.findByText("30");
        expect(hub.usageSummary).toHaveBeenCalledWith("30d");
    });

    it("reorders services without opening one and opens the selected service text", async () => {
        vi.mocked(hub.serviceCatalog).mockResolvedValue({
            services: [
                { id: "a", name: "面板A", hostname: "a.3585616.xyz" },
                { id: "b", name: "面板B", hostname: "b.3585616.xyz" },
            ],
        });
        vi.mocked(hub.serviceTicket).mockResolvedValue({ url: "https://b.3585616.xyz/entry" });
        render(<ServicesPage />);
        fireEvent.click((await screen.findAllByRole("button", { name: "上移" }))[1]);
        await waitFor(() => expect(hub.serviceOrder).toHaveBeenCalledWith(["b", "a"]));
        expect(hub.serviceTicket).not.toHaveBeenCalled();
        fireEvent.click(await screen.findByText("面板B"));
        await waitFor(() => expect(hub.serviceTicket).toHaveBeenCalledWith("b"));
        expect(windowOpen).toHaveBeenCalled();
    });

    it("routes Element settings precisely and uses the native logout flow", () => {
        const dispatch = vi.spyOn(dis, "dispatch");
        render(<SettingsPage onNavigateElement={vi.fn()} />);
        fireEvent.click(screen.getByText("通知", { exact: true }));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ initialTabId: UserTab.Notifications }));
        fireEvent.click(screen.getByText("退出登录", { exact: true }));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ action: Action.ViewUserSettings }));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ action: "logout" }));
    });

    it("filters device data without changing the collection protocol", async () => {
        vi.mocked(hub.notifications).mockResolvedValue({
            items: [
                { title: "会议", app_name: "日程" },
                { title: "快递", app_name: "物流" },
            ],
        });
        render(<DeviceDataPage />);
        await screen.findByText("会议");
        fireEvent.change(screen.getByRole("searchbox", { name: "搜索设备数据" }), { target: { value: "物流" } });
        expect(screen.queryByText("会议")).not.toBeInTheDocument();
        expect(screen.getByText("快递")).toBeVisible();
    });

    it("reads every mobile data category with its own presentation and query", async () => {
        vi.mocked(hub.sms).mockResolvedValue({
            items: [{ person: "张先生", body: "会议改期", direction: "in", sent_at: "2026-11-25T09:00:00" }],
        });
        vi.mocked(hub.calendar).mockResolvedValue({
            from: "2026-11-25T00:00:00",
            to: "2026-11-26T00:00:00",
            items: [{ title: "团队会议", all_day: true, location: "会议室", description: "讨论计划" }],
        });
        vi.mocked(hub.contacts).mockResolvedValue({
            items: [{ name: "李女士", phones: '["12345", "67890"]', organization: "办公室" }],
        });
        vi.mocked(hub.deviceUsage).mockResolvedValue({
            date: "2026-11-25",
            items: [{ app_name: "日历应用", duration_s: 180 }],
        });
        render(<DeviceDataPage />);
        await screen.findByText("没有数据。手机端开启对应权限并同步后才会出现。");
        fireEvent.click(screen.getByRole("button", { name: "短信" }));
        await screen.findByText("会议改期");
        expect(hub.sms).toHaveBeenCalledWith(200);
        fireEvent.click(screen.getByRole("button", { name: "日历" }));
        await screen.findByText("团队会议");
        expect(screen.getByText("全天")).toBeVisible();
        expect(screen.getByText("讨论计划")).toBeVisible();
        expect(hub.calendar).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole("button", { name: "通讯录" }));
        await screen.findByText("李女士");
        expect(screen.getByText("12345 / 67890")).toBeVisible();
        expect(hub.contacts).toHaveBeenCalledWith(300);
        fireEvent.click(screen.getByRole("button", { name: "使用时长" }));
        await screen.findByText("日历应用");
        expect(screen.getByText("3 分钟")).toBeVisible();
        expect(hub.deviceUsage).toHaveBeenCalledOnce();
    });

    it("validates and adds a candidate, then removes it without switching the model", async () => {
        vi.mocked(hub.agentBundle)
            .mockResolvedValueOnce({ candidates: [] })
            .mockResolvedValueOnce({ candidates: [{ key: "new", label: "新候选" }] })
            .mockResolvedValue({ candidates: [] });
        render(<ModelPage />);
        fireEvent.click(await screen.findByRole("button", { name: "新增候选" }));
        fireEvent.click(screen.getByRole("button", { name: "加入候选池" }));
        expect(hub.addCandidate).not.toHaveBeenCalled();
        const inputs = screen.getAllByRole("textbox");
        for (const [index, value] of ["new", "新候选", "new-model", "https://api.example/v1", "MODEL_KEY"].entries()) {
            fireEvent.change(inputs[index], { target: { value } });
        }
        fireEvent.click(screen.getByRole("button", { name: "加入候选池" }));
        await waitFor(() =>
            expect(hub.addCandidate).toHaveBeenCalledWith(
                {
                    key: "new",
                    label: "新候选",
                    model: "new-model",
                    base_url: "https://api.example/v1",
                    key_env: "MODEL_KEY",
                    scope: "persona",
                },
                "default",
            ),
        );
        await screen.findByText("新候选", { exact: true });
        fireEvent.click(screen.getByRole("button", { name: "删除" }));
        await waitFor(() => expect(hub.deleteCandidate).toHaveBeenCalledWith("new", "default"));
        expect(client.sendTextMessage).not.toHaveBeenCalled();
        expect(hub.switchModel).not.toHaveBeenCalled();
    });

    it("retries a model load failure and uses legacy APIs only when missing", async () => {
        vi.mocked(hub.agentBundle)
            .mockRejectedValueOnce(new Error("连接中断"))
            .mockRejectedValueOnce(new HubError("missing", 404));
        vi.mocked(hub.agentModel).mockResolvedValue({ model: { label: "旧接口模型" } });
        render(<ModelPage />);
        await screen.findByText("连接中断");
        expect(hub.agentModel).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "重试" }));
        await screen.findByText("旧接口模型");
        expect(hub.agentModel).toHaveBeenCalledWith("default");
    });

    it("requests credential references and never displays secret values", async () => {
        vi.mocked(hub.agentCredentials).mockResolvedValue({
            items: [{ name: "API_KEY", resolved: true, references: ["main"] }],
        });
        render(<CredentialsPage />);
        await screen.findByText("API_KEY");
        expect(hub.agentCredentials).toHaveBeenCalledWith(true);
        fireEvent.click(screen.getByRole("button", { name: "新增" }));
        const input = screen.getByLabelText("值");
        expect(input).toHaveAttribute("type", "password");
        expect(input).toHaveValue("");
    });

    it("rejects fractional retention instead of silently rounding", async () => {
        vi.mocked(hub.retention).mockResolvedValue({ notify_days: 30, location_days: 14 });
        render(<PrivacyPage />);
        const inputs = await screen.findAllByRole("spinbutton");
        fireEvent.change(inputs[0], { target: { value: "1.5" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));
        await screen.findByText("请填非负整数。");
        expect(hub.setRetention).not.toHaveBeenCalled();
    });

    it("clears only the locally stored pairing token", async () => {
        render(<SettingsPage onNavigateElement={vi.fn()} />);
        fireEvent.click(screen.getByText("设备数据", { exact: true }));
        fireEvent.click(screen.getByRole("button", { name: "连接设置" }));
        fireEvent.click(screen.getByRole("button", { name: "清除本机配对" }));
        expect(loadConfig()).toEqual({ baseUrl: "https://hub.example", token: "", persona: "default" });
        expect(hub.revokeDevice).not.toHaveBeenCalled();
    });
    it("shows live server metrics and disables polling when requested", async () => {
        vi.mocked(hub.serverStatus).mockResolvedValue({
            host: { name: "Home server", os: "Linux", kernel: "6.1", uptime_s: 90000 },
            cpu: { cores: 2, avg: 25, temp_c: 48, per_core: [20, 30], freq_mhz: [1800, 2000], load: [0.2] },
            mem: { total_mb: 4096, used_mb: 2048, available_mb: 2048, cached_mb: 500 },
            disk: [{ mount: "/", total_gb: 20, used_gb: 5, pct: 25 }],
            net: { iface: "eth0", rx_bytes: 1024, tx_bytes: 2048 },
            services: [{ key: "db", name: "数据库", status: "running", active: true, mem_mb: 20, cpu_pct: 5 }],
        });
        vi.mocked(hub.serverHistory).mockResolvedValue({
            points: [
                { ts: "2026-11-25T10:00:00", cpu_pct: 10, mem_pct: 20 },
                { ts: "2026-11-25T11:00:00", cpu_pct: 20, mem_pct: 30 },
            ],
        });
        render(<ServerPage />);
        await screen.findByText("数据库");
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "0" } });
        expect(screen.getByRole("combobox")).toHaveValue("0");
        expect(screen.getByText("24 小时趋势")).toBeVisible();
    });

    it("edits skills and persona configuration through the same bundle", async () => {
        vi.mocked(hub.memoryBundle).mockResolvedValue({
            memory: {},
            skills: [{ path: "daily.md", name: "日报", description: "总结" }],
            entries: [{ key: "prompt", value: "原设定", label: "系统提示" }],
        });
        vi.mocked(hub.skillContent).mockResolvedValue({ content: "旧技能" });
        render(<MemoryPage />);
        fireEvent.click(await screen.findByRole("button", { name: "技能" }));
        fireEvent.click(await screen.findByText("日报", { exact: true }));
        const editor = await screen.findByRole("textbox", { name: "编辑内容" });
        fireEvent.change(editor, { target: { value: "新技能" } });
        fireEvent.click(screen.getByRole("button", { name: "保存技能" }));
        await waitFor(() => expect(hub.saveSkill).toHaveBeenCalledWith("daily.md", "default", "新技能"));
        fireEvent.click(screen.getByRole("button", { name: "人设" }));
        fireEvent.click(await screen.findByText("系统提示", { exact: true }));
        fireEvent.change(screen.getByRole("textbox", { name: "编辑内容" }), { target: { value: "新设定" } });
        fireEvent.click(screen.getByRole("button", { name: "保存设定" }));
        await waitFor(() => expect(hub.savePersona).toHaveBeenCalledWith("default", "prompt", "新设定"));
    });

    it("changes the model label, tests and switches candidates without parent-card activation", async () => {
        vi.mocked(hub.agentBundle).mockResolvedValue({
            model: { key: "main", label: "主模型", base_url: "https://api.test", model: "main" },
            candidates: [
                { key: "other", label: "候选模型", base_url: "https://other.test", model: "other", has_key: true },
            ],
            fallback: [{ model: "backup" }],
        });
        vi.mocked(hub.testCandidate).mockResolvedValue({ ok: true, model: "other", ms: 10 });
        render(<ModelPage />);
        fireEvent.click(await screen.findByRole("button", { name: "改备注" }));
        await waitFor(() =>
            expect(hub.setModelLabel).toHaveBeenCalledWith("default", "https://api.test", "main", "新备注"),
        );
        fireEvent.click(screen.getByRole("button", { name: "测试" }));
        await waitFor(() => expect(hub.testCandidate).toHaveBeenCalledWith("other", "default"));
        expect(hub.switchModel).not.toHaveBeenCalled();
        await screen.findByText(/测试通过/);
        fireEvent.click(screen.getByText("候选模型", { exact: true }));
        expect(hub.switchModel).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "切换" }));
        await waitFor(() => expect(hub.switchModel).toHaveBeenCalledWith("other", "default"));
        await screen.findByText("已切换到 候选模型");
    });

    it("edits credentials and isolates plugin toggles per profile", async () => {
        vi.mocked(hub.agentCredentials).mockResolvedValue({
            items: [{ name: "OLD_KEY", resolved: true, references: [] }],
        });
        render(<CredentialsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "编辑" }));
        fireEvent.change(screen.getByLabelText("变量名"), { target: { value: "RENAMED_KEY" } });
        const valInput = screen.getByLabelText("新值");
        expect(valInput).toHaveAttribute("type", "password");
        fireEvent.change(valInput, { target: { value: "new-secret" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));
        await waitFor(() => expect(hub.setCredential).toHaveBeenCalledWith("RENAMED_KEY", "new-secret"));
        await waitFor(() => expect(hub.deleteCredential).toHaveBeenCalledWith("OLD_KEY", false));

        cleanup();
        vi.mocked(hub.agentPlugins).mockResolvedValue({
            items: [{ id: "mem", name: "记忆插件", kind: "installed", enabled: true }],
        });
        render(<PluginsPage />);
        const sw = await screen.findByRole("switch", { name: "记忆插件" });
        expect(sw).toHaveAttribute("aria-checked", "true");
        fireEvent.click(sw);
        expect(sw).toHaveAttribute("aria-checked", "false");
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "other" } });
        await waitFor(() => expect(hub.agentPlugins).toHaveBeenCalledWith("other"));
        expect(await screen.findByRole("switch", { name: "记忆插件" })).toHaveAttribute("aria-checked", "true");
    });

    it("disables boundary arrows and supports moving services down", async () => {
        vi.mocked(hub.serviceCatalog).mockResolvedValue({
            services: [
                { id: "a", name: "面板A", hostname: "a.3585616.xyz" },
                { id: "b", name: "面板B", hostname: "b.3585616.xyz" },
            ],
        });
        render(<ServicesPage />);
        const ups = await screen.findAllByRole("button", { name: "上移" });
        const downs = screen.getAllByRole("button", { name: "下移" });
        expect(ups[0]).toBeDisabled();
        expect(downs[1]).toBeDisabled();
        fireEvent.click(downs[0]);
        await waitFor(() => expect(hub.serviceOrder).toHaveBeenCalledWith(["b", "a"]));
    });

    it("updates and deletes credentials only after explicit user actions", async () => {
        vi.mocked(hub.agentCredentials).mockResolvedValue({
            items: [{ name: "KEY", resolved: true, references: ["main"], in_system: true }],
        });
        render(<CredentialsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "新增" }));
        fireEvent.change(screen.getByLabelText("变量名"), { target: { value: "NEW_KEY" } });
        fireEvent.change(screen.getByLabelText("值"), { target: { value: "secret" } });
        fireEvent.click(screen.getByRole("button", { name: "写入 .env" }));
        await waitFor(() => expect(hub.setCredential).toHaveBeenCalledWith("NEW_KEY", "secret"));
        fireEvent.click(await screen.findByRole("button", { name: "删除" }));
        await waitFor(() => expect(hub.deleteCredential).toHaveBeenCalledWith("KEY", true));
    });

    it("pairs using the entered address and saves the returned token", async () => {
        vi.mocked(hub.pair).mockResolvedValue({ token: "new-token", device_id: "new-pc" });
        render(<SettingsPage onNavigateElement={vi.fn()} />);
        fireEvent.click(screen.getByText("设备数据", { exact: true }));
        fireEvent.click(screen.getByRole("button", { name: "连接设置" }));
        fireEvent.change(screen.getByLabelText("device-hub 地址"), { target: { value: "https://new.test" } });
        fireEvent.change(screen.getByLabelText("配对码"), { target: { value: "123456" } });
        fireEvent.click(screen.getByRole("button", { name: "配对" }));
        await waitFor(() => expect(hub.pair).toHaveBeenCalledWith("123456", "Qing PC", "https://new.test"));
        await waitFor(() => expect(loadConfig().token).toBe("new-token"));
        expect(loadConfig().baseUrl).toBe("https://new.test");
    });
});
