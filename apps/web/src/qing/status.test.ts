/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";
import { registerTranslations, setLocale } from "@element-hq/web-shared-components";

import en from "../i18n/strings/en_EN.json";
import zh from "../i18n/strings/zh_Hans.json";
import { statusLabel } from "./status";

describe("Qing localization", () => {
    afterEach(() => setLocale("en"));
    it("covers every Qing English entry in Chinese with matching interpolation parameters", () => {
        expect(Object.keys(zh.qing).sort()).toEqual(Object.keys(en.qing).sort());
        for (const key of Object.keys(en.qing) as (keyof typeof en.qing)[]) {
            expect(zh.qing[key]).not.toMatch(/missing translation|qing\|text_/);
            expect(zh.qing[key].match(/%\([^)]+\)s/g)?.sort() ?? []).toEqual(
                en.qing[key].match(/%\([^)]+\)s/g)?.sort() ?? [],
            );
        }
    });
    it("localizes protocol states and retains unknown server values", () => {
        registerTranslations("zh", zh);
        setLocale("zh");
        expect(statusLabel("ok")).toBe("正常");
        expect(statusLabel("running")).toBe("运行中");
        expect(statusLabel("failed")).toBe("错误");
        expect(statusLabel("chat_completions")).toBe("聊天补全");
        expect(statusLabel("custom-server-state")).toBe("custom-server-state");
        registerTranslations("en", en);
        setLocale("en");
        expect(statusLabel("ok")).toBe("Healthy");
    });
});
