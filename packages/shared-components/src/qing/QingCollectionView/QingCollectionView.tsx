/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useState, type JSX } from "react";
import { Button, Heading, Text } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { Flex } from "../../core/utils/Flex";
import styles from "./QingCollectionView.module.css";

/** A localized operation offered by a hub resource. */
export interface QingCollectionAction {
    id: string;
    label: string;
    danger?: boolean;
}

/** A summary row; identifiers remain opaque to the view. */
export interface QingCollectionRow {
    id: string;
    title: string;
    description: string;
    actions: QingCollectionAction[];
}

/** An editable value and its localized presentation. */
export interface QingCollectionField {
    id: string;
    label: string;
    value: string;
    type?: "text" | "textarea" | "password" | "select" | "checkbox" | "time";
    options?: { value: string; label: string }[];
    hint?: string;
}

/** Snapshot for server-backed collections and their editors. */
export interface QingCollectionViewSnapshot {
    title: string;
    hint: string;
    loading: boolean;
    busy: boolean;
    error: string;
    notice: string;
    query: string;
    searchable: boolean;
    rows: QingCollectionRow[];
    fields: QingCollectionField[];
    toolbar: QingCollectionAction[];
    editing: boolean;
    confirmation: string;
    result: string;
    /** Documentation URLs already validated by the view model. */
    links?: { url: string; label: string }[];
    labels: {
        back: string;
        refresh: string;
        search: string;
        save: string;
        cancel: string;
        confirm: string;
        loading: string;
        empty: string;
        copy?: string;
        copied?: string;
    };
}

/** Bound actions provided by the resource view model. */
export interface QingCollectionViewActions {
    back: () => void;
    refresh: () => void;
    search: (query: string) => void;
    setField: (id: string, value: string) => void;
    activate: (id: string, action: string) => void;
    toolbar: (action: string) => void;
    save: () => void;
    confirm: (accepted: boolean) => void;
}

/** Contract implemented by resource-specific view models. */
export type QingCollectionViewModel = ViewModel<QingCollectionViewSnapshot, QingCollectionViewActions>;

interface Props {
    /** Owns fetching, validation and all user actions. */
    vm: QingCollectionViewModel;
}

/** A desktop collection/editor view with localized, accessible controls. */
export function QingCollectionView({ vm }: Readonly<Props>): JSX.Element {
    const snapshot = useViewModel(vm);
    const [copied, setCopied] = useState(false);
    const { title, hint, labels, loading, busy, error, notice, query, rows, fields, toolbar, editing } = snapshot;

    const copyResult = (): void => {
        if (!snapshot.result || !navigator.clipboard?.writeText) return;
        void navigator.clipboard.writeText(snapshot.result).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <Flex className={styles.view} direction="column" gap="var(--cpd-space-4x)">
            <Flex className={styles.header} align="center" wrap="wrap" gap="var(--cpd-space-3x)">
                <Button kind="secondary" onClick={vm.back}>
                    {labels.back}
                </Button>
                <Heading as="h1" size="md" className={styles.title}>
                    {title}
                </Heading>
                <Button kind="secondary" disabled={busy || loading} onClick={vm.refresh}>
                    {labels.refresh}
                </Button>
                {toolbar.map((action) => (
                    <Button
                        key={action.id}
                        kind="secondary"
                        destructive={action.danger}
                        disabled={busy || loading}
                        onClick={() => vm.toolbar(action.id)}
                    >
                        {action.label}
                    </Button>
                ))}
            </Flex>
            {hint && <Text className={styles.hint}>{hint}</Text>}
            {error && (
                <Text role="alert" className={styles.error}>
                    {error}
                </Text>
            )}
            {snapshot.links?.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                </a>
            ))}
            {notice && <Text role="status">{notice}</Text>}
            {snapshot.confirmation && (
                <Flex className={styles.confirmation} direction="column" gap="var(--cpd-space-3x)" role="alert">
                    <Text>{snapshot.confirmation}</Text>
                    <Flex gap="var(--cpd-space-3x)">
                        <Button kind="primary" destructive onClick={() => vm.confirm(true)}>
                            {labels.confirm}
                        </Button>
                        <Button kind="secondary" onClick={() => vm.confirm(false)}>
                            {labels.cancel}
                        </Button>
                    </Flex>
                </Flex>
            )}
            {snapshot.searchable && !editing && (
                <input
                    className={styles.input}
                    type="search"
                    aria-label={labels.search}
                    placeholder={labels.search}
                    value={query}
                    onChange={(event) => vm.search(event.target.value)}
                />
            )}
            <section className={styles.content} aria-busy={loading || busy}>
                {loading ? (
                    <Text role="status">{labels.loading}</Text>
                ) : (
                    <>
                        {editing && (
                            <form
                                className={styles.form}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    vm.save();
                                }}
                            >
                                {fields.map((field) => (
                                    <label key={field.id} className={styles.field}>
                                        <Text as="span" weight="medium">
                                            {field.label}
                                        </Text>
                                        {field.type === "textarea" ? (
                                            <textarea
                                                className={styles.input}
                                                value={field.value}
                                                disabled={busy}
                                                onChange={(event) => vm.setField(field.id, event.target.value)}
                                            />
                                        ) : field.type === "select" ? (
                                            <select
                                                className={styles.input}
                                                value={field.value}
                                                disabled={busy}
                                                onChange={(event) => vm.setField(field.id, event.target.value)}
                                            >
                                                {field.options?.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : field.type === "checkbox" ? (
                                            <input
                                                type="checkbox"
                                                checked={field.value === "true"}
                                                disabled={busy}
                                                onChange={(event) =>
                                                    vm.setField(field.id, String(event.target.checked))
                                                }
                                            />
                                        ) : (
                                            <input
                                                className={styles.input}
                                                type={field.type ?? "text"}
                                                value={field.value}
                                                disabled={busy}
                                                onChange={(event) => vm.setField(field.id, event.target.value)}
                                            />
                                        )}
                                        {field.hint && (
                                            <Text as="span" className={styles.hint}>
                                                {field.hint}
                                            </Text>
                                        )}
                                    </label>
                                ))}
                                <Button type="submit" kind="primary" disabled={busy}>
                                    {busy ? labels.loading : labels.save}
                                </Button>
                            </form>
                        )}
                        {snapshot.result && (
                            <div className={styles.resultBox}>
                                <Flex justify="end">
                                    <Button kind="secondary" size="md" onClick={copyResult}>
                                        {copied ? (labels.copied ?? "Copied") : (labels.copy ?? "Copy")}
                                    </Button>
                                </Flex>
                                <pre className={styles.result}>{snapshot.result}</pre>
                            </div>
                        )}
                        {!editing && rows.length === 0 && !snapshot.result && <Text>{labels.empty}</Text>}
                        <Flex direction="column" gap="var(--cpd-space-3x)">
                            {rows.map((row) => (
                                <article key={row.id} className={styles.row}>
                                    <Heading as="h2" size="sm">
                                        {row.title}
                                    </Heading>
                                    <Text className={styles.hint}>{row.description}</Text>
                                    <Flex gap="var(--cpd-space-2x)" wrap="wrap">
                                        {row.actions.map((action) => (
                                            <Button
                                                key={action.id}
                                                kind="secondary"
                                                destructive={action.danger}
                                                disabled={busy}
                                                onClick={() => vm.activate(row.id, action.id)}
                                            >
                                                {action.label}
                                            </Button>
                                        ))}
                                    </Flex>
                                </article>
                            ))}
                        </Flex>
                    </>
                )}
            </section>
        </Flex>
    );
}
