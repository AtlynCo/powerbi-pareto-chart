import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { unzipSync } from "fflate";
import { normalizePackage, getDefaultPackagePath } from "../scripts/normalize-package.mjs";

const EXPECTED_MANIFEST_BYTES = 763;
const EXPECTED_MANIFEST_SHA256 = "d675f6ed2f35b305805396ce0894887c6299e548e435c781c25a7ea7c4a82046";
const EXPECTED_RESOURCE_BYTES = 729125;
const EXPECTED_RESOURCE_SHA256 = "3c440d1d7526fd0fc743a8ac4a8402409d4517e86c25a792623614f7d61c06af";

function sha256(bytes: Uint8Array | Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

test("normalizePackage produces identical archive bytes from varying entry dates and orders", async () => {
    const zip1 = new JSZip();
    zip1.file("b.txt", "content-b", { date: new Date("2025-05-10T12:00:00Z") });
    zip1.file("a.txt", "content-a", { date: new Date("2026-11-20T08:30:00Z") });
    const bytes1 = await zip1.generateAsync({ type: "nodebuffer" });

    const zip2 = new JSZip();
    zip2.file("a.txt", "content-a", { date: new Date("2023-01-01T00:00:00Z") });
    zip2.file("b.txt", "content-b", { date: new Date("2024-07-04T18:45:00Z") });
    const bytes2 = await zip2.generateAsync({ type: "nodebuffer" });

    const testFile1 = path.resolve("artifacts", `test-norm-1.${process.pid}.zip`);
    const testFile2 = path.resolve("artifacts", `test-norm-2.${process.pid}.zip`);

    try {
        writeFileSync(testFile1, bytes1);
        writeFileSync(testFile2, bytes2);

        const res1 = await normalizePackage(testFile1);
        const res2 = await normalizePackage(testFile2);

        assert.equal(res1.sha256, res2.sha256);
        assert.ok(Buffer.from(res1.bytes).equals(Buffer.from(res2.bytes)));

        const unzipped = unzipSync(res1.bytes);
        assert.equal(Buffer.from(unzipped["a.txt"]).toString(), "content-a");
        assert.equal(Buffer.from(unzipped["b.txt"]).toString(), "content-b");
    } finally {
        try { unlinkSync(testFile1); } catch {}
        try { unlinkSync(testFile2); } catch {}
    }
});

test("production package members preserve exact bytes and native parity", () => {
    const packagePath = getDefaultPackagePath();
    if (!existsSync(packagePath)) {
        return; // Package hasn't been built yet in this step
    }
    const archiveBytes = readFileSync(packagePath);
    const entries = unzipSync(archiveBytes);

    const manifestEntry = entries["package.json"];
    assert.ok(manifestEntry, "package.json missing from package");
    assert.equal(manifestEntry.length, EXPECTED_MANIFEST_BYTES);
    assert.equal(sha256(manifestEntry), EXPECTED_MANIFEST_SHA256);

    const metadata = JSON.parse(Buffer.from(manifestEntry).toString("utf8"));
    const resourceKey = `resources/${metadata.visual.guid}.pbiviz.json`;
    const resourceEntry = entries[resourceKey];
    assert.ok(resourceEntry, `${resourceKey} missing from package`);
    assert.equal(resourceEntry.length, EXPECTED_RESOURCE_BYTES);
    assert.equal(sha256(resourceEntry), EXPECTED_RESOURCE_SHA256);
});
