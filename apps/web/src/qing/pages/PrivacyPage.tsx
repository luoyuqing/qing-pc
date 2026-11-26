/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/*
Qing PC · 数据与隐私
对应手机端 settings/privacy：数据保留策略（通知条数与位置记录天数）。
GET /admin/retention、PATCH /admin/retention
*/

import { _t } from "../../languageHandler";
import React, { useCallback, useEffect, useState } from "react";
import { hub } from "../hub";
import { Button, Card, ErrorBox, Loading, PageHeader, Scroll } from "../ui";
import { palette } from "../theme";

export const PrivacyPage: React.FC<{ onBack?: () => void }> = ({ onBack }): React.ReactNode => {
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

    const save = async (): Promise<void> => {
        const n = Number(notifyDays);
        const l = Number(locationDays);
        if (
            !notifyDays.trim() ||
            !locationDays.trim() ||
            !Number.isInteger(n) ||
            !Number.isInteger(l) ||
            n < 0 ||
            l < 0
        ) {
            setError(_t("qing|text_009ca083"));
            return;
        }
        setSaving(true);
        setSaved(null);
        try {
            await hub.setRetention(n, l);
            setSaved(_t("qing|text_1bd91a7d"));
            setTimeout(() => setSaved(null), 3000);
        } catch (e) {
            setError(_t("qing|text_2e9c15dc", { v0: (e as Error).message }));
        }
        setSaving(false);
    };

    const field = (label: string, hint: string, value: string, onChange: (v: string) => void): React.ReactNode => (
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
            <PageHeader title={_t("qing|text_ebdc835e")} subtitle={_t("qing|text_eaa7ce48")} onBack={onBack} />
            {loading ? (
                <Loading />
            ) : error ? (
                <div style={{ padding: "0 24px" }}>
                    <ErrorBox message={error} onRetry={() => void load()} />
                </div>
            ) : (
                <Scroll>
                    <Card style={{ maxWidth: 560 }}>
                        {field(_t("qing|text_59aa6af5"), _t("qing|text_2de8c7f6"), notifyDays, setNotifyDays)}
                        {field(_t("qing|text_3d5a9d99"), _t("qing|text_c425221d"), locationDays, setLocationDays)}
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Button variant="primary" disabled={saving} onClick={() => void save()}>
                                {saving ? _t("qing|text_ff509c9b") : _t("qing|text_a3030bf8")}
                            </Button>
                            {saved && <span style={{ fontSize: 12, color: p.accent }}>{saved}</span>}
                        </div>
                    </Card>
                    <div style={{ fontSize: 11.5, color: p.textDim, marginTop: 12, lineHeight: 1.7 }}>
                        {_t("qing|text_8371fe93")}
                    </div>
                </Scroll>
            )}
        </>
    );
};
