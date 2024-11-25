import { Plugin, addIcon } from 'obsidian';
import { GitModal } from './git-modal';

export default class GitDiffPlugin extends Plugin {
  async onload() {
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
