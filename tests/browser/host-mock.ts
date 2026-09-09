import type powerbi from "powerbi-visuals-api";

export interface DataOptions {
    labels?: (string | number | null)[];
    keys?: string[];
    highlights?: (number | null | undefined)[];
    segmented?: boolean;
    format?: string;
    objects?: powerbi.DataViewObjects;
    tooltips?: { name: string; values: powerbi.PrimitiveValue[]; format?: string }[];
}

/** Produces an aggregated categorical view, not an incremental batch. */
export function categoricalView(values: unknown[], options: DataOptions = {}): powerbi.DataView {
    const categorySource: powerbi.DataViewMetadataColumn = {
        displayName: "Category", queryName: "Fact.Category", roles: { Category: true }, type: { text: true }
    };
    const contributionSource: powerbi.DataViewMetadataColumn = {
        displayName: "Contribution", queryName: "Sum(Fact.Contribution)", roles: { Contribution: true },
        isMeasure: true, type: { numeric: true }, format: options.format ?? "#,0.00"
    };
    const tooltipColumns = (options.tooltips ?? []).map(column => ({
        source: {
            displayName: column.name, queryName: `Fact.${column.name}`, roles: { Tooltips: true },
            isMeasure: true, type: { numeric: true }, format: column.format
        },
        values: column.values
    }));
    return {
        metadata: {
            columns: [categorySource, contributionSource, ...tooltipColumns.map(column => column.source)],
            objects: options.objects,
            ...(options.segmented ? { segment: {} } : {})
        },
        categorical: {
            categories: [{
                source: categorySource,
                // SDK PrimitiveValue omits the nulls used for actual host blanks.
                values: (options.labels ?? values.map((_, index) => `Category ${index}`)) as powerbi.PrimitiveValue[],
                identity: values.map((_, index) => ({
                    key: options.keys?.[index] ?? `row-${index}`,
                    expr: { kind: 0 }
                })) as unknown as NonNullable<powerbi.DataViewCategoryColumn["identity"]>
            }],
            values: [{
                source: contributionSource,
                values: values as powerbi.PrimitiveValue[],
                ...(options.highlights === undefined ? {} : { highlights: options.highlights })
            }, ...tooltipColumns] as powerbi.DataViewValueColumns
        }
    };
}

export interface HostOptions {
    locale?: string;
    allowInteractions?: boolean;
    fetchAvailable?: boolean;
    fetchAccepted?: boolean;
    highContrast?: boolean;
    foreground?: string;
    background?: string;
    foregroundSelected?: string;
}

export interface MockSelectionId {
    getKey(): string;
    equals(other: MockSelectionId): boolean;
    includes(other: MockSelectionId, ignoreHighlight?: boolean): boolean;
    hasIdentity(): boolean;
    getSelector(): object;
    getSelectorsByColumn(): object;
}

export interface TooltipCall {
    coordinates?: number[];
    isTouchEvent: boolean;
    immediately?: boolean;
    dataItems?: { displayName: string; value: string }[];
    identities?: string[];
}

export interface HostState {
    events: { name: "started" | "finished" | "failed"; type: number; operationKind?: number; message?: string }[];
    fetchRequests: boolean[];
    selections: { keys: string[]; multiSelect: boolean }[];
    selectedKeys: string[];
    clears: number;
    menus: { key: string | null; position: { x: number; y: number } }[];
    tooltips: { name: "show" | "move" | "hide"; options: TooltipCall }[];
    localizationKeys: string[];
    builderKeys: string[];
    persisted: powerbi.VisualObjectInstancesToPersist[];
}

export interface VisualUpdate {
    type: number;
    viewport: { width: number; height: number };
    dataViews?: powerbi.DataView[];
    operationKind?: number;
}

interface PackagedVisual {
    update(options: VisualUpdate): void;
    getFormattingModel(): unknown;
    destroy(): void;
}

export interface BrowserHarness {
    host: Record<string, unknown>;
    state: HostState;
    visual?: PackagedVisual;
    incomingSelection(keys: string[]): void;
    incomingCompositeSelection(keys: string[]): void;
    setFetchAccepted(accepted: boolean): void;
    rejectNextInteraction(kind: "select" | "clear" | "contextMenu"): void;
}

declare global {
    interface Window {
        __paretoTest: BrowserHarness;
        __categoryScriptRan?: boolean;
    }
}

/**
 * Inject with page.evaluate(installHostMock, options). All runtime dependencies
 * are inside this function so the host can also be used with another bundle.
 */
