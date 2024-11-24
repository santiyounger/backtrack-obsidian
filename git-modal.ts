import { App, Modal, Notice } from 'obsidian';
import git from 'isomorphic-git';
import { diffLines } from 'diff'; // Import diffLines for diff generation
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

      // Create content area for file diff
      const contentArea = container.createDiv({ cls: 'git-content-area' });
      contentArea.setText('Select a commit to view the diff.');

      // Populate commit list
      commits.forEach((commit, index) => {
        const commitItem = commitList.createDiv({ cls: 'commit-item' });
        commitItem.setText(`#${index + 1} - ${commit.commit.message}`);
        commitItem.onclick = async () => {
          try {
            const diffContent = await this.getFileDiff(dir, commit.oid);
            contentArea.innerHTML = diffContent; // Set diff content as HTML
          } catch (error) {
            contentArea.setText('Error displaying diff.');
            console.error(error);
          }
        };
      });
    } catch (error) {
      new Notice('Error displaying commits.');
      console.error(error);
    }
  }

  async getFileDiff(dir: string, oid: string): Promise<string> {
    const relativeFilePath = this.filePath;

    try {
      // Get the current content of the file
      const currentContent = await this.app.vault.adapter.read(relativeFilePath);

      // Get the content from the selected commit
      const { blob: latestContentBlob } = await git.readBlob({
        fs,
        dir,
        oid,
        filepath: relativeFilePath,
      });
      const latestContent = new TextDecoder('utf-8').decode(latestContentBlob);

      // Generate the diff
      const diffs = diffLines(latestContent, currentContent);

      // Format the diff as HTML with color coding
      return diffs
        .map((part) => {
          const color = part.added
            ? 'var(--text-success)'
            : part.removed
            ? 'var(--text-error)'
            : 'var(--text-normal)';
          const background = part.added
            ? 'rgba(0, 255, 0, 0.1)'
            : part.removed
            ? 'rgba(255, 0, 0, 0.1)'
            : 'transparent';
          return `<div style="color:${color}; background:${background}; white-space:pre-wrap;">${part.value}</div>`;
        })
        .join('');
    } catch (error) {
      console.error('Error generating file diff:', error);
      throw new Error('Failed to generate file diff.');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
