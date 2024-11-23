import { App, Modal, Notice } from "obsidian";
import { getGitDiff } from "./git_operations";

export class GitModal extends Modal {
  private filePath?: string;

  constructor(app: App) {
    super(app);

    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.filePath = activeFile.path;
    } else {
      new Notice("No active file selected for diff.");
      this.close();
    }
  }

  async onOpen() {
    const { contentEl } = this;

    this.titleEl.setText("Git Diff Viewer");

    if (!this.filePath) {
      new Notice("No file selected.");
      this.close();
      return;
    }

    try {
      const diffHtml = await getGitDiff(this.app, this.filePath);
      contentEl.createDiv({ cls: "git-diff-view", html: diffHtml });
    } catch (error) {
      new Notice("Error displaying diff.");
      console.error("Git Diff Error:", error);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
