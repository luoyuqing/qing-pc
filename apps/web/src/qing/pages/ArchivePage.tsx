/*
Qing PC · 归档
归档 = 给房间打上 u.qing.archived tag：
- 聊天列表里隐藏（见 stores/room-list-v3/isRoomVisible.ts 与 RoomListStoreV3.getSections）
- 只在本页出现
tag 存在服务端，换一台 PC 登录同一账号也能看到一致的归档结果。

注：手机版 qing 的归档存在 SharedPreferences（本机），两端不互通，这是手机端原有设计。
*/

import React, { useCallback, useEffect, useState } from "react";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { QING_ARCHIVE_TAG } from "../../stores/room-list-v3/isRoomVisible";
import { Button, Card, Empty, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

const ROOM_TAGS_EVENT = "Room.tags";
const ROOM_UNREAD_EVENT = "Room.unread_notifications";

interface RoomInfo {
    id: string;
    name: string;
    /** 该会话的未读条数，用于列表里逐条标出 */
    unread: number;
}

export const ArchivePage: React.FC<{ onOpenRoom: (roomId: string) => void }> = ({ onOpenRoom }) => {
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
        const rooms: any[] = client.getRooms?.() || [];
        const joined = rooms.filter((r) => r?.getMyMembership?.() === "join");
        const map = (r: any): RoomInfo => ({
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
        // 打/撤 tag 会触发 Room.tags，列表随之刷新
        client.on(ROOM_TAGS_EVENT as any, refresh);
        client.on(ROOM_UNREAD_EVENT as any, refresh);
        return () => {
            client.off(ROOM_TAGS_EVENT as any, refresh);
            client.off(ROOM_UNREAD_EVENT as any, refresh);
        };
    }, [client, refresh]);

    const archive = async (roomId: string) => {
        if (!client) return;
        setBusy(roomId);
        try {
            await client.setRoomTag(roomId, QING_ARCHIVE_TAG, { order: 0.5 });
            refresh();
        } catch (e) {
            window.alert(`归档失败：${(e as Error).message}`);
        }
        setBusy(null);
    };

    const unarchive = async (roomId: string) => {
        if (!client) return;
        setBusy(roomId);
        try {
            await client.deleteRoomTag(roomId, QING_ARCHIVE_TAG);
            refresh();
        } catch (e) {
            window.alert(`取消归档失败：${(e as Error).message}`);
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
                title="归档"
                subtitle={`已归档 ${archived.length} 个会话 · 已从聊天列表隐藏`}
                right={<Button onClick={() => setPicking((v) => !v)}>{picking ? "完成" : "归档会话"}</Button>}
            />

            {picking && (
                <div style={{ padding: "0 24px 12px", flexShrink: 0 }}>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索要归档的会话…"
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
                {picking ? (
                    <>
                        <div style={{ fontSize: 12, color: p.textDim, marginBottom: 8 }}>
                            点一下即归档，并立即从聊天列表消失（{candidates.length} 个可选）
                        </div>
                        {candidates.slice(0, 200).map((r) => (
                            <Card
                                key={r.id}
                                onClick={busy ? undefined : () => void archive(r.id)}
                                style={{ marginBottom: 6, padding: "10px 14px", opacity: busy === r.id ? 0.5 : 1 }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: p.text }}>
                                        {r.name}
                                    </div>
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
                                        {busy === r.id ? "归档中…" : "归档"}
                                    </span>
                                </div>
                            </Card>
                        ))}
                        {candidates.length === 0 && <Empty text="没有可归档的会话。" />}
                    </>
                ) : archived.length === 0 ? (
                    <Empty text="还没有归档的会话。点右上角「归档会话」把不常看的会话收起来，它们会从聊天列表消失。" />
                ) : (
                    archived.map((r) => (
                        <Card key={r.id} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div
                                    onClick={() => onOpenRoom(r.id)}
                                    style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 13.5, color: p.text, fontWeight: 500 }}>
                                            {r.name}
                                        </span>
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
                                        {r.unread > 0 ? `${r.unread} 条未读` : "点击打开"}
                                    </div>
                                </div>
                                <Button disabled={busy === r.id} onClick={() => void unarchive(r.id)}>
                                    {busy === r.id ? "…" : "取消归档"}
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </Scroll>
        </>
    );
};
