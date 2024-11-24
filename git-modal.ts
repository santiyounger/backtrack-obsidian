import { App, Modal, Notice } from 'obsidian';
import git from 'isomorphic-git';
import * as fs from 'fs';
import * as path from 'path';

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
      const dir = (this.app.vault.adapter as any).getBasePath
        ? (this.app.vault.adapter as any).getBasePath()
        : path.resolve('.'); // Fallback if `getBasePath` is not available

      // Get commit history for the file
      const commits = await git.log({ fs, dir, filepath: this.filePath });

      if (commits.length === 0) {
        contentEl.setText('No commit history found for this file.');
        return;
      }

      const container = contentEl.createDiv({ cls: 'git-modal-container' });

      // Create sidebar for commit list
      const sidebar = container.createDiv({ cls: 'git-sidebar' });
      sidebar.setText('Commit History');
      const commitList = sidebar.createDiv({ cls: 'commit-list' });

      // Create content area for file content
      const contentArea = container.createDiv({ cls: 'git-content-area' });
      contentArea.setText('Select a commit to view the file content.');

      // Populate commit list
      commits.forEach((commit, index) => {
        const commitItem = commitList.createDiv({ cls: 'commit-item' });
        commitItem.setText(`#${index + 1} - ${commit.commit.message}`);
        commitItem.onclick = async () => {
          const { blob } = await git.readBlob({
            fs,
            dir,
            oid: commit.oid,
            filepath: this.filePath,
          });
          const fileContent = new TextDecoder('utf-8').decode(blob);
          contentArea.setText(fileContent);
        };
      });
    } catch (error) {
      new Notice('Error displaying commits.');
      console.error(error);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

