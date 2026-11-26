/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { favoriteKey, importFavorites, readFavorites } from "./favorites";

describe("session favorites", () => {
    beforeEach(() => localStorage.clear());
    it("isolates hubs, accounts and personas and normalizes trailing slashes", () => {
        expect(favoriteKey("https://hub/", "@a:matrix", "work")).toBe(favoriteKey("https://hub", "@a:matrix", "work"));
        const key = favoriteKey("https://hub", "@a:matrix", "work");
        expect(key).not.toBe(favoriteKey("https://other", "@a:matrix", "work"));
        expect(key).not.toBe(favoriteKey("https://hub", "@b:matrix", "work"));
        expect(key).not.toBe(favoriteKey("https://hub", "@a:matrix", "home"));
    });
    it("ignores corrupt entries and preserves saved room IDs", () => {
        localStorage.setItem(
            "old",
            '[null,{}, {"id": 1}, {"id": "session", "name": "标题", "room_id": "!room:matrix"}]',
        );
        expect(readFavorites("old")).toEqual([{ id: "session", name: "标题", room_id: "!room:matrix" }]);
        localStorage.setItem("old", "broken");
        expect(readFavorites("old")).toEqual([]);
    });
    it("keeps current snapshots when explicitly importing duplicate legacy IDs", () => {
        expect(
            importFavorites(
                [{ id: "a", name: "当前" }],
                [
                    { id: "a", name: "旧版" },
                    { id: "b", name: "保留" },
                ],
            ),
        ).toEqual([
            { id: "a", name: "当前" },
            { id: "b", name: "保留" },
        ]);
    });
});
