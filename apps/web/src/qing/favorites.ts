/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FavSession } from "./task-types";

/** Keep saved sessions separate for each hub, Matrix account and persona. */
export function favoriteKey(baseUrl: string, userId: string, persona: string): string {
    return `qing.pc.favSessions.${[baseUrl.replace(/\/+$/, ""), userId, persona].map(encodeURIComponent).join(".")}`;
}

/** Read legacy or scoped snapshots without allowing malformed storage to break the page. */
export function readFavorites(key: string): FavSession[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (!Array.isArray(value)) return [];
        return value.filter(
            (item): item is FavSession =>
                item !== null && typeof item === "object" && typeof item.id === "string" && item.id.length > 0,
        );
    } catch {
        return [];
    }
}

/** Import only after the user chooses the account/persona that owns old unscoped favorites. */
export function importFavorites(current: FavSession[], legacy: FavSession[]): FavSession[] {
    const ids = new Set(current.map((item) => item.id));
    return [...current, ...legacy.filter((item) => !ids.has(item.id))];
}
