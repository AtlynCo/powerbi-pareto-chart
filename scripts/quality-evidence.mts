import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import type powerbi from "powerbi-visuals-api";
import { readPackage } from "./package-utils.mjs";
import { categoricalView, installHostMock, type DataOptions, type HostOptions } from "../tests/browser/host-mock";

interface Payload {
    visual: { guid: string; displayName: string; version: string };
    content: { js: string; css: string };
    stringResources: Record<string, Record<string, string>>;
}

interface PackageResult {
    bytes: Uint8Array;
    filename: string;
    sha256: string;
    metadata: { visual: { guid: string; version: string } };
    manifest: unknown;
    payload: Payload;
}

export interface Size {
    width: number;
    height: number;
}

interface ScenarioDefinition {
    id: string;
    title: string;
    category: "scenario" | "state";
    note: string;
    defaultViewport?: Size;
    view: powerbi.DataView;
    hostOptions?: HostOptions;
    afterUpdate?: ScenarioAction;
}

type ScenarioAction = "scroll-root" | "touch-and-keyboard";

interface CaptureRecord {
    id: string;
    title: string;
    category: "scenario" | "state";
    viewport: Size;
    file: string;
    note: string;
    dom: {
        title: string | null;
        ariaLabel: string | null;
        direction: string | null;
        barTargets: number;
        contributionBars: number;
        cumulativeLines: number;
        tableRows: number;
        warning: string | null;
        alert: string | null;
        thresholdSummary: string | null;
        total: string | null;
        rootRect: { width: number; height: number; x: number; y: number };
        scrollState: {
            scrollTop: number;
            scrollHeight: number;
            clientHeight: number;
            chartScrollLeft: number;
            chartScrollWidth: number;
            chartClientWidth: number;
        };
    };
    renderFailedCount: number;
}

interface ListingCandidate {
    scenarioId: string;
    viewport: Size;
    sourceFile: string;
    file: string;
}

interface BenchmarkStats {
    raw: number[];
    p50: number;
    p95: number;
    max: number;
}

interface BenchmarkOperationReport {
    name: "create" | "dataUpdate" | "resize";
    syncMs: BenchmarkStats;
    nextAnimationFrameMs: BenchmarkStats;
}

interface BenchmarkCaseReport {
    id: string;
    description: string;
    seed: number;
    rows: number;
    warmupSamples: number;
    measuredSamples: number;
    startedAtUtc: string;
    completedAtUtc: string;
    expectedTotal: string;
    operations: BenchmarkOperationReport[];
    oracle: {
        totalText: string | null;
        thresholdSummary: string | null;
        barTargets: number;
        contributionBars: number;
        cumulativeLines: number;
        tableRows: number;
        chartViewBox: string | null;
        firstCategoryLabel: string | null;
        renderFailedCount: number;
    };
}

interface BenchmarkMethod {
    syncRegion: string;
    nextAnimationFrameRegion: string;
    excludes: string[];
    includes: string[];
    forceLayoutBoundary: string;
    diagnosticsHandling: string;
}

interface InteractionEvidence {
    file: string;
    viewport: Size;
    selectedKeys: string[];
    selections: { keys: string[]; multiSelect: boolean }[];
    tooltipTouchCall: {
        isTouchEvent: boolean;
        identities?: string[];
        dataItems?: { displayName: string; value: string }[];
    } | null;
    focusedRowIndex: string | null;
    clearedCount: number;
}

interface MultiHostEvidence {
    file: string;
    viewport: Size;
    hosts: Array<{
        key: string;
        direction: string | null;
        total: string | null;
        thresholdSummary: string | null;
        failedEvents: number;
        selectedKeys: string[];
    }>;
}

interface QualityReport {
    label: "baseline" | "final";
    note: string;
    generatedAtUtc: string;
    command: string;
    package: {
        filename: string;
        copiedArtifact: string;
        sha256: string;
        guid: string;
        visualVersion: string;
    };
    environment: {
        browser: string;
        browserVersion: string;
        node: string;
        platform: NodeJS.Platform;
        release: string;
        arch: string;
        cpuModel: string;
        cpuCount: number;
        totalMemoryBytes: number;
        freeMemoryBytes: number;
    };
    captureSizes: Size[];
    captures: CaptureRecord[];
    listingCandidates: ListingCandidate[];
    multiHost: MultiHostEvidence;
    interactions: InteractionEvidence;
    benchmarks: BenchmarkCaseReport[];
    benchmarkMethod: BenchmarkMethod;
    caveats: string[];
}

export const DEFAULT_CAPTURE_SIZES: readonly Size[] = Object.freeze([
    { width: 80, height: 80 },
    { width: 258, height: 198 },
    { width: 398, height: 298 },
    { width: 1280, height: 620 },
    { width: 1366, height: 768 }
]);

const MULTI_HOST_VIEWPORT: Size = { width: 1366, height: 768 };
const LISTING_PRIMARY_SIZE: Size = { width: 1366, height: 768 };
const LISTING_FALLBACK_SIZE: Size = { width: 1280, height: 720 };
const INTERACTION_VIEWPORT: Size = { width: 1280, height: 620 };
const LOADING_VIEWPORT: Size = { width: 398, height: 298 };
const SCROLL_VIEWPORT: Size = { width: 1280, height: 620 };
const BASELINE_IMMUTABLE_PATH = path.resolve("artifacts", "quality", "baseline", "baseline.pbiviz");
const pageDiagnostics = new WeakMap<import("@playwright/test").Page, string[]>();

function parseCli(argv = process.argv.slice(2)): {
    label: "baseline" | "final";
    samples: number;
    warmups: number;
    skipBenchmarks: boolean;
    packagePath?: string;
    captureSizes: Size[];
} {
    const { values } = parseArgs({
        args: argv,
        allowPositionals: false,
        options: {
            label: { type: "string" },
            samples: { type: "string" },
            warmups: { type: "string" },
            "skip-benchmarks": { type: "boolean" },
            package: { type: "string" },
            "capture-sizes": { type: "string", multiple: true }
        }
    });
    const label = values.label;
    if (label !== "baseline" && label !== "final") {
        throw new Error("Use --label baseline or --label final.");
    }
    const samples = boundedInteger(values.samples, 20, 1, 200, "--samples");
    const warmups = boundedInteger(values.warmups, 3, 0, 50, "--warmups");
    return {
        label,
        samples,
        warmups,
        skipBenchmarks: values["skip-benchmarks"] ?? false,
        packagePath: values.package,
        captureSizes: mergeCaptureSizes(values["capture-sizes"] ?? [])
    };
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number, name: string): number {
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
    }
    return value;
}

function mergeCaptureSizes(extraValues: string[]): Size[] {
    const seen = new Set(DEFAULT_CAPTURE_SIZES.map(sizeKey));
    const sizes = [...DEFAULT_CAPTURE_SIZES];
    for (const chunk of extraValues.flatMap(value => value.split(","))) {
        const token = chunk.trim();
        if (!token) continue;
        const parsed = parseSizeToken(token);
        const key = sizeKey(parsed);
        if (!seen.has(key)) {
            seen.add(key);
            sizes.push(parsed);
        }
    }
    return sizes.sort((left, right) => (left.width - right.width) || (left.height - right.height));
}

