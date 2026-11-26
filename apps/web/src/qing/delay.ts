/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** Wait for a polling interval and release its timer/listener when a page exits. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const cleanup = (): void => {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
        };
        const abort = (): void => {
            cleanup();
            reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(() => {
            cleanup();
            resolve();
        }, ms);
        signal.addEventListener("abort", abort, { once: true });
    });
}
