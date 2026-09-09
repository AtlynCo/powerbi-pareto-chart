import test from "node:test";
import assert from "node:assert/strict";
import { analyze, type InputRow, type ParetoModel } from "../src/model";

function rows(values: unknown[]): InputRow[] {
    return values.map((value, index) => ({
        index, key: `key-${index}`, sortKey: `sort-${index}`, label: `Row ${index}`, value
    }));
}

function assertReadyInvariants(model: ParetoModel): void {
    assert.equal(model.kind, "ready");
    assert.ok(model.total !== undefined && Number.isFinite(model.total) && model.total > 0);
    assert.equal(model.overflow, false);
    assert.equal(model.rows.at(-1)?.cumulative, model.total);
    assert.equal(model.rows.at(-1)?.cumulativeShare, 1);
    assert.equal(model.rows.filter(row => row.crossing).length, 1);
    assert.equal(model.rows.filter(row => row.included).length, model.includedCount);
    let previous = 0;
    for (const [index, row] of model.rows.entries()) {
        assert.equal(row.rank, index + 1);
        assert.ok(Number.isFinite(row.cumulative));
        assert.ok(row.cumulative >= previous && row.cumulative <= model.total);
        assert.ok(row.share >= 0 && row.share <= 1);
        assert.ok(row.cumulativeShare >= 0 && row.cumulativeShare <= 1);
        assert.equal(row.cumulativeShare, row.cumulative / model.total);
        previous = row.cumulative;
    }
}

test("ranks contributions, calculates fractional shares, and keeps source identities", () => {
    const model = analyze(rows([10, 60, 30]), 80);
    assertReadyInvariants(model);
    assert.equal(model.total, 100);
    assert.deepEqual(model.rows.map(row => row.index), [1, 2, 0]);
    assert.deepEqual(model.rows.map(row => row.value), [60, 30, 10]);
    assert.deepEqual(model.rows.map(row => row.cumulative), [60, 90, 100]);
    assert.deepEqual(model.rows.map(row => row.share), [0.6, 0.3, 0.1]);
    assert.deepEqual(model.rows.map(row => row.cumulativeShare), [0.6, 0.9, 1]);
    assert.deepEqual(model.rows.map(row => row.included), [true, true, false]);
    assert.deepEqual(model.rows.map(row => row.crossing), [false, true, false]);
    assert.equal(model.crossingRank, 2);
    assert.equal(model.includedCount, 2);
    assert.equal(model.rows[0].label, "Row 1");
});

test("equal contributions use code-unit sortKey, key, then original index", () => {
    const input: InputRow[] = [
        { index: 8, key: "a", sortKey: "a", label: "a", value: 5 },
        { index: 7, key: "a", sortKey: "ä", label: "umlaut", value: 5 },
        { index: 6, key: "a", sortKey: "Z", label: "Z", value: 5 },
        { index: 5, key: "ä", sortKey: "A", label: "A-umlaut", value: 5 },
        { index: 4, key: "a", sortKey: "A", label: "A-a", value: 5 },
        { index: 3, key: "Z", sortKey: "A", label: "A-Z-later", value: 5 },
        { index: 2, key: "Z", sortKey: "A", label: "A-Z-earlier", value: 5 },
        { index: 1, key: "a", sortKey: "😀", label: "astral", value: 5 },
        { index: 0, key: "a", sortKey: "\uE000", label: "private", value: 5 }
    ];
    const expected = [2, 3, 4, 5, 6, 8, 7, 1, 0];
    for (const order of [input, input.toReversed(), [...input.slice(3), ...input.slice(0, 3)]]) {
        assert.deepEqual(analyze(order, 80).rows.map(row => row.index), expected);
    }
});

test("the first crossing is marked, while every contribution tied at that crossing is included", () => {
    const model = analyze(rows([40, 20, 20, 20]), 60);
    assertReadyInvariants(model);
    assert.equal(model.crossingRank, 2);
    assert.equal(model.includedCount, 4);
    assert.deepEqual(model.rows.map(row => row.crossing), [false, true, false, false]);
    assert.ok(model.rows.every(row => row.included));
    const equal = analyze(rows([10, 10, 10, 10]), 1);
    assert.equal(equal.crossingRank, 1);
    assert.equal(equal.includedCount, 4);
});

