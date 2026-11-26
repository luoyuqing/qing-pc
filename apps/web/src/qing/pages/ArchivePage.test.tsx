/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "test-utils-rtl";
import { createClient, Room, type MatrixClient, RoomEvent } from "matrix-js-sdk/src/matrix";

import { ArchivePage } from "./ArchivePage";
import { QING_ARCHIVE_TAG } from "../../stores/room-list-v3/isRoomVisible";

const current = vi.hoisted(() => ({ client: null as MatrixClient | null }));
vi.mock("../../MatrixClientPeg", () => ({ MatrixClientPeg: { safeGet: () => current.client } }));

describe("archived conversation management", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        current.client = null;
    });
    it("archives and restores a joined room by its real ID and disposes its listeners", async () => {
        const client = createClient({ baseUrl: "https://matrix.test", userId: "@user:matrix.test" });
        const room = new Room("!room:matrix.test", client, "@user:matrix.test");
        room.name = "Project";
        vi.spyOn(room, "getMyMembership").mockReturnValue("join");
        vi.spyOn(client, "getRooms").mockReturnValue([room]);
        const archive = vi.spyOn(client, "setRoomTag").mockImplementation(async () => {
            room.tags[QING_ARCHIVE_TAG] = { order: 0.5 };
            return {};
        });
        const restore = vi.spyOn(client, "deleteRoomTag").mockImplementation(async () => {
            delete room.tags[QING_ARCHIVE_TAG];
            return {};
        });
        current.client = client;
        const open = vi.fn();
        const { unmount } = render(<ArchivePage onOpenRoom={open} />);
        fireEvent.click(screen.getByRole("button", { name: "Archived conversations" }));
        fireEvent.click(await screen.findByText("Project"));
        await waitFor(() => expect(archive).toHaveBeenCalledWith(room.roomId, QING_ARCHIVE_TAG, { order: 0.5 }));
        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        fireEvent.click(await screen.findByText("Project"));
        expect(open).toHaveBeenCalledWith(room.roomId);
        fireEvent.click(screen.getByRole("button", { name: "Unarchive" }));
        await waitFor(() => expect(restore).toHaveBeenCalledWith(room.roomId, QING_ARCHIVE_TAG));
        unmount();
        expect(room.listenerCount(RoomEvent.UnreadNotifications)).toBe(0);
    });
    it("shows the empty state when no rooms are archived", () => {
        render(<ArchivePage onOpenRoom={vi.fn()} />);
        expect(screen.getByText(/No archived conversations/)).toBeVisible();
    });
});
