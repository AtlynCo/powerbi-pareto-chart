import type powerbi from "powerbi-visuals-api";

export const MAX_CATEGORIES = 100000;
export type Completeness = "complete" | "loading" | "refused" | "limit" | "stalled" | "unexpected";

// With fetchMoreData(true), each Append already contains the aggregated rows.
// Replacing the data view is intentional: concatenation would double-count.
export class SegmentTracker {
    private previousCount = 0;
    public status: Completeness = "complete";

    public accept(count: number, segmented: boolean, operation: number | undefined, requestMore: () => boolean): Completeness {
        const appended = operation === 1;
        const previous = this.previousCount;
        this.previousCount = count;
        if (operation === 2) {
            return this.status = "unexpected";
        }
        if (count > MAX_CATEGORIES || (count >= MAX_CATEGORIES && segmented)) {
            return this.status = "limit";
        }
        if (!segmented) {
            return this.status = "complete";
        }
        if (appended && count <= previous) {
            return this.status = "stalled";
        }
        return this.status = requestMore() ? "loading" : "refused";
    }
}

export interface Binding {
    category: powerbi.DataViewCategoryColumn;
    contribution: powerbi.DataViewValueColumn;
    tooltips: powerbi.DataViewValueColumn[];
}

export function getBinding(view: powerbi.DataView): Binding | undefined {
    const categories = view.categorical?.categories?.filter(c => c.source.roles?.Category);
    const measures = view.categorical?.values?.filter(v => v.source.roles?.Contribution);
    if (categories?.length !== 1 || measures?.length !== 1) {
        return undefined;
    }
    return {
        category: categories[0],
        contribution: measures[0],
        tooltips: view.categorical?.values?.filter(v => v.source.roles?.Tooltips) ?? []
    };
}

export function canonicalCategory(value: powerbi.PrimitiveValue): string {
    if (value === null || value === undefined) {
        return "0:";
    }
    if (value instanceof Date) {
        return `date:${value.getTime()}`;
    }
    return `${typeof value}:${String(value)}`;
}
