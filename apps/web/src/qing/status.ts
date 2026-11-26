/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { _t } from "../languageHandler";
import { textOf } from "./data";

/** Translate known protocol states while retaining unrecognized server data. */
export function statusLabel(value: unknown): string {
    const text = textOf(value);
    const labels: Record<string, string> = {
        ok: _t("qing|status_ok"),
        success: _t("qing|text_c0b3fbff"),
        failed: _t("qing|text_0bc1fb72"),
        error: _t("qing|text_0bc1fb72"),
        running: _t("qing|text_1f0eb99b"),
        stopped: _t("qing|text_f006455e"),
        enabled: _t("qing|text_dfb80223"),
        disabled: _t("qing|text_eb0c326b"),
        pending: _t("qing|text_d3d21191"),
        chat_completions: _t("qing|text_722a4afa"),
        responses: _t("qing|status_responses"),
    };
    return labels[text] ?? text;
}

/** Convert raw network/HTTP error strings into readable localized messages. */
export function friendlyError(error: unknown): string {
    const raw = error instanceof Error ? error.message : textOf(error);
    if (!raw) return _t("qing|err_server");
    if (/HTTP 401\b/i.test(raw)) return _t("qing|err_unauthorized");
    if (/HTTP 404\b/i.test(raw)) return _t("qing|err_not_found");
    if (/HTTP 5\d\d\b/i.test(raw)) return _t("qing|err_server");
    if (/timeout|timed out|AbortError/i.test(raw)) return _t("qing|err_timeout");
    if (/Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(raw)) return _t("qing|err_network");
    return raw;
}