function parseSizeToken(token: string): Size {
    const match = /^(\d+)x(\d+)$/i.exec(token);
    if (!match) throw new Error(`Capture size must look like 1280x720, received ${JSON.stringify(token)}.`);
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width < 40 || height < 40) throw new Error(`Capture size ${token} is too small.`);
    return { width, height };
}

function sizeKey(size: Size): string {
    return `${size.width}x${size.height}`;
}

function sizeSlug(size: Size): string {
    return `${String(size.width).padStart(4, "0")}x${String(size.height).padStart(4, "0")}`;
}

function packagePathForLabel(label: "baseline" | "final", override?: string): string {
    if (override) return path.resolve(override);
    if (label === "baseline") {
        return BASELINE_IMMUTABLE_PATH;
    }
    return path.resolve(readPackage().filename);
}

export function readQualityPackage(label: "baseline" | "final", override?: string): PackageResult {
    return readPackage(packagePathForLabel(label, override)) as PackageResult;
}

function buildScenarioData(): ScenarioDefinition[] {
    const sample = (file: string, format: string, measure: string, tooltip: string) => {
        const rows = fs.readFileSync(path.join("samples", file), "utf8").trim().split(/\r?\n/).slice(1).map(line => line.split(","));
        const view = categoricalView(rows.map(row => Number(row[1])), {
            labels: rows.map(row => row[0] || null), keys: rows.map((_, index) => `${file}-${index}`),
            format, objects: { analysis: { threshold: 80 }, appearance: { showTable: true } },
            tooltips: [{ name: tooltip, values: rows.map(row => Number(row[2])), format: "#,0" }]
        });
        view.categorical!.values![0].source.displayName = measure;
        return view;
    };
    const denseValues = Array.from({ length: 100 }, (_, index) => Math.max(1, 700 - index * 6 + (index % 5)));
    const denseLabels = denseValues.map((_, index) => `Category ${String(index + 1).padStart(3, "0")}`);
    const denseKeys = denseLabels.map((_, index) => `dense-${index + 1}`);
    const objects = { analysis: { threshold: 80, pageSize: 30 }, appearance: { showTable: true } };
    return [
        {
            id: "defect",
            title: "Defect concentration",
            category: "scenario",
            note: "Offline host-mock capture of ranked defect counts from the packaged visual.",
            view: sample("defect-count.csv", "#,0", "Defect count", "Rework minutes")
        },
        {
            id: "cost",
            title: "Cost concentration",
            category: "scenario",
            note: "Offline host-mock capture using currency formatting from the real packaged bundle.",
            view: sample("complaint-cost.csv", "$#,0.00", "Complaint cost (USD)", "Complaint count")
        },
        {
            id: "customer",
            title: "Customer concentration",
            category: "scenario",
            note: "Offline host-mock capture of the authored synthetic customer revenue scenario from the real visual package.",
            view: sample("customer-revenue.csv", "$#,0.00", "Customer revenue (USD)", "Invoice count")
        },
        {
            id: "longlabels",
            title: "Long labels",
            category: "scenario",
            note: "Long category labels rendered by the packaged visual without a synthetic HTML fallback.",
            view: categoricalView([88, 74, 63, 52, 41, 35, 29, 24, 18, 13, 8, 5], {
                labels: [
                    "Demand planning exceptions requiring weekly cross-functional review",
                    "Customer lifetime value cohorts with shared revenue attribution",
                    "Manual reconciliation tasks carried over from the previous month",
                    "Sales enablement content requests awaiting regional localization",
                    "Backlog items with ambiguous scope and external dependencies",
                    "Escalations from enterprise tenants requesting custom thresholds",
                    "Legacy semantic model refreshes still using old field bindings",
                    "Support conversations reopened after downstream validation failures",
                    "Chart interactions retried from touch devices on compact tiles",
                    "Localization strings validated against right-to-left environments",
                    "Accessibility fixes verified under forced-colors high contrast",
                    "Residual low-volume categories after concentration threshold crossing"
                ],
                keys: Array.from({ length: 12 }, (_, index) => `long-${index + 1}`),
                objects: { analysis: { threshold: 80 }, appearance: { showTable: true, fontSize: 14 } }
            })
        },
        {
            id: "dense100cats",
            title: "Dense 100 categories",
            category: "scenario",
            note: "One hundred deterministic categories to exercise pagination, overview rendering, and scroll affordances.",
            view: categoricalView(denseValues, { labels: denseLabels, keys: denseKeys, objects })
        },
        {
            id: "loading",
            title: "Incomplete loading state",
            category: "state",
            note: "Host-mock capture of the packaged visual while a segmented request remains incomplete.",
            defaultViewport: LOADING_VIEWPORT,
            view: categoricalView(denseValues, { labels: denseLabels, keys: denseKeys, segmented: true, objects })
        },
        {
            id: "invalid",
            title: "Invalid data state",
            category: "state",
            note: "Host-mock capture showing the packaged visual's invalid-data alert path.",
            defaultViewport: LOADING_VIEWPORT,
            view: categoricalView([60, -5, null, Number.POSITIVE_INFINITY], {
                labels: ["Valid", "Negative", "Missing", "Infinite"],
                keys: ["invalid-ok", "invalid-negative", "invalid-missing", "invalid-infinite"],
                objects: { analysis: { threshold: 80 }, appearance: { showTable: true } }
            })
        },
        {
            id: "empty", title: "Empty query", category: "state", note: "Bound query with no delivered categories.",
            defaultViewport: LOADING_VIEWPORT, view: categoricalView([])
        },
        {
            id: "zero", title: "Zero total", category: "state", note: "Zero contributions retained; no defined cumulative percentages.",
            defaultViewport: LOADING_VIEWPORT, view: categoricalView([0, 0, 0])
        },
        {
            id: "subset", title: "Explicit received subset", category: "state", note: "Opt-in partial denominator; full population remains unknown.",
            defaultViewport: LOADING_VIEWPORT,
            view: categoricalView([60, 30, 10], { segmented: true, objects: { analysis: { partialPolicy: "subset" } } })
        },
        {
            id: "highlight", title: "Incoming highlight", category: "state", note: "Highlights overlay original contributions without changing the denominator.",
            defaultViewport: INTERACTION_VIEWPORT, view: categoricalView([60, 30, 10], { highlights: [20, 15, null] })
        },
        {
            id: "scroll",
            title: "Scrolled dense view",
            category: "state",
            note: "Host-mock capture after scrolling a dense packaged-visual render to the lower table region.",
            defaultViewport: SCROLL_VIEWPORT,
            view: categoricalView(denseValues, { labels: denseLabels, keys: denseKeys, objects }),
            afterUpdate: "scroll-root"
        },
        {
            id: "touch-keyboard",
            title: "Touch and keyboard interaction state",
            category: "state",
            note: "Host-mock capture after real keyboard selection and touch tooltip interactions against the packaged visual.",
            defaultViewport: INTERACTION_VIEWPORT,
            view: categoricalView([320, 220, 110, 70, 40], {
                labels: ["Enterprise", "Mid-market", "Self-serve", "Pilot", "Other"],
                keys: ["touch-enterprise", "touch-mid", "touch-self", "touch-pilot", "touch-other"],
                objects: { analysis: { threshold: 80 }, appearance: { showTable: true } }
            }),
            afterUpdate: "touch-and-keyboard"
        }
    ];
}

