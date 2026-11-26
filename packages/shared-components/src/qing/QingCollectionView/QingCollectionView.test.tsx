/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@test-utils";

import { MockViewModel } from "../../core/viewmodel";
import {
    QingCollectionView,
    type QingCollectionViewActions,
    type QingCollectionViewSnapshot,
} from "./QingCollectionView";
import { collectionSnapshot } from "./collection-snapshot";

function setup(snapshot: Partial<QingCollectionViewSnapshot> = {}): QingCollectionViewActions {
    const actions = {
        back: vi.fn(),
        refresh: vi.fn(),
        search: vi.fn(),
        setField: vi.fn(),
        activate: vi.fn(),
        toolbar: vi.fn(),
        save: vi.fn(),
        confirm: vi.fn(),
    };
    const vm = Object.assign(new MockViewModel({ ...collectionSnapshot, ...snapshot }), actions);
    render(<QingCollectionView vm={vm} />);
    return actions;
}

describe("QingCollectionView", () => {
    it("renders a collection and forwards row/search actions", () => {
        const actions = setup();
        fireEvent.click(screen.getByRole("button", { name: "查看与编辑" }));
        fireEvent.change(screen.getByRole("searchbox", { name: "搜索" }), { target: { value: "出行" } });
        expect(actions.activate).toHaveBeenCalledWith("fact", "open");
        expect(actions.search).toHaveBeenCalledWith("出行");
    });
    it("exposes loading and failure states", () => {
        setup({ loading: true, error: "连接失败" });
        expect(screen.getByRole("status")).toHaveTextContent("处理中…");
        expect(screen.getByRole("alert")).toHaveTextContent("连接失败");
    });
    it("forwards edits for labelled input types and submits the form", () => {
        const actions = setup({
            editing: true,
            rows: [],
            fields: [
                { id: "name", label: "名称", value: "任务" },
                { id: "body", label: "内容", value: "", type: "textarea" },
                { id: "enabled", label: "启用", value: "false", type: "checkbox" },
                {
                    id: "mode",
                    label: "频率",
                    value: "daily",
                    type: "select",
                    options: [
                        { value: "daily", label: "每天" },
                        { value: "weekly", label: "每周" },
                    ],
                },
            ],
        });
        fireEvent.change(screen.getByRole("textbox", { name: "名称" }), { target: { value: "晨报" } });
        fireEvent.change(screen.getByRole("textbox", { name: "内容" }), { target: { value: "总结日程" } });
        fireEvent.click(screen.getByRole("checkbox", { name: "启用" }));
        fireEvent.change(screen.getByRole("combobox", { name: "频率" }), { target: { value: "weekly" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));
        expect(actions.setField).toHaveBeenCalledWith("name", "晨报");
        expect(actions.setField).toHaveBeenCalledWith("body", "总结日程");
        expect(actions.setField).toHaveBeenCalledWith("enabled", "true");
        expect(actions.setField).toHaveBeenCalledWith("mode", "weekly");
        expect(actions.save).toHaveBeenCalledOnce();
    });
    it("lets the user cancel a confirmation", () => {
        const actions = setup({ confirmation: "确认吊销设备？" });
        fireEvent.click(screen.getByRole("button", { name: "取消" }));
        expect(actions.confirm).toHaveBeenCalledWith(false);
    });
    it("disables mutations while busy", () => {
        setup({ busy: true });
        expect(screen.getByRole("button", { name: "查看与编辑" })).toBeDisabled();
    });
    it("offers navigation, documentation and feedback alongside resource actions", () => {
        const actions = setup({
            toolbar: [{ id: "create", label: "新增" }],
            notice: "已保存",
            result: "检查结果",
            links: [{ url: "https://example.org/docs", label: "使用说明" }],
        });
        fireEvent.click(screen.getByRole("button", { name: "返回" }));
        fireEvent.click(screen.getByRole("button", { name: "刷新" }));
        fireEvent.click(screen.getByRole("button", { name: "新增" }));
        expect(actions.back).toHaveBeenCalledOnce();
        expect(actions.refresh).toHaveBeenCalledOnce();
        expect(actions.toolbar).toHaveBeenCalledWith("create");
        expect(screen.getByRole("link", { name: "使用说明" })).toHaveAttribute("href", "https://example.org/docs");
        expect(screen.getByRole("status")).toHaveTextContent("已保存");
        expect(screen.getByText("检查结果")).toBeVisible();
    });
    it("shows an empty collection and accepts an explicit confirmation", () => {
        const actions = setup({ rows: [], confirmation: "确认删除？" });
        expect(screen.getByText("暂无记录。")).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "确认" }));
        expect(actions.confirm).toHaveBeenCalledWith(true);
    });
    it("keeps a secret field and its explanation visible while saving", () => {
        setup({
            editing: true,
            busy: true,
            fields: [{ id: "token", label: "令牌", value: "", type: "password", hint: "留空保留原值" }],
        });
        expect(screen.getByLabelText(/令牌/)).toHaveAttribute("type", "password");
        expect(screen.getByLabelText(/令牌/)).toBeDisabled();
        expect(screen.getByText("留空保留原值")).toBeVisible();
        expect(screen.getByRole("button", { name: "处理中…" })).toBeDisabled();
    });
});
