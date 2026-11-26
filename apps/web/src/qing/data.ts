/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** Read a JSON object without assuming the server's optional fields exist. */
export function recordOf(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

/** Read object rows from an array or an items envelope. */
export function recordsOf(value: unknown): Record<string, unknown>[] {
    const rows = Array.isArray(value) ? value : recordOf(value).items;
    return Array.isArray(rows)
        ? rows.filter((row) => row !== null && typeof row === "object" && !Array.isArray(row)).map(recordOf)
        : [];
}

/** Format only scalar values; never render an object as [object Object]. */
export function textOf(value: unknown): string {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

/** Strip the fact header already retained by the server when saving a vault note. */
export function vaultBody(value: string): string {
    const lines = value.split("\n");
    let index = 0;
    while (index < lines.length) {
        const line = lines[index].trim();
        if ((index === 0 && line.startsWith("# ")) || !line || /^[a-z_]+:\s/.test(line)) index++;
        else break;
    }
    return lines.slice(index).join("\n").trim();
}

/** Format an arbitrary server response into readable key-value lines without dumping raw JSON. */
export function formatHumanResult(value: unknown, depth = 0): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    const indent = "  ".repeat(depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return "—";
        return value.map((item) => `${indent}- ${formatHumanResult(item, depth + 1)}`).join("\n");
    }
    const entries = Object.entries(recordOf(value)).filter(([, v]) => v !== undefined && v !== null && v !== "");
    if (entries.length === 0) return "—";
    return entries
        .map(([k, v]) => {
            if (typeof v === "object") {
                return `${indent}${k}:\n${formatHumanResult(v, depth + 1)}`;
            }
            return `${indent}${k}: ${textOf(v)}`;
        })
        .join("\n");
}