export function qualityBrowserBridgeSource(): string {
    return `(() => {
        window.__qualityHarnesses = {};
        window.__qualityCategoricalView = function(values, options = {}) {
            const categorySource = {
                displayName: 'Category', queryName: 'Fact.Category', roles: { Category: true }, type: { text: true }
            };
            const contributionSource = {
                displayName: 'Contribution', queryName: 'Sum(Fact.Contribution)', roles: { Contribution: true },
                isMeasure: true, type: { numeric: true }, format: options.format ?? '#,0.00'
            };
            const tooltipColumns = (options.tooltips ?? []).map(column => ({
                source: {
                    displayName: column.name, queryName: 'Fact.' + column.name, roles: { Tooltips: true },
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
                        values: options.labels ?? values.map((_, index) => 'Category ' + index),
                        identity: values.map((_, index) => ({
                            key: options.keys?.[index] ?? 'row-' + index,
                            expr: { kind: 0 }
                        }))
                    }],
                    values: [{
                        source: contributionSource,
                        values,
                        ...(options.highlights === undefined ? {} : { highlights: options.highlights })
                    }, ...tooltipColumns]
                }
            };
        };
        window.__qualityInstallHostMock = function(options) {
            const state = {
                events: [], fetchRequests: [], selections: [], selectedKeys: [], clears: 0,
                menus: [], tooltips: [], localizationKeys: [], builderKeys: [], persisted: []
            };
            let fetchAccepted = options.fetchAccepted ?? true;
            let selected = [];
            let selectionCallback;
            let rejectNext;
            const locale = options.locale ?? 'en-US';
            const localized = options.resources[locale] ?? options.resources['en-US'];
            const makeIdentity = key => ({
                getKey: () => key,
                equals: other => other?.getKey() === key,
                includes: other => other?.getKey() === key,
                hasIdentity: () => true,
                getSelector: () => ({ data: [{ scopeId: { key } }] }),
                getSelectorsByColumn: () => ({ dataMap: { 'Fact.Category': { key } } })
            });
            const publishSelection = () => {
                state.selectedKeys = selected.map(identity => identity.getKey());
            };
            const rejected = kind => {
                if (rejectNext !== kind) return false;
                rejectNext = undefined;
                return true;
            };
            const captureTooltip = (name, args) => {
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
                registerOnSelectCallback: callback => { selectionCallback = callback; },
                select: (ids, multiSelect = false) => {
                    const incoming = Array.isArray(ids) ? ids : [ids];
                    state.selections.push({ keys: incoming.map(id => id.getKey()), multiSelect });
                    if (rejected('select')) return Promise.reject(new Error('Mock selection rejection'));
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
                clear: () => {
                    state.clears++;
                    if (rejected('clear')) return Promise.reject(new Error('Mock clear rejection'));
                    selected = [];
                    publishSelection();
                    return Promise.resolve([]);
                },
                showContextMenu: (id, position) => {
                    state.menus.push({ key: 'getKey' in id ? id.getKey() : null, position: { ...position } });
                    return rejected('contextMenu') ? Promise.reject(new Error('Mock context menu rejection')) : Promise.resolve();
                }
            };
            const host = {
                persistProperties: changes => { state.persisted.push(changes); },
                locale,
                hostCapabilities: { allowInteractions: options.allowInteractions ?? true },
                colorPalette: {
                    isHighContrast: options.highContrast ?? false,
                    foreground: { value: options.foreground ?? '#FFFF00' },
                    background: { value: options.background ?? '#000000' },
                    foregroundSelected: { value: options.foregroundSelected ?? '#00FFFF' },
                    hyperlink: { value: '#00FFFF' },
                    getColor: () => ({ value: '#7895B2' }),
                    reset: () => undefined
                },
                eventService: {
                    renderingStarted: update => state.events.push({ name: 'started', type: update.type, operationKind: update.operationKind }),
                    renderingFinished: update => state.events.push({ name: 'finished', type: update.type, operationKind: update.operationKind }),
                    renderingFailed: (update, message) => state.events.push({ name: 'failed', type: update.type, operationKind: update.operationKind, message })
                },
                createLocalizationManager: () => ({
                    getDisplayName: key => {
                        state.localizationKeys.push(key);
                        return localized[key] ?? options.resources['en-US'][key] ?? key;
                    }
                }),
                createSelectionManager: () => selectionManager,
                createSelectionIdBuilder: () => {
                    let key;
                    const builder = {
                        withCategory: (category, index) => {
                            const identity = category.identity?.[index];
                            if (typeof identity?.key !== 'string') throw new Error('Mock category identity missing at ' + index);
                            key = 'category:' + identity.key;
                            return builder;
                        },
                        withMeasure: () => builder,
                        withSeries: () => builder,
                        createSelectionId: () => {
                            if (!key) throw new Error('withCategory must supply an identity before createSelectionId');
                            state.builderKeys.push(key);
                            return makeIdentity(key);
                        }
                    };
                    return builder;
                },
                tooltipService: {
                    enabled: () => true,
                    show: args => captureTooltip('show', args),
                    move: args => captureTooltip('move', args),
                    hide: args => captureTooltip('hide', args)
                },
                fetchMoreData: options.fetchAvailable === false ? undefined : aggregateSegments => {
                    state.fetchRequests.push(aggregateSegments);
                    return fetchAccepted;
                }
            };
            window.__paretoTest = {
                host,
                state,
                incomingSelection: keys => {
                    selected = keys.map(makeIdentity);
                    publishSelection();
                    selectionCallback?.();
                },
                incomingCompositeSelection: keys => {
                    const identity = makeIdentity('composite:' + keys.join('|'));
                    identity.includes = other => keys.includes(other.getKey());
                    selected = [identity];
                    publishSelection();
                    selectionCallback?.();
                },
                setFetchAccepted: accepted => { fetchAccepted = accepted; },
                rejectNextInteraction: kind => { rejectNext = kind; }
            };
            Object.assign(window, { powerbi: { visuals: { plugins: {} } } });
        };
        window.__qualityMountVisual = function(args) {
            const { key, rootId, guid, resources, hostOptions = {} } = args;
            window.__qualityInstallHostMock({ ...hostOptions, resources });
            const globals = window;
            const namespace = globals[guid];
            const powerbi = globals.powerbi;
            const plugin = powerbi?.visuals?.plugins?.[guid] ?? namespace?.default ?? namespace;
            const element = document.getElementById(rootId);
            if (!element) throw new Error('Missing visual root ' + rootId + '.');
            window.__qualityHarnesses[key] = window.__paretoTest;
            const options = { element, host: window.__paretoTest.host };
            if (plugin?.create) window.__paretoTest.visual = plugin.create(options);
            else if (namespace?.Visual) window.__paretoTest.visual = new namespace.Visual(options);
            else throw new Error('No Power BI plugin or Visual export in the packaged bundle for ' + guid + '.');
        };
        window.__qualityUpdateVisual = function(args) {
            const { key, view, viewport, type = 2, operationKind = 0 } = args;
            const harness = window.__qualityHarnesses[key];
            if (!harness?.visual) throw new Error('Missing visual harness ' + key + '.');
            harness.visual.update({ type, operationKind, viewport, dataViews: view ? [view] : [] });
        };
        window.__qualityDestroyAllVisuals = function() {
            for (const harness of Object.values(window.__qualityHarnesses)) {
                harness.visual?.destroy?.();
            }
            window.__qualityHarnesses = {};
        };
        window.__qualityRunBenchmarks = async function(args) {
            const { guid, resources, cases, samples, warmups } = args;
            const stage = document.getElementById('bench-stage');
            if (!stage) throw new Error('Missing benchmark stage.');
            const nextFrame = () => new Promise(resolve => {
                const started = performance.now();
                requestAnimationFrame(() => resolve(performance.now() - started));
            });
            const makeSeries = (count, seed) => {
                let state = seed >>> 0;
                const values = [];
                const labels = [];
                const keys = [];
                let total = 0;
                for (let index = 0; index < count; index++) {
                    state = (state * 1664525 + 1013904223) >>> 0;
                    const value = 25 + (state % 975);
                    values.push(value);
                    labels.push('Benchmark ' + String(index + 1).padStart(6, '0'));
                    keys.push('bench-' + (index + 1));
                    total += value;
                }
                return { values, labels, keys, total };
            };
            const expectedTotalText = total => 'Denominator total: ' + new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(total);
            const destroyHarness = key => {
                window.__qualityHarnesses[key]?.visual?.destroy?.();
                delete window.__qualityHarnesses[key];
            };
            const resetDiagnostics = key => {
                const state = window.__qualityHarnesses[key]?.state;
                if (!state) return;
                state.events = [];
                state.fetchRequests = [];
                state.selections = [];
                state.selectedKeys = [];
                state.clears = 0;
                state.menus = [];
                state.tooltips = [];
                state.localizationKeys = [];
                state.builderKeys = [];
                state.persisted = [];
            };
            const failedCount = key => window.__qualityHarnesses[key]?.state.events.filter(event => event.name === 'failed').length ?? 0;
            const runCase = async entry => {
                const primary = makeSeries(entry.rows, entry.seed);
                const secondary = makeSeries(entry.rows, entry.seed ^ 0x9e3779b9);
                const viewOptions = series => ({
                    labels: series.labels,
                    keys: series.keys,
                    objects: { analysis: { threshold: 80, pageSize: 30 }, appearance: { showTable: true } }
                });
                const primaryView = window.__qualityCategoricalView(primary.values, viewOptions(primary));
                const secondaryView = window.__qualityCategoricalView(secondary.values, viewOptions(secondary));
                const startedAtUtc = new Date().toISOString();
                const createSamples = [];
                const createFrames = [];
                const dataSamples = [];
                const dataFrames = [];
                const resizeSamples = [];
                const resizeFrames = [];
                for (let index = 0; index < warmups + samples; index++) {
                    const rootId = 'create-' + entry.id + '-' + index;
                    stage.replaceChildren();
                    const root = document.createElement('div');
                    root.id = rootId;
                    root.style.width = '1366px';
                    root.style.height = '768px';
                    stage.appendChild(root);
                    const started = performance.now();
                    window.__qualityMountVisual({ key: rootId, rootId, guid, resources });
                    window.__qualityUpdateVisual({ key: rootId, view: primaryView, viewport: { width: 1366, height: 768 }, type: 2, operationKind: 0 });
                    const sync = performance.now() - started;
                    const frame = await nextFrame();
                    const failed = window.__qualityHarnesses[rootId]?.state.events.filter(event => event.name === 'failed').length ?? 0;
                    if (failed) throw new Error('Create benchmark failed for ' + entry.id + '.');
                    if (index >= warmups) {
                        createSamples.push(sync);
                        createFrames.push(frame);
                    }
                    destroyHarness(rootId);
                    stage.replaceChildren();
                }
                stage.replaceChildren();
                const dataRootId = 'data-' + entry.id;
                const dataRoot = document.createElement('div');
                dataRoot.id = dataRootId;
                dataRoot.style.width = '1366px';
                dataRoot.style.height = '768px';
                stage.appendChild(dataRoot);
                window.__qualityMountVisual({ key: dataRootId, rootId: dataRootId, guid, resources });
                window.__qualityUpdateVisual({ key: dataRootId, view: primaryView, viewport: { width: 1366, height: 768 }, type: 2, operationKind: 0 });
                resetDiagnostics(dataRootId);
                for (let index = 0; index < warmups; index++) {
                    resetDiagnostics(dataRootId);
                    window.__qualityUpdateVisual({
                        key: dataRootId,
                        view: index % 2 === 0 ? primaryView : secondaryView,
                        viewport: { width: 1366, height: 768 },
                        type: 2,
                        operationKind: 0
                    });
                    await nextFrame();
                    if (failedCount(dataRootId)) throw new Error('Data benchmark failed during warmup for ' + entry.id + '.');
                }
                for (let index = 0; index < samples; index++) {
                    resetDiagnostics(dataRootId);
                    const started = performance.now();
                    window.__qualityUpdateVisual({
                        key: dataRootId,
                        view: index % 2 === 0 ? primaryView : secondaryView,
                        viewport: { width: 1366, height: 768 },
                        type: 2,
                        operationKind: 0
                    });
                    dataSamples.push(performance.now() - started);
                    dataFrames.push(await nextFrame());
                    if (failedCount(dataRootId)) throw new Error('Data benchmark failed during measurement for ' + entry.id + '.');
                }
                resetDiagnostics(dataRootId);
                window.__qualityUpdateVisual({
                    key: dataRootId,
                    view: primaryView,
                    viewport: { width: 1366, height: 768 },
                    type: 2,
                    operationKind: 0
                });
                await nextFrame();
                const resizeRootId = 'resize-' + entry.id;
                const resizeRoot = document.createElement('div');
                resizeRoot.id = resizeRootId;
                resizeRoot.style.width = '1366px';
                resizeRoot.style.height = '768px';
                stage.appendChild(resizeRoot);
                window.__qualityMountVisual({ key: resizeRootId, rootId: resizeRootId, guid, resources });
                window.__qualityUpdateVisual({ key: resizeRootId, view: primaryView, viewport: { width: 1280, height: 620 }, type: 2, operationKind: 0 });
                const resizeViewports = [{ width: 1280, height: 620 }, { width: 1366, height: 768 }];
                resetDiagnostics(resizeRootId);
                for (let index = 0; index < warmups; index++) {
                    resetDiagnostics(resizeRootId);
                    window.__qualityUpdateVisual({ key: resizeRootId, viewport: resizeViewports[index % 2], type: 4, operationKind: 0 });
                    await nextFrame();
                    if (failedCount(resizeRootId)) throw new Error('Resize benchmark failed during warmup for ' + entry.id + '.');
                }
                for (let index = 0; index < samples; index++) {
                    resetDiagnostics(resizeRootId);
                    const started = performance.now();
                    window.__qualityUpdateVisual({ key: resizeRootId, viewport: resizeViewports[index % 2], type: 4, operationKind: 0 });
                    resizeSamples.push(performance.now() - started);
                    resizeFrames.push(await nextFrame());
                    if (failedCount(resizeRootId)) throw new Error('Resize benchmark failed during measurement for ' + entry.id + '.');
                }
                const benchmarkRoot = document.getElementById(dataRootId)?.querySelector('.atlyn-pareto');
                const totalText = benchmarkRoot?.querySelector('.total')?.textContent?.trim() ?? null;
                const expectedTotal = expectedTotalText(primary.total);
                if (totalText !== expectedTotal) throw new Error('Unexpected benchmark total for ' + entry.id + ': ' + totalText + ' !== ' + expectedTotal);
                const oracle = {
                    totalText,
                    thresholdSummary: benchmarkRoot?.querySelector('.threshold-summary')?.textContent?.trim() ?? null,
                    barTargets: benchmarkRoot?.querySelectorAll('.bar-target').length ?? 0,
                    contributionBars: benchmarkRoot?.querySelectorAll('.contribution-bar').length ?? 0,
                    cumulativeLines: benchmarkRoot?.querySelectorAll('.cumulative-line').length ?? 0,
                    tableRows: benchmarkRoot?.querySelectorAll('.data-table tbody tr').length ?? 0,
                    chartViewBox: benchmarkRoot?.querySelector('.chart-scroll svg')?.getAttribute('viewBox') ?? null,
                    firstCategoryLabel: benchmarkRoot?.querySelector('.category-label tspan')?.textContent ?? null,
                    renderFailedCount: failedCount(dataRootId)
                };
                const completedAtUtc = new Date().toISOString();
                destroyHarness(dataRootId);
                destroyHarness(resizeRootId);
                stage.replaceChildren();
                return {
                    id: entry.id,
                    description: entry.description,
                    seed: entry.seed,
                    rows: entry.rows,
                    warmupSamples: warmups,
                    measuredSamples: samples,
                    startedAtUtc,
                    completedAtUtc,
                    expectedTotal,
                    operations: [
                        { name: 'create', syncMs: createSamples, nextAnimationFrameMs: createFrames },
                        { name: 'dataUpdate', syncMs: dataSamples, nextAnimationFrameMs: dataFrames },
                        { name: 'resize', syncMs: resizeSamples, nextAnimationFrameMs: resizeFrames }
                    ],
                    oracle
                };
            };
            const results = [];
            for (const entry of cases) {
                results.push(await runCase(entry));
            }
            return results;
        };
    })();`;
}

