/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { confirmAction, editText } from "./dialogs";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../Modal", () => ({ default: { createDialog: create } }));
vi.mock("../components/views/dialogs/QuestionDialog", () => ({ default: () => null }));
vi.mock("../components/views/dialogs/TextInputDialog", () => ({ default: () => null }));

describe("native Qing dialogs", () => {
    it("returns the explicit confirmation result", async () => {
        create
            .mockReturnValueOnce({ finished: Promise.resolve([false]) })
            .mockReturnValueOnce({ finished: Promise.resolve([true]) });
        await expect(confirmAction("删除？")).resolves.toBe(false);
        await expect(confirmAction("删除？")).resolves.toBe(true);
    });
    it("distinguishes cancelling from clearing a text field", async () => {
        create
            .mockReturnValueOnce({ finished: Promise.resolve([false, "cancelled"]) })
            .mockReturnValueOnce({ finished: Promise.resolve([true, ""]) });
        await expect(editText("备注", "old")).resolves.toBeNull();
        await expect(editText("备注", "old")).resolves.toBe("");
    });
});
