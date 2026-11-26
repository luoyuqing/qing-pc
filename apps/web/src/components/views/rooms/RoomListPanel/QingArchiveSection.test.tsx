/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "test-utils-rtl";

import { QingArchiveSection } from "./QingArchiveSection";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { QING_ARCHIVE_TAG } from "../../../../stores/room-list-v3/isRoomVisible";
import dis from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";

function makeRoom(id: string, name: string, archived: boolean, unread = 0) {
    return {
        roomId: id,
        name,
        tags: archived ? { [QING_ARCHIVE_TAG]: { order: 0.5 } } : {},
        getMyMembership: () => "join",
        getUnreadNotificationCount: () => unread,
        on: vi.fn(),
        off: vi.fn(),
    };
}

describe("QingArchiveSection", () => {
    beforeEach(() => {
        cleanup();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("is collapsed by default and persists expanded state across remounts", () => {
        const archivedRoom = makeRoom("!a:matrix", "归档房间", true, 3);
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue({
            getRooms: () => [archivedRoom],
            on: vi.fn(),
            off: vi.fn(),
        } as unknown as ReturnType<typeof MatrixClientPeg.get>);

        const { unmount } = render(<QingArchiveSection />);
        const toggle = screen.getByRole("button", { expanded: false });
        expect(screen.queryByText("归档房间")).toBeNull();

        fireEvent.click(toggle);
        expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
        expect(screen.getByText("归档房间")).toBeTruthy();
        expect(screen.getByText("3")).toBeTruthy();
        unmount();

        render(<QingArchiveSection />);
        expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
        expect(screen.getByText("归档房间")).toBeTruthy();
    });

    it("opens an archived room and unarchives it", async () => {
        localStorage.setItem("qing.archive.expanded", "1");
        const archivedRoom = makeRoom("!a:matrix", "归档房间", true, 2);
        const deleteRoomTag = vi.fn().mockImplementation(async () => {
            delete archivedRoom.tags[QING_ARCHIVE_TAG];
        });
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue({
            getRooms: () => [archivedRoom],
            deleteRoomTag,
            on: vi.fn(),
            off: vi.fn(),
        } as unknown as ReturnType<typeof MatrixClientPeg.get>);
        const dispatchSpy = vi.spyOn(dis, "dispatch");

        render(<QingArchiveSection />);
        fireEvent.click(screen.getByText("归档房间"));
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.ViewRoom,
                room_id: "!a:matrix",
            }),
        );

        fireEvent.click(screen.getByRole("button", { name: "Unarchive" }));
        await waitFor(() => expect(deleteRoomTag).toHaveBeenCalledWith("!a:matrix", QING_ARCHIVE_TAG));
    });
});
