/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** Live Element theme tokens, with Qing's existing purple brand accent. */
export const QING = {
    railWidth: 60,
    accent: "var(--qing-accent)",
    accentSoft: "var(--qing-accent-soft)",
    bg: "var(--cpd-color-bg-canvas-default)",
    bgAlt: "var(--cpd-color-bg-subtle-primary)",
    border: "var(--cpd-color-border-interactive-secondary)",
    divider: "var(--cpd-color-border-disabled)",
    text: "var(--cpd-color-text-primary)",
    textDim: "var(--cpd-color-text-secondary)",
    danger: "var(--cpd-color-text-critical-primary)",
};

/** CSS variables update mounted panels when Element changes theme. */
export function palette(): typeof QING {
    return QING;
}
