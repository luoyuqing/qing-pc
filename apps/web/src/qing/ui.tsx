/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/* Qing PC · Element 主题下的通用面板控件 */

import { _t } from "../languageHandler";
import React from "react";
import { Heading } from "@vector-im/compound-web";
import { palette } from "./theme";

export const PageHeader: React.FC<{
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    onBack?: () => void;
}> = ({ title, subtitle, right, onBack }): React.ReactNode => {
    const p = palette();
    return (
        <div
            className="mx_QingShell_header"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "20px 24px 12px",
                flexShrink: 0,
            }}
        >
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    style={{
                        border: "none",
                        background: "transparent",
                        color: p.textDim,
                        cursor: "pointer",
                        fontSize: 16,
                        padding: "2px 4px",
                        flexShrink: 0,
                    }}
                    title={_t("qing|text_572cf45b")}
                    aria-label={_t("qing|text_572cf45b")}
                >
                    ←
                </button>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
                <Heading as="h1" size="md" style={{ color: p.text }}>
                    {title}
                </Heading>
                {subtitle && <div style={{ fontSize: 12, color: p.textDim, marginTop: 3 }}>{subtitle}</div>}
            </div>
            {right && (
                <div className="mx_QingShell_headerActions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {right}
                </div>
            )}
        </div>
    );
};

export const Button: React.FC<{
    "children": React.ReactNode;
    "onClick"?: React.MouseEventHandler<HTMLButtonElement>;
    "disabled"?: boolean;
    "variant"?: "primary" | "ghost";
    "title"?: string;
    "aria-label"?: string;
}> = ({ children, onClick, disabled, variant = "ghost", title, "aria-label": ariaLabel }): React.ReactNode => {
    const p = palette();
    const primary = variant === "primary";
    return (
        <button
            type="button"
            title={title}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={onClick}
            style={{
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
                border: primary ? "none" : `1px solid ${p.divider}`,
                background: primary ? p.accent : "transparent",
                color: primary ? "#fff" : p.text,
                transition: "opacity 120ms ease",
            }}
        >
            {children}
        </button>
    );
};

export const Pill: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
}> = ({ label, active, onClick }): React.ReactNode => {
    const p = palette();
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            style={{
                padding: "6px 14px",
                fontSize: 13,
                borderRadius: 999,
                cursor: "pointer",
                border: "none",
                background: active ? p.accent : p.bgAlt,
                color: active ? "#fff" : p.textDim,
                fontWeight: active ? 600 : 400,
            }}
        >
            {label}
        </button>
    );
};

export const Card: React.FC<{
    "children": React.ReactNode;
    "onClick"?: () => void;
    "style"?: React.CSSProperties;
    "aria-expanded"?: boolean;
}> = ({ children, onClick, style, "aria-expanded": ariaExpanded }): React.ReactNode => {
    const p = palette();
    return (
        <div
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-expanded={ariaExpanded}
            onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    event.currentTarget.click();
                }
            }}
            onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target !== event.currentTarget && target.closest("button, input, select, textarea, a")) return;
                onClick?.();
            }}
            style={{
                padding: 14,
                borderRadius: 12,
                background: p.bgAlt,
                border: `1px solid ${p.divider}`,
                boxSizing: "border-box",
                cursor: onClick ? "pointer" : "default",
                ...style,
            }}
        >
            {children}
        </div>
    );
};

export const Scroll: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
    children,
    style,
}): React.ReactNode => (
    <div
        className="mx_QingShell_scroll"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 24px 32px", ...style }}
    >
        <div className="mx_QingShell_content">{children}</div>
    </div>
);

export const Loading: React.FC<{ label?: string }> = ({ label = _t("qing|text_4927a53b") }): React.ReactNode => {
    const p = palette();
    return (
        <div role="status" style={{ padding: 40, textAlign: "center", color: p.textDim, fontSize: 13 }}>
            {label}
        </div>
    );
};

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({
    message,
    onRetry,
}): React.ReactNode => {
    const p = palette();
    return (
        <div style={{ padding: "24px 0" }}>
            <div role="alert" style={{ color: p.danger, fontSize: 13, lineHeight: 1.6, wordBreak: "break-word" }}>
                {message}
            </div>
            {onRetry && (
                <div style={{ marginTop: 12 }}>
                    <Button onClick={onRetry}>{_t("qing|text_b8784c8d")}</Button>
                </div>
            )}
        </div>
    );
};

export const Empty: React.FC<{ text: string }> = ({ text }): React.ReactNode => {
    const p = palette();
    return <div style={{ padding: 40, textAlign: "center", color: p.textDim, fontSize: 13 }}>{text}</div>;
};
