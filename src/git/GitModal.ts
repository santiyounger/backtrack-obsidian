import { App, Modal, Notice } from 'obsidian';
import * as path from 'path';
import { GitDiffView } from './components/GitDiffView';
import { GitSidebar } from './components/GitSidebar';
import { getCommitHistory } from './utils/gitUtils';

export class GitModal extends Modal {
    private filePath: string;
    private diffView: GitDiffView;
    private sidebar: GitSidebar;

    constructor(app: App) {
        super(app);

        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.filePath = activeFile.path;
        } else {
            new Notice('No active file selected for diff.');
            this.close();
        }
    }

    async onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass('git-diff-modal');
        this.titleEl.setText('Draft Keep History');

        if (!this.filePath) {
            new Notice('No file selected.');
            this.close();
            return;
        }

        try {
            const dir = (this.app.vault.adapter as any).getBasePath
                ? (this.app.vault.adapter as any).getBasePath()
                : path.resolve('.');

            const commits = await getCommitHistory(dir, this.filePath);

            if (commits.length === 0) {
                contentEl.setText('No commit history found for this file.');
                return;
            }

            const container = contentEl.createDiv({ cls: 'git-modal-container' });
            
            // Initialize components
            this.sidebar = new GitSidebar(container);
            const diffWrapper = this.createDiffWrapper(container);
            const contentArea = diffWrapper.createDiv({ cls: 'git-content-area' });
            this.diffView = new GitDiffView(contentArea);

            // Setup commit list with callback
            this.sidebar.renderCommitList(commits, async (commit, index) => {
                const prevCommitOid = index + 1 < commits.length ? commits[index + 1].oid : null;
                await this.diffView.renderDiff(dir, prevCommitOid, commit.oid, this.filePath);
            });

        } catch (error) {
            new Notice('Error displaying commits.');
            console.error(error);
        }
    }

    private createDiffWrapper(container: HTMLElement): HTMLElement {
        const diffWrapper = container.createDiv({ cls: 'git-diff-wrapper' });
        const headings = diffWrapper.createDiv({ cls: 'git-diff-headings' });
        headings.createDiv({ cls: 'git-diff-heading', text: 'Before' });
        headings.createDiv({ cls: 'git-diff-heading', text: 'After' });
        return diffWrapper;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 