function captureSummaryTitle(label: "baseline" | "final"): string {
    return label === "baseline" ? "baseline evidence" : "final evidence";
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resetOutputDirectory(directory: string): Promise<void> {
    await fsp.rm(directory, { recursive: true, force: true });
    await fsp.mkdir(directory, { recursive: true });
}

async function prepareOutput(label: "baseline" | "final", packageResult: PackageResult): Promise<{
    root: string;
    screenshotDir: string;
    listingDir: string;
    packageCopy: string;
}> {
    const root = path.resolve("artifacts", "quality", label);
    const screenshotDir = path.join(root, "screenshots");
    const listingDir = path.join(root, "listing-candidates");
    const packageDir = path.join(root, "package");
    await fsp.mkdir(root, { recursive: true });
    await Promise.all([
        resetOutputDirectory(screenshotDir),
        resetOutputDirectory(listingDir),
        resetOutputDirectory(packageDir)
    ]);
    await Promise.all([
        fsp.rm(path.join(root, "report.json"), { force: true }),
        fsp.rm(path.join(root, "summary.txt"), { force: true })
    ]);
    await Promise.all([
        fsp.mkdir(packageDir, { recursive: true })
    ]);
    const packageCopy = label === "baseline" && path.resolve(packageResult.filename) === BASELINE_IMMUTABLE_PATH
        ? BASELINE_IMMUTABLE_PATH
        : path.join(packageDir, path.basename(packageResult.filename));
    if (path.resolve(packageResult.filename) !== path.resolve(packageCopy)) {
        await fsp.writeFile(packageCopy, packageResult.bytes);
    }
    return { root, screenshotDir, listingDir, packageCopy };
}

function screenshotFile(directory: string, scenarioId: string, viewport: Size): string {
    return path.join(directory, `${scenarioId}-${sizeSlug(viewport)}.png`);
}

async function launchBrowser() {
    process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".playwright");
    const { chromium } = await import("@playwright/test");
    return chromium.launch({ headless: true });
}

