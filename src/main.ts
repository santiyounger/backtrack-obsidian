import { Plugin, TAbstractFile, MarkdownView } from 'obsidian';
import { GitModal } from './git/components/GitModal';
import { FileTracker } from './git/utils/FileTracker';
import { DraftKeep } from './git/utils/DraftKeep';

export default class GitDiffPlugin extends Plugin {
  private fileTracker: FileTracker;
  private draftKeep: DraftKeep;

  async onload() {
    const vaultPath = (this.app.vault.adapter as any).getBasePath();
    this.fileTracker = new FileTracker(vaultPath);
    this.draftKeep = new DraftKeep(this.app);

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

    this.addCommand({
      id: 'take-snapshot',
      name: 'Take Snapshot (Save, Commit, Push)',
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
          if (!checking) {
            this.draftKeep.gitStageCommitPush(activeView);
          }
          return true;
        }
        return false;
      }
    });

    this.addRibbonIcon('git-branch', 'Open Git Diff Viewer', () => {
      new GitModal(this.app).open();
    });
  }
}
