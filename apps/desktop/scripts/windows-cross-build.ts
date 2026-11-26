/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import * as fsp from "node:fs/promises";
import path from "node:path";

/** Detect the Windows-only CLI target before electron-builder initializes native rebuilding. */
export function isWindowsCrossBuild(platform: string, args: readonly string[]): boolean {
    return platform !== "win32" && args.some((arg) => arg === "--win" || arg === "-w" || arg.startsWith("--win="));
}

/** Reject a cross-built app whose required search module is absent or compiled for a different OS/architecture. */
export async function assertWindowsSearchBinary(resourcesDir: string, arch: string): Promise<void> {
    const file = path.join(
        resourcesDir,
        "app.asar.unpacked",
        "node_modules",
        "@matrix-org",
        `seshat-win32-${arch}`,
        "index.node",
    );
    const bytes = await fsp.readFile(file);
    const peOffset = bytes.length >= 64 ? bytes.readUInt32LE(0x3c) : 0;
    const expected = arch === "x64" ? 0x8664 : arch === "arm64" ? 0xaa64 : 0x14c;
    if (
        bytes.toString("ascii", 0, 2) !== "MZ" ||
        peOffset < 64 ||
        peOffset + 6 > bytes.length ||
        bytes.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0" ||
        bytes.readUInt16LE(peOffset + 4) !== expected
    ) {
        throw new Error(`Windows search module is not a valid ${arch} PE binary: ${file}`);
    }
}
