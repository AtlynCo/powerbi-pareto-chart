import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/browser",
    fullyParallel: false,
    workers: 1,
    reporter: "list",
    use: { browserName: "chromium", headless: true, viewport: { width: 1000, height: 800 } }
});