test("a contribution after a non-tied exact crossing is not included", () => {
    const model = analyze(rows([50, 30, 15, 5]), 80);
    assert.equal(model.crossingRank, 2);
    assert.equal(model.includedCount, 2);
    assert.deepEqual(model.rows.map(row => row.included), [true, true, false, false]);
});

test("floating-point roundoff at a threshold does not spuriously add the next contribution", () => {
    const model = analyze(rows([0.7, 0.1, 0.1, 0.1]), 80);
    assertReadyInvariants(model);
    assert.equal(model.total, 1);
    assert.ok(model.rows[1].cumulativeShare < 0.8);
    assert.equal(model.crossingRank, 2);
    assert.equal(model.includedCount, 4);
    const untied = analyze(rows([0.7, 0.1, 0.09, 0.06, 0.05]), 80);
    assert.equal(untied.crossingRank, 2);
    assert.equal(untied.includedCount, 2);
});

test("threshold tolerance does not erase a material shortfall", () => {
    const model = analyze(rows([0.8 - 1e-12, 0.2 + 1e-12]), 80);
    assert.equal(model.crossingRank, 2);
    assert.equal(model.includedCount, 2);
    const smallThreshold = analyze(rows([0.01 - 1e-14, ...Array(101).fill(0.99 / 101 + 1e-14 / 101)]), 1);
    assert.equal(smallThreshold.crossingRank, 2);
});

test("100 percent includes all positive rows but excludes trailing zero rows", () => {
    const model = analyze(rows([0, 60, -0, 40, 0]), 100);
    assertReadyInvariants(model);
    assert.equal(model.crossingRank, 2);
    assert.equal(model.includedCount, 2);
    assert.equal(model.rows.length, 5);
    assert.deepEqual(model.rows.map(row => row.included), [true, true, false, false, false]);
    assert.deepEqual(model.rows.map(row => row.cumulativeShare), [0.6, 1, 1, 1, 1]);
});

test("100 percent does not mistake a rounded prefix for the complete positive total", () => {
    const model = analyze(rows([1e300, 1, Number.MIN_VALUE, 0]), 100);
    assertReadyInvariants(model);
    assert.equal(model.total, 1e300);
    assert.equal(model.rows[0].cumulativeShare, 1);
    assert.equal(model.crossingRank, 3);
    assert.equal(model.includedCount, 3);
    assert.deepEqual(model.rows.map(row => row.crossing), [false, false, true, false]);
});

test("empty and zero-total models are distinct and zero rows are preserved", () => {
    const empty = analyze([], 80);
    assert.equal(empty.kind, "empty");
    assert.equal(empty.total, undefined);
    assert.deepEqual(empty.rows, []);
    assert.equal(empty.crossingRank, undefined);
    assert.equal(empty.includedCount, 0);
    const zero = analyze(rows([0, -0, 0]), 100);
    assert.equal(zero.kind, "zero");
    assert.equal(zero.total, 0);
    assert.equal(zero.rows.length, 3);
    assert.equal(zero.crossingRank, undefined);
    assert.equal(zero.includedCount, 0);
    assert.equal(zero.overflow, false);
    for (const row of zero.rows) {
        assert.equal(row.value, 0);
        assert.equal(row.share, 0);
        assert.equal(row.cumulative, 0);
        assert.equal(row.cumulativeShare, 0);
        assert.equal(row.included, false);
        assert.equal(row.crossing, false);
    }
});

test("one nonzero contribution crosses any threshold at its first rank", () => {
    for (const threshold of [1, 80, 100]) {
        const model = analyze(rows([7]), threshold);
        assertReadyInvariants(model);
        assert.equal(model.crossingRank, 1);
        assert.equal(model.includedCount, 1);
        assert.equal(model.rows[0].share, 1);
    }
});

test("negatives reject the whole model, even with valid positive contributions", () => {
    for (const values of [[-1], [5, -1, 10], [-Number.MIN_VALUE, 1]]) {
        const model = analyze(rows(values), 80);
        assert.equal(model.kind, "invalid");
        assert.deepEqual(model.rows, []);
        assert.equal(model.total, undefined);
        assert.equal(model.crossingRank, undefined);
        assert.equal(model.includedCount, 0);
        assert.equal(model.issues.negative, 1);
        assert.equal(model.overflow, false);
    }
});

