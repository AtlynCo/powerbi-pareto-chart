import test from "node:test";
import assert from "node:assert/strict";
import { canonicalCategory, getBinding, MAX_CATEGORIES, SegmentTracker } from "../src/data";
import type powerbi from "powerbi-visuals-api";

test("aggregated fetching continues until final segment, without double counting", () => {
    const tracker = new SegmentTracker();
    let calls = 0;
    const fetch = () => { calls++; return true; };
    assert.equal(tracker.accept(10000, true, 0, fetch), "loading");
    assert.equal(tracker.accept(20000, true, 1, fetch), "loading");
    assert.equal(tracker.accept(25000, false, 1, fetch), "complete");
    assert.equal(calls, 2);
});

test("refused requests, bounded final view and stalled append stay incomplete", () => {
    const tracker = new SegmentTracker();
    assert.equal(tracker.accept(10000, true, 0, () => false), "refused");
    assert.equal(tracker.accept(MAX_CATEGORIES, true, 1, () => { throw Error("No fetch at bound"); }), "limit");
    assert.equal(tracker.accept(MAX_CATEGORIES + 1, false, 0, () => true), "limit");
    assert.equal(tracker.accept(MAX_CATEGORIES, false, 0, () => true), "complete");
    assert.equal(tracker.accept(10000, true, 0, () => true), "loading");
    assert.equal(tracker.accept(10000, true, 1, () => { throw Error("No repeated fetch"); }), "stalled");
});

test("create resets count for a new filtered query and unexpected increments never imply complete", () => {
    const tracker = new SegmentTracker();
    tracker.accept(20000, true, 0, () => true);
    assert.equal(tracker.accept(2, true, 0, () => true), "loading");
    assert.equal(tracker.accept(1, false, 2, () => true), "unexpected");
    assert.equal(tracker.accept(0, false, 0, () => true), "complete");
});

test("a shrinking final Append cannot be mislabeled as the complete aggregated query", () => {
    const tracker = new SegmentTracker();
    tracker.accept(10000, true, 0, () => true);
    assert.equal(tracker.accept(3, false, 1, () => { throw Error("unexpected fetch"); }), "unexpected");
    tracker.reset();
    assert.equal(tracker.accept(3, false, 0, () => false), "complete");
});

test("stable typed category keys distinguish numeric, text, dates and blanks", () => {
    assert.equal(canonicalCategory(null), canonicalCategory(undefined));
    assert.notEqual(canonicalCategory(10), canonicalCategory("10"));
    assert.equal(canonicalCategory(new Date("2026-01-01T00:00:00Z")), "date:1767225600000");
    assert.equal(canonicalCategory("<script>"), "string:<script>");
});

test("binding requires exactly one category and contribution, preserves tooltip columns", () => {
    const metadata = { columns: [] };
    assert.equal(getBinding({ metadata }), undefined);
    const category = { source: { displayName: "Type", roles: { Category: true } }, values: ["A"] };
    const contribution = { source: { displayName: "Count", roles: { Contribution: true } }, values: [1] };
    const tooltip = { source: { displayName: "Cost", roles: { Tooltips: true } }, values: [25] };
    const values = Object.assign([contribution, tooltip], { grouped: () => [] });
    const view: powerbi.DataView = { metadata, categorical: { categories: [category], values } };
    assert.equal(getBinding(view)?.tooltips[0], tooltip);
    view.categorical!.categories!.push(category);
    assert.equal(getBinding(view), undefined);
});

test("binding returns undefined when either category or contribution is missing", () => {
    const metadata = { columns: [] };
    const category = { source: { displayName: "Type", roles: { Category: true } }, values: ["A"] };
    const contribution = { source: { displayName: "Count", roles: { Contribution: true } }, values: [1] };
    assert.equal(getBinding({ metadata, categorical: { categories: [category] } }), undefined);
    assert.equal(getBinding({ metadata, categorical: { values: Object.assign([contribution], { grouped: () => [] }) } }), undefined);
    assert.equal(getBinding({ metadata, categorical: {} }), undefined);
});