async function preparePage(page: import("@playwright/test").Page, payload: Payload, html: string): Promise<void> {
    const errors: string[] = [];
    pageDiagnostics.set(page, errors);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", request => errors.push(`Unexpected runtime network request: ${request.url()}`));
    await page.route("**/*", route => route.abort("blockedbyclient"));
    await page.setContent(html);
    await page.evaluate(() => { (window as Window & { __qualityHarnesses?: Record<string, Window["__paretoTest"]> }).__qualityHarnesses = {}; });
    await page.addStyleTag({ content: payload.content.css });
    await page.addScriptTag({ content: payload.content.js });
    await page.addScriptTag({ content: qualityBrowserBridgeSource() });
}

async function mountSingleVisual(page: import("@playwright/test").Page, payload: Payload, rootId: string, viewport: Size, hostOptions?: HostOptions): Promise<void> {
    await page.evaluate(({ guid, resources, rootId, viewport, hostOptions }) => {
        const root = document.getElementById(rootId);
        if (!root) throw new Error(`Missing root ${rootId}`);
        root.setAttribute("data-quality-root", rootId);
        root.setAttribute("style", `width:${viewport.width}px;height:${viewport.height}px;`);
        (window as unknown as {
            __qualityMountVisual(args: {
                key: string;
                rootId: string;
                guid: string;
                resources: Payload["stringResources"];
                hostOptions?: HostOptions;
            }): void;
        }).__qualityMountVisual({ key: rootId, rootId, guid, resources, hostOptions });
    }, { guid: payload.visual.guid, resources: payload.stringResources, rootId, viewport, hostOptions });
}

async function updateVisual(
    page: import("@playwright/test").Page,
    rootId: string,
    view: powerbi.DataView,
    viewport: Size,
    type = 2,
    operationKind = 0
): Promise<void> {
    await page.evaluate(({ rootId, view, viewport, type, operationKind }) => {
        const harness = (window as Window & { __qualityHarnesses?: Record<string, Window["__paretoTest"]> }).__qualityHarnesses?.[rootId];
        if (!harness?.visual) throw new Error(`Missing harness ${rootId}.`);
        harness.visual.update({ type, operationKind, viewport, dataViews: view ? [view] : [] });
    }, { rootId, view, viewport, type, operationKind });
}

async function destroyVisuals(page: import("@playwright/test").Page): Promise<void> {
    await page.evaluate(() => {
        const stored = window as Window & { __qualityHarnesses?: Record<string, Window["__paretoTest"]> };
        for (const harness of Object.values(stored.__qualityHarnesses ?? {})) {
            harness.visual?.destroy();
        }
        stored.__qualityHarnesses = {};
    });
    const errors = pageDiagnostics.get(page) ?? [];
    if (errors.length) throw new Error(errors.join("\n"));
}

