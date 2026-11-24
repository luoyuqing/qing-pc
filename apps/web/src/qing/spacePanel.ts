/*
Qing PC · 空间栏显隐

默认收起 Element 的空间栏，让 Qing 的六项导航成为唯一的一级导航。
用户若在多空间之间切换，可在 设置 → 界面 里把它打开。
状态存 localStorage，改完立即生效（只切 body class，无需重启）。
*/

const KEY = "qing.showSpacePanel";
const BODY_CLASS = "qing-hide-space";

export function isSpacePanelVisible(): boolean {
    try {
        return window.localStorage.getItem(KEY) === "1";
    } catch {
        return false;
    }
}

function apply(): void {
    if (typeof document === "undefined" || !document.body) return;
    document.body.classList.toggle(BODY_CLASS, !isSpacePanelVisible());
}

export function setSpacePanelVisible(visible: boolean): void {
    try {
        window.localStorage.setItem(KEY, visible ? "1" : "0");
    } catch {
        /* 隐私模式写不进去就算了，本次会话仍生效 */
    }
    apply();
}

// 模块加载时先应用一次，避免首屏闪出空间栏
apply();

// body 可能还没就绪（脚本在 head 时），再兜一次
if (typeof document !== "undefined" && !document.body) {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
}