export function installHostMock(options: HostOptions & { resources: Record<string, Record<string, string>> }): void {
    const state: HostState = {
        events: [], fetchRequests: [], selections: [], selectedKeys: [], clears: 0,
        menus: [], tooltips: [], localizationKeys: [], builderKeys: [], persisted: []
    };
    let fetchAccepted = options.fetchAccepted ?? true;
    let selected: MockSelectionId[] = [];
    let selectionCallback: (() => void) | undefined;
    let rejectNext: "select" | "clear" | "contextMenu" | undefined;
    const locale = options.locale ?? "en-US";
    const resources = options.resources[locale] ?? options.resources["en-US"];
    const makeIdentity = (key: string): MockSelectionId => ({
        getKey: () => key,
        equals: other => other?.getKey() === key,
        includes: other => other?.getKey() === key,
        hasIdentity: () => true,
        getSelector: () => ({ data: [{ scopeId: { key } }] }),
        getSelectorsByColumn: () => ({ dataMap: { "Fact.Category": { key } } })
    });
    const publishSelection = (): void => {
        state.selectedKeys = selected.map(identity => identity.getKey());
    };
    const rejected = (kind: typeof rejectNext): boolean => {
        if (rejectNext !== kind) return false;
        rejectNext = undefined;
        return true;
    };
    const captureTooltip = (name: "show" | "move" | "hide", args: {
        coordinates?: number[]; isTouchEvent: boolean; immediately?: boolean;
        dataItems?: { displayName: string; value: string }[]; identities?: MockSelectionId[];
    }): void => {
        state.tooltips.push({
            name,
            options: {
                ...args,
                dataItems: args.dataItems?.map(item => ({ ...item })),
                identities: args.identities?.map(identity => identity.getKey())
            }
        });
    };
    const selectionManager = {
        getSelectionIds: () => [...selected],
        hasSelection: () => selected.length > 0,
        registerOnSelectCallback: (callback: () => void) => { selectionCallback = callback; },
        select: (ids: MockSelectionId | MockSelectionId[], multiSelect = false): Promise<MockSelectionId[]> => {
            const incoming = Array.isArray(ids) ? ids : [ids];
            state.selections.push({ keys: incoming.map(id => id.getKey()), multiSelect });
            if (rejected("select")) return Promise.reject(new Error("Mock selection rejection"));
            if (multiSelect) {
                for (const id of incoming) {
                    const present = selected.findIndex(existing => existing.equals(id));
                    if (present < 0) selected.push(id);
                    else selected.splice(present, 1);
                }
            } else {
                const same = incoming.length === selected.length && incoming.every(id => selected.some(existing => existing.equals(id)));
                selected = same ? [] : [...incoming];
            }
            publishSelection();
            return Promise.resolve([...selected]);
        },
        clear: (): Promise<MockSelectionId[]> => {
            state.clears++;
            if (rejected("clear")) return Promise.reject(new Error("Mock clear rejection"));
            selected = [];
            publishSelection();
            return Promise.resolve([]);
        },
        showContextMenu: (id: MockSelectionId | object, position: { x: number; y: number }): Promise<void> => {
            state.menus.push({ key: "getKey" in id ? (id as MockSelectionId).getKey() : null, position: { ...position } });
            return rejected("contextMenu") ? Promise.reject(new Error("Mock context menu rejection")) : Promise.resolve();
        }
    };
    const host = {
        persistProperties: (changes: powerbi.VisualObjectInstancesToPersist) => {
            state.persisted.push(changes);
        },
        locale,
        hostCapabilities: { allowInteractions: options.allowInteractions ?? true },
        colorPalette: {
            isHighContrast: options.highContrast ?? false,
            foreground: { value: options.foreground ?? "#FFFF00" },
            background: { value: options.background ?? "#000000" },
            foregroundSelected: { value: options.foregroundSelected ?? "#00FFFF" },
            hyperlink: { value: "#00FFFF" },
            getColor: () => ({ value: "#7895B2" }),
            reset: () => undefined
        },
        eventService: {
            renderingStarted: (update: VisualUpdate) => state.events.push({ name: "started", type: update.type, operationKind: update.operationKind }),
            renderingFinished: (update: VisualUpdate) => state.events.push({ name: "finished", type: update.type, operationKind: update.operationKind }),
            renderingFailed: (update: VisualUpdate, message?: string) => state.events.push({ name: "failed", type: update.type, operationKind: update.operationKind, message })
        },
        createLocalizationManager: () => ({
            getDisplayName: (key: string): string => {
                state.localizationKeys.push(key);
                return resources[key] ?? options.resources["en-US"][key] ?? key;
            }
        }),
        createSelectionManager: () => selectionManager,
        createSelectionIdBuilder: () => {
            let key: string | undefined;
            const builder = {
                withCategory: (category: powerbi.DataViewCategoryColumn, index: number) => {
                    const identity = category.identity?.[index] as unknown as { key?: string } | undefined;
                    if (typeof identity?.key !== "string") throw new Error(`Mock category identity missing at ${index}`);
                    key = `category:${identity.key}`;
                    return builder;
                },
                withMeasure: () => builder,
                withSeries: () => builder,
                createSelectionId: () => {
                    if (!key) throw new Error("withCategory must supply an identity before createSelectionId");
                    state.builderKeys.push(key);
                    return makeIdentity(key);
                }
            };
            return builder;
        },
        tooltipService: {
            enabled: () => true,
            show: (args: Parameters<typeof captureTooltip>[1]) => captureTooltip("show", args),
            move: (args: Parameters<typeof captureTooltip>[1]) => captureTooltip("move", args),
            hide: (args: Parameters<typeof captureTooltip>[1]) => captureTooltip("hide", args)
        },
        fetchMoreData: options.fetchAvailable === false ? undefined : (aggregateSegments: boolean): boolean => {
            state.fetchRequests.push(aggregateSegments);
            return fetchAccepted;
        }
    };
    window.__paretoTest = {
        host, state,
        incomingSelection: keys => {
            selected = keys.map(makeIdentity);
            publishSelection();
            selectionCallback?.();
        },
        incomingCompositeSelection: keys => {
            const identity = makeIdentity(`composite:${keys.join("|")}`);
            identity.includes = other => keys.includes(other.getKey());
            selected = [identity];
            publishSelection();
            selectionCallback?.();
        },
        setFetchAccepted: accepted => { fetchAccepted = accepted; },
        rejectNextInteraction: kind => { rejectNext = kind; }
    };
    Object.assign(window, { powerbi: { visuals: { plugins: {} } } });
}
