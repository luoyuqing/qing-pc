/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isWindowsCrossBuild, assertWindowsSearchBinary } from "./windows-cross-build.ts";

describe("Windows cross packaging", () => {
    let resourcesDir: string;
    let file: string;
    beforeEach(async () => {
        resourcesDir = await fsp.mkdtemp(path.join(os.tmpdir(), "qing-win-search-"));
        file = path.join(resourcesDir, "app.asar.unpacked/node_modules/@matrix-org/seshat-win32-x64/index.node");
        await fsp.mkdir(path.dirname(file), { recursive: true });
    });
    afterEach(async () => {
        await fsp.rm(resourcesDir, { recursive: true, force: true });
    });
    it("leaves native Windows and Linux packaging unchanged", () => {
        expect(isWindowsCrossBuild("win32", ["--win", "zip"])).toBe(false);
        expect(isWindowsCrossBuild("linux", ["--linux"])).toBe(false);
        expect(isWindowsCrossBuild("linux", ["--win", "zip"])).toBe(true);
        expect(isWindowsCrossBuild("darwin", ["-w"])).toBe(true);
    });
    it("requires the Windows search module rather than silently dropping search", async () => {
        await expect(assertWindowsSearchBinary(resourcesDir, "x64")).rejects.toThrow("ENOENT");
        await fsp.writeFile(file, Buffer.from("\x7fELF"));
        await expect(assertWindowsSearchBinary(resourcesDir, "x64")).rejects.toThrow("valid x64 PE");
    });
    it("accepts x64 PE modules and rejects a module built for arm64", async () => {
        const bytes = Buffer.alloc(128);
        bytes.write("MZ");
        bytes.writeUInt32LE(64, 0x3c);
        bytes.write("PE\0\0", 64);
        bytes.writeUInt16LE(0x8664, 68);
        await fsp.writeFile(file, bytes);
        await expect(assertWindowsSearchBinary(resourcesDir, "x64")).resolves.toBeUndefined();
        bytes.writeUInt16LE(0xaa64, 68);
        await fsp.writeFile(file, bytes);
        await expect(assertWindowsSearchBinary(resourcesDir, "x64")).rejects.toThrow("valid x64 PE");
    });
});