test("null and undefined are missing and all other nonnumbers or nonfinite values are invalid", () => {
    const input = rows([1, null, undefined, "2", "", true, false, NaN, Infinity, -Infinity, {}, [], 2n, Symbol("x")]);
    const model = analyze(input, 80);
    assert.equal(model.kind, "invalid");
    assert.deepEqual(model.rows, []);
    assert.equal(model.total, undefined);
    assert.deepEqual(model.issues, { missing: 2, invalid: 11, negative: 0, invalidHighlight: 0 });
});

test("invalid issue categories are counted across the entire input without partial totals", () => {
    const model = analyze(rows([10, -2, null, "3", NaN, -4, undefined, 20]), 80);
    assert.equal(model.kind, "invalid");
    assert.deepEqual(model.rows, []);
    assert.equal(model.total, undefined);
    assert.deepEqual(model.issues, { missing: 2, invalid: 2, negative: 2, invalidHighlight: 0 });
});

test("overflow rejects all rows instead of returning an infinite or saturated total", () => {
    for (const values of [
        [Number.MAX_VALUE, Number.MAX_VALUE],
        [Number.MAX_VALUE, 1],
        [Number.MAX_VALUE, Number.MIN_VALUE],
        [Number.MAX_VALUE / 2, Number.MAX_VALUE / 2, 1]
    ]) {
        const model = analyze(rows(values), 80);
        assert.equal(model.kind, "invalid");
        assert.equal(model.overflow, true);
        assert.equal(model.total, undefined);
        assert.deepEqual(model.rows, []);
        assert.equal(model.includedCount, 0);
        assert.equal(model.crossingRank, undefined);
        assert.deepEqual(model.issues, { missing: 0, invalid: 0, negative: 0, invalidHighlight: 0 });
    }
});

test("the maximum finite representable total remains valid", () => {
    for (const values of [[Number.MAX_VALUE], [Number.MAX_VALUE / 2, Number.MAX_VALUE / 2, 0]]) {
        const model = analyze(rows(values), 100);
        assertReadyInvariants(model);
        assert.equal(model.total, Number.MAX_VALUE);
    }
});

test("compensation preserves exactly representable small contributions after a large value", () => {
    const model = analyze(rows([1e16, ...Array(1000).fill(1)]), 100);
    assertReadyInvariants(model);
    assert.equal(model.total, 10000000000001000);
    assert.equal(model.rows[2].cumulative, 10000000000000002);
    assert.equal(model.crossingRank, 1001);
    assert.equal(model.includedCount, 1001);
});

test("exactly representable totals and prefixes agree", () => {
    const model = analyze(rows([0.125, 0.5, 0.25, 0.125]), 75);
    assertReadyInvariants(model);
    assert.equal(model.total, 1);
    assert.deepEqual(model.rows.map(row => row.cumulative), [0.5, 0.75, 0.875, 1]);
    assert.equal(model.crossingRank, 2);
    assert.equal(model.includedCount, 2);
});

test("subnormal contributions retain nonzero total and meaningful fractional shares", () => {
    const minimum = Number.MIN_VALUE;
    const model = analyze(rows([minimum, minimum * 3, minimum * 2, 0]), 50);
    assertReadyInvariants(model);
    assert.equal(model.total, minimum * 6);
    assert.deepEqual(model.rows.map(row => row.share), [0.5, 1 / 3, 1 / 6, 0]);
    assert.deepEqual(model.rows.map(row => row.cumulative), [minimum * 3, minimum * 5, minimum * 6, minimum * 6]);
    assert.equal(model.crossingRank, 1);
    const singleton = analyze(rows([minimum]), 100);
    assertReadyInvariants(singleton);
    assert.equal(singleton.total, minimum);
    assert.equal(singleton.rows[0].share, 1);
});

test("extreme-scale values never produce NaN, infinity, or shares outside zero to one", () => {
    for (const values of [
        [1e300, 1e-300, Number.MIN_VALUE, 0],
        [8e307, 8e307, 1, 1e-300, Number.MIN_VALUE],
        [1e-300, 1e-300, Number.MIN_VALUE],
        [2 ** 1022, 2 ** 1021, 2 ** -1022, Number.MIN_VALUE]
    ]) {
        for (const threshold of [1, 80, 99.99999999999999, 100]) {
            assertReadyInvariants(analyze(rows(values), threshold));
        }
    }
});

