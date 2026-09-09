import type powerbi from "powerbi-visuals-api";
export type TextKey = string;

export function localize(manager: powerbi.extensibility.ILocalizationManager, key: TextKey, ...args: (string | number)[]): string {
    const template = manager.getDisplayName(key);
    return template.replace(/\{(\d+)\}/g, (_, index: string) => String(args[Number(index)] ?? ""));
}
