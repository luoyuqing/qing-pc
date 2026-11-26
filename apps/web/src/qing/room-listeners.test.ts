/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { createClient, Room, ClientEvent, NotificationCountType } from "matrix-js-sdk/src/matrix";
import { subscribeRoomChanges } from "./room-listeners";

describe("room unread subscriptions", () => {
    it("observes existing and newly synced rooms and releases listeners on disposal", () => {
        const client = createClient({ baseUrl: "https://matrix.test", userId: "@user:matrix.test" });
        const first = new Room("!first:matrix.test", client, "@user:matrix.test");
        const second = new Room("!second:matrix.test", client, "@user:matrix.test");
        vi.spyOn(client, "getRooms").mockReturnValue([first]);
        const update = vi.fn();
        const dispose = subscribeRoomChanges(client, update);
        update.mockClear();
        first.setUnreadNotificationCount(NotificationCountType.Total, 2);
        expect(update).toHaveBeenCalledOnce();
        client.emit(ClientEvent.Room, second);
        update.mockClear();
        second.setUnreadNotificationCount(NotificationCountType.Total, 1);
        expect(update).toHaveBeenCalledOnce();
        dispose();
        update.mockClear();
        first.setUnreadNotificationCount(NotificationCountType.Total, 0);
        second.setUnreadNotificationCount(NotificationCountType.Total, 0);
        client.emit(ClientEvent.Room, first);
        expect(update).not.toHaveBeenCalled();
    });
});
