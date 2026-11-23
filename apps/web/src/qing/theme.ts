/* Qing PC · 视觉常量。与手机版同一套紫色主色，其余沿用 Element 的中性色。 */

export const QING = {
    railWidth: 60,
    accent: "#6a5ae0",
    accentSoft: "rgba(106, 90, 224, 0.12)",
    bg: "#ffffff",
    bgAlt: "#f7f7fa",
    border: "rgba(0, 0, 0, 0.08)",
    text: "#1b1b1f",
    textDim: "#6b6b76",
    danger: "#d5393e",
};

/** 深色模式下用同一结构的另一组取值 */
export const QING_DARK = {
    accent: "#8f80ff",
    accentSoft: "rgba(143, 128, 255, 0.18)",
    bg: "#18181c",
    bgAlt: "#202027",
    border: "rgba(255, 255, 255, 0.1)",
    text: "#f2f2f5",
    textDim: "#a0a0ad",
    danger: "#ff6b70",
};

export function isDark(): boolean {
    // Element 在 <html> 上打 data-theme；没有时按系统偏好
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr.includes("dark");
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function palette(): typeof QING {
    return isDark() ? QING_DARK : QING;
}
