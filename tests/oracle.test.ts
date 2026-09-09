import test from "node:test";
import assert from "node:assert/strict";
import { analyze, type InputRow } from "../src/model";

// Independent exact oracle: every finite nonnegative binary64 value is an
// integer multiple of 2^-1074. No production summation or threshold helper used.
function units(value: number): bigint {
    const bytes = new DataView(new ArrayBuffer(8));
    bytes.setFloat64(0, value);
    const bits = bytes.getBigUint64(0);
    const exponent = Number((bits >> 52n) & 2047n);
    const fraction = bits & ((1n << 52n) - 1n);
    return exponent === 0 ? fraction : ((1n << 52n) | fraction) << BigInt(exponent - 1);
}

function nearestDouble(value: bigint): number {
    if (value === 0n) return 0;
    const shift = Math.max(0, value.toString(2).length - 53);
    let mantissa = value >> BigInt(shift);
    if (shift > 0) {
        const remainder = value - (mantissa << BigInt(shift));
        const halfway = 1n << BigInt(shift - 1);
        if (remainder > halfway || (remainder === halfway && mantissa % 2n !== 0n)) mantissa++;
    }
    return Number(mantissa) * 2 ** (shift - 1074);
}

const rows = (values: number[]): InputRow[] => values.map((value, index) => ({
    index, key: `id-${String(index).padStart(3, "0")}`, sortKey: `category-${String(index).padStart(3, "0")}`,
    label: `Category ${index}`, value
}));

test("binary64 BigInt oracle verifies deterministic adversarial totals and every prefix", () => {
    let seed = 0x50415245;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    const exponents = [-1074, -1070, -1022, -900, -100, -53, -1, 0, 50, 300, 900, 970];
    const limit = units(Number.MAX_VALUE);
    const fixtures = [
        [Number.MAX_VALUE, Number.MIN_VALUE],
        [Number.MAX_VALUE / 2, Number.MAX_VALUE / 2],
        [1e16, 1, 1, 1, 1],
        [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE],
        [1e308, 1e308]
    ];
    for (let sample = 0; sample < 400; sample++) {
        fixtures.push(Array.from({ length: 1 + random() % 50 }, () =>
            (random() % 32) * 2 ** exponents[random() % exponents.length]));
    }
    for (const values of fixtures) {
        const exact = values.reduce((sum, value) => sum + units(value), 0n);
        const actual = analyze(rows(values), 80);
        if (exact > limit) {
            assert.equal(actual.overflow, true);
            assert.equal(actual.kind, "invalid");
            assert.equal(actual.total, undefined);
            continue;
        }
        assert.equal(actual.total, nearestDouble(exact));
        let prefix = 0n;
        for (const row of actual.rows) {
            prefix += units(row.value);
            assert.equal(row.cumulative, nearestDouble(prefix));
            assert.ok(Number.isFinite(row.cumulativeShare));
            assert.ok(row.cumulativeShare >= 0 && row.cumulativeShare <= 1);
        }
        if (actual.kind === "ready") assert.equal(actual.rows.at(-1)?.cumulativeShare, 1);
    }
});

test("integer-rational threshold oracle proves ties, exact crossings and 0/100 settings policy", () => {
    for (let sample = 1; sample <= 100; sample++) {
        const input = rows(Array.from({ length: 30 }, (_, i) => (i * 13 + sample * 7) % 29));
        const ranked = [...input].sort((a, b) => Number(b.value) - Number(a.value) || (a.key < b.key ? -1 : 1));
        const total = ranked.reduce((sum, row) => sum + BigInt(Number(row.value)), 0n);
        for (const requested of [0, 1, 20, 50, 80, 100]) {
            const threshold = requested === 0 ? 1 : requested;
            let cumulative = 0n;
            const crossing = ranked.findIndex(row => {
                cumulative += BigInt(Number(row.value));
                return cumulative * 100n >= total * BigInt(threshold);
            });
            const actual = analyze(input, requested);
            assert.equal(actual.threshold, threshold);
            assert.equal(actual.crossingRank, crossing + 1);
            assert.deepEqual(actual.rows.map(row => row.key), ranked.map(row => row.key));
            const boundary = ranked[crossing].value;
            assert.deepEqual(actual.rows.filter(row => row.included).map(row => row.key),
                ranked.filter(row => Number(row.value) >= Number(boundary)).map(row => row.key));
        }
    }
});
