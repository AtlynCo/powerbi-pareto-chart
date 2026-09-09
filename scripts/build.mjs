import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const home = path.resolve(".build-home");
const certs = path.join(home, "pbiviz-certs");
fs.mkdirSync(certs, { recursive: true });
const env = {
    ...process.env, USERPROFILE: home, HOME: home,
    APPDATA: path.join(home, "AppData", "Roaming"),
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
    npm_config_cache: path.resolve(".npm-cache")
};
function run(command, args) {
    const result = spawnSync(command, args, { env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

// The official packager resolves dev-server certificates even for package-only
// builds. Pre-provision an untrusted file-only certificate to avoid cert-store
// mutations or writes to the developer's real home directory.
run(process.execPath, [path.resolve("scripts", "generate-notices.mjs"), "--check"]);
if (process.platform === "win32") {
    fs.writeFileSync(path.join(certs, "PowerBICustomVisualTestPass.txt"), randomBytes(24).toString("hex"));
    run("pwsh", ["-NoLogo", "-NoProfile", "-File", path.resolve("scripts", "build-certificate.ps1"), "-CertificateDirectory", certs]);
} else {
    run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "7", "-subj", "/CN=localhost",
        "-keyout", path.join(certs, "PowerBICustomVisualTest_private.key"),
        "-out", path.join(certs, "PowerBICustomVisualTest_public.crt")]);
}
run(process.execPath, [path.resolve("node_modules", "powerbi-visuals-tools", "bin", "pbiviz.js"), "package", "--all-locales", "--no-stats", ...process.argv.slice(2)]);
