/* Qing PC · 面板通用组件（自绘，避免依赖 Element 内部设计系统的版本变动） */

import React from "react";
import { palette } from "./theme";

export const PageHeader: React.FC<{
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    onBack?: () => void;
}> = ({ title, subtitle, right, onBack }) => {
    const p = palette();
    return (
        <div
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
                    title="返回"
                >
                    ←
                </button>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 21, fontWeight: 600, color: p.text, lineHeight: 1.2 }}>{title}</div>
                {subtitle && (
                    <div style={{ fontSize: 12, color: p.textDim, marginTop: 3 }}>{subtitle}</div>
                )}
            </div>
            {right && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
        </div>
    );
};

export const Button: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: "primary" | "ghost";
    title?: string;
}> = ({ children, onClick, disabled, variant = "ghost", title }) => {
    const p = palette();
    const primary = variant === "primary";
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            style={{
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
                border: primary ? "none" : `1px solid ${p.border}`,
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
}> = ({ label, active, onClick }) => {
    const p = palette();
    return (
        <button
            type="button"
            onClick={onClick}
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
    children: React.ReactNode;
    onClick?: () => void;
    style?: React.CSSProperties;
}> = ({ children, onClick, style }) => {
    const p = palette();
    return (
        <div
            onClick={onClick}
            style={{
                padding: 14,
                borderRadius: 12,
                background: p.bgAlt,
                border: `1px solid ${p.border}`,
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
}) => (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 24px 32px", ...style }}>
        {children}
    </div>
);

export const Loading: React.FC<{ label?: string }> = ({ label = "加载中…" }) => {
    const p = palette();
    return <div style={{ padding: 40, textAlign: "center", color: p.textDim, fontSize: 13 }}>{label}</div>;
};

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
    const p = palette();
    return (
        <div style={{ padding: "24px 0" }}>
            <div style={{ color: p.danger, fontSize: 13, lineHeight: 1.6, wordBreak: "break-word" }}>{message}</div>
            {onRetry && (
                <div style={{ marginTop: 12 }}>
                    <Button onClick={onRetry}>重试</Button>
                </div>
            )}
        </div>
    );
};

export const Empty: React.FC<{ text: string }> = ({ text }) => {
    const p = palette();
    return <div style={{ padding: 40, textAlign: "center", color: p.textDim, fontSize: 13 }}>{text}</div>;
};