async function collectCaptureDom(page: import("@playwright/test").Page, rootId: string) {
    return page.evaluate(id => {
        const root = document.getElementById(id)?.querySelector<HTMLElement>(".atlyn-pareto");
        if (!root) throw new Error(`Missing mounted visual ${id}.`);
        const chartScroll = root.querySelector<HTMLElement>(".chart-scroll");
        const rect = root.getBoundingClientRect();
        return {
            title: root.querySelector(".title")?.textContent ?? null,
            ariaLabel: root.getAttribute("aria-label"),
            direction: root.getAttribute("dir"),
            barTargets: root.querySelectorAll(".bar-target").length,
            contributionBars: root.querySelectorAll(".contribution-bar").length,
            cumulativeLines: root.querySelectorAll(".cumulative-line").length,
            tableRows: root.querySelectorAll(".data-table tbody tr").length,
            warning: root.querySelector(".warning, .retrieval")?.textContent?.trim() ?? null,
            alert: root.querySelector("[role='alert']")?.textContent?.trim() ?? null,
            thresholdSummary: root.querySelector(".threshold-summary")?.textContent?.trim() ?? null,
            total: root.querySelector(".total")?.textContent?.trim() ?? null,
            rootRect: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
            scrollState: {
                scrollTop: root.scrollTop,
                scrollHeight: root.scrollHeight,
                clientHeight: root.clientHeight,
                chartScrollLeft: chartScroll?.scrollLeft ?? 0,
                chartScrollWidth: chartScroll?.scrollWidth ?? 0,
                chartClientWidth: chartScroll?.clientWidth ?? 0
            }
        };
    }, rootId);
}

async function captureScenario(
    page: import("@playwright/test").Page,
    payload: Payload,
    scenario: ScenarioDefinition,
    viewport: Size,
    screenshotDir: string
): Promise<CaptureRecord> {
    await page.setViewportSize(viewport);
    const rootId = "visual-root";
    const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f6f8fa;"><div id="${rootId}" style="width:${viewport.width}px;height:${viewport.height}px;"></div></body></html>`;
    await preparePage(page, payload, html);
    await mountSingleVisual(page, payload, rootId, viewport, scenario.hostOptions);
    await updateVisual(page, rootId, scenario.view, viewport);
    if (scenario.afterUpdate === "scroll-root") {
        await page.evaluate(id => {
            const root = document.getElementById(id)?.querySelector<HTMLElement>(".atlyn-pareto");
            if (!root) throw new Error("Missing root for scroll capture.");
            root.scrollTop = root.scrollHeight;
        }, rootId);
    } else if (scenario.afterUpdate === "touch-and-keyboard") {
        const bars = page.locator(".bar-target");
        await bars.first().focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await bars.nth(1).dispatchEvent("pointerenter", { pointerType: "touch", clientX: 24, clientY: 24 });
    }
    const file = screenshotFile(screenshotDir, scenario.id, viewport);
    await page.screenshot({ path: file });
    const dom = await collectCaptureDom(page, rootId);
    const state = await page.evaluate(id => {
        const harness = (window as Window & { __qualityHarnesses?: Record<string, Window["__paretoTest"]> }).__qualityHarnesses?.[id];
        if (!harness) throw new Error(`Missing harness ${id}.`);
        return harness.state;
    }, rootId);
    if (state.events.some(event => event.name === "failed")) throw new Error(`Rendering failed in capture ${scenario.id}`);
    await destroyVisuals(page);
    return {
        id: scenario.id,
        title: scenario.title,
        category: scenario.category,
        viewport,
        file,
        note: scenario.note,
        dom,
        renderFailedCount: state.events.filter(event => event.name === "failed").length
    };
}

async function captureMultiHost(
    browser: import("@playwright/test").Browser,
    payload: Payload,
    screenshotDir: string
): Promise<MultiHostEvidence> {
    const page = await browser.newPage({ viewport: MULTI_HOST_VIEWPORT });
    const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f3f5f7;font-family:Segoe UI,sans-serif;"><main style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;padding:16px;height:${MULTI_HOST_VIEWPORT.height}px;"><section style="background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:8px;"><h1 style="font-size:16px;margin:0 0 8px;">Default host</h1><div id="host-default" style="width:400px;height:680px;"></div></section><section style="background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:8px;"><h1 style="font-size:16px;margin:0 0 8px;">RTL host</h1><div id="host-rtl" style="width:400px;height:680px;"></div></section><section style="background:#111;color:#fff;border:1px solid #3d444d;border-radius:8px;padding:8px;"><h1 style="font-size:16px;margin:0 0 8px;">High contrast host</h1><div id="host-hc" style="width:400px;height:680px;"></div></section></main></body></html>`;
    await preparePage(page, payload, html);
    await mountSingleVisual(page, payload, "host-default", { width: 400, height: 680 });
    await mountSingleVisual(page, payload, "host-rtl", { width: 400, height: 680 }, { locale: "ar-SA" });
    await mountSingleVisual(page, payload, "host-hc", { width: 400, height: 680 }, {
        highContrast: true,
        foreground: "#FFFFFF",
        background: "#000000",
        foregroundSelected: "#00FF00"
    });
    const scenarios = buildScenarioData().filter(scenario => ["defect", "cost", "customer"].includes(scenario.id));
    await Promise.all([
        updateVisual(page, "host-default", scenarios[0].view, { width: 400, height: 680 }),
        updateVisual(page, "host-rtl", scenarios[1].view, { width: 400, height: 680 }),
        updateVisual(page, "host-hc", scenarios[2].view, { width: 400, height: 680 })
    ]);
    await page.evaluate(() => {
        const target = document.querySelectorAll<SVGElement>("#host-rtl .bar-target")[1];
        if (!target) throw new Error("Missing RTL bar target.");
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
    });
    const file = screenshotFile(screenshotDir, "multi-host", MULTI_HOST_VIEWPORT);
    await page.screenshot({ path: file });
    const hosts = await page.evaluate(() => {
        return ["host-default", "host-rtl", "host-hc"].map(key => {
            const root = document.getElementById(key)?.querySelector<HTMLElement>(".atlyn-pareto");
            const state = (window as Window & { __qualityHarnesses?: Record<string, Window["__paretoTest"]> }).__qualityHarnesses?.[key]?.state;
            if (!state) throw new Error(`Missing harness ${key}.`);
            return {
                key,
                direction: root?.getAttribute("dir") ?? null,
                total: root?.querySelector(".total")?.textContent?.trim() ?? null,
                thresholdSummary: root?.querySelector(".threshold-summary")?.textContent?.trim() ?? null,
                failedEvents: state.events.filter(event => event.name === "failed").length,
                selectedKeys: [...state.selectedKeys]
            };
        });
    });
    await destroyVisuals(page);
    await page.close();
    return { file, viewport: MULTI_HOST_VIEWPORT, hosts };
}

async function captureInteractionEvidence(
    browser: import("@playwright/test").Browser,
    payload: Payload,
    screenshotDir: string
): Promise<InteractionEvidence> {
    const page = await browser.newPage({ viewport: INTERACTION_VIEWPORT });
    const scenario = buildScenarioData().find(item => item.id === "touch-keyboard");
    if (!scenario) throw new Error("Missing touch-keyboard scenario.");
    const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f6f8fa;"><div id="interaction-root" style="width:${INTERACTION_VIEWPORT.width}px;height:${INTERACTION_VIEWPORT.height}px;"></div></body></html>`;
    await preparePage(page, payload, html);
    await mountSingleVisual(page, payload, "interaction-root", INTERACTION_VIEWPORT);
    await updateVisual(page, "interaction-root", scenario.view, INTERACTION_VIEWPORT);
    const bars = page.locator(".bar-target");
    await bars.first().focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await bars.nth(1).dispatchEvent("pointerenter", { pointerType: "touch", clientX: 36, clientY: 28 });
    await bars.nth(1).dispatchEvent("pointermove", { pointerType: "touch", clientX: 44, clientY: 36 });
    const file = screenshotFile(screenshotDir, "interaction-evidence", INTERACTION_VIEWPORT);
    await page.screenshot({ path: file });
    const evidence = await page.evaluate(() => {
        const root = document.getElementById("interaction-root")?.querySelector<HTMLElement>(".atlyn-pareto");
        const state = (window as Window & { __qualityHarnesses?: Record<string, Window["__paretoTest"]> }).__qualityHarnesses?.["interaction-root"]?.state;
        if (!state) throw new Error("Missing interaction harness.");
        const tooltipTouchCall = [...state.tooltips].reverse().find(entry => entry.name === "show" && entry.options.isTouchEvent)?.options ?? null;
        return {
            selectedKeys: [...state.selectedKeys],
            selections: [...state.selections],
            tooltipTouchCall,
            focusedRowIndex: root?.querySelector<HTMLElement>(".bar-target:focus")?.dataset.rowIndex ?? null,
            clearedCount: state.clears
        };
    });
    await destroyVisuals(page);
    await page.close();
    return { file, viewport: INTERACTION_VIEWPORT, ...evidence };
}

