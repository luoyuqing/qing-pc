/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { _t } from "../../languageHandler";
import {
    BaseViewModel,
    type FallbackCandidateOption,
    type FallbackChainItem,
    type FallbackEditorState,
    type QingCollectionViewSnapshot,
    type QingCollectionViewModel as ViewModelContract,
    type QingCollectionField,
    type QingCollectionRow,
    type QingCollectionAction,
} from "@element-hq/web-shared-components";

import { friendlyError, statusLabel } from "../../qing/status";
import { HubError, hub } from "../../qing/hub";
import { formatHumanResult, recordOf, recordsOf, textOf, vaultBody } from "../../qing/data";
import { scheduleFields, buildSchedule, validSchedule } from "../../qing/schedule";

/** Server resources exposed through the shared desktop collection view. */
export type QingResource =
    | "vault"
    | "routine"
    | "devices"
    | "audit"
    | "diagnose"
    | "connectors"
    | "favorites"
    | "models";

interface Props {
    resource: QingResource;
    persona: string;
    id?: string;
    onBack: () => void;
}

function getTitles(): Record<QingResource, string> {
    return {
        vault: _t("qing|text_bdb0c9ab"),
        routine: _t("qing|text_3c39e9bd"),
        devices: _t("qing|text_ed269d5a"),
        audit: _t("qing|text_b119a5b0"),
        diagnose: _t("qing|text_de94f8b3"),
        connectors: _t("qing|text_b1bea287"),
        favorites: _t("qing|text_3c7c1e16"),
        models: _t("qing|text_8cbcf741"),
    };
}

