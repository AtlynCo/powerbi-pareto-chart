import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

class AnalysisCard extends formattingSettings.SimpleCard {
    name = "analysis";
    displayName = "Analysis";
    displayNameKey = "Card_Analysis";
    threshold = new formattingSettings.NumUpDown({
        name: "threshold", displayName: "Threshold (%)", displayNameKey: "Setting_Threshold", value: 80,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 100 }
        }
    });
    partialPolicy = new formattingSettings.AutoDropdown({
        name: "partialPolicy", displayName: "Incomplete data", displayNameKey: "Setting_PartialPolicy", value: "withhold"
    });
    pageSize = new formattingSettings.NumUpDown({
        name: "pageSize", displayName: "Categories per page", displayNameKey: "Setting_PageSize", value: 30,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 10 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 100 }
        }
    });
    slices = [this.threshold, this.partialPolicy, this.pageSize];
}

class AppearanceCard extends formattingSettings.SimpleCard {
    name = "appearance";
    displayName = "Appearance";
    displayNameKey = "Card_Appearance";
    barColor = new formattingSettings.ColorPicker({
        name: "barColor", displayName: "Bars", displayNameKey: "Setting_BarColor", value: { value: "#7895B2" }
    });
    thresholdColor = new formattingSettings.ColorPicker({
        name: "thresholdColor", displayName: "Threshold contributors", displayNameKey: "Setting_ThresholdColor", value: { value: "#176B78" }
    });
    lineColor = new formattingSettings.ColorPicker({
        name: "lineColor", displayName: "Cumulative share", displayNameKey: "Setting_LineColor", value: { value: "#B24C16" }
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayName: "Text size", displayNameKey: "Setting_FontSize", value: 12,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 10 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 24 }
        }
    });
    showTable = new formattingSettings.ToggleSwitch({
        name: "showTable", displayName: "Show data table", displayNameKey: "Setting_ShowTable", value: true
    });
    slices = [this.barColor, this.thresholdColor, this.lineColor, this.fontSize, this.showTable];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
    analysis = new AnalysisCard();
    appearance = new AppearanceCard();
    cards = [this.analysis, this.appearance];
}

export function boundedNumber(value: number, fallback: number, min: number, max: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function safeColor(value: string | undefined, fallback: string): string {
    return value && /^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/i.test(value) ? value : fallback;
}
