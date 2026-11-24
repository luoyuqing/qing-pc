/*
Qing PC · 归档
手机端的归档是「本机偏好」（qing.chat_list.archived_rooms，存 SharedPreferences），
不写 Matrix tag、不跨设备同步。PC 端同样用本机存储，语义保持一致：
只影响这台设备怎么显示，不会动服务器上的房间。
*/

import React, { useCallback, useEffect, useState } from "react";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { Button, Card, Empty, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

const KEY = "qing.pc.archivedRooms";

function readArchived(): string[] {
    try {
        const raw = window.localStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
        return [];
    }
}

function writeArchived(ids: string[]): void {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids))));
}

interface RoomInfo {
    id: string;
    name: string;
    avatarUrl?: string;
}

export const ArchivePage: React.FC<{ onOpenRoom: (roomId: string) => void }> = ({ onOpenRoom }) => {
    const [archived, setArchived] = useState<string[]>(readArchived());
    const [allRooms, setAllRooms] = useState<RoomInfo[]>([]);
    const [picking, setPicking] = useState(false);
    const [query, setQuery] = useState("");
    const p = palette();

    const loadRooms = useCallback(() => {
        let client: any;
        try {
            client = MatrixClientPeg.safeGet();
        } catch {
            setAllRooms([]);
            return;
        }
        const rooms = (client.getRooms?.() || [])
            .filter((r: any) => r?.getMyMembership?.() === "join")
            .map((r: any) => ({
                id: r.roomId,
                name: r.name || r.roomId,
                avatarUrl: r.getAvatarUrl?.(client.getHomeserverUrl(), 32, 32, "crop") || undefined,
            }))
            .sort((a: RoomInfo, b: RoomInfo) => a.name.localeCompare(b.name, "zh-Hans-CN"));
        setAllRooms(rooms);
    }, []);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    const byId = new Map(allRooms.map((r) => [r.id, r]));
    const archivedRooms = archived.map((id) => byId.get(id) || { id, name: id });

    const add = (id: string) => {
        const next = [...archived, id];
        setArchived(next);
        writeArchived(next);
    };

    const remove = (id: string) => {
        const next = archived.filter((x) => x !== id);
        setArchived(next);
        writeArchived(next);
    };

    const candidates = allRooms.filter(
        (r) => !archived.includes(r.id) && (!query || r.name.toLowerCase().includes(query.toLowerCase())),
    );

    return (
        <>
            <PageHeader
                title="归档"
                subtitle={`已归档 ${archived.length} 个会话 · 仅本机生效`}
                right={
                    <Button onClick={() => setPicking((v) => !v)}>{picking ? "完成" : "添加归档"}</Button>
                }
            />

            {picking && (
                <div style={{ padding: "0 24px 12px", flexShrink: 0 }}>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索会话…"
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
                            点一下加入归档（共 {candidates.length} 个可选）
                        </div>
                        {candidates.slice(0, 200).map((r) => (
                            <Card
                                key={r.id}
                                onClick={() => add(r.id)}
                                style={{ marginBottom: 6, padding: "10px 14px" }}
                            >
                                <div style={{ fontSize: 13.5, color: p.text }}>{r.name}</div>
                            </Card>
                        ))}
                        {candidates.length === 0 && <Empty text="没有可添加的会话。" />}
                    </>
                ) : archivedRooms.length === 0 ? (
                    <Empty text="还没有归档的会话。点右上角「添加归档」把不常看的会话收起来。" />
                ) : (
                    archivedRooms.map((r) => (
                        <Card key={r.id} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div
                                    onClick={() => onOpenRoom(r.id)}
                                    style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                                >
                                    <div style={{ fontSize: 13.5, color: p.text, fontWeight: 500 }}>{r.name}</div>
                                    <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 2 }}>点击打开</div>
                                </div>
                                <Button onClick={() => remove(r.id)}>移出</Button>
                            </div>
                        </Card>
                    ))
                )}
            </Scroll>
        </>
    );
};
