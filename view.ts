import { App, ItemView, MarkdownView, TFile, Menu, EventRef } from "obsidian";
import StartPagePlugin from "./main";
import { t } from "./i18n";

export const VIEW_TYPE_START_PAGE = "start-page-view";

export class StartPageView extends ItemView {
  plugin: StartPagePlugin;
  private fileChangeEventRef: EventRef;
  private refreshTimer: number | null = null;
  private readonly REFRESH_INTERVAL = 60000; // 1分钟刷新一次

  constructor(leaf: any, app: App, plugin: StartPagePlugin) {
    super(leaf);
    this.app = app;
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_START_PAGE;
  }

  getDisplayText(): string {
    return t("start_page");
  }

  getIcon(): string {
    return "home";
  }

  canClose(): boolean {
    return false;
  }

  async onOpen() {
    await this.renderContent();
    
    // Register file change event
    this.fileChangeEventRef = this.app.vault.on('modify', () => {
      this.renderContent();
    });

    this.registerDomEvent(this.containerEl, "contextmenu", (evt: MouseEvent) => {
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle(t("refresh"))
          .setIcon("refresh-cw")
          .onClick(() => this.renderContent());
      });
      menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
    });
  }

  async onClose() {
    // Clean up event listener and timer when view is closed
    if (this.fileChangeEventRef) {
      this.app.vault.offref(this.fileChangeEventRef);
    }
    this.clearRefreshTimer();
  }

  private clearRefreshTimer() {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private startRefreshTimerIfNeeded(recentNotes: TFile[]) {
    // 清除现有的定时器
    this.clearRefreshTimer();

    // 检查是否有需要定时刷新的时间标签
    const needsRefresh = recentNotes.some(file => {
      const diff = Date.now() - file.stat.mtime;
      return diff < 24 * 60 * 60 * 1000; // 24小时内的文件需要定时刷新
    });

    if (needsRefresh) {
      this.refreshTimer = window.setInterval(() => {
        this.renderContent();
      }, this.REFRESH_INTERVAL);
    }
  }

  async renderContent() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("start-page-container");

    container.createEl("h1", { text: t("welcome") });

    // Display pinned notes
    if (this.plugin.settings.pinnedNotes.length > 0) {
      container.createEl("h2", { text: t("pinned_notes") });
      const pinnedUl = container.createEl("ul");
      
      for (const path of this.plugin.settings.pinnedNotes) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          const li = pinnedUl.createEl("li");
          const link = li.createEl("a", {
            text: file.basename,
            href: "#",
          });
          link.onclick = () => {
            // Check if file is already open in any leaf
            const existingLeaf = this.app.workspace.getLeavesOfType("markdown").find(
              (leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path
            );

            if (existingLeaf) {
              // If file is already open, just focus that leaf
              this.app.workspace.revealLeaf(existingLeaf);
            } else {
              // If file is not open, open it in a new leaf
              this.app.workspace.openLinkText(file.path, "", false);
            }
            return false;
          };
        }
      }
    }

    // Display recent notes
    const recentNotes = this.getRecentNotes(this.plugin.settings.recentNotesLimit);
    if (recentNotes.length > 0) {
      container.createEl("h2", { text: t("recent_notes") });
      const ul = container.createEl("ul");

      for (const file of recentNotes) {
        const li = ul.createEl("li");
        const link = li.createEl("a", {
          text: file.basename,
          href: "#",
        });
        link.onclick = () => {
          // Check if file is already open in any leaf
          const existingLeaf = this.app.workspace.getLeavesOfType("markdown").find(
            (leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path
          );

          if (existingLeaf) {
            // If file is already open, just focus that leaf
            this.app.workspace.revealLeaf(existingLeaf);
          } else {
            // If file is not open, open it in a new leaf
            this.app.workspace.openLinkText(file.path, "", false);
          }
          return false;
        };

        const row = li.createEl("div", {
          cls: "row"
        });

        const parentPath = row.createEl("span", {
          text: file.parent?.path,
          cls: "time-tag"
        });

        // Add time tag
        const timeTag = row.createEl("span", {
          text: this.formatDate(file.stat.mtime),
          cls: "time-tag"
        });
      }

      // 检查是否需要启动定时刷新
      this.startRefreshTimerIfNeeded(recentNotes);
    }
  }

  getRecentNotes(limit: number): TFile[] {
    const files = this.app.vault.getMarkdownFiles();
    return files
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, limit);
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000));
        return t("minutes_ago").replace("{minutes}", minutes.toString());
      }
      return t("hours_ago").replace("{hours}", hours.toString());
    }
    
    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return t("days_ago").replace("{days}", days.toString());
    }
    
    // Otherwise show full date
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
