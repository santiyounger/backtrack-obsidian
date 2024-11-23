import { App, Plugin } from 'obsidian';
import { GitModal } from './git-modal';

export default class GitDiffPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'open-git-diff-modal',
      name: 'Open Git Diff Modal',
      callback: () => {
        new GitModal(this.app).open();
      },
    });
  }
}
