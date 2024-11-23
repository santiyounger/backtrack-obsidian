import { App, Modal, Notice } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitModal extends Modal {
  filePath: string;
  commits: Array<{ hash: string; message: string; date: string }> = [];

  constructor(app: App) {
    super(app);
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.filePath = activeFile.path;
    } else {
      new Notice('No active file to show git diffs for.');
      this.close();
    }
  }

  async onOpen() {
    this.titleEl.setText('Git Diff Viewer');
    if (!this.filePath) return;

    // Check if git is available and if the vault is a git repository
    const gitAvailable = await this.checkGitAvailable();
    if (!gitAvailable) return;
    const isGitRepo = await this.checkGitRepository();
    if (!isGitRepo) return;

    // Create container elements
    const { contentEl } = this;

    const container = contentEl.createDiv({ cls: 'git-diff-container' });
    const sidebar = container.createDiv({ cls: 'git-diff-sidebar' });
    const diffView = container.createDiv({ cls: 'git-diff-view' });

    // Load commits
    await this.loadCommits();

    // Populate sidebar with commits
    for (const commit of this.commits) {
      const commitEl = sidebar.createDiv({ cls: 'git-commit-item' });
      const commitHashEl = commitEl.createEl('div', {
        cls: 'git-commit-hash',
        text: commit.hash.substring(0, 7),
      });
      const commitMessageEl = commitEl.createEl('div', {
        cls: 'git-commit-message',
        text: commit.message,
      });
      const commitDateEl = commitEl.createEl('div', {
        cls: 'git-commit-date',
        text: commit.date,
      });

      commitEl.addEventListener('click', async () => {
        // Load diff for this commit
        const diff = await this.getDiff(commit.hash);
        diffView.empty();
        const pre = diffView.createEl('pre');
        const code = pre.createEl('code', { cls: 'language-diff' });
        code.setText(diff);
      });
    }

    // Apply styles
    this.applyStyles();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  async checkGitAvailable() {
    try {
      await execAsync('git --version', {
        cwd: this.app.vault.adapter.getBasePath(),
      });
      return true;
    } catch (error) {
      new Notice('Git is not installed or not available in PATH.');
      this.close();
      return false;
    }
  }

  async checkGitRepository() {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: this.app.vault.adapter.getBasePath(),
      });
      return true;
    } catch (error) {
      new Notice('Current vault is not a git repository.');
      this.close();
      return false;
    }
  }

  async loadCommits() {
    try {
      const maxCommits = 100;
      const { stdout, stderr } = await execAsync(
        `git log -n ${maxCommits} --pretty=format:"%H|%ad|%s" --date=short -- "${this.filePath}"`,
        { cwd: this.app.vault.adapter.getBasePath() }
      );
      if (stderr) {
        console.error(stderr);
        new Notice('Error fetching git commits.');
        return;
      }
      const lines = stdout.split('\n');
      this.commits = lines.map((line) => {
        const [hash, date, message] = line.split('|');
        return { hash, date, message };
      });
    } catch (error) {
      console.error(error);
      new Notice('Error fetching git commits.');
    }
  }

  async getDiff(hash: string) {
    try {
      const { stdout, stderr } = await execAsync(
        `git diff ${hash}~ ${hash} -- "${this.filePath}"`,
        { cwd: this.app.vault.adapter.getBasePath() }
      );
      if (stderr) {
        console.error(stderr);
        new Notice('Error fetching git diff.');
        return '';
      }
      return stdout;
    } catch (error) {
      console.error(error);
      new Notice('Error fetching git diff.');
      return '';
    }
  }

  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .git-diff-container {
        display: flex;
        height: 100%;
      }
      .git-diff-sidebar {
        width: 30%;
        overflow-y: auto;
        border-right: 1px solid var(--background-modifier-border);
      }
      .git-diff-view {
        width: 70%;
        padding: 10px;
        overflow-y: auto;
      }
      .git-commit-item {
        padding: 10px;
        cursor: pointer;
        border-bottom: 1px solid var(--background-modifier-border);
      }
      .git-commit-item:hover {
        background-color: var(--background-modifier-hover);
      }
      .git-commit-hash {
        font-weight: bold;
      }
      .git-commit-message {
        margin-top: 5px;
      }
      .git-commit-date {
        font-size: 0.8em;
        color: var(--text-muted);
      }
      pre {
        white-space: pre-wrap;
      }
    `;
    this.contentEl.appendChild(style);
  }
}
