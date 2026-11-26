/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "test-utils-rtl";

import { QingShell } from "./QingShell";

const { stop, subscribe } = vi.hoisted(() => ({ stop: vi.fn(), subscribe: vi.fn() }));
vi.mock("./spacePanel", () => ({}));
vi.mock("../MatrixClientPeg", () => ({ MatrixClientPeg: { get: () => ({ getRooms: () => [] }) } }));
vi.mock("./room-listeners", () => ({ subscribeRoomChanges: subscribe }));
vi.mock("./pages/BriefingPage", () => ({ BriefingPage: () => <div>Briefing content</div> }));
vi.mock("./pages/TasksPage", () => ({
    TasksPage: ({ onOpenRoom }: { onOpenRoom: (id: string) => void }) => (
        <button onClick={() => onOpenRoom("!real:matrix")}>Open real room</button>
    ),
}));
vi.mock("./pages/ServicesPage", () => ({ ServicesPage: () => <div>Services content</div> }));
vi.mock("./pages/SettingsPage", () => ({
    SettingsPage: ({ onNavigateElement }: { onNavigateElement: () => void }) => (
        <button onClick={onNavigateElement}>Open account settings</button>
    ),
}));

describe("Qing shell navigation", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        document.body.innerHTML = "";
    });
    it("keeps five tabs and makes the underlying chat inert only while an overlay is open", async () => {
        subscribe.mockReturnValue(stop);
        const content = document.createElement("main");
        content.className = "mx_QingShell_elementContent";
        content.textContent = "Persistent chat";
        document.body.append(content);
        const { unmount } = render(<QingShell />);
        expect(screen.getByRole("navigation", { name: "Main navigation" }).querySelectorAll("button")).toHaveLength(5);
        fireEvent.click(screen.getByRole("button", { name: "Briefing" }));
        await screen.findByText("Briefing content");
        expect(content.inert).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
        fireEvent.click(await screen.findByRole("button", { name: "Open real room" }));
        expect(location.hash).toBe("#/room/!real%3Amatrix");
        expect(content.inert).toBe(false);
        expect(content.textContent).toBe("Persistent chat");
        unmount();
        expect(stop).toHaveBeenCalledOnce();
    });
    it("returns to chat when opening native settings", async () => {
        subscribe.mockReturnValue(stop);
        render(<QingShell />);
        fireEvent.click(screen.getByRole("button", { name: "Settings" }));
        fireEvent.click(await screen.findByRole("button", { name: "Open account settings" }));
        expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute("aria-current", "page");
    });
});
