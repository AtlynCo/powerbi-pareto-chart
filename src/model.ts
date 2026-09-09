export interface InputRow {
    index: number;
    key: string;
    sortKey: string;
    label: string;
    value: unknown;
    highlight?: unknown;
}

export interface RankedRow extends Omit<InputRow, "value" | "highlight"> {
    value: number;
    highlight?: number;
    rank: number;
    cumulative: number;
    share: number;
    cumulativeShare: number;
    included: boolean;
    crossing: boolean;
}

export interface ModelIssues {
    missing: number;
    invalid: number;
    negative: number;
    invalidHighlight: number;
}

export interface ParetoModel {
    kind: "empty" | "invalid" | "zero" | "ready";
    rows: RankedRow[];
    total?: number;
    /** Clamped percent (1–100); row shares are fractions (0–1). */
    threshold: number;
    crossingRank?: number;
    includedCount: number;
    issues: ModelIssues;
    overflow: boolean;
}

type ValidRow = Omit<InputRow, "value" | "highlight"> & {
    value: number;
    highlight?: number;
};

export function contributionProblem(value: unknown): "missing" | "invalid" | "negative" | undefined {
    if (value === null || value === undefined) return "missing";
    if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
    return value < 0 ? "negative" : undefined;
}

function compareText(left: string, right: string): number {
    // Relational string comparison uses UTF-16 code units, independent of host locale.
    return left < right ? -1 : left > right ? 1 : 0;
}

function compareRows(left: ValidRow, right: ValidRow): number {
    // Stable ties follow canonical sort key, identity key, then source index.
    return (left.value > right.value ? -1 : left.value < right.value ? 1 : 0)
        || compareText(left.sortKey, right.sortKey)
        || compareText(left.key, right.key)
        || left.index - right.index;
}

class CompensatedSum {
    private sum = 0;
    private correction = 0;

    add(value: number): number | undefined {
        const next = this.sum + value;
        if (!Number.isFinite(next)) {
            return undefined;
        }
        // Neumaier compensation retains contributions below the running sum's ULP.
        this.correction += Math.abs(this.sum) >= Math.abs(value)
            ? (this.sum - next) + value
            : (value - next) + this.sum;
        this.sum = next;
        // Even MAX_VALUE + a subnormal is overflow, not a saturated valid total.
        if (this.correction > Number.MAX_VALUE - this.sum) {
            return undefined;
        }
        const total = this.sum + this.correction;
        return Number.isFinite(total) ? total : undefined;
    }
}

export function analyze(rows: InputRow[], thresholdPercent: number): ParetoModel {
    const threshold = Number.isFinite(thresholdPercent)
        ? Math.min(100, Math.max(1, thresholdPercent))
        : 80;
    const issues: ModelIssues = { missing: 0, invalid: 0, negative: 0, invalidHighlight: 0 };
    const base: ParetoModel = {
        kind: "empty", rows: [], threshold, includedCount: 0, issues, overflow: false
    };
    if (rows.length === 0) {
        return base;
    }

    const valid: ValidRow[] = [];
    for (const row of rows) {
        let value: number | undefined;
        const problem = contributionProblem(row.value);
        if (problem) {
            issues[problem]++;
        } else if (typeof row.value === "number") {
            value = row.value === 0 ? 0 : row.value;
        }

        let highlight: number | undefined;
        if (row.highlight !== null && row.highlight !== undefined) {
            if (typeof row.highlight === "number" && Number.isFinite(row.highlight)
                && row.highlight >= 0 && value !== undefined && row.highlight <= value) {
                highlight = row.highlight === 0 ? 0 : row.highlight;
            } else {
                issues.invalidHighlight++;
            }
        }
        if (value !== undefined) {
            valid.push({
                index: row.index, key: row.key, sortKey: row.sortKey, label: row.label,
                value, highlight
            });
        }
    }
    if (issues.missing || issues.invalid || issues.negative) {
        return { ...base, kind: "invalid" };
    }

    valid.sort(compareRows);
    const sum = new CompensatedSum();
    const cumulative: number[] = [];
    for (const row of valid) {
        const current = sum.add(row.value);
        if (current === undefined) {
            return { ...base, kind: "invalid", overflow: true };
        }
        cumulative.push(current);
    }
    const total = cumulative[cumulative.length - 1];
    const ranked: RankedRow[] = valid.map((row, index) => ({
        ...row,
        rank: index + 1,
        cumulative: cumulative[index],
        share: total === 0 ? 0 : row.value / total,
        cumulativeShare: total === 0 ? 0 : cumulative[index] / total,
        included: false,
        crossing: false
    }));
    if (total === 0) {
        return { ...base, kind: "zero", rows: ranked, total };
    }

    // Four relative epsilons absorb division/summation roundoff at a boundary,
    // not a material shortfall. At 100%, require every positive contribution;
    // a rounded prefix of 1 must not hide tiny positive rows or include zeros.
    const target = threshold / 100;
    const tolerance = 4 * Number.EPSILON * target;
    let crossingIndex = ranked.length - 1;
    if (threshold === 100) {
        while (ranked[crossingIndex].value === 0) {
            crossingIndex--;
        }
    } else {
        crossingIndex = ranked.findIndex(row => row.cumulativeShare >= target
            || target - row.cumulativeShare <= tolerance);
    }
    const crossingValue = ranked[crossingIndex].value;
    let includedCount = 0;
    for (const row of ranked) {
        row.included = row.value >= crossingValue;
        row.crossing = row.rank === crossingIndex + 1;
        if (row.included) {
            includedCount++;
        }
    }
    return {
        ...base, kind: "ready", rows: ranked, total,
        crossingRank: crossingIndex + 1, includedCount
    };
}