function deterministicSeries(count: number, seed: number): { values: number[]; labels: string[]; keys: string[]; total: number } {
    let state = seed >>> 0;
    const values: number[] = [];
    const labels: string[] = [];
    const keys: string[] = [];
    let total = 0;
    for (let index = 0; index < count; index++) {
        state = (state * 1664525 + 1013904223) >>> 0;
        const value = 25 + (state % 975);
        values.push(value);
        labels.push(`Benchmark ${String(index + 1).padStart(6, "0")}`);
        keys.push(`bench-${index + 1}`);
        total += value;
    }
    return { values, labels, keys, total };
}

function expectedTotalText(total: number): string {
    return `Denominator total: ${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(total)}`;
}

function stats(values: number[]): BenchmarkStats {
    if (values.length === 0) throw new Error("No benchmark samples were recorded.");
    const sorted = [...values].sort((left, right) => left - right);
    const percentile = (fraction: number) => {
        const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
        return Number(sorted[index].toFixed(3));
    };
    return {
        raw: values.map(value => Number(value.toFixed(3))),
        p50: percentile(0.5),
        p95: percentile(0.95),
        max: Number(Math.max(...values).toFixed(3))
    };
}

function benchmarkMethod(): BenchmarkMethod {
    return {
        syncRegion: "Browser performance.now: create includes mock-host installation, visual construction and update; dataUpdate/resize include the synchronous update call.",
        nextAnimationFrameRegion: "Duration from the end of update until the next requestAnimationFrame callback; this callback is not proof of completed paint.",
        excludes: [
            "Playwright argument serialization and result transport",
            "Node-side orchestration outside page.evaluate",
            "Package unzip/load work completed before the benchmark loop"
        ],
        includes: [
            "The packaged visual's synchronous JavaScript and DOM work during update(...)",
            "Host-mock callback work performed during that update",
            "Per-sample diagnostics reset only outside the timed region"
        ],
        forceLayoutBoundary: "No explicit forced-layout read occurs inside the sync timer; the companion nextAnimationFrame metric is the post-update boundary.",
        diagnosticsHandling: "Benchmark harness state arrays (events, builderKeys, tooltips, persisted changes, and related diagnostics) are cleared between samples outside the timed region to avoid accumulation-driven GC artifacts."
    };
}

async function runBenchmarks(
    browser: import("@playwright/test").Browser,
    payload: Payload,
    samples: number,
    warmups: number
): Promise<BenchmarkCaseReport[]> {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const html = "<!doctype html><html><head><meta charset=\"UTF-8\"></head><body style=\"margin:0;background:#ffffff;\"><div id=\"bench-stage\"></div></body></html>";
    await preparePage(page, payload, html);
    const cases = [
        { id: "typical-1000", description: "Deterministic typical-size benchmark dataset", rows: 1000, seed: 0x51f15e },
        { id: "max-100000", description: "Deterministic maximum-size benchmark dataset", rows: 100000, seed: 0xa11ce5 }
    ];
    const result = await page.evaluate(({ guid, resources, cases, samples, warmups }) =>
        (window as unknown as {
            __qualityRunBenchmarks(args: {
                guid: string;
                resources: Payload["stringResources"];
                cases: Array<{ id: string; description: string; rows: number; seed: number }>;
                samples: number;
                warmups: number;
            }): Promise<Array<Omit<BenchmarkCaseReport, "operations"> & {
                operations: Array<{ name: "create" | "dataUpdate" | "resize"; syncMs: number[]; nextAnimationFrameMs: number[] }>;
            }>>;
        }).__qualityRunBenchmarks({ guid, resources, cases, samples, warmups }),
    { guid: payload.visual.guid, resources: payload.stringResources, cases, samples, warmups });
    await destroyVisuals(page);
    await page.close();
    return result.map(entry => ({
        ...entry,
        operations: entry.operations.map(operation => ({
            name: operation.name,
            syncMs: stats(operation.syncMs),
            nextAnimationFrameMs: stats(operation.nextAnimationFrameMs)
        }))
    }));
}

