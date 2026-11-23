/*
Qing PC · 极简 Markdown 渲染
只处理简报/记忆里实际出现的语法：标题、无序列表、粗体、行内代码。
复杂语法退化为纯文本，不做完整解析。
*/

import React from "react";
import { palette } from "./theme";

function inline(text: string, keyPrefix: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const pattern = /\*\*(.+?)\*\*|`([^`]+)`/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > cursor) {
            nodes.push(text.slice(cursor, match.index));
        }
        if (match[1] !== undefined) {
            nodes.push(
                <strong key={`${keyPrefix}-b${index++}`} style={{ fontWeight: 600 }}>
                    {match[1]}
                </strong>,
            );
        } else {
            nodes.push(
                <code
                    key={`${keyPrefix}-c${index++}`}
                    style={{
                        fontFamily: "var(--cpd-font-family-monospace, monospace)",
                        fontSize: "0.9em",
                        padding: "1px 4px",
                        borderRadius: 4,
                        background: palette().bgAlt,
                    }}
                >
                    {match[2]}
                </code>,
            );
        }
        cursor = match.index + match[0].length;
    }
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
}

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
    const p = palette();
    const lines = (text || "").split("\n");

    return (
        <div style={{ color: p.text, fontSize: 14, lineHeight: 1.65 }}>
            {lines.map((raw, i) => {
                const line = raw.replace(/\s+$/, "");
                if (!line.trim()) return <div key={i} style={{ height: 8 }} />;

                if (line.startsWith("### ")) {
                    return (
                        <div key={i} style={{ fontWeight: 600, fontSize: 14, marginTop: 10 }}>
                            {inline(line.slice(4), `h3-${i}`)}
                        </div>
                    );
                }
                if (line.startsWith("## ")) {
                    return (
                        <div key={i} style={{ fontWeight: 600, fontSize: 16, marginTop: 14 }}>
                            {inline(line.slice(3), `h2-${i}`)}
                        </div>
                    );
                }
                if (line.startsWith("# ")) {
                    return (
                        <div key={i} style={{ fontWeight: 700, fontSize: 19, marginTop: 16 }}>
                            {inline(line.slice(2), `h1-${i}`)}
                        </div>
                    );
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                    return (
                        <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 2 }}>
                            <span style={{ color: p.accent }}>•</span>
                            <span>{inline(line.slice(2), `li-${i}`)}</span>
                        </div>
                    );
                }
                return <div key={i}>{inline(line, `p-${i}`)}</div>;
            })}
        </div>
    );
};