test("finite thresholds clamp to 1 through 100 percent and nonfinite thresholds default to 80", () => {
    for (const [input, expected] of [
        [-100, 1], [0, 1], [-0, 1], [0.5, 1], [1, 1],
        [33.5, 33.5], [80, 80], [100, 100], [101, 100],
        [NaN, 80], [Infinity, 80], [-Infinity, 80]
    ]) {
        assert.equal(analyze(rows([99, 1]), input).threshold, expected);
        assert.equal(analyze([], input).threshold, expected);
        assert.equal(analyze(rows([null]), input).threshold, expected);
    }
});

test("valid highlights preserve ranking, denominator, and all cumulative analysis", () => {
    const input = rows([10, 60, 30, 0]);
    const baseline = analyze(input, 80);
    const highlights = [5, 0, 30, 0];
    const highlighted = analyze(input.map((row, index) => ({ ...row, highlight: highlights[index] })), 80);
    assertReadyInvariants(highlighted);
    assert.equal(highlighted.total, baseline.total);
    assert.equal(highlighted.crossingRank, baseline.crossingRank);
    assert.equal(highlighted.includedCount, baseline.includedCount);
    assert.equal(highlighted.issues.invalidHighlight, 0);
    assert.deepEqual(highlighted.rows.map(row => row.highlight), [0, 30, 5, 0]);
    assert.deepEqual(
        highlighted.rows.map(({ highlight: _highlight, ...row }) => row),
        baseline.rows.map(({ highlight: _highlight, ...row }) => row)
    );
});

test("missing highlights are absent, not zero or invalid", () => {
    const input = rows([5, 3, 2]);
    input[0].highlight = undefined;
    input[1].highlight = null;
    const model = analyze(input, 80);
    assertReadyInvariants(model);
    assert.equal(model.issues.invalidHighlight, 0);
    assert.ok(model.rows.every(row => row.highlight === undefined));
});

test("out-of-bounds, nonfinite, or nonnumeric highlights are ignored and counted independently", () => {
    const highlights = [-1, 11, NaN, Infinity, -Infinity, "2", {}, true];
    const input = rows(highlights.map(() => 10));
    input.forEach((row, index) => { row.highlight = highlights[index]; });
    const model = analyze(input, 80);
    assertReadyInvariants(model);
    assert.equal(model.total, 80);
    assert.equal(model.issues.invalidHighlight, highlights.length);
    assert.ok(model.rows.every(row => row.highlight === undefined));
    assert.deepEqual(model.issues, { missing: 0, invalid: 0, negative: 0, invalidHighlight: 8 });
});

test("highlight bounds handle zero and subnormal contributions without tolerance", () => {
    const input = rows([0, Number.MIN_VALUE, Number.MIN_VALUE]);
    input[0].highlight = -0;
    input[1].highlight = Number.MIN_VALUE;
    input[2].highlight = Number.MIN_VALUE * 2;
    const model = analyze(input, 100);
    assertReadyInvariants(model);
    assert.equal(model.issues.invalidHighlight, 1);
    assert.deepEqual(model.rows.map(row => row.highlight), [Number.MIN_VALUE, undefined, 0]);
    const zero = analyze([{ ...rows([0])[0], highlight: Number.MIN_VALUE }], 80);
    assert.equal(zero.kind, "zero");
    assert.equal(zero.issues.invalidHighlight, 1);
});

test("a highlight cannot validate or replace an invalid base contribution", () => {
    const model = analyze([{ ...rows(["10"])[0], highlight: 5 }], 80);
    assert.equal(model.kind, "invalid");
    assert.equal(model.total, undefined);
    assert.equal(model.issues.invalid, 1);
    assert.equal(model.issues.invalidHighlight, 1);
});

test("analysis never mutates the input array or its rows", () => {
    const input = rows([1, 5, 3]);
    input[0].highlight = 1;
    const before = structuredClone(input);
    input.forEach(row => Object.freeze(row));
    Object.freeze(input);
    analyze(input, 80);
    assert.deepEqual(input, before);
});
