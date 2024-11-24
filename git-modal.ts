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

      // Create wrapper for the diff area
      const diffWrapper = container.createDiv({ cls: 'git-diff-wrapper' });

      // Add centered headings for each column
      const headings = diffWrapper.createDiv({ cls: 'git-diff-headings' });
      headings.createDiv({ cls: 'git-diff-heading', text: 'Before' });
      headings.createDiv({ cls: 'git-diff-heading', text: 'After' });

      // Create content area for file diff
      const contentArea = diffWrapper.createDiv({ cls: 'git-content-area' });

      // Create two scrollable columns for diffs
      const prevColumn = contentArea.createDiv({ cls: 'git-column' });
      const currColumn = contentArea.createDiv({ cls: 'git-column' });

      // Populate commit list
      commits.forEach((commit, index) => {
        const commitItem = commitList.createDiv({ cls: 'commit-item' });
        commitItem.setText(`#${index + 1} - ${commit.commit.message}`);
        commitItem.onclick = async () => {
          try {
            const prevCommitOid = index + 1 < commits.length ? commits[index + 1].oid : null;
            const currentCommitOid = commit.oid;
            const diffContent = await this.getFileDiff(dir, prevCommitOid, currentCommitOid);

            const [prevContent, currContent] = diffContent.split('|SPLIT|'); // Ensure split
            prevColumn.innerHTML = prevContent;
            currColumn.innerHTML = currContent;
          } catch (error) {
            prevColumn.setText('Error displaying diff.');
            currColumn.setText('Error displaying diff.');
            console.error(error);
          }
        };
      });
    } catch (error) {
      new Notice('Error displaying commits.');
      console.error(error);
    }
  }

  async getFileDiff(dir: string, prevOid: string | null, currentOid: string): Promise<string> {
    const relativeFilePath = this.filePath;

    try {
      // Get the content from the current commit
      const { blob: currentBlob } = await git.readBlob({
        fs,
        dir,
        oid: currentOid,
        filepath: relativeFilePath,
      });
      const currentContent = new TextDecoder('utf-8').decode(currentBlob);

      // Get the content from the previous commit (if available)
      let prevContent = '';
      if (prevOid) {
        const { blob: prevBlob } = await git.readBlob({
          fs,
          dir,
          oid: prevOid,
          filepath: relativeFilePath,
        });
        prevContent = new TextDecoder('utf-8').decode(prevBlob);
      }

      // Generate the diff for the split view
      const diffs = diffLines(prevContent, currentContent);

      // Format the diff as a split view with HTML and color coding
      const leftColumn = diffs
        .map((part) => {
          if (part.removed || !part.added) {
            const color = part.removed ? 'var(--text-error)' : 'var(--text-normal)';
            const background = part.removed ? 'rgba(255, 0, 0, 0.1)' : 'transparent';
            return `<div style="color:${color}; background:${background}; white-space:pre-wrap;">${part.value}</div>`;
          }
          return '';
        })
        .join('');

      const rightColumn = diffs
        .map((part) => {
          if (part.added || !part.removed) {
            const color = part.added ? 'var(--text-success)' : 'var(--text-normal)';
            const background = part.added ? 'rgba(0, 255, 0, 0.1)' : 'transparent';
            return `<div style="color:${color}; background:${background}; white-space:pre-wrap;">${part.value}</div>`;
          }
          return '';
        })
        .join('');

      return `${leftColumn}|SPLIT|${rightColumn}`;
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
