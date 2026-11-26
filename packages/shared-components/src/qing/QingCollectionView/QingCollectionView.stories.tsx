/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Meta, type StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import {
    QingCollectionView,
    type QingCollectionViewSnapshot,
    type QingCollectionViewActions,
} from "./QingCollectionView";
import { useMockedViewModel } from "../../core/viewmodel";
import { collectionSnapshot } from "./collection-snapshot";

function StoryView(snapshot: QingCollectionViewSnapshot): JSX.Element {
    const actions: QingCollectionViewActions = {
        back: fn(),
        refresh: fn(),
        search: fn(),
        setField: fn(),
        activate: fn(),
        toolbar: fn(),
        save: fn(),
        confirm: fn(),
    };
    const vm = useMockedViewModel(snapshot, actions);
    return <QingCollectionView vm={vm} />;
}

const meta = {
    title: "Qing/Collection",
    component: StoryView,
    args: collectionSnapshot,
    parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StoryView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { rows: [] } };
export const Loading: Story = { args: { loading: true } };
export const Error: Story = { args: { error: "连接失败，请检查地址与令牌。" } };
export const Editor: Story = {
    args: {
        editing: true,
        rows: [],
        fields: [{ id: "content", label: "记忆正文", value: "优先选择公共交通", type: "textarea" }],
    },
};
