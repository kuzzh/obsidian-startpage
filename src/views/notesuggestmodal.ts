import { App, SuggestModal, TFile } from "obsidian";

export default class NoteSuggestModal extends SuggestModal<TFile> {
	onChooseItem: (item: TFile) => void;

	constructor(app: App, onChoose: (item: TFile) => void) {
		super(app);
		this.onChooseItem = onChoose;
	}

	getSuggestions(query: string): TFile[] {
		return this.app.vault
			.getFiles()
			.filter(file => file.path.toLowerCase().includes(query.toLowerCase()));
	}

	renderSuggestion(file: TFile, el: HTMLElement) {
		el.setText(file.path);
	}

	onChooseSuggestion(item: TFile, evt: MouseEvent | KeyboardEvent) {
		this.onChooseItem(item);
	}
}
