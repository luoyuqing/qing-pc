/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** Ask for confirmation using Element's accessible modal and theme. */
export async function confirmAction(description: string): Promise<boolean> {
    const [{ default: Modal }, { default: QuestionDialog }] = await Promise.all([
        import("../Modal"),
        import("../components/views/dialogs/QuestionDialog"),
    ]);
    const [confirmed] = await Modal.createDialog(QuestionDialog, { description }).finished;
    return !!confirmed;
}

/** Edit a single text value using Element's accessible modal. */
export async function editText(title: string, value: string): Promise<string | null> {
    const [{ default: Modal }, { default: TextInputDialog }] = await Promise.all([
        import("../Modal"),
        import("../components/views/dialogs/TextInputDialog"),
    ]);
    const [confirmed, text] = await Modal.createDialog(TextInputDialog, { title, value }).finished;
    return confirmed ? (text ?? "") : null;
}
