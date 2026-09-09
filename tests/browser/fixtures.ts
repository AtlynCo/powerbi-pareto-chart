import { test as base, expect, type Page } from "@playwright/test";
import type powerbi from "powerbi-visuals-api";
import { readPackage } from "../../scripts/package-utils.mjs";
import { installHostMock, type HostOptions, type HostState, type VisualUpdate } from "./host-mock";

interface Payload {
    visual: { guid: string };
    content: { js: string; css: string };
    stringResources: Record<string, Record<string, string>>;
}

export class PackagedApp {
    expectedRenderFailures = 0;
    constructor(readonly page: Page, readonly resources: Payload["stringResources"]) {}

    async update(view?: powerbi.DataView, overrides: Partial<VisualUpdate> = {}): Promise<void> {
        await this.page.evaluate(options => window.__paretoTest.visual!.update(options), {
            type: 2, operationKind: 0, viewport: { width: 900, height: 700 },
            dataViews: view ? [view] : [], ...overrides
        });
    }

    async state(): Promise<HostState> {
        return this.page.evaluate(() => window.__paretoTest.state);
    }

    async incomingSelection(keys: string[]): Promise<void> {
        await this.page.evaluate(selection => window.__paretoTest.incomingSelection(selection), keys);
    }

    async formatting(): Promise<unknown> {
        return this.page.evaluate(() => window.__paretoTest.visual!.getFormattingModel());
    }

    async destroy(): Promise<void> {
        await this.page.evaluate(() => window.__paretoTest.visual!.destroy());
    }
}

export const test = base.extend<{ app: PackagedApp; hostOptions: HostOptions }>({
    hostOptions: [{}, { option: true }],
    app: async ({ page, hostOptions }, use, testInfo) => {
        const result = readPackage() as { payload: Payload; sha256: string; filename: string };
        const { payload } = result;
        const pageErrors: string[] = [];
        const requests: string[] = [];
        const failedRequests: string[] = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        page.on("request", request => requests.push(request.url()));
        page.on("requestfailed", request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
        await page.route("**/*", route => route.abort("blockedbyclient"));
        await page.setContent("<!doctype html><html><head><meta charset=\"UTF-8\"></head><body style=\"margin:0\"><div id=\"visual\"></div></body></html>");
        await page.evaluate(installHostMock, { ...hostOptions, resources: payload.stringResources });
        await page.addStyleTag({ content: payload.content.css });
        await page.addScriptTag({ content: payload.content.js });
        await page.evaluate(guid => {
            type Constructor = new (options: { element: HTMLElement; host: Record<string, unknown> }) => NonNullable<Window["__paretoTest"]["visual"]>;
            type Plugin = { create?: (options: { element: HTMLElement; host: Record<string, unknown> }) => NonNullable<Window["__paretoTest"]["visual"]>; Visual?: Constructor };
            const globals = window as unknown as Record<string, unknown>;
            const namespace = globals[guid] as (Plugin & { default?: Plugin }) | undefined;
            const powerbi = globals.powerbi as { visuals?: { plugins?: Record<string, Plugin> } } | undefined;
            const plugin = powerbi?.visuals?.plugins?.[guid] ?? namespace?.default ?? namespace;
            const options = { element: document.getElementById("visual")!, host: window.__paretoTest.host };
            if (plugin?.create) window.__paretoTest.visual = plugin.create(options);
            else if (namespace?.Visual) window.__paretoTest.visual = new namespace.Visual(options);
            else throw new Error(`No Power BI plugin or Visual export in the packaged bundle for ${guid}; global export keys: ${Object.keys(namespace ?? {}).join(", ")}`);
        }, payload.visual.guid);
        const app = new PackagedApp(page, payload.stringResources);
        await testInfo.attach("tested-package", {
            body: JSON.stringify({ filename: result.filename, sha256: result.sha256, guid: payload.visual.guid }, null, 2),
            contentType: "application/json"
        });
        try {
            await use(app);
        } finally {
            const state = await app.state();
            await testInfo.attach("host-events", { body: JSON.stringify(state.events), contentType: "application/json" });
            await testInfo.attach("browser-diagnostics", {
                body: JSON.stringify({ pageErrors, requests, failedRequests }), contentType: "application/json"
            });
            await app.destroy();
            expect(pageErrors, "The packaged visual must not throw browser errors").toEqual([]);
            expect(requests, "The packaged visual must work offline without any network requests").toEqual([]);
            expect(failedRequests, "Network failures must not be silently swallowed").toEqual([]);
            expect(state.events.filter(event => event.name === "failed")).toHaveLength(app.expectedRenderFailures);
            expect(state.events.length % 2, "Every started render must terminate").toBe(0);
            for (let index = 0; index < state.events.length; index += 2) {
                expect(state.events[index].name).toBe("started");
                expect(["finished", "failed"]).toContain(state.events[index + 1].name);
                expect(state.events[index + 1].type).toBe(state.events[index].type);
                expect(state.events[index + 1].operationKind).toBe(state.events[index].operationKind);
            }
        }
    }
});

export { expect };

export async function tableRows(page: Page): Promise<string[][]> {
    return page.locator(".data-table tbody tr").evaluateAll(rows =>
        rows.map(row => Array.from(row.querySelectorAll("td"), cell => cell.textContent ?? "")));
}

export async function lastTooltip(app: PackagedApp): Promise<Record<string, string>> {
    const call = (await app.state()).tooltips.filter(tooltip => tooltip.name === "show").at(-1);
    expect(call, "A real pointer or keyboard interaction should invoke the host tooltip").toBeDefined();
    return Object.fromEntries(call!.options.dataItems!.map(item => [item.displayName, item.value]));
}

export function formattingValues(model: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const visit = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (value === null || typeof value !== "object") return;
        const node = value as Record<string, unknown>;
        const descriptor = node.descriptor as { objectName?: string; propertyName?: string } | undefined;
        if (descriptor?.objectName && descriptor.propertyName && "value" in node) {
            result[`${descriptor.objectName}.${descriptor.propertyName}`] = node.value;
        }
        Object.values(node).forEach(visit);
    };
    visit(model);
    return result;
}
