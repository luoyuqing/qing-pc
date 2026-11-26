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
    meta?: string;
    badge?: { label: string; tone?: "ok" | "warn" | "danger" };
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

/** An item in the ordered fallback chain editor. */
export interface FallbackChainItem {
    id: string;
    label: string;
    model: string;
    baseUrl: string;
    provider: string;
    keyEnv: string;
}

/** A candidate model that can be toggled into the fallback chain. */
export interface FallbackCandidateOption {
    id: string;
    label: string;
    model: string;
    baseUrl: string;
    provider: string;
    keyEnv: string;
    inChain: boolean;
}

/** State for the list-based fallback chain editor. */
export interface FallbackEditorState {
    items: FallbackChainItem[];
    candidates: FallbackCandidateOption[];
    hint: string;
    labels: {
        chainTitle: string;
        candidatesTitle: string;
        emptyChain: string;
        moveUp: string;
        moveDown: string;
        remove: string;
    };
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
    fallbackEditor?: FallbackEditorState;
    toolbar: QingCollectionAction[];
    editing: boolean;
    confirmation: string;
    result: string;
    /** Raw payload for copy-to-clipboard when result is a human summary. */
    rawResult?: string;
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
        copyRaw?: string;
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
    toggleFallbackCandidate?: (id: string) => void;
    moveFallbackItem?: (index: number, delta: -1 | 1) => void;
    removeFallbackItem?: (index: number) => void;
    cancelEdit?: () => void;
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
        const text = snapshot.rawResult ?? snapshot.result;
        if (!text || !navigator.clipboard?.writeText) return;
        void navigator.clipboard.writeText(text).then(() => {
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
                        {snapshot.fallbackEditor ? (
                            <div className={styles.fallbackSection}>
                                <Text size="sm" weight="semibold">
                                    {snapshot.fallbackEditor.labels.chainTitle}
                                </Text>
                                <Text size="xs" className={styles.meta}>
                                    {snapshot.fallbackEditor.hint}
                                </Text>
                                {snapshot.fallbackEditor.items.length === 0 ? (
                                    <Text size="sm" className={styles.hint}>
                                        {snapshot.fallbackEditor.labels.emptyChain}
                                    </Text>
                                ) : (
                                    <div className={styles.fallbackList}>
                                        {snapshot.fallbackEditor.items.map((item, idx) => (
                                            <div
                                                key={`${item.id}:${item.model}:${item.baseUrl}`}
                                                className={styles.fallbackItem}
                                            >
                                                <span className={styles.fallbackIndex}>{idx + 1}</span>
                                                <div className={styles.fallbackInfo}>
                                                    <Text size="md" weight="semibold">
                                                        {item.label || item.model}
                                                    </Text>
                                                    <Text size="xs" className={styles.meta}>
                                                        {[item.model, item.baseUrl].filter(Boolean).join(" · ")}
                                                    </Text>
                                                </div>
                                                <Flex gap="var(--cpd-space-1x)">
                                                    <Button
                                                        kind="secondary"
                                                        size="md"
                                                        disabled={busy || idx === 0}
                                                        aria-label={snapshot.fallbackEditor?.labels.moveUp}
                                                        onClick={() => vm.moveFallbackItem?.(idx, -1)}
                                                    >
                                                        ↑
                                                    </Button>
                                                    <Button
                                                        kind="secondary"
                                                        size="md"
                                                        disabled={
                                                            busy ||
                                                            idx === (snapshot.fallbackEditor?.items.length ?? 0) - 1
                                                        }
                                                        aria-label={snapshot.fallbackEditor?.labels.moveDown}
                                                        onClick={() => vm.moveFallbackItem?.(idx, 1)}
                                                    >
                                                        ↓
                                                    </Button>
                                                    <Button
                                                        kind="secondary"
                                                        size="md"
                                                        destructive
                                                        disabled={busy}
                                                        onClick={() => vm.removeFallbackItem?.(idx)}
                                                    >
                                                        {snapshot.fallbackEditor?.labels.remove}
                                                    </Button>
                                                </Flex>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {snapshot.fallbackEditor.candidates.length > 0 && (
                                    <>
                                        <Text size="sm" weight="semibold">
                                            {snapshot.fallbackEditor.labels.candidatesTitle}
                                        </Text>
                                        <div className={styles.fallbackCandidates}>
                                            {snapshot.fallbackEditor.candidates.map((cand) => (
                                                <label
                                                    key={cand.id}
                                                    aria-label={cand.label || cand.model || cand.id}
                                                    className={styles.fallbackCandidate}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={cand.inChain}
                                                        disabled={busy}
                                                        onChange={() => vm.toggleFallbackCandidate?.(cand.id)}
                                                    />
                                                    <div className={styles.fallbackInfo}>
                                                        <Text size="sm" weight="semibold">
                                                            {cand.label || cand.model || cand.id}
                                                        </Text>
                                                        <Text size="xs" className={styles.meta}>
                                                            {[cand.model, cand.baseUrl].filter(Boolean).join(" · ")}
                                                        </Text>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}
                                <Flex gap="var(--cpd-space-2x)">
                                    <Button kind="primary" disabled={busy} onClick={vm.save}>
                                        {busy ? labels.loading : labels.save}
                                    </Button>
                                    {vm.cancelEdit && (
                                        <Button kind="secondary" disabled={busy} onClick={vm.cancelEdit}>
                                            {labels.cancel}
                                        </Button>
                                    )}
                                </Flex>
                            </div>
                        ) : (
                            editing && (
                                <form
                                    className={styles.form}
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        vm.save();
                                    }}
                                >
                                    {fields.map((field) => (
                                        <label key={field.id} className={styles.field}>
                                            <Text as="span" size="sm" weight="medium">
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
                                                <Text as="span" size="xs" className={styles.meta}>
                                                    {field.hint}
                                                </Text>
                                            )}
                                        </label>
                                    ))}
                                    <Button type="submit" kind="primary" disabled={busy}>
                                        {busy ? labels.loading : labels.save}
                                    </Button>
                                </form>
                            )
                        )}
                        {snapshot.result && (
                            <div className={styles.resultBox}>
                                <Flex justify="space-between" align="center" gap="var(--cpd-space-2x)">
                                    <pre className={styles.result}>{snapshot.result}</pre>
                                    <Button kind="secondary" size="md" onClick={copyResult}>
                                        {copied
                                            ? (labels.copied ?? "Copied")
                                            : snapshot.rawResult
                                              ? (labels.copyRaw ?? labels.copy ?? "Copy raw data")
                                              : (labels.copy ?? "Copy")}
                                    </Button>
                                </Flex>
                            </div>
                        )}
                        {!editing && rows.length === 0 && !snapshot.result && <Text size="sm">{labels.empty}</Text>}
                        <div className={styles.rows}>
                            {rows.map((row) => (
                                <article key={row.id} className={styles.row}>
                                    <Flex
                                        className={styles.rowHeader}
                                        align="center"
                                        justify="space-between"
                                        gap="var(--cpd-space-2x)"
                                    >
                                        <Text as="h2" size="md" weight="semibold" className={styles.rowTitle}>
                                            {row.title}
                                        </Text>
                                        {row.badge && (
                                            <span
                                                className={`${styles.badge} ${
                                                    row.badge.tone === "ok"
                                                        ? styles.badgeOk
                                                        : row.badge.tone === "danger"
                                                          ? styles.badgeDanger
                                                          : styles.badgeWarn
                                                }`}
                                            >
                                                {row.badge.label}
                                            </span>
                                        )}
                                    </Flex>
                                    {row.description && (
                                        <Text size="sm" className={styles.rowBody}>
                                            {row.description}
                                        </Text>
                                    )}
                                    {row.meta && (
                                        <Text size="xs" className={styles.meta}>
                                            {row.meta}
                                        </Text>
                                    )}
                                    {row.actions.length > 0 && (
                                        <Flex gap="var(--cpd-space-2x)" wrap="wrap" className={styles.actions}>
                                            {row.actions.map((action) => (
                                                <Button
                                                    key={action.id}
                                                    kind="secondary"
                                                    size="md"
                                                    destructive={action.danger}
                                                    disabled={busy}
                                                    onClick={() => vm.activate(row.id, action.id)}
                                                >
                                                    {action.label}
                                                </Button>
                                            ))}
                                        </Flex>
                                    )}
                                </article>
                            ))}
                        </div>
                    </>
                )}
            </section>
        </Flex>
    );
}
