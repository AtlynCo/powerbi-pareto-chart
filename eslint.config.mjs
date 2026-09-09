import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";
import { fileURLToPath } from "node:url";

export default [
    powerbiVisualsConfigs.configs.recommended,
    {
        ignores: ["node_modules/**", "dist/**", ".vscode/**", ".tmp/**"],
    },
    {
        languageOptions: {
            parserOptions: { tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)) }
        }
    },
];