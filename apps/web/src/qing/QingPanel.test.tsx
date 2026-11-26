/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "test-utils-rtl";
import { registerTranslations, setLocale } from "@element-hq/web-shared-components";

import translations from "../i18n/strings/zh_Hans.json";
import { hub } from "./hub";
import { QingPanel } from "./QingPanel";
import { QingCollectionViewModel } from "../viewmodels/qing/QingCollectionViewModel";

describe("QingPanel lifecycle", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        setLocale("en");
    });

    it("loads its resource, offers navigation and disposes when closed", async () => {
        registerTranslations("zh", translations);
        setLocale("zh");
        vi.spyOn(hub, "audit").mockResolvedValue({ items: [{ id: "1", action: "查询通知", actor: "手机" }] });
        const dispose = vi.spyOn(QingCollectionViewModel.prototype, "dispose");
        const back = vi.fn();
        const { unmount } = render(<QingPanel resource="audit" persona="default" onBack={back} />);
        await screen.findByText("查询通知");
        expect(hub.audit).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole("button", { name: "返回" }));
        expect(back).toHaveBeenCalledOnce();
        unmount();
        expect(dispose).toHaveBeenCalledOnce();
    });
});
