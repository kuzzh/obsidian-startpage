import { App, SuggestModal, TAbstractFile, TFile, TFolder } from "obsidian";

export default class FileFolderSuggestModal extends SuggestModal<TAbstractFile> {
	onChooseItem: (item: TAbstractFile) => void;

	constructor(app: App, onChoose: (item: TAbstractFile) => void) {
		super(app);
		this.onChooseItem = onChoose;
	}

	getSuggestions(query: string): TAbstractFile[] {
		const allItems: TAbstractFile[] = [];
		
		// Add all folders
		const folders = this.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder);
		allItems.push(...folders);
		
		// Add all files
		const files = this.app.vault.getFiles();
		allItems.push(...files);
		
		// Filter by query
		return allItems.filter(item => 
			item.path.toLowerCase().includes(query.toLowerCase())
		);
	}

	renderSuggestion(item: TAbstractFile, el: HTMLElement) {
		const container = el.createDiv({ cls: "file-folder-suggest-item" });
		
		if (item instanceof TFolder) {
			container.createSpan({ cls: "suggest-type", text: "[Folder] " });
		} else {
			container.createSpan({ cls: "suggest-type", text: "[File] " });
		}
		
		container.createSpan({ text: item.path });
	}

	onChooseSuggestion(item: TAbstractFile, evt: MouseEvent | KeyboardEvent) {
		this.onChooseItem(item);
	}
}
