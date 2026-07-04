import { App, SuggestModal, TFolder } from "obsidian";

export default class FolderSuggestModal extends SuggestModal<TFolder> {
	onChooseItem: (item: TFolder) => void;

	constructor(app: App, onChoose: (item: TFolder) => void) {
		super(app);
		this.onChooseItem = onChoose;
	}

	getSuggestions(query: string): TFolder[] {
		return this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder)
			.filter((folder) => folder.path.toLowerCase().includes(query.toLowerCase()));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement) {
		el.setText(folder.path || "/");
	}

	onChooseSuggestion(item: TFolder, evt: MouseEvent | KeyboardEvent) {
		this.onChooseItem(item);
	}
}
