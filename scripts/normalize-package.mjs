import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

// JSZip encodes ZIP timestamps with the Date's UTC getters, so this anchor must be built in
// UTC. `new Date(1980, 0, 1)` is local midnight, which encodes a different DOS time on every
// build machine (and a pre-1980, out-of-range DOS date east of UTC), making the package hash
// depend on the builder's timezone.
const fixedDate = new Date(Date.UTC(1980, 0, 1, 0, 0, 0, 0));

export async function normalizePackage(targetPath) {
    const packagePath = path.resolve(targetPath ?? getDefaultPackagePath());
    if (!existsSync(packagePath)) {
        throw new Error(`Package file not found: ${packagePath}`);
    }
    const sourceBytes = readFileSync(packagePath);
    const source = await JSZip.loadAsync(sourceBytes);
    const normalized = new JSZip();

    for (const name of Object.keys(source.files).sort()) {
        const entry = source.files[name];
        const data = entry.dir ? null : await entry.async("nodebuffer");
        normalized.file(name, data, {
            compression: "DEFLATE",
            compressionOptions: { level: 9 },
            createFolders: false,
            date: fixedDate,
            dir: entry.dir,
            dosPermissions: entry.dir ? 0x10 : 0x20,
            unixPermissions: entry.dir ? 0o40755 : 0o100644
        });
    }

    const bytes = await normalized.generateAsync({
        comment: "",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
        platform: "DOS",
        type: "nodebuffer"
    });

    const tempPath = `${packagePath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tempPath, bytes);
    try {
        renameSync(tempPath, packagePath);
    } catch {
        writeFileSync(packagePath, bytes);
        try { unlinkSync(tempPath); } catch {}
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    return { packagePath, bytes, size: bytes.length, sha256 };
}

export function getDefaultPackagePath() {
    const metadata = JSON.parse(readFileSync(path.resolve("pbiviz.json"), "utf8"));
    return path.join("dist", `${metadata.visual.guid}.${metadata.visual.version}.pbiviz`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const target = process.argv[2];
    normalizePackage(target).then(({ packagePath, size, sha256 }) => {
        console.log(`Normalized ${packagePath} (${size} bytes, SHA-256: ${sha256})`);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