/** Manages hub collections, forms and mutations without coupling their view to server responses. */
export class QingCollectionViewModel
    extends BaseViewModel<QingCollectionViewSnapshot, Props>
    implements ViewModelContract
{
    private generation = 0;
    private searchTimer: ReturnType<typeof setTimeout> | undefined;
    private records: Record<string, unknown>[] = [];
    private catalog: Record<string, unknown>[] = [];
    private modelData: Record<string, unknown> = {};
    private selected = "";
    private operation = "";
    private values: Record<string, string> = {};
    private dirty = false;
    private pending: (() => void) | undefined;

    public constructor(props: Props) {
        super(props, {
            title: getTitles()[props.resource],
            hint: "",
            loading: true,
            busy: false,
            error: "",
            notice: "",
            query: "",
            searchable: props.resource !== "routine" && props.resource !== "diagnose",
            rows: [],
            fields: [],
            toolbar: [],
            editing: false,
            confirmation: "",
            result: "",
            rawResult: "",
            labels: {
                back: _t("qing|text_572cf45b"),
                refresh: _t("qing|text_aee88743"),
                search: _t("qing|text_44ce7ae9"),
                save: _t("qing|text_a3030bf8"),
                cancel: _t("qing|text_2cd0f3be"),
                confirm: _t("qing|text_36f33ada"),
                loading: _t("qing|text_d3d21191"),
                empty: _t("qing|text_70a40a53"),
                copy: _t("qing|copy"),
                copyRaw: _t("qing|copy_raw"),
                copied: _t("qing|copied"),
            },
        });
        this.disposables.track(() => clearTimeout(this.searchTimer));
    }

    public refresh = (): void => {
        if (this.dirty)
            this.ask(_t("qing|text_644d939a"), () => {
                this.dirty = false;
                void this.load();
            });
        else void this.load();
    };

    public back = (): void => {
        const leave = (): void => {
            this.generation++;
            if (this.snapshot.current.editing && this.props.resource !== "routine") {
                this.dirty = false;
                this.selected = "";
                this.snapshot.merge({ editing: false, fields: [], result: "", error: "" });
                void this.load();
            } else this.props.onBack();
        };
        if (this.dirty) this.ask(_t("qing|text_3c4b0b24"), leave);
        else leave();
    };

    public search = (query: string): void => {
        this.snapshot.merge({ query });
        clearTimeout(this.searchTimer);
        if (this.props.resource === "vault") this.searchTimer = setTimeout(() => void this.load(), 250);
        else this.showRows();
    };

    public setField = (id: string, value: string): void => {
        this.values[id] = value;
        this.dirty = true;
        if (this.props.resource === "routine" && id === "mode") this.snapshot.merge({ fields: this.routineFields() });
        else
            this.snapshot.merge({
                fields: this.snapshot.current.fields.map((field) => (field.id === id ? { ...field, value } : field)),
            });
    };

    public activate = (id: string, action: string): void => {
        if (this.snapshot.current.busy) return;
        const item = this.records.find((record) => this.idOf(record) === id);
        if (!item) return;
        if (action === "delete" || action === "revoke") {
            const title = textOf(item.title ?? item.label ?? item.name ?? item.id) || _t("qing|item_default");
            this.ask(
                action === "revoke" ? _t("qing|device_revoke_confirm", { v0: title }) : _t("qing|text_e53f55a8"),
                () =>
                    void this.perform(async () => {
                        if (this.props.resource === "devices") await hub.revokeDevice(id);
                        else if (this.props.resource === "favorites") await hub.serviceFavDelete(Number(id));
                        else await hub.deleteMcpServer(Number(id));
                        await this.load();
                    }),
            );
            return;
        }
        if (action === "up" || action === "down") {
            void this.perform(async () => {
                const order = [...this.records];
                const index = order.indexOf(item);
                const next = index + (action === "up" ? -1 : 1);
                if (next < 0 || next >= order.length) return;
                [order[index], order[next]] = [order[next], order[index]];
                await hub.serviceFavOrder(order.map((row) => Number(row.id)));
                await this.load();
            });
            return;
        }
        if (action === "refresh") {
            void this.perform(async () => {
                await hub.refreshMcpServer(Number(id));
                await this.load();
            });
            return;
        }
        if (action === "test-connector") {
            void this.perform(async () => {
                const result = await hub.callConnector(textOf(item.id), {});
                this.snapshot.merge({ result: formatHumanResult(result) });
            });
            return;
        }
        this.selected = id;
        this.operation = action;
        if (this.props.resource === "vault") {
            void this.perform(async () => {
                const data = recordOf(await hub.vaultNote(this.props.persona, id));
                this.edit(
                    { content: vaultBody(textOf(data.content)) },
                    [
                        {
                            id: "content",
                            label: _t("qing|text_af5f7676"),
                            type: "textarea",
                            value: "",
                            hint: _t("qing|text_92f5a772"),
                        },
                    ],
                    [{ id: "delete-note", label: _t("qing|text_47f29503"), danger: true }],
                );
            });
        } else if (this.props.resource === "models") this.editModel(item, action);
        else if (this.props.resource === "connectors") this.editConnector(item, action);
    };

    public toolbar = (action: string): void => {
        if (this.snapshot.current.busy) return;
        if (action === "delete-note") {
            this.ask(
                _t("qing|text_3d2cd2ae"),
                () =>
                    void this.perform(async () => {
                        await hub.deleteVaultNote(this.props.persona, this.selected);
                        this.dirty = false;
                        this.snapshot.merge({ editing: false, fields: [] });
                        await this.load();
                    }),
            );
        } else if (action === "index") {
            void this.perform(async () => {
                const raw = await hub.memoryVaultStatus(this.props.persona);
                const status = recordOf(raw);
                const parts: string[] = [status.ok === false ? _t("qing|vault_index_warn") : _t("qing|vault_index_ok")];
                if (status.coverage !== undefined) {
                    parts.push(_t("qing|vault_coverage", { v0: `${textOf(status.coverage)}%` }));
                }
                if (status.files !== undefined && status.total !== undefined) {
                    parts.push(_t("qing|vault_files", { v0: textOf(status.files), v1: textOf(status.total) }));
                }
                if (status.entities !== undefined) {
                    parts.push(_t("qing|vault_entities", { v0: textOf(status.entities) }));
                }
                if (status.pending !== undefined) {
                    parts.push(_t("qing|vault_pending", { v0: textOf(status.pending) }));
                }
                if (status.failed !== undefined) {
                    parts.push(_t("qing|vault_failed", { v0: textOf(status.failed) }));
                }
                this.snapshot.merge({
                    result: parts.join(" · "),
                    rawResult: JSON.stringify(raw, null, 2),
                });
            });
        } else if (action === "delete-routine") {
            this.ask(
                _t("qing|delete_routine_confirm"),
                () =>
                    void this.perform(async () => {
                        await hub.deleteRoutine(this.props.id ?? "", this.props.persona);
                        this.dirty = false;
                        this.props.onBack();
                    }),
            );
        } else if (action === "run") {
            if (this.dirty) {
                this.snapshot.merge({ error: _t("qing|text_9888c4c1") });
                return;
            }
            this.ask(
                _t("qing|text_7d38e523"),
                () =>
                    void this.perform(async () => {
                        const result = recordOf(await hub.runRoutine(this.props.id ?? "", this.props.persona));
                        if (result.ok === false) throw new Error(textOf(result.error) || _t("qing|text_a3cfc7bf"));
                        this.snapshot.merge({ notice: _t("qing|text_75ab1608") });
                        await this.load();
                    }),
            );
        } else if (action === "add-favorite") {
            this.operation = "add-favorite";
            this.edit({ name: "", url: "" }, [
                { id: "name", label: _t("qing|text_d44e9b3d"), value: "" },
                { id: "url", label: _t("qing|text_a8ecb4b6"), value: "" },
            ]);
        } else if (action === "add-mcp") {
            this.operation = "add-mcp";
            this.edit({ name: "", url: "", token: "" }, [
                { id: "name", label: _t("qing|text_d44e9b3d"), value: "" },
                { id: "url", label: _t("qing|text_9d5e991e"), value: "" },
                { id: "token", label: _t("qing|text_de9561e8"), value: "", type: "password" },
            ]);
        } else if (action === "catalog") {
            this.records = this.catalog;
            this.operation = "catalog";
            this.showRows();
        } else if (action === "fallback") {
            this.operation = "fallback";
            this.openFallbackEditor();
        } else if (action === "test-model") {
            void this.perform(async () =>
                this.snapshot.merge({
                    result: formatHumanResult(await hub.testModel(undefined, this.props.persona)),
                }),
            );
        } else if (action === "endpoint-models") {
            const base = this.values.base_url;
            if (!base) {
                this.snapshot.merge({ error: _t("qing|text_f1a3703c") });
                return;
            }
            void this.perform(async () => {
                const result = recordOf(await hub.endpointModels(base, this.values.key_env));
                const list = result.models ?? result.items ?? result.data;
                const models = (Array.isArray(list) ? list : [])
                    .map((model) => (typeof model === "string" ? model : textOf(recordOf(model).id)))
                    .filter(Boolean);
                if (!models.length) throw new Error(_t("qing|text_3e5402c1"));
                this.snapshot.merge({
                    fields: this.snapshot.current.fields.map((field) =>
                        field.id === "model"
                            ? {
                                  ...field,
                                  type: "select",
                                  options: models.map((model) => ({ value: model, label: model })),
                              }
                            : field,
                    ),
                });
            });
        }
    };

    public save = (): void => {
        void this.perform(async () => {
            const { resource, persona } = this.props;
            if (resource === "vault") await hub.saveVaultNote(persona, this.selected, this.values.content);
            else if (resource === "routine") {
                const schedule = buildSchedule(this.values);
                if (!this.values.name.trim() || !this.values.prompt.trim() || !validSchedule(schedule))
                    throw new Error(_t("qing|text_a89b0529"));
                await hub.updateRoutine(this.props.id ?? "", persona, {
                    name: this.values.name.trim(),
                    prompt: this.values.prompt,
                    schedule,
                    enabled: this.values.enabled === "true",
                });
            } else if (resource === "favorites") {
                if (!this.values.name.trim()) throw new Error(_t("qing|text_cfbffde8"));
                this.validateUrl(this.values.url);
                await hub.serviceFavAdd(this.values.name.trim(), this.values.url.trim());
            } else if (resource === "connectors") {
                await this.saveConnector();
                if (this.operation === "tools") {
                    this.dirty = false;
                    return;
                }
            } else if (resource === "models") await this.saveModel();
            this.dirty = false;
            this.snapshot.merge({
                notice: _t("qing|text_1bd91a7d"),
                editing: resource === "routine",
                fields: resource === "routine" ? this.snapshot.current.fields : [],
                fallbackEditor: undefined,
                result: "",
            });
            await this.load();
        });
    };

    public cancelEdit = (): void => {
        this.dirty = false;
        this.operation = "";
        this.snapshot.merge({
            editing: false,
            fields: [],
            fallbackEditor: undefined,
            error: "",
        });
        this.showRows();
    };

    public toggleFallbackCandidate = (id: string): void => {
        const editor = this.snapshot.current.fallbackEditor;
        if (!editor) return;
        const cand = editor.candidates.find((c) => c.id === id);
        if (!cand) return;
        const existsIdx = editor.items.findIndex(
            (item) => item.id === cand.id || (item.model === cand.model && item.baseUrl === cand.baseUrl),
        );
        const nextItems =
            existsIdx >= 0
                ? editor.items.filter((_, idx) => idx !== existsIdx)
                : [
                      ...editor.items,
                      {
                          id: cand.id,
                          label: cand.label,
                          model: cand.model,
                          baseUrl: cand.baseUrl,
                          provider: cand.provider,
                          keyEnv: cand.keyEnv,
                      },
                  ];
        this.updateFallbackEditor(nextItems);
    };

    public moveFallbackItem = (index: number, delta: -1 | 1): void => {
        const editor = this.snapshot.current.fallbackEditor;
        if (!editor) return;
        const nextIndex = index + delta;
        if (nextIndex < 0 || nextIndex >= editor.items.length) return;
        const nextItems = [...editor.items];
        [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
        this.updateFallbackEditor(nextItems);
    };

    public removeFallbackItem = (index: number): void => {
        const editor = this.snapshot.current.fallbackEditor;
        if (!editor) return;
        this.updateFallbackEditor(editor.items.filter((_, idx) => idx !== index));
    };

    private openFallbackEditor(): void {
        const items: FallbackChainItem[] = recordsOf(this.modelData.fallback).map((row, idx) => ({
            id: textOf(row.key) || textOf(row.model) || `fb-${idx}`,
            label: textOf(row.label) || textOf(row.model) || textOf(row.key),
            model: textOf(row.model),
            baseUrl: textOf(row.base_url),
            provider: textOf(row.provider) || "custom",
            keyEnv: textOf(row.key_env),
        }));
        this.updateFallbackEditor(items);
    }

    private updateFallbackEditor(items: FallbackChainItem[]): void {
        const candidates: FallbackCandidateOption[] = recordsOf(this.modelData.candidates).map((row, idx) => {
            const id = textOf(row.key) || textOf(row.model) || `cand-${idx}`;
            const model = textOf(row.model);
            const baseUrl = textOf(row.base_url);
            const inChain = items.some((item) => item.id === id || (item.model === model && item.baseUrl === baseUrl));
            return {
                id,
                label: textOf(row.label) || model || id,
                model,
                baseUrl,
                provider: textOf(row.provider) || "custom",
                keyEnv: textOf(row.key_env),
                inChain,
            };
        });
        const fallbackEditor: FallbackEditorState = {
            items,
            candidates,
            hint: _t("qing|fallback_list_hint"),
            labels: {
                chainTitle: _t("qing|text_f40bbf98"),
                candidatesTitle: _t("qing|fallback_pick_candidates"),
                emptyChain: _t("qing|fallback_empty_chain"),
                moveUp: _t("qing|text_f853a70b"),
                moveDown: _t("qing|text_e75e8b4e"),
                remove: _t("qing|text_2f9daa82"),
            },
        };
        this.dirty = true;
        this.snapshot.merge({
            editing: true,
            fields: [],
            rows: [],
            fallbackEditor,
            error: "",
            notice: "",
            result: "",
            rawResult: undefined,
        });
    }

    public confirm = (accepted: boolean): void => {
        const pending = this.pending;
        this.pending = undefined;
        this.snapshot.merge({ confirmation: "" });
        if (accepted) pending?.();
    };

    private ask(message: string, action: () => void): void {
        this.pending = action;
        this.snapshot.merge({ confirmation: message });
    }

    private async perform(action: () => Promise<void>): Promise<void> {
        if (this.snapshot.current.busy || this.isDisposed) return;
        const generation = this.generation;
        this.snapshot.merge({ busy: true, error: "", notice: "" });
        try {
            await action();
        } catch (error) {
            if (!this.isDisposed && generation === this.generation)
                this.snapshot.merge({ error: friendlyError(error) });
        } finally {
            if (!this.isDisposed) this.snapshot.merge({ busy: false });
        }
    }

    private async load(): Promise<void> {
        if (this.isDisposed) return;
        const generation = ++this.generation;
        const { resource, persona } = this.props;
        this.snapshot.merge({ loading: true, error: "", fallbackEditor: undefined });
        try {
            if (resource === "routine") {
                const [jobResponse, historyResponse] = await Promise.allSettled([
                    hub.routine(this.props.id ?? "", persona),
                    hub.routineHistory(this.props.id ?? "", persona),
                ]);
                if (this.isDisposed || generation !== this.generation) return;
                if (jobResponse.status === "rejected") throw jobResponse.reason;
                const job = recordOf(recordOf(jobResponse.value).job);
                this.values = {
                    ...scheduleFields(textOf(job.schedule ?? job.schedule_expr)),
                    name: textOf(job.name),
                    prompt: textOf(job.prompt),
                    enabled: String(job.enabled === true || job.enabled === 1),
                };
                this.dirty = false;
                this.records = historyResponse.status === "fulfilled" ? recordsOf(historyResponse.value) : [];
                this.snapshot.merge({
                    title: textOf(job.name) || getTitles().routine,
                    editing: true,
                    fields: this.routineFields(),
                    toolbar: [
                        { id: "run", label: _t("qing|text_cdb6be7c") },
                        { id: "delete-routine", label: _t("qing|delete_routine"), danger: true },
                    ],
                    hint: [textOf(job.next_run_at ?? job.next_run), textOf(job.timezone)].filter(Boolean).join(" · "),
                    error: historyResponse.status === "rejected" ? _t("qing|text_4d9d19b1") : "",
                });
            } else {
                let response: unknown;
                if (resource === "vault") response = await hub.memoryVault(persona, this.snapshot.current.query);
                else if (resource === "devices") response = await hub.devices();
                else if (resource === "audit") response = await hub.audit();
                else if (resource === "diagnose") response = await hub.diagnose(persona);
                else if (resource === "favorites") response = await hub.serviceFavs();
                else if (resource === "models") {
                    try {
                        response = await hub.agentBundle(persona);
                    } catch (error) {
                        if (!(error instanceof HubError) || error.status !== 404) throw error;
                        response = await hub.agentModel(persona);
                    }
                } else {
                    const [catalog, servers, connectors] = await Promise.all([
                        hub.connectorCatalog(),
                        hub.mcpServers(),
                        hub.connectors(),
                    ]);
                    if (this.isDisposed || generation !== this.generation) return;
                    this.catalog = recordsOf(catalog);
                    response = [
                        ...recordsOf(servers).map((item) => ({ ...item, recordKind: "mcp" })),
                        ...recordsOf(connectors).map((item) => ({ ...item, recordKind: "connector" })),
                    ];
                }
                if (this.isDisposed || generation !== this.generation) return;
                if (resource === "models") {
                    this.modelData = recordOf(response);
                    this.records = [
                        ...recordsOf(this.modelData.candidates).map((item) => ({ ...item, recordKind: "candidate" })),
                        ...recordsOf(this.modelData.auxiliary).map((item) => ({ ...item, recordKind: "auxiliary" })),
                    ];
                } else if (resource === "diagnose") {
                    const data = recordOf(response);
                    this.records = recordsOf(data.checks ?? data.items);
                    if (!this.records.length) this.snapshot.merge({ result: formatHumanResult(response) });
                } else this.records = recordsOf(response);
                this.operation = "";
                this.snapshot.merge({
                    toolbar:
                        resource === "vault"
                            ? [{ id: "index", label: _t("qing|text_11676e8a") }]
                            : resource === "favorites"
                              ? [{ id: "add-favorite", label: _t("qing|text_6cc69188") }]
                              : resource === "connectors"
                                ? [
                                      { id: "catalog", label: _t("qing|text_a5a8a403") },
                                      { id: "add-mcp", label: _t("qing|text_c7121fa8") },
                                  ]
                                : resource === "models"
                                  ? [
                                        { id: "fallback", label: _t("qing|text_d75d9516") },
                                        { id: "test-model", label: _t("qing|text_d361b5e6") },
                                    ]
                                  : [],
                });
            }
            this.showRows();
        } catch (error) {
            if (!this.isDisposed && generation === this.generation)
                this.snapshot.merge({ error: friendlyError(error) });
        } finally {
            if (!this.isDisposed && generation === this.generation) this.snapshot.merge({ loading: false });
        }
    }

    private idOf(item: Record<string, unknown>): string {
        return (
            textOf(this.props.resource === "vault" ? item.name : (item.id ?? item.key ?? item.name)) ||
            `item-${this.records.indexOf(item)}`
        );
    }

    private showRows(): void {
        const resource = this.props.resource;
        const query = this.snapshot.current.query.trim().toLocaleLowerCase();
        const rows: QingCollectionRow[] = this.records
            .filter((item) => !query || JSON.stringify(item).toLocaleLowerCase().includes(query))
            .map((item) => {
                const id = this.idOf(item);
                let actions: QingCollectionAction[] = [];
                if (resource === "vault") actions = [{ id: "open", label: _t("qing|text_9b2c29ed") }];
                if (resource === "devices" && !item.revoked)
                    actions = [{ id: "revoke", label: _t("qing|text_d8c68b7c"), danger: true }];
                if (resource === "favorites")
                    actions = [
                        { id: "up", label: _t("qing|text_f853a70b") },
                        { id: "down", label: _t("qing|text_e75e8b4e") },
                        { id: "delete", label: _t("qing|text_2f9daa82"), danger: true },
                    ];
                if (resource === "models")
                    actions = [
                        {
                            id: item.recordKind === "auxiliary" ? "auxiliary" : "candidate",
                            label: _t("qing|text_05183656"),
                        },
                    ];
                if (resource === "connectors")
                    actions =
                        this.operation === "catalog"
                            ? [{ id: "configure", label: _t("qing|text_a5574109") }]
                            : item.recordKind === "mcp"
                              ? [
                                    { id: "tools", label: _t("qing|text_5ca6730d") },
                                    { id: "refresh", label: _t("qing|text_6fd87b32") },
                                    { id: "delete", label: _t("qing|text_2f9daa82"), danger: true },
                                ]
                              : [
                                    { id: "configure", label: _t("qing|text_148d195e") },
                                    { id: "test-connector", label: _t("qing|text_6aa8f49c") },
                                ];
                const title =
                    textOf(item.title ?? item.label ?? item.name ?? item.action ?? item.started_at) ||
                    _t("qing|item_default");
                if (resource === "vault") {
                    const rawSummary = textOf(
                        item.summary ?? item.description ?? item.detail ?? item.preview ?? item.content,
                    );
                    const cleaned = vaultBody(rawSummary).replace(/\s+/g, " ").trim();
                    const summary = cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned;
                    const time = textOf(item.updated_at ?? item.created_at ?? item.mtime);
                    return {
                        id,
                        title: title.replace(/\.md$/i, ""),
                        description: summary,
                        meta: time || undefined,
                        actions,
                    };
                }
                if (resource === "connectors") {
                    const tools = Array.isArray(item.tools) ? item.tools : [];
                    const hasError = Boolean(item.error || item.last_error);
                    const connected =
                        item.connected === true ||
                        item.configured === true ||
                        item.status === "ok" ||
                        item.status === "enabled" ||
                        item.recordKind === "mcp";
                    const badge =
                        item.mode === "pending"
                            ? { label: _t("qing|conn_pending"), tone: "warn" as const }
                            : hasError
                              ? { label: _t("qing|conn_error"), tone: "danger" as const }
                              : connected
                                ? { label: _t("qing|conn_connected"), tone: "ok" as const }
                                : { label: _t("qing|conn_unconfigured"), tone: "warn" as const };
                    const desc = [
                        textOf(item.capability ?? item.description ?? item.detail),
                        tools.length ? _t("qing|conn_tools_count", { v0: String(tools.length) }) : "",
                        hasError ? friendlyError(item.error ?? item.last_error) : "",
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    return { id, title, description: desc, meta: textOf(item.url) || undefined, badge, actions };
                }
                if (resource === "devices") {
                    const revoked = Boolean(item.revoked);
                    const badge = revoked
                        ? { label: _t("qing|device_revoked"), tone: "danger" as const }
                        : { label: _t("qing|device_active"), tone: "ok" as const };
                    const desc = [
                        textOf(item.platform ?? item.os ?? item.type),
                        textOf(item.ip ?? item.remote_addr),
                        textOf(item.device_id ?? item.id),
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    const lastSeen = textOf(item.last_seen ?? item.updated_at);
                    const createdAt = textOf(item.created_at);
                    const meta = [
                        lastSeen ? _t("qing|device_last_seen", { v0: lastSeen }) : "",
                        createdAt ? _t("qing|device_created_at", { v0: createdAt }) : "",
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    return { id, title, description: desc, meta: meta || undefined, badge, actions };
                }
                if (resource === "audit") {
                    const failed =
                        item.ok === false || item.status === "failed" || item.status === "error" || Boolean(item.error);
                    const passed = item.ok === true || item.status === "ok" || item.status === "success";
                    const badge = failed
                        ? { label: _t("qing|text_0bc1fb72"), tone: "danger" as const }
                        : passed
                          ? { label: _t("qing|status_ok"), tone: "ok" as const }
                          : undefined;
                    const desc = [
                        textOf(item.detail ?? item.summary ?? item.target ?? item.resource),
                        item.error ? friendlyError(item.error) : "",
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    const meta = [
                        textOf(item.actor ?? item.device_name ?? item.persona),
                        textOf(item.created_at ?? item.timestamp ?? item.started_at),
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    return { id, title, description: desc, meta: meta || undefined, badge, actions };
                }
                if (resource === "diagnose") {
                    const ok =
                        item.ok === true || item.status === "ok" || item.status === "success" || item.passed === true;
                    const badge = ok
                        ? { label: _t("qing|diag_pass"), tone: "ok" as const }
                        : { label: _t("qing|diag_fail"), tone: "danger" as const };
                    const rawErr = textOf(item.error ?? item.last_error);
                    const detail = textOf(item.detail ?? item.summary ?? item.message);
                    const hint = ok
                        ? detail || _t("qing|diag_ok_hint")
                        : [
                              textOf(item.hint ?? item.fix) || this.diagnoseFixHint(item),
                              rawErr ? friendlyError(rawErr) : detail,
                          ]
                              .filter(Boolean)
                              .join(" · ");
                    const meta = item.ms !== undefined ? `${textOf(item.ms)} ms` : undefined;
                    return { id, title, description: hint, meta, badge, actions };
                }
                const description = [
                    textOf(
                        item.description ??
                            item.detail ??
                            item.preview ??
                            item.summary ??
                            item.prompt ??
                            item.url ??
                            item.model,
                    ),
                    item.status !== undefined
                        ? statusLabel(item.status)
                        : textOf(item.actor ?? item.last_seen ?? item.created_at),
                    textOf(item.error ?? item.last_error),
                ]
                    .filter(Boolean)
                    .join(" · ");
                return { id, title, description, actions };
            });
        this.snapshot.merge({ rows });
    }

    private edit(
        values: Record<string, string>,
        fields: QingCollectionField[],
        toolbar: QingCollectionAction[] = [],
    ): void {
        if (this.isDisposed) return;
        this.values = values;
        this.dirty = false;
        this.snapshot.merge({
            editing: true,
            fields: fields.map((field) => ({ ...field, value: values[field.id] ?? "" })),
            rows: [],
            toolbar,
            result: "",
            links: [],
            error: "",
        });
    }

    private routineFields(): QingCollectionField[] {
        const fields: QingCollectionField[] = [
            { id: "name", label: _t("qing|text_d44e9b3d"), value: this.values.name },
            {
                id: "mode",
                label: _t("qing|text_56a78268"),
                value: this.values.mode,
                type: "select",
                options: [
                    { value: "daily", label: _t("qing|text_eea1694c") },
                    { value: "weekly", label: _t("qing|text_92845d3b") },
                    { value: "hourly", label: _t("qing|text_adf263ec") },
                    { value: "custom", label: _t("qing|text_4eafa9e9") },
                ],
            },
        ];
        if (this.values.mode === "custom")
            fields.push({ id: "schedule", label: _t("qing|text_5b77d589"), value: this.values.schedule });
        else if (this.values.mode === "hourly")
            fields.push({ id: "minute", label: _t("qing|text_a692e881"), value: this.values.minute });
        else fields.push({ id: "time", label: _t("qing|text_45e03e43"), value: this.values.time, type: "time" });
        if (this.values.mode === "weekly")
            fields.push({
                id: "weekday",
                label: _t("qing|text_c398134d"),
                value: this.values.weekday,
                type: "select",
                options: Array.from({ length: 7 }, (_, index) => ({
                    value: String(index),
                    label: new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
                        new Date(2026, 10, 22 + index),
                    ),
                })),
            });
        fields.push(
            { id: "prompt", label: _t("qing|text_2b7e32bf"), value: this.values.prompt, type: "textarea" },
            { id: "enabled", label: _t("qing|text_e69df862"), value: this.values.enabled, type: "checkbox" },
        );
        return fields;
    }

    private editModel(item: Record<string, unknown>, action: string): void {
        this.operation = action;
        this.edit(
            {
                model: textOf(item.model),
                base_url: textOf(item.base_url),
                key_env: textOf(item.key_env),
                label: textOf(item.label),
                scope: "persona",
                api_mode: textOf(item.api_mode) || "chat_completions",
            },
            [
                { id: "label", label: _t("qing|text_daede988"), value: "" },
                { id: "model", label: _t("qing|text_c98e118e"), value: "" },
                { id: "base_url", label: _t("qing|text_52fff168"), value: "" },
                { id: "key_env", label: _t("qing|text_6802c4f4"), value: "" },
                {
                    id: "api_mode",
                    label: _t("qing|text_a9fd1ddb"),
                    value: "",
                    type: "select",
                    options: [
                        { value: "chat_completions", label: _t("qing|text_722a4afa") },
                        { value: "responses", label: "Responses" },
                    ],
                },
                {
                    id: "scope",
                    label: _t("qing|text_4382ef93"),
                    value: "",
                    type: "select",
                    options: [
                        { value: "persona", label: _t("qing|text_73bbb3d7") },
                        { value: "all", label: _t("qing|text_56634297") },
                    ],
                },
            ],
            [{ id: "endpoint-models", label: _t("qing|text_3a606209") }],
        );
    }

    private async saveModel(): Promise<void> {
        const { persona } = this.props;
        if (this.operation === "fallback") {
            const items = this.snapshot.current.fallbackEditor?.items ?? [];
            const chain = items.map((item) => ({
                provider: item.provider || "custom",
                model: item.model,
                base_url: item.baseUrl,
                key_env: item.keyEnv,
            }));
            await hub.saveFallback(persona, chain);
        } else {
            if (!this.values.model.trim()) throw new Error(_t("qing|text_28d51247"));
            this.validateUrl(this.values.base_url);
            if (this.operation === "auxiliary")
                await hub.saveAuxiliary(persona, {
                    key: this.selected,
                    model: this.values.model,
                    base_url: this.values.base_url,
                    key_env: this.values.key_env,
                    scope: this.values.scope,
                });
            else
                await hub.updateCandidate(
                    this.selected,
                    persona,
                    {
                        label: this.values.label,
                        model: this.values.model,
                        base_url: this.values.base_url,
                        key_env: this.values.key_env,
                        api_mode: this.values.api_mode,
                    },
                    this.values.scope,
                );
        }
    }

    private editConnector(item: Record<string, unknown>, action: string): void {
        if (item.recordKind === "connector") item = { ...this.catalog.find((entry) => entry.id === item.id), ...item };
        if (action === "tools") {
            const tools = recordsOf(item.tools);
            const options = tools.map((tool) => ({ value: textOf(tool.name), label: textOf(tool.name) }));
            this.edit({ tool: options[0]?.value ?? "", arguments: "{}" }, [
                { id: "tool", label: _t("qing|text_5ca6730d"), value: "", type: "select", options },
                { id: "arguments", label: _t("qing|text_48f8beef"), type: "textarea", value: "" },
            ]);
            this.snapshot.merge({
                hint: tools
                    .map((tool) => {
                        const schema = recordOf(tool.inputSchema);
                        const props = recordOf(schema.properties);
                        const paramList = Object.keys(props).join(", ");
                        return [`${textOf(tool.name)}：${textOf(tool.description)}`, paramList ? `(${paramList})` : ""]
                            .filter(Boolean)
                            .join(" ");
                    })
                    .join("\n"),
            });
        } else {
            if (item.mode === "pending") {
                this.snapshot.merge({ error: _t("qing|text_da1bf9cc") });
                return;
            }
            const fields = recordsOf(item.fields);
            const existing = recordOf(item.config);
            this.edit(
                Object.fromEntries(
                    fields.map((field) => [
                        textOf(field.key),
                        field.secret === true ? "" : textOf(existing[textOf(field.key)]),
                    ]),
                ),
                fields.map((field) => ({
                    id: textOf(field.key),
                    label: textOf(field.label) || textOf(field.key),
                    value: "",
                    type: field.secret === true ? "password" : "text",
                    hint: textOf(field.hint),
                })),
            );
            const links = [
                { url: textOf(item.doc_url), label: _t("qing|text_debb2412") },
                ...fields.map((field) => ({
                    url: textOf(field.help_url),
                    label: textOf(field.label) || _t("qing|text_8fe9ef3b"),
                })),
            ].filter((link) => /^https?:\/\//.test(link.url));
            this.snapshot.merge({
                links,
                hint: [textOf(item.capability), ...(Array.isArray(item.steps) ? item.steps.map(textOf) : [])]
                    .filter(Boolean)
                    .join("\n"),
            });
        }
    }

    private async saveConnector(): Promise<void> {
        let item = this.records.find((record) => this.idOf(record) === this.selected) ?? {};
        if (item.recordKind === "connector") item = { ...this.catalog.find((entry) => entry.id === item.id), ...item };
        if (this.operation === "add-mcp") {
            if (!this.values.name.trim()) throw new Error(_t("qing|text_a155a6a5"));
            this.validateUrl(this.values.url);
            await hub.addMcpServer(this.values.name.trim(), this.values.url.trim(), this.values.token || undefined);
        } else if (this.operation === "tools") {
            const args: unknown = JSON.parse(this.values.arguments);
            if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error(_t("qing|text_217c38d3"));
            const result = await hub.mcpCall(Number(item.id), this.values.tool, recordOf(args));
            this.snapshot.merge({ result: formatHumanResult(result), notice: _t("qing|text_8360d896") });
        } else {
            for (const field of recordsOf(item.fields))
                if (!this.values[textOf(field.key)]?.trim() && field.required !== false)
                    throw new Error(_t("qing|text_0f125542"));
            if (item.mode === "remote") {
                let url = textOf(item.url);
                for (const [key, value] of Object.entries(this.values)) url = url.replaceAll(`{${key}}`, value);
                this.validateUrl(url);
                await hub.addMcpServer(textOf(item.name), url, this.values.token || undefined);
            } else await hub.saveConnector(textOf(item.id), this.values);
        }
    }

    private diagnoseFixHint(item: Record<string, unknown>): string {
        const text = `${textOf(item.name ?? item.check)} ${textOf(item.error ?? item.detail)}`.toLowerCase();
        if (/401|403|token|auth|unauthorized|pair/.test(text)) return _t("qing|diag_fix_auth");
        if (/timeout|timed out/.test(text)) return _t("qing|diag_fix_timeout");
        if (/key|credential|env/.test(text)) return _t("qing|diag_fix_key");
        if (/network|fetch|econn|dns|url|http/.test(text)) return _t("qing|diag_fix_network");
        return _t("qing|diag_fix_generic");
    }

    private validateUrl(value: string): void {
        let url: URL;
        try {
            url = new URL(value.trim());
        } catch {
            throw new Error(_t("qing|text_f55919c1"));
        }
        if (!["http:", "https:"].includes(url.protocol)) throw new Error(_t("qing|text_cdcb752d"));
    }
}
