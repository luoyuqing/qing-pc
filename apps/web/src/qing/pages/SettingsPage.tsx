/* Qing PC · 设置：device-hub 连接与助理身份 */

import React, { useState } from "react";
import { DEFAULT_BASE_URL, hub, loadConfig, saveConfig } from "../hub";
import { Button, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

const Field: React.FC<{
    label: string;
    value: string;
    placeholder?: string;
    password?: boolean;
    onChange: (value: string) => void;
}> = ({ label, value, placeholder, password, onChange }) => {
    const p = palette();
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: p.textDim, marginBottom: 5 }}>{label}</div>
            <input
                type={password ? "password" : "text"}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    fontSize: 13.5,
                    borderRadius: 8,
                    outline: "none",
                    border: `1px solid ${p.border}`,
                    background: p.bgAlt,
                    color: p.text,
                }}
            />
        </div>
    );
};

export const SettingsPage: React.FC = () => {
    const initial = loadConfig();
    const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
    const [token, setToken] = useState(initial.token);
    const [persona, setPersona] = useState(initial.persona);
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [testing, setTesting] = useState(false);
    const p = palette();

    const persist = () => {
        saveConfig({ baseUrl, token, persona });
    };

    const saveAndTest = async () => {
        setTesting(true);
        setStatus(null);
        persist();
        try {
            const health = await hub.health();
            setStatus({ ok: true, text: `连接成功：${health?.status ?? "ok"}` });
        } catch (e) {
            setStatus({ ok: false, text: `连接失败：${(e as Error).message}` });
        }
        setTesting(false);
    };

    return (
        <>
            <PageHeader title="设置" subtitle="device-hub 连接与助理身份" />
            <Scroll>
                <div style={{ maxWidth: 560 }}>
                    <Field
                        label="服务地址"
                        value={baseUrl}
                        placeholder={DEFAULT_BASE_URL}
                        onChange={setBaseUrl}
                    />
                    <Field
                        label="访问令牌"
                        value={token}
                        password
                        placeholder="配对时下发的 Bearer token"
                        onChange={setToken}
                    />
                    <Field label="人设" value={persona} placeholder="default" onChange={setPersona} />

                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <Button variant="primary" disabled={testing} onClick={() => void saveAndTest()}>
                            {testing ? "测试中…" : "保存并测试"}
                        </Button>
                        <Button
                            onClick={() => {
                                persist();
                                setStatus({ ok: true, text: "已保存" });
                            }}
                        >
                            仅保存
                        </Button>
                    </div>

                    {status && (
                        <div
                            style={{
                                marginTop: 16,
                                fontSize: 12.5,
                                color: status.ok ? p.accent : p.danger,
                                wordBreak: "break-word",
                            }}
                        >
                            {status.text}
                        </div>
                    )}

                    <div style={{ marginTop: 28, fontSize: 12, color: p.textDim, lineHeight: 1.7 }}>
                        手机通知、短信、通讯录、日历、定位与 App 使用时长仍由 Android 端采集上报，
                        PC 通过 device-hub 读取同一份数据。
                        <br />
                        聊天沿用 Element 的 Matrix 会话，与手机版共用同一批房间。
                    </div>
                </div>
            </Scroll>
        </>
    );
};
