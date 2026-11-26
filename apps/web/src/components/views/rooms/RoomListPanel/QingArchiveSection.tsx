/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useCallback, useEffect, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import { _t } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { subscribeRoomChanges } from "../../../../qing/room-listeners";
import { palette } from "../../../../qing/theme";
import { QING_ARCHIVE_TAG } from "../../../../stores/room-list-v3/isRoomVisible";

const EXPANDED_STORAGE_KEY = "qing.archive.expanded";

interface ArchivedRoomItem {
    id: string;
    name: string;
    unread: number;
}

function readExpandedState(): boolean {
    try {
        return localStorage.getItem(EXPANDED_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function saveExpandedState(expanded: boolean): void {
    try {
        localStorage.setItem(EXPANDED_STORAGE_KEY, expanded ? "1" : "0");
    } catch {
        // Ignore storage errors in restricted environments.
    }
}

/**
 * Collapsible archive drawer rendered under the Chat tab's room list.
 * Collapsed by default; expanded/collapsed state persists across sessions.
 */
export const QingArchiveSection: React.FC = () => {
    const [expanded, setExpanded] = useState<boolean>(readExpandedState);
    const [archived, setArchived] = useState<ArchivedRoomItem[]>([]);
    const [allRooms, setAllRooms] = useState<ArchivedRoomItem[]>([]);
    const [picking, setPicking] = useState(false);
    const [query, setQuery] = useState("");
    const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const p = palette();

    const getClient = useCallback(() => {
        try {
            return MatrixClientPeg.get();
        } catch {
            return null;
        }
    }, []);

    const refresh = useCallback(() => {
        const client = getClient();
        if (!client) return;
        const joined = client.getRooms().filter((room) => room?.getMyMembership?.() === "join");
        const toItem = (room: Room): ArchivedRoomItem => ({
            id: room.roomId,
            name: room.name || room.roomId,
            unread: room.getUnreadNotificationCount?.() ?? 0,
        });
        setArchived(joined.filter((room) => Boolean(room?.tags?.[QING_ARCHIVE_TAG])).map(toItem));
        setAllRooms(joined.map(toItem).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")));
    }, [getClient]);

    useEffect(() => {
        refresh();
        const client = getClient();
        if (!client || typeof client.on !== "function") return;
        return subscribeRoomChanges(client, refresh);
    }, [getClient, refresh]);

    const toggleExpanded = (): void => {
        setExpanded((prev) => {
            const next = !prev;
            saveExpandedState(next);
            if (!next) setPicking(false);
            return next;
        });
    };

    const openRoom = (roomId: string): void => {
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: undefined,
        });
    };

    const unarchiveRoom = async (roomId: string): Promise<void> => {
        const client = getClient();
        if (!client) return;
        setBusyRoomId(roomId);
        setError(null);
        try {
            await client.deleteRoomTag(roomId, QING_ARCHIVE_TAG);
            refresh();
        } catch (err) {
            setError(_t("qing|text_c60abf39", { v0: (err as Error).message }));
        }
        setBusyRoomId(null);
    };

    const archiveRoom = async (roomId: string): Promise<void> => {
        const client = getClient();
        if (!client) return;
        setBusyRoomId(roomId);
        setError(null);
        try {
            await client.setRoomTag(roomId, QING_ARCHIVE_TAG, { order: 0.5 });
            refresh();
        } catch (err) {
            setError(_t("qing|text_162dff12", { v0: (err as Error).message }));
        }
        setBusyRoomId(null);
    };

    const totalUnread = archived.reduce((sum, item) => sum + item.unread, 0);
    const archivedIds = new Set(archived.map((item) => item.id));
    const candidates = allRooms.filter(
        (item) => !archivedIds.has(item.id) && (!query || item.name.toLowerCase().includes(query.toLowerCase())),
    );

    return (
        <div
            data-testid="qing-archive-section"
            style={{
                borderTop: `1px solid ${p.border}`,
                background: p.bg,
                flexShrink: 0,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", padding: "6px 10px", gap: 6 }}>
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={toggleExpanded}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 6px",
                        border: "none",
                        borderRadius: 6,
                        background: "transparent",
                        color: p.text,
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 500,
                        textAlign: "left",
                    }}
                >
                    <span aria-hidden="true" style={{ fontSize: 10, color: p.textDim, width: 10 }}>
                        {expanded ? "▾" : "▸"}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {_t("qing|text_5292ab1a")} ({archived.length})
                    </span>
                    {!expanded && totalUnread > 0 && (
                        <span
                            style={{
                                minWidth: 16,
                                height: 16,
                                padding: "0 4px",
                                borderRadius: 8,
                                background: p.danger,
                                color: "#fff",
                                fontSize: 10,
                                lineHeight: "16px",
                                textAlign: "center",
                                fontWeight: 600,
                            }}
                        >
                            {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                    )}
                </button>
                {expanded && (
                    <button
                        type="button"
                        onClick={() => setPicking((prev) => !prev)}
                        style={{
                            border: `1px solid ${p.border}`,
                            borderRadius: 6,
                            background: "transparent",
                            color: p.textDim,
                            cursor: "pointer",
                            fontSize: 11.5,
                            padding: "2px 8px",
                            flexShrink: 0,
                        }}
                    >
                        {picking ? _t("qing|text_c0b3fbff") : _t("qing|text_0a388587")}
                    </button>
                )}
            </div>

            {expanded && (
                <div style={{ maxHeight: 240, overflowY: "auto", padding: "0 10px 8px" }}>
                    {error && (
                        <div role="alert" style={{ fontSize: 11.5, color: p.danger, padding: "4px 6px" }}>
                            {error}
                        </div>
                    )}
                    {picking && (
                        <div style={{ padding: "4px 0 6px" }}>
                            <input
                                type="search"
                                aria-label={_t("qing|text_44ce7ae9")}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={_t("qing|text_808c6a3f")}
                                style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "5px 8px",
                                    fontSize: 12,
                                    borderRadius: 6,
                                    border: `1px solid ${p.border}`,
                                    background: p.bgAlt,
                                    color: p.text,
                                    outline: "none",
                                }}
                            />
                            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                {candidates.slice(0, 50).map((room) => (
                                    <button
                                        key={room.id}
                                        type="button"
                                        disabled={busyRoomId === room.id}
                                        onClick={() => void archiveRoom(room.id)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            padding: "5px 8px",
                                            borderRadius: 6,
                                            border: `1px solid ${p.border}`,
                                            background: p.bgAlt,
                                            color: p.text,
                                            cursor: "pointer",
                                            fontSize: 12,
                                            textAlign: "left",
                                        }}
                                    >
                                        <span
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {room.name}
                                        </span>
                                        <span style={{ fontSize: 11, color: p.textDim }}>
                                            {_t("qing|text_5292ab1a")}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!picking && archived.length === 0 && (
                        <div style={{ fontSize: 12, color: p.textDim, padding: "6px 6px" }}>
                            {_t("qing|text_67a4cfac")}
                        </div>
                    )}

                    {!picking &&
                        archived.map((room) => (
                            <div
                                key={room.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "5px 6px",
                                    borderRadius: 6,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => openRoom(room.id)}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        border: "none",
                                        background: "transparent",
                                        padding: 0,
                                        textAlign: "left",
                                        cursor: "pointer",
                                        color: p.text,
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span
                                            style={{
                                                fontSize: 12.5,
                                                fontWeight: 500,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {room.name}
                                        </span>
                                        {room.unread > 0 && (
                                            <span
                                                style={{
                                                    minWidth: 16,
                                                    height: 16,
                                                    padding: "0 4px",
                                                    borderRadius: 8,
                                                    background: p.danger,
                                                    color: "#fff",
                                                    fontSize: 10,
                                                    lineHeight: "16px",
                                                    textAlign: "center",
                                                    fontWeight: 600,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {room.unread > 99 ? "99+" : room.unread}
                                            </span>
                                        )}
                                    </div>
                                    {room.unread > 0 && (
                                        <div style={{ fontSize: 11, color: p.textDim }}>
                                            {_t("qing|text_e3c359e2", { v0: room.unread })}
                                        </div>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    disabled={busyRoomId === room.id}
                                    onClick={() => void unarchiveRoom(room.id)}
                                    style={{
                                        border: `1px solid ${p.border}`,
                                        borderRadius: 6,
                                        background: "transparent",
                                        color: p.textDim,
                                        cursor: "pointer",
                                        fontSize: 11,
                                        padding: "2px 6px",
                                        flexShrink: 0,
                                    }}
                                >
                                    {busyRoomId === room.id ? "…" : _t("qing|text_be235f67")}
                                </button>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
};
