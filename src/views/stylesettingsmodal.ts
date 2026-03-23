import { App, Modal, Setting, DropdownComponent } from "obsidian";
import StartPagePlugin from "@/main";
import { t } from "@/i18n";
import { SectionStyleSettings } from "@/types";

type SectionType = "pinned" | "recent";

export default class StyleSettingsModal extends Modal {
    private plugin: StartPagePlugin;
    private onSettingsChange: () => void;
    private currentSection: SectionType = "pinned";
    private settingsContainer: HTMLElement;

    constructor(app: App, plugin: StartPagePlugin, onSettingsChange: () => void) {
        super(app);
        this.plugin = plugin;
        this.onSettingsChange = onSettingsChange;
        this.setTitle(t("style_settings_heading"));
    }

    onOpen() {
        const { contentEl } = this;

        new Setting(contentEl)
            .setName(t("style_settings_select_section"))
            .addDropdown(dropdown => {
                dropdown
                    .addOption("pinned", t("style_settings_pinned_notes"))
                    .addOption("recent", t("style_settings_recent_notes"))
                    .setValue(this.currentSection)
                    .onChange(async (value) => {
                        this.currentSection = value as SectionType;
                        this.refreshSettingsDisplay();
                    });
            });

        this.settingsContainer = contentEl.createDiv("style-settings-container");
        this.refreshSettingsDisplay();
    }

    private refreshSettingsDisplay() {
        this.settingsContainer.empty();

        const styleSettings = this.currentSection === "pinned"
            ? this.plugin.settings.pinnedNotesStyle
            : this.plugin.settings.recentNotesStyle;

        this.createStyleSettings(this.settingsContainer, styleSettings);
    }

    private createStyleSettings(
        containerEl: HTMLElement,
        styleSettings: SectionStyleSettings
    ) {
        this.addStyleSetting(containerEl, styleSettings, "sectionMargin", t("style_section_margin"), t("style_section_margin_desc"));
        this.addStyleSetting(containerEl, styleSettings, "sectionPadding", t("style_section_padding"), t("style_section_padding_desc"));

        this.addStyleSetting(containerEl, styleSettings, "headerMargin", t("style_header_margin"), t("style_header_margin_desc"));
        this.addStyleSetting(containerEl, styleSettings, "headerPadding", t("style_header_padding"), t("style_header_padding_desc"));

        this.addStyleSetting(containerEl, styleSettings, "titleFontSize", t("style_title_font_size"), t("style_title_font_size_desc"));
        this.addStyleSetting(containerEl, styleSettings, "titleMargin", t("style_title_margin"), t("style_title_margin_desc"));
        this.addStyleSetting(containerEl, styleSettings, "titlePadding", t("style_title_padding"), t("style_title_padding_desc"));

        this.addStyleSetting(containerEl, styleSettings, "listGap", t("style_list_gap"), t("style_list_gap_desc"));

        this.addStyleSetting(containerEl, styleSettings, "itemPadding", t("style_item_padding"), t("style_item_padding_desc"));
        this.addStyleSetting(containerEl, styleSettings, "itemMargin", t("style_item_margin"), t("style_item_margin_desc"));

        this.addStyleSetting(containerEl, styleSettings, "noteTitleFontSize", t("style_note_title_font_size"), t("style_note_title_font_size_desc"));
        this.addStyleSetting(containerEl, styleSettings, "noteTitleMargin", t("style_note_title_margin"), t("style_note_title_margin_desc"));
        this.addStyleSetting(containerEl, styleSettings, "noteTitlePadding", t("style_note_title_padding"), t("style_note_title_padding_desc"));

        this.addStyleSetting(containerEl, styleSettings, "noteDateFontSize", t("style_note_date_font_size"), t("style_note_date_font_size_desc"));

        this.addStyleSetting(containerEl, styleSettings, "noteFolderFontSize", t("style_note_folder_font_size"), t("style_note_folder_font_size_desc"));
    }

    private addStyleSetting(
        container: HTMLElement,
        settings: SectionStyleSettings,
        key: keyof SectionStyleSettings,
        name: string,
        desc: string
    ) {
        new Setting(container)
            .setName(name)
            .setDesc(desc)
            .addText(text =>
                text.setValue(settings[key]).onChange(async (value) => {
                    const normalizedValue = this.normalizeCssValue(value);
                    settings[key] = normalizedValue;
                    await this.plugin.saveSettings();
                    this.onSettingsChange();
                })
            );
    }

    private normalizeCssValue(value: string): string {
        if (!value || value.trim() === "") {
            return value;
        }

        const trimmedValue = value.trim();

        // 检查是否已有单位 (px, em, rem, %, vw, vh, pt, cm, mm, in, ex, ch, vmin, vmax)
        const hasUnit = /^(\d+\.?\d*)\s*(px|em|rem|%|vw|vh|pt|cm|mm|in|ex|ch|vmin|vmax)$/i.test(trimmedValue);

        if (hasUnit) {
            return trimmedValue;
        }

        // 检查是否为纯数字（包括小数）
        const isNumber = /^\d+\.?\d*$/.test(trimmedValue);

        if (isNumber) {
            return trimmedValue + "px";
        }

        // 其他情况（如 auto, inherit, initial, unset, 0 等）原样返回
        return trimmedValue;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
