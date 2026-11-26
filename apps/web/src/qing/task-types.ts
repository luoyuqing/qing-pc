/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** A Hermes session; Matrix navigation always uses room_id, never a display name. */
export interface TaskSession {
    id: string;
    name?: string;
    platform?: string;
    room_id?: string;
    is_current?: boolean;
    message_count?: number;
    last_at?: string;
}

/** A saved session snapshot retained beyond the recent-session window. */
export interface FavSession extends TaskSession {
    name: string;
}
