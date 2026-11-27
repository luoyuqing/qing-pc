/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { rejectToastIfExists } from "@element-hq/element-web-playwright-common";
import { type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";

/** Mock only device-hub; Matrix login, sync and room navigation use the real Synapse fixture. */
async function mockHub(page: Page): Promise<{ writes: { path: string; body: unknown }[] }> {
    const writes: { path: string; body: unknown }[] = [];
    await page.addInitScript(() => {
        localStorage.setItem(
            "qing.hub.config",
            JSON.stringify({ baseUrl: "https://hub.test", token: "test-token", persona: "default" }),
        );
    });
    await page.route("https://hub.test/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (["POST", "PATCH", "DELETE"].includes(request.method())) writes.push({ path, body: request.postDataJSON() });
        const responses: Record<string, unknown> = {
            "/health": { ok: true, version: "test" },
            "/personas": { items: [{ id: "default", label: "办公" }] },
            "/briefing/day": {
                items: [
                    { kind: "morning", content: "# 今日简报\n\n会议和待办已整理。", created_at: "2026-11-25T07:30:00" },
                ],
                pending: ["evening"],
                stats: { sessions: 3 },
                todos: [],
            },
            "/briefing/history": { items: [] },
            "/tasks/sessions": { items: [{ id: "s1", name: "项目记录", message_count: 2 }] },
            "/tasks/sessions/s1/messages": {
                items: [{ cursor: "1", content: "会话内容", role: "user" }],
                has_more: false,
            },
            "/tasks/sessions/digest": { summary: "最近讨论了项目进度。" },
            "/routines": { items: [{ id: "brief", name: "晨报任务", schedule: "30 7 * * *", enabled: true }] },
            "/routines/brief": {
                job: { id: "brief", name: "晨报任务", schedule: "30 7 * * *", prompt: "整理当天工作", enabled: true },
            },
            "/routines/brief/history": { items: [{ id: "run1", status: "success", summary: "完成" }] },
            "/memory/bundle": {
                memory: {
                    memory: {
                        content:
                            "## 2026-11-27 代理配置\nsing-box: 韩服主力+双机场fallback(83池),guard失败自动切;lyq本机/opt/clash(7890/7891,final=韩国-auto)",
                    },
                    profile: { content: "工作日办公" },
                },
                skills: [],
                entries: [],
            },
            "/agent/bundle": {
                model: {
                    key: "main",
                    label: "主模型",
                    model: "deepseek-chat",
                    base_url: "https://api.deepseek.com/v1",
                },
                candidates: [
                    {
                        key: "c1",
                        label: "备用模型",
                        model: "gpt-4o",
                        base_url: "https://api.openai.com/v1",
                        key_env: "OPENAI_API_KEY",
                    },
                ],
            },
            "/agent/credentials": {
                items: [
                    ...Array.from({ length: 10 }, (_, i) => ({ name: `PROVIDER_${i}_KEY` })),
                    { name: "CF2_PAGES_TOKEN" },
                    { name: "comfy-token" },
                    { name: "SMTP_PASS" },
                ],
            },
            "/memory/vault": { items: [{ name: "fact.md", title: "工作偏好", preview: "下午开会" }] },
            "/memory/vault/note": { content: "# 工作偏好\ncreated_at: yesterday\n\n下午开会" },
            "/memory/vault/status": { ok: true, count: 1 },
            "/svc/catalog": { services: [] },
            "/svc/fav/list": { items: [] },
            "/query/devices": { items: [{ id: "old-phone", name: "旧手机" }] },
            "/audit": { items: [{ id: "audit1", action: "查询通知", actor: "手机" }] },
            "/diagnose": { checks: [{ id: "memory", name: "记忆索引", status: "ok" }] },
        };
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(responses[path] ?? { ok: true, items: [] }),
        });
    });
    return { writes };
}

