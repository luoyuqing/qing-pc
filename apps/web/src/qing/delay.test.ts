/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { delay } from "./delay";

describe("cancellable briefing polling", () => {
    afterEach(() => vi.useRealTimers());
    it("releases its timer and abort listener after the interval", async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const remove = vi.spyOn(controller.signal, "removeEventListener");
        const promise = delay(3000, controller.signal);
        await vi.advanceTimersByTimeAsync(3000);
        await expect(promise).resolves.toBeUndefined();
        expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
        expect(vi.getTimerCount()).toBe(0);
    });
    it("cancels a pending interval when leaving the page", async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const promise = delay(3000, controller.signal);
        // Attach the rejection assertion before aborting to avoid an unhandled promise rejection.
        // oxlint-disable-next-line vitest/valid-expect
        const assertion = expect(promise).rejects.toThrow("Aborted");
        controller.abort();
        await assertion;
        expect(vi.getTimerCount()).toBe(0);
    });
    it("never schedules a timer for an already cancelled page", async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        controller.abort();
        await expect(delay(3000, controller.signal)).rejects.toThrow("Aborted");
        expect(vi.getTimerCount()).toBe(0);
    });
});