async function writeSummary(root: string, report: QualityReport): Promise<void> {
    const lines = [
        `${captureSummaryTitle(report.label)} — local Chromium + host mock (not Power BI Desktop)`,
        `Generated: ${report.generatedAtUtc}`,
        `Package: ${report.package.filename}`,
        `Copied package: ${report.package.copiedArtifact}`,
        `SHA256: ${report.package.sha256}`,
        `Command: ${report.command}`,
        `Benchmark method: ${report.benchmarkMethod.syncRegion}`,
        `Benchmark layout boundary: ${report.benchmarkMethod.forceLayoutBoundary}`,
        `Benchmark diagnostics handling: ${report.benchmarkMethod.diagnosticsHandling}`,
        "",
        "Listing candidates:",
        ...report.listingCandidates.map(candidate => `- ${path.relative(root, candidate.file)} <= ${path.relative(root, candidate.sourceFile)} (${sizeKey(candidate.viewport)})`),
        "",
        "Benchmark medians (sync update / next animation frame, ms):",
        ...(report.benchmarks.length === 0
            ? ["- Skipped for this capture run."]
            : report.benchmarks.flatMap(benchmark => [
                `- ${benchmark.id} (${benchmark.rows} rows, seed ${benchmark.seed})`,
                ...benchmark.operations.map(operation => `  - ${operation.name}: p50 ${operation.syncMs.p50} / ${operation.nextAnimationFrameMs.p50}, p95 ${operation.syncMs.p95} / ${operation.nextAnimationFrameMs.p95}, max ${operation.syncMs.max} / ${operation.nextAnimationFrameMs.max}`)
            ])),
        "",
        "Caveats:",
        ...report.caveats.map(item => `- ${item}`)
    ];
    await fsp.writeFile(path.join(root, "summary.txt"), `${lines.join("\n")}\n`, "utf8");
    await fsp.writeFile(path.join(root, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function listingPreferenceOrder(sizes: Size[]): Size[] {
    const unique = new Map(sizes.map(size => [sizeKey(size), size]));
    const ordered = [LISTING_PRIMARY_SIZE, LISTING_FALLBACK_SIZE]
        .map(size => unique.get(sizeKey(size)))
        .filter((size): size is Size => !!size);
    return ordered.length > 0 ? ordered : [LISTING_FALLBACK_SIZE];
}

async function createListingCandidates(
    root: string,
    captures: CaptureRecord[],
    listingDir: string
): Promise<ListingCandidate[]> {
    const desiredIds = ["defect", "cost", "customer"];
    const chosen: ListingCandidate[] = [];
    for (const scenarioId of desiredIds) {
        const capture = captures.find(item => item.id === scenarioId && item.viewport.width === 1366 && item.viewport.height === 768);
        if (!capture) throw new Error(`Missing required 1366x768 listing candidate for ${scenarioId}`);
        const file = path.join(listingDir, `${String(chosen.length + 1).padStart(2, "0")}-${scenarioId}-${sizeSlug(capture.viewport)}.png`);
        await fsp.copyFile(capture.file, file);
        chosen.push({ scenarioId, viewport: capture.viewport, sourceFile: capture.file, file });
    }
    return chosen;
}

async function buildReport(options: {
    label: "baseline" | "final";
    samples: number;
    warmups: number;
    skipBenchmarks: boolean;
    packagePath?: string;
    captureSizes: Size[];
}): Promise<QualityReport> {
    const packageResult = readQualityPackage(options.label, options.packagePath);
    const output = await prepareOutput(options.label, packageResult);
    const browser = await launchBrowser();
    try {
        const environment = {
            browser: "chromium",
            browserVersion: browser.version(),
            node: process.version,
            platform: process.platform,
            release: os.release(),
            arch: process.arch,
            cpuModel: os.cpus()[0]?.model ?? "unknown",
            cpuCount: os.cpus().length,
            totalMemoryBytes: os.totalmem(),
            freeMemoryBytes: os.freemem()
        };
        const scenarios = buildScenarioData();
        const captures: CaptureRecord[] = [];
        for (const scenario of scenarios) {
            const sizes = scenario.category === "scenario"
                ? options.captureSizes
                : [scenario.defaultViewport ?? options.captureSizes.at(-1) ?? DEFAULT_CAPTURE_SIZES.at(-1)!];
            for (const viewport of sizes) {
                const page = await browser.newPage({ viewport });
                try {
                    captures.push(await captureScenario(page, packageResult.payload, scenario, viewport, output.screenshotDir));
                } finally {
                    await page.close();
                }
            }
        }
        const multiHost = await captureMultiHost(browser, packageResult.payload, output.screenshotDir);
        const interactions = await captureInteractionEvidence(browser, packageResult.payload, output.screenshotDir);
        const benchmarks = options.skipBenchmarks ? [] : await runBenchmarks(browser, packageResult.payload, options.samples, options.warmups);
        const listingCandidates = await createListingCandidates(output.root, captures, output.listingDir);
        const report: QualityReport = {
            label: options.label,
            note: "Captured with a local Chromium browser and the repository host mock; not captured inside Power BI Desktop.",
            generatedAtUtc: new Date().toISOString(),
            command: `node --import tsx scripts/quality-evidence.mts --label ${options.label}${options.samples !== 20 ? ` --samples ${options.samples}` : ""}${options.warmups !== 3 ? ` --warmups ${options.warmups}` : ""}${options.skipBenchmarks ? " --skip-benchmarks" : ""}${options.captureSizes.some(size => !DEFAULT_CAPTURE_SIZES.some(defaultSize => sizeKey(defaultSize) === sizeKey(size))) ? ` --capture-sizes ${options.captureSizes.filter(size => !DEFAULT_CAPTURE_SIZES.some(defaultSize => sizeKey(defaultSize) === sizeKey(size))).map(sizeKey).join(",")}` : ""}${options.packagePath ? ` --package ${JSON.stringify(options.packagePath)}` : ""}`,
            package: {
                filename: packageResult.filename,
                copiedArtifact: output.packageCopy,
                sha256: packageResult.sha256,
                guid: packageResult.payload.visual.guid,
                visualVersion: packageResult.payload.visual.version
            },
            environment,
            captureSizes: options.captureSizes,
            captures,
            listingCandidates,
            multiHost,
            interactions,
            benchmarks,
            benchmarkMethod: benchmarkMethod(),
            caveats: [
                "All evidence is from the packaged .pbiviz running offline in local Chromium with every network request blocked.",
                "Host behavior uses the test mock and its in-page benchmark adapter rather than Power BI Desktop; native host overhead is not measured.",
                "Shared-machine contention can materially affect benchmark outliers; use the raw samples in report.json when comparing runs.",
                "Current Microsoft documentation conflicts on listing screenshot size; these candidates use the Power BI-specific 1366x768 requirement. Recheck Partner Center before submission.",
                ...(options.skipBenchmarks ? ["Benchmarks were intentionally skipped in this fast capture run."] : [])
            ]
        };
        await writeSummary(output.root, report);
        return report;
    } finally {
        await browser.close();
    }
}

async function main(): Promise<void> {
    const options = parseCli();
    const report = await buildReport(options);
    const relative = (value: string) => path.relative(process.cwd(), value) || ".";
    const keyBenchmarks = report.benchmarks.map(benchmark => {
        const create = benchmark.operations.find(operation => operation.name === "create")!;
        const update = benchmark.operations.find(operation => operation.name === "dataUpdate")!;
        const resize = benchmark.operations.find(operation => operation.name === "resize")!;
        return `${benchmark.id}: create p50 ${create.syncMs.p50}ms, update p50 ${update.syncMs.p50}ms, resize p50 ${resize.syncMs.p50}ms`;
    }).join(" | ");
    console.log([
        `Generated ${report.label} quality evidence (host mock, not Desktop).`,
        `Report: ${relative(path.resolve("artifacts", "quality", report.label, "report.json"))}`,
        `Summary: ${relative(path.resolve("artifacts", "quality", report.label, "summary.txt"))}`,
        `Listing candidates: ${report.listingCandidates.map(candidate => relative(candidate.file)).join(", ")}`,
        `Benchmarks: ${keyBenchmarks || "skipped"}`
    ].join("\n"));
}

const entryHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryHref) {
    await main();
}
