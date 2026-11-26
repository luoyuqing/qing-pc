/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { buildSchedule, scheduleFields, validSchedule } from "./schedule";
import { recordOf, recordsOf, textOf, vaultBody } from "./data";

describe("hub form data", () => {
    it.each(["30 7 * * *", "15 20 * * 3", "5 * * * *", "*/10 9-17 * * 1-5"])(
        "retains an existing schedule: %s",
        (schedule) => {
            expect(buildSchedule(scheduleFields(schedule))).toBe(schedule);
            expect(validSchedule(schedule)).toBe(true);
        },
    );
    it.each([
        "60 7 * * *",
        "0 24 * * *",
        "0 7 0 * *",
        "0 7 * 13 *",
        "0 7 * * 8",
        "*/0 * * * *",
        "* * * *",
        "* * * * * *",
        "1-0 * * * *",
        "x * * * *",
    ])("rejects an invalid schedule: %s", (schedule) => {
        expect(validSchedule(schedule)).toBe(false);
    });
    it("handles malformed envelopes and preserves only object rows", () => {
        expect(recordOf(null)).toEqual({});
        expect(recordsOf({ items: [null, 1, { id: "one" }] })).toEqual([{ id: "one" }]);
        expect(textOf({ id: "one" })).toBe("");
        expect(textOf(0)).toBe("0");
        expect(vaultBody("# 标题\ncreated_at: today\n\n正文")).toBe("正文");
    });
});