test("keeps five tabs and supports session, routine and memory workflows", async ({ pageWithCredentials: page }) => {
    const { writes } = await mockHub(page);
    const navigationStart = Date.now();
    await page.goto("/");
    await rejectToastIfExists(page, "Verify this device");
    await rejectToastIfExists(page, "Notifications");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("button")).toHaveCount(5);
    const navigationReadyMs = Date.now() - navigationStart;
    const briefingStart = Date.now();
    await nav.getByRole("button", { name: "Briefing", exact: true }).click();
    await expect(page.getByText("今日简报", { exact: true })).toBeVisible();
    const briefingReadyMs = Date.now() - briefingStart;
    const browserMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        return {
            firstContentfulPaintMs: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            usedJSHeapBytes: heap?.usedJSHeapSize,
        };
    });
    await writeFile(
        "/data/home/qing-work/output/runtime-metrics.json",
        JSON.stringify(
            {
                environment: "Linux Chromium; local HTTP/Synapse; mocked hub; authenticated reload with warm resources",
                navigationReadyMs,
                briefingReadyMs,
                ...browserMetrics,
            },
            null,
            2,
        ),
    );
    await expect(page.locator(".mx_QingShell_elementContent")).toBeHidden();
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
    await nav.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByText("项目记录", { exact: true }).click();
    await expect(page.getByText("会话内容", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Favorite", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: /Scheduled · 1/ }).click();
    await page.getByText("晨报任务", { exact: true }).click();
    await page.getByRole("textbox", { name: "Task content" }).fill("整理会议与待办");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
        .poll(() => writes.find((entry) => entry.path === "/routines/brief")?.body)
        .toMatchObject({ prompt: "整理会议与待办", schedule: "30 7 * * *" });
    await nav.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByText("Memory", { exact: true }).click();
    await page.getByRole("button", { name: "Memory vault", exact: true }).click();
    await page.getByRole("button", { name: "View and edit", exact: true }).click();
    await page.getByRole("textbox", { name: "Memory content" }).fill("偏好\n喜欢茶");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
        .poll(() => writes.find((entry) => entry.path === "/memory/vault/note")?.body)
        .toMatchObject({ persona: "default", name: "fact.md", content: "偏好\n喜欢茶" });
    await nav.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(nav.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-current", "page");
});

test("requires confirmation to revoke a paired device", async ({ pageWithCredentials: page }) => {
    const { writes } = await mockHub(page);
    await page.goto("/");
    await rejectToastIfExists(page, "Verify this device");
    await rejectToastIfExists(page, "Notifications");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Settings" }).click();
    await page.getByText("Devices and tokens", { exact: true }).click();
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(writes).toHaveLength(0);
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect.poll(() => writes.some((entry) => entry.path === "/devices/old-phone")).toBe(true);
});

test("renders narrow and wide panels and follows Element theme changes", async ({ pageWithCredentials: page, app }) => {
    await mockHub(page);
    await page.goto("/");
    await rejectToastIfExists(page, "Verify this device");
    await rejectToastIfExists(page, "Notifications");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("button", { name: "Briefing" }).click();
    await expect(page.getByText("今日简报", { exact: true })).toBeVisible();
    await expect(page.locator(".mx_QingShell_elementContent")).toBeHidden();
    for (const width of [1440, 720]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "dark"]) {
            await app.settings.setValue("theme", null, SettingLevel.DEVICE, theme);
            await expect(page.locator("body")).toHaveClass(new RegExp(`cpd-theme-${theme}`));
            const heading = page.getByText("今日简报", { exact: true });
            const bounds = await heading.boundingBox();
            expect(bounds?.x).toBeGreaterThanOrEqual(60);
            expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
            await page.screenshot({ path: `/data/home/qing-work/output/screenshots/briefing-${theme}-${width}.png` });
        }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: /Settings|设置/ }).click();
    await expect(page.getByText(/Server status|服务器状态/).first()).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
        await page.evaluate((mode) => {
            document.body.classList.toggle("cpd-theme-dark", mode === "dark");
            document.body.classList.toggle("cpd-theme-light", mode === "light");
        }, theme);
        await page.screenshot({ path: `/data/home/qing-work/output/screenshots/settings-${theme}-1440.png` });
    }
    await expect(page.getByText(/missing translation|qing\|text_/)).toHaveCount(0);
});

test("verifies round 5 briefing pending card, memory full-width cards, model credentials and version 1.12.35", async ({
    pageWithCredentials: page,
}) => {
    await mockHub(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await rejectToastIfExists(page, "Verify this device");
    await rejectToastIfExists(page, "Notifications");

    const versionRes = await page.request.get("/version");
    expect((await versionRes.text()).trim()).toMatch(/^1\.12\.35(?:-dev)?$/);

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("button", { name: "Briefing" }).click();
    await expect(page.getByText("今日简报", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending generation")).toHaveCount(0);
    await page.screenshot({ path: "/data/home/qing-work/output/screenshots/briefing-morning-no-pending.png" });

    await page.getByRole("button", { name: "Evening briefing" }).click();
    await expect(page.getByText("Pending generation")).toBeVisible();
    await expect(page.getByText("· evening")).toBeVisible();
    await page.screenshot({ path: "/data/home/qing-work/output/screenshots/briefing-evening-pending.png" });

    await nav.getByRole("button", { name: "Settings" }).click();
    await page.getByText("Memory", { exact: true }).click();
    const memCard = page.getByRole("button", { name: /代理配置/ });
    await expect(memCard).toHaveAttribute("aria-expanded", "false");
    const memBox = await memCard.boundingBox();
    expect(memBox?.width ?? 0).toBeGreaterThan(700);
    await page.screenshot({ path: "/data/home/qing-work/output/screenshots/memory-fullwidth-collapsed.png" });
    await memCard.click();
    await expect(memCard).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({ path: "/data/home/qing-work/output/screenshots/memory-fullwidth-expanded.png" });

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByText("Models and inference", { exact: true }).click();
    await page.getByRole("button", { name: "Add candidate" }).click();
    await expect(page.getByRole("button", { name: "CF2_PAGES_TOKEN" })).toBeVisible();
    await expect(page.getByRole("button", { name: "comfy-token" })).toBeVisible();
    await page.screenshot({ path: "/data/home/qing-work/output/screenshots/model-credentials-search.png" });
});
