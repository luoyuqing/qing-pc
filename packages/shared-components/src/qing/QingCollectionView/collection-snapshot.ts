/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type QingCollectionViewSnapshot } from "./QingCollectionView";

/** Example state for isolated collection stories and control tests. */
export const collectionSnapshot: QingCollectionViewSnapshot = {
    title: "记忆库",
    hint: "查看、搜索与编辑助理的长期记忆",
    loading: false,
    busy: false,
    error: "",
    notice: "",
    query: "",
    searchable: true,
    rows: [
        {
            id: "fact",
            title: "出行偏好",
            description: "优先选择公共交通",
            actions: [{ id: "open", label: "查看与编辑" }],
        },
    ],
    fields: [],
    toolbar: [],
    editing: false,
    confirmation: "",
    result: "",
    labels: {
        back: "返回",
        refresh: "刷新",
        search: "搜索",
        save: "保存",
        cancel: "取消",
        confirm: "确认",
        loading: "处理中…",
        empty: "暂无记录。",
    },
};
