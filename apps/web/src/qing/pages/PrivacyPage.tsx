/*
Qing PC · 数据与隐私
对应手机端 settings/privacy：数据保留策略（通知条数与位置记录天数）。
GET /admin/retention、POST /admin/retention
*/

import React, { useCallback, useEffect, useState } from "react";
import { hub } from "../hub";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const PrivacyPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [notifyDays, setNotifyDays] = useState("");
    const [locationDays, setLocationDays] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const p = palette();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const d = await hub.retention();
            setNotifyDays(`${d?.notify_days ?? ""}`);
            setLocationDays(`${d?.location_days ?? ""}`);
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async () => {
        const n = Number(notifyDays);
        const l = Number(locationDays);
        if (!Number.isFinite(n) || !Number.isFinite(l) || n < 0 || l < 0) {
            window.alert("请填非负整数。");
            return;
        }
        setSaving(true);
        setSaved(null);
        try {
            await hub.setRetention(Math.floor(n), Math.floor(l));
            setSaved("已保存");
            setTimeout(() => setSaved(null), 3000);
        } catch (e) {
            window.alert(`保存失败：${(e as Error).message}`);
        }
        setSaving(false);
    };

    const field = (label: string, hint: string, value: string, onChange: (v: string) => void) => (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: p.text, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11.5, color: p.textDim, marginBottom: 6, lineHeight: 1.55 }}>{hint}</div>
            <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: 160,
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    fontSize: 13.5,
                    borderRadius: 8,
                    border: `1px solid ${p.border}`,
                    background: p.bgAlt,
                    color: p.text,
                    outline: "none",
                }}
            />
        </div>
    );

    return (
        <>
            <PageHeader title="数据与隐私" subtitle="数据保留策略" onBack={onBack} />
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => void load()} />
                </div>
            ) : (
                <Scroll>
                    <Card style={{ maxWidth: 560 }}>
                        {field(
                            "通知 / 短信保留（天）",
                            "手机上报的通知与短信，超过这个天数会被清掉。填 0 表示不保留。",
                            notifyDays,
                            setNotifyDays,
                        )}
                        {field(
                            "位置记录保留（天）",
                            "定位轨迹的保留窗口，超过即删除。填 0 表示不保留。",
                            locationDays,
                            setLocationDays,
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Button variant="primary" disabled={saving} onClick={() => void save()}>
                                {saving ? "保存中…" : "保存"}
                            </Button>
                            {saved && <span style={{ fontSize: 12, color: p.accent }}>{saved}</span>}
                        </div>
                    </Card>
                    <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 12, lineHeight: 1.7 }}>
                        策略由 X2 上的 device-hub 执行，改完立即对后续清理生效；已经入库的历史数据不会回溯删除。
                    </div>
                </Scroll>
            )}
        </>
    );
};
