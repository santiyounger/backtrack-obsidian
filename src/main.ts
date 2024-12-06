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

    // Handle file rename events
    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file.path !== oldPath) {
          this.fileTracker.handleFileRename(oldPath, file.path);
        }
      })
    );

    // Register commands
    this.addCommand({
      id: 'open-git-diff-modal',
      name: 'Open Snapshot History',
      callback: () => {
        new GitModal(this.app).open();
      },
    });

    this.addCommand({
      id: 'take-snapshot',
      name: 'Take Snapshot',
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

    // Add ribbon icon
    this.addRibbonIcon('git-branch', 'Open Snapshot History', () => {
      new GitModal(this.app).open();
    });

    // Apply the correct theme class initially
    this.updateThemeClass();

    // Listen for theme changes and update the theme class
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        this.updateThemeClass();
      })
    );
  }

  /**
   * Updates the theme class on the <html> element based on the active Obsidian theme.
   */
  private updateThemeClass() {
    const rootElement = document.documentElement;
    const bodyClassList = document.body.classList;

    // Check for Obsidian's theme classes and apply corresponding custom classes
    if (bodyClassList.contains('mod-dark')) {
      rootElement.classList.add('theme-dark');
      rootElement.classList.remove('theme-light');
    } else {
      rootElement.classList.add('theme-light');
      rootElement.classList.remove('theme-dark');
    }
  }
}
