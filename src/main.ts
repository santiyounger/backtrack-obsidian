import { Plugin, TAbstractFile } from 'obsidian';
import { GitModal } from './git/components/GitModal';
import { FileTracker } from './git/utils/FileTracker';

export default class GitDiffPlugin extends Plugin {
  private fileTracker: FileTracker;

  async onload() {
    const vaultPath = (this.app.vault.adapter as any).getBasePath();
    this.fileTracker = new FileTracker(vaultPath);

    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file.path !== oldPath) {
          this.fileTracker.handleFileRename(oldPath, file.path);
        }
      })
    );

    this.addCommand({
      id: 'open-git-diff-modal',
      name: 'Open Git Diff Viewer',
      callback: () => {
        new GitModal(this.app).open();
      },
    });

    this.addRibbonIcon('git-branch', 'Open Git Diff Viewer', () => {
      new GitModal(this.app).open();
    });
  }
}
