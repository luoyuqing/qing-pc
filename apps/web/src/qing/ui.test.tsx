/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { registerTranslations, setLocale } from "@element-hq/web-shared-components";
import translations from "../i18n/strings/zh_Hans.json";
import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "test-utils-rtl";

import { Button, Card, ErrorBox, PageHeader } from "./ui";
import { PersonaPicker, invalidatePersonaCache } from "./PersonaPicker";
import { hub } from "./hub";

describe("Qing accessible controls", () => {
    beforeEach(() => {
        registerTranslations("zh", translations);
        setLocale("zh");
    });
    afterEach(() => {
        cleanup();
        invalidatePersonaCache();
        vi.restoreAllMocks();
        setLocale("en");
    });

    it("opens a card with Enter and Space", () => {
        const action = vi.fn();
        render(<Card onClick={action}>查看记录</Card>);
        const card = screen.getByRole("button", { name: "查看记录" });
        fireEvent.keyDown(card, { key: "Enter" });
        fireEvent.keyDown(card, { key: " " });
        expect(action).toHaveBeenCalledTimes(2);
    });

    it("does not activate a parent card from a nested control", () => {
        const action = vi.fn();
        render(
            <Card onClick={action}>
                记录
                <Button>编辑</Button>
            </Card>,
        );
        fireEvent.keyDown(screen.getByRole("button", { name: "编辑" }), { key: "Enter" });
        expect(action).not.toHaveBeenCalled();
    });

    it("keeps a disabled operation inactive", () => {
        const action = vi.fn();
        render(
            <Button disabled onClick={action}>
                保存
            </Button>,
        );
        fireEvent.click(screen.getByRole("button", { name: "保存" }));
        expect(action).not.toHaveBeenCalled();
    });

    it("provides back and retry actions", () => {
        const back = vi.fn();
        const retry = vi.fn();
        render(
            <>
                <PageHeader title="详情" onBack={back} />
                <ErrorBox message="连接失败" onRetry={retry} />
            </>,
        );
        fireEvent.click(screen.getByRole("button", { name: "返回" }));
        fireEvent.click(screen.getByRole("button", { name: "重试" }));
        expect(back).toHaveBeenCalledOnce();
        expect(retry).toHaveBeenCalledOnce();
    });

    it("offers a labelled native persona selector", async () => {
        vi.spyOn(hub, "personas").mockResolvedValue({
            items: [
                { id: "default", label: "办公" },
                { id: "other", label: "其他" },
            ],
        });
        const changed = vi.fn();
        render(<PersonaPicker value="default" onChange={changed} />);
        const select = await screen.findByRole("combobox", { name: "切换人设" });
        fireEvent.change(select, { target: { value: "other" } });
        expect(changed).toHaveBeenCalledWith("other");
    });
});
