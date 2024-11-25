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
    this.modalEl.addClass('git-diff-modal'); // Add the unique class
    this.titleEl.setText('Draft Keep History');

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

      let activeCommitItem: HTMLDivElement | null = null;

      // Format commit items
      commits.forEach((commit, index) => {
        const commitItem = commitList.createDiv({ cls: 'commit-item' });

        // Add formatted commit details
        const TRUNCATION_LIMIT = 30;
        commitItem.innerHTML = `
          <strong class="commit-date">${new Date(commit.commit.author.timestamp * 1000).toISOString().split('T')[0].replace(/-/g, '/')} - ${new Date(commit.commit.author.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
          <div class="commit-details">
              ${commit.commit.message.length > TRUNCATION_LIMIT ? commit.commit.message.substring(0, TRUNCATION_LIMIT) + '...' : commit.commit.message}<br>
          </div>
        `;

        commitItem.onclick = async () => {
          // Remove the `selected` class from the previously active commit
          if (activeCommitItem) {
            activeCommitItem.removeClass('selected');
          }

          // Add the `selected` class to the currently clicked commit
          commitItem.addClass('selected');
          activeCommitItem = commitItem;

          try {
            const prevCommitOid = index + 1 < commits.length ? commits[index + 1].oid : null;
            const currentCommitOid = commit.oid;
            const diffContent = await this.getFileDiff(dir, prevCommitOid, currentCommitOid);

            const [diffRows] = diffContent.split('|SPLIT|');
            contentArea.innerHTML = diffRows;
          } catch (error) {
            contentArea.setText('Error displaying diff.');
            console.error(error);
          }
        };

        // Automatically trigger the first commit
        if (index === 0) {
          commitItem.click();
        }
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

      // Initialize an array to hold the HTML for each row
      const rows: string[] = [];

      diffs.forEach((part) => {
        const partLines = part.value.split('\n');
        // Remove the last empty string if the string ends with a newline
        if (partLines[partLines.length - 1] === '') {
          partLines.pop();
        }

        partLines.forEach((line) => {
          let beforeLine = '';
          let afterLine = '';

          if (part.removed) {
            beforeLine = line;
            afterLine = ''; // Empty space to match the removed line
          } else if (part.added) {
            beforeLine = ''; // Empty space to match the added line
            afterLine = line;
          } else {
            beforeLine = line;
            afterLine = line;
          }

          // Escape HTML entities to prevent XSS
          beforeLine = this.escapeHtml(beforeLine);
          afterLine = this.escapeHtml(afterLine);

          // Add styling for removed and added lines
          if (part.removed) {
            beforeLine = `<span class="diff-removed">${beforeLine}</span>`;
          }
          if (part.added) {
            afterLine = `<span class="diff-added">${afterLine}</span>`;
          }

          // Create a row with before and after lines
          rows.push(`
            <div class="diff-row">
              <div class="diff-before">${beforeLine}</div>
              <div class="diff-after">${afterLine}</div>
            </div>
          `);
        });
      });

      return `${rows.join('')}|SPLIT|`;
    } catch (error) {
      console.error('Error generating file diff:', error);
      throw new Error('Failed to generate file diff.');
    }
  }

  escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
