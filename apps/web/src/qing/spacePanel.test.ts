/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { isSpacePanelVisible, setSpacePanelVisible } from "./spacePanel";

describe("space sidebar preference", () => {
    afterEach(() => {
        localStorage.clear();
        document.body.classList.remove("qing-hide-space");
    });
    it("hides by default and applies changes without reloading the chat", () => {
        expect(isSpacePanelVisible()).toBe(false);
        setSpacePanelVisible(true);
        expect(isSpacePanelVisible()).toBe(true);
        expect(document.body.classList.contains("qing-hide-space")).toBe(false);
        setSpacePanelVisible(false);
        expect(document.body.classList.contains("qing-hide-space")).toBe(true);
    });
});
