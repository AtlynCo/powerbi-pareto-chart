import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(".playwright") }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
