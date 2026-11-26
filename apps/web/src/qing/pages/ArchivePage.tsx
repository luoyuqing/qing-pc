/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 归档
归档 = 给房间打上 u.qing.archived tag：
- 聊天列表里隐藏（见 stores/room-list-v3/isRoomVisible.ts 与 RoomListStoreV3.getSections）
- 只在本页出现
tag 存在服务端，换一台 PC 登录同一账号也能看到一致的归档结果。

注：手机版 qing 的归档存在 SharedPreferences（本机），两端不互通，这是手机端原有设计。
*/

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { subscribeRoomChanges } from "../room-listeners";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { QING_ARCHIVE_TAG } from "../../stores/room-list-v3/isRoomVisible";
import { Button, Card, Empty, ErrorBox, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

interface RoomInfo {
    id: string;
    name: string;
    /** 该会话的未读条数，用于列表里逐条标出 */
    unread: number;
}

export const ArchivePage: React.FC<{ onOpenRoom: (roomId: string) => void; onBack?: () => void }> = ({
    onOpenRoom,
    onBack,
}): React.ReactNode => {
    const [error, setError] = useState<string | null>(null);
    const [archived, setArchived] = useState<RoomInfo[]>([]);
    const [allRooms, setAllRooms] = useState<RoomInfo[]>([]);
    const [picking, setPicking] = useState(false);
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const p = palette();

    const client = (() => {
        try {
            return MatrixClientPeg.safeGet();
        } catch {
            return null;
        }
    })();

    const refresh = useCallback(() => {
        if (!client) return;
        const rooms = client.getRooms();
        const joined = rooms.filter((r) => r?.getMyMembership?.() === "join");
        const map = (r: Room): RoomInfo => ({
            id: r.roomId,
            name: r.name || r.roomId,
            unread: r.getUnreadNotificationCount?.() ?? 0,
        });

        setArchived(joined.filter((r) => r?.tags?.[QING_ARCHIVE_TAG]).map(map));
        setAllRooms(joined.map(map).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")));
    }, [client]);

    useEffect(() => {
        refresh();
        if (!client) return;
        return subscribeRoomChanges(client, refresh);
    }, [client, refresh]);

    const archive = async (roomId: string): Promise<void> => {
        if (!client) return;
        setBusy(roomId);
        try {
            await client.setRoomTag(roomId, QING_ARCHIVE_TAG, { order: 0.5 });
            refresh();
        } catch (e) {
            setError(_t("qing|text_162dff12", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const unarchive = async (roomId: string): Promise<void> => {
        if (!client) return;
        setBusy(roomId);
        try {
            await client.deleteRoomTag(roomId, QING_ARCHIVE_TAG);
            refresh();
        } catch (e) {
            setError(_t("qing|text_c60abf39", { v0: (e as Error).message }));
        }
        setBusy(null);
    };

    const archivedIds = new Set(archived.map((r) => r.id));
    const candidates = allRooms.filter(
        (r) => !archivedIds.has(r.id) && (!query || r.name.toLowerCase().includes(query.toLowerCase())),
    );

    return (
        <>
            <PageHeader
                title={_t("qing|text_5292ab1a")}
                onBack={onBack}
                subtitle={_t("qing|text_2f1f4055", { v0: archived.length })}
                right={
                    <Button onClick={() => setPicking((v) => !v)}>
                        {picking ? _t("qing|text_c0b3fbff") : _t("qing|text_0a388587")}
                    </Button>
                }
            />

            {picking && (
                <div style={{ padding: "0 24px 12px", flexShrink: 0 }}>
                    <input
                        type="search"
                        aria-label={_t("qing|text_44ce7ae9")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={_t("qing|text_808c6a3f")}
                        style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "8px 12px",
                            fontSize: 13,
                            borderRadius: 8,
                            border: `1px solid ${p.border}`,
                            background: p.bgAlt,
                            color: p.text,
                            outline: "none",
                        }}
                    />
                </div>
            )}

            <Scroll>
                {error && <ErrorBox message={error} />}
                {picking ? (
                    <>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8 }}>
                            {_t("qing|text_dec83d8f")}
                            {candidates.length} {_t("qing|text_e4e1048e")}
                        </div>
                        {candidates.slice(0, 200).map((r) => (
                            <Card
                                key={r.id}
                                onClick={busy ? undefined : () => void archive(r.id)}
                                style={{ marginBottom: 6, padding: "10px 14px", opacity: busy === r.id ? 0.5 : 1 }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: p.text }}>{r.name}</div>
                                    {r.unread > 0 && (
                                        <span
                                            style={{
                                                minWidth: 17,
                                                height: 17,
                                                padding: "0 5px",
                                                borderRadius: 9,
                                                background: p.danger,
                                                color: "#fff",
                                                fontSize: 10.5,
                                                lineHeight: "17px",
                                                textAlign: "center",
                                                fontWeight: 600,
                                                boxSizing: "border-box",
                                            }}
                                        >
                                            {r.unread > 99 ? "99+" : r.unread}
                                        </span>
                                    )}
                                    <span style={{ fontSize: 11.5, color: p.textDim }}>
                                        {busy === r.id ? _t("qing|text_7763947b") : _t("qing|text_5292ab1a")}
                                    </span>
                                </div>
                            </Card>
                        ))}
                        {candidates.length === 0 && <Empty text={_t("qing|text_9a34c06b")} />}
                    </>
                ) : archived.length === 0 ? (
                    <Empty text={_t("qing|text_67a4cfac")} />
                ) : (
                    archived.map((r) => (
                        <Card key={r.id} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (
                                            event.target === event.currentTarget &&
                                            (event.key === "Enter" || event.key === " ")
                                        ) {
                                            event.preventDefault();
                                            event.currentTarget.click();
                                        }
                                    }}
                                    onClick={() => onOpenRoom(r.id)}
                                    style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 13.5, color: p.text, fontWeight: 500 }}>{r.name}</span>
                                        {r.unread > 0 && (
                                            <span
                                                style={{
                                                    minWidth: 17,
                                                    height: 17,
                                                    padding: "0 5px",
                                                    borderRadius: 9,
                                                    background: p.danger,
                                                    color: "#fff",
                                                    fontSize: 10.5,
                                                    lineHeight: "17px",
                                                    textAlign: "center",
                                                    fontWeight: 600,
                                                    boxSizing: "border-box",
                                                }}
                                            >
                                                {r.unread > 99 ? "99+" : r.unread}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>
                                        {r.unread > 0
                                            ? _t("qing|text_e3c359e2", { v0: r.unread })
                                            : _t("qing|text_d4024568")}
                                    </div>
                                </div>
                                <Button disabled={busy === r.id} onClick={() => void unarchive(r.id)}>
                                    {busy === r.id ? "…" : _t("qing|text_be235f67")}
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </Scroll>
        </>
    );
};
