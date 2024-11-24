import { App, Modal, Notice } from 'obsidian';
import { getGitDiff } from './git_operations';

export class GitModal extends Modal {
  filePath: string;

  constructor(app: App) {
    super(app);

    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.filePath = activeFile.path; // Get the relative path of the active file
    } else {
      new Notice('No active file selected for diff.');
      this.close();
    }
  }

  async onOpen() {
    const { contentEl } = this;

    this.titleEl.setText('Git Diff Viewer');

    if (!this.filePath) {
      new Notice('No file selected.');
      this.close();
      return;
    }

    try {
      const diffHtml = await getGitDiff(this.app, this.filePath);

      // Create a div element and set its innerHTML explicitly
      const diffContainer = contentEl.createDiv({ cls: 'git-diff-view' });
      diffContainer.innerHTML = diffHtml;
    } catch (error) {
      new Notice('Error displaying diff.');
      console.error(error);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
