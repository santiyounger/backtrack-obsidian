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

      // Create two scrollable columns for diffs with synchronized scrolling
      const prevColumn = contentArea.createDiv({ cls: 'git-column' });
      const currColumn = contentArea.createDiv({ cls: 'git-column' });

      // Add synchronized scrolling between the two columns
      prevColumn.onscroll = () => {
        currColumn.scrollTop = prevColumn.scrollTop;
      };
      currColumn.onscroll = () => {
        prevColumn.scrollTop = currColumn.scrollTop;
      };

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

            const [prevContent, currContent] = diffContent.split('|SPLIT|'); // Ensure split
            prevColumn.innerHTML = prevContent;
            currColumn.innerHTML = currContent;
          } catch (error) {
            prevColumn.setText('Error displaying diff.');
            currColumn.setText('Error displaying diff.');
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

      // Format the diff as a split view with HTML and color coding
      const leftColumn = diffs
        .map((part) => {
          if (part.removed) {
            const color = 'var(--text-error)';
            const background = 'rgba(255, 0, 0, 0.1)';
            const lineHeight = part.value.split('\n').length * 1.5 + 'em';
            return `<div style="color:${color}; background:${background}; white-space:pre-wrap; height: auto;">${part.value}</div>`;
          }
          if (!part.added) {
            return `<div style="white-space:pre-wrap;">${part.value}</div>`;
          }
          // Add blank lines to match added content in the right column
          const blankLines = part.value.split('\n').length;
          return `<div style="height: ${blankLines * 1.5}em;"></div>`;
        })
        .join('');

      const rightColumn = diffs
        .map((part) => {
          if (part.added) {
            const color = 'var(--text-success)';
            const background = 'rgba(0, 255, 0, 0.1)';
            const lineHeight = part.value.split('\n').length * 1.5 + 'em';
            return `<div style="color:${color}; background:${background}; white-space:pre-wrap; height: auto;">${part.value}</div>`;
          }
          if (!part.removed) {
            return `<div style="white-space:pre-wrap;">${part.value}</div>`;
          }
          // Add blank lines to match removed content in the left column
          const blankLines = part.value.split('\n').length;
          return `<div style="height: ${blankLines * 1.5}em;"></div>`;
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
