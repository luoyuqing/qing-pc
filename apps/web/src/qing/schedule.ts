/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** Decode common five-field cron schedules into desktop form values. */
export function scheduleFields(schedule: string): Record<string, string> {
    const fields = schedule.trim().split(/\s+/);
    const values = { mode: "custom", time: "07:30", minute: "0", weekday: "1", schedule };
    if (fields.length !== 5) return values;
    const [minute, hour, day, month, weekday] = fields;
    if (!/^\d+$/.test(minute) || Number(minute) > 59 || day !== "*" || month !== "*") return values;
    if (hour === "*" && weekday === "*") return { ...values, mode: "hourly", minute };
    if (!/^\d+$/.test(hour) || Number(hour) > 23) return values;
    const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    if (weekday === "*") return { ...values, mode: "daily", time };
    if (/^[0-6]$/.test(weekday)) return { ...values, mode: "weekly", time, weekday };
    return values;
}

/** Build a cron expression without changing custom schedules. */
export function buildSchedule(values: Record<string, string>): string {
    if (values.mode === "custom") return values.schedule.trim();
    if (values.mode === "hourly") return `${values.minute} * * * *`;
    const [hour, minute] = values.time.split(":");
    if (!/^\d{2}:\d{2}$/.test(values.time)) return "";
    return `${Number(minute)} ${Number(hour)} * * ${values.mode === "weekly" ? values.weekday : "*"}`;
}

/** Validate numeric cron ranges, lists and steps before sending a routine edit. */
export function validSchedule(schedule: string): boolean {
    const fields = schedule.trim().split(/\s+/);
    const bounds = [
        [0, 59],
        [0, 23],
        [1, 31],
        [1, 12],
        [0, 7],
    ];
    if (fields.length !== bounds.length) return false;
    return fields.every((field, index) =>
        field.split(",").every((part) => {
            const [range, step, extra] = part.split("/");
            if (extra !== undefined || (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1))) return false;
            if (range === "*") return true;
            if (!/^\d+(?:-\d+)?$/.test(range)) return false;
            const [start, end = start] = range.split("-").map(Number);
            return start >= bounds[index][0] && end <= bounds[index][1] && start <= end;
        }),
    );
}
