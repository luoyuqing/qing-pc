/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { ClientEvent, RoomEvent, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

/** Observe unread counts on rooms, since the client does not re-emit that event. */
export function subscribeRoomChanges(client: MatrixClient, listener: () => void): () => void {
    const rooms = new Set<Room>();
    const attach = (room: Room): void => {
        if (rooms.has(room)) return;
        rooms.add(room);
        room.on(RoomEvent.UnreadNotifications, listener);
        room.on(RoomEvent.Tags, listener);
        room.on(RoomEvent.MyMembership, listener);
        listener();
    };
    for (const room of client.getRooms()) attach(room);
    client.on(ClientEvent.Room, attach);
    return () => {
        client.off(ClientEvent.Room, attach);
        for (const room of rooms) {
            room.off(RoomEvent.UnreadNotifications, listener);
            room.off(RoomEvent.Tags, listener);
            room.off(RoomEvent.MyMembership, listener);
        }
        rooms.clear();
    };
}
