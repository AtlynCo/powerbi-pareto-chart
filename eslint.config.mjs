import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";
import { fileURLToPath } from "node:url";

export default [
    powerbiVisualsConfigs.configs.recommended,
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            ".vscode/**",
            ".tmp/**",
            ".playwright/**",
            ".build-home/**",
            "artifacts/**",
            "test-results/**",
            "playwright-report/**"
        ],
    },
    {
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.json", "./tsconfig.tests.json"],
                tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url))
            }
        }
    },
    {
        files: ["tests/**"],
        rules: {
            "powerbi-visuals/non-literal-fs-path": "off"
        }
    },
];