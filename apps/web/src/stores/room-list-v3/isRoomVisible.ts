/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";

/**
 * 清助理归档 tag。
 *
 * 用自定义 tag（`u.` 是 Matrix 规范里留给应用的命名空间）而不是 `m.lowpriority`，
 * 避免和 Element 原生的「低优先级」分区抢语义。
 * tag 存在服务端，所以同一账号在别的 PC 上也能看到一致的归档结果。
 */
export const QING_ARCHIVE_TAG = "u.qing.archived";

/** 会话是否已被归档（归档后从聊天列表隐藏，只在「归档」页出现） */
export function isRoomArchived(room?: Room): boolean {
    return !!room?.tags?.[QING_ARCHIVE_TAG];
}

/**
 * Determines whether a room should be visible in the room list
 * @param room - The room to check for visibility
 */
export function isRoomVisible(room?: Room): boolean {
    if (!room) return false;

    // hide space rooms as they'll be shown in the SpacePanel
    if (room.isSpaceRoom()) return false;

    // local rooms shouldn't show up anywhere
    if (isLocalRoom(room)) return false;

    // 已归档的会话不在聊天列表里出现（否则归档等于没做）
    if (isRoomArchived(room)) return false;

    return true; // default
}
