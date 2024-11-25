import { App, Modal, Notice } from 'obsidian';
import git from 'isomorphic-git';
import { diffLines, diffWords } from 'diff'; // Add diffWords import
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

      // Helper function to calculate similarity between two strings
      const calculateSimilarity = (str1: string, str2: string): number => {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) return 1.0;
        
        const editDistance = (str1: string, str2: string): number => {
          const m = str1.length, n = str2.length;
          const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
          
          for (let i = 0; i <= m; i++) dp[i][0] = i;
          for (let j = 0; j <= n; j++) dp[0][j] = j;
          
          for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
              if (str1[i - 1] === str2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
              else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
          }
          return dp[m][n];
        };

        return 1 - editDistance(longer, shorter) / longer.length;
      };

      for (let i = 0; i < diffs.length; i++) {
        const part = diffs[i];
        const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

        if (part.removed && nextPart?.added) {
          // Check if this is a modification rather than a pure removal/addition
          const similarity = calculateSimilarity(part.value, nextPart.value);
          
          if (similarity > 0.5) { // Threshold for considering it a modification
            const partLines = part.value.split('\n');
            const nextPartLines = nextPart.value.split('\n');
            
            if (partLines[partLines.length - 1] === '') partLines.pop();
            if (nextPartLines[nextPartLines.length - 1] === '') nextPartLines.pop();

            partLines.forEach((line, idx) => {
              const beforeLine = `<span class="diff-modified">${this.escapeHtml(line)}</span>`;
              
              if (idx < nextPartLines.length) {
                // Generate word-level diff for the modified lines
                const wordDiffs = diffWords(line, nextPartLines[idx]);
                let afterLine = '<span class="diff-modified">';
                
                wordDiffs.forEach(wordPart => {
                  if (wordPart.added) {
                    afterLine += `<span class="diff-word-added">${this.escapeHtml(wordPart.value)}</span>`;
                  } else if (wordPart.removed) {
                    afterLine += `<span class="diff-word-removed">${this.escapeHtml(wordPart.value)}</span>`;
                  } else {
                    afterLine += this.escapeHtml(wordPart.value);
                  }
                });
                
                afterLine += '</span>';

                rows.push(`
                  <div class="diff-row">
                    <div class="diff-before">${beforeLine}</div>
                    <div class="diff-after">${afterLine}</div>
                  </div>
                `);
              }
            });
            
            i++; // Skip the next part since we've handled it
          } else {
            // Handle as regular removal/addition
            const partLines = part.value.split('\n');
            if (partLines[partLines.length - 1] === '') partLines.pop();
            
            partLines.forEach(line => {
              rows.push(`
                <div class="diff-row">
                  <div class="diff-before"><span class="diff-removed">${this.escapeHtml(line)}</span></div>
                  <div class="diff-after"></div>
                </div>
              `);
            });
          }
        } else if (part.added) {
          const partLines = part.value.split('\n');
          if (partLines[partLines.length - 1] === '') partLines.pop();
          
          partLines.forEach(line => {
            rows.push(`
              <div class="diff-row">
                <div class="diff-before"></div>
                <div class="diff-after"><span class="diff-added">${this.escapeHtml(line)}</span></div>
              </div>
            `);
          });
        } else if (part.removed) {
          const partLines = part.value.split('\n');
          if (partLines[partLines.length - 1] === '') partLines.pop();
          
          partLines.forEach(line => {
            rows.push(`
              <div class="diff-row">
                <div class="diff-before"><span class="diff-removed">${this.escapeHtml(line)}</span></div>
                <div class="diff-after"></div>
              </div>
            `);
          });
        } else {
          // Unchanged lines
          const partLines = part.value.split('\n');
          if (partLines[partLines.length - 1] === '') partLines.pop();
          
          partLines.forEach(line => {
            rows.push(`
              <div class="diff-row">
                <div class="diff-before">${this.escapeHtml(line)}</div>
                <div class="diff-after">${this.escapeHtml(line)}</div>
              </div>
            `);
          });
        }
      }

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
