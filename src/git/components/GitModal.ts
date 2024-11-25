import { App, Modal, Notice } from 'obsidian';
import * as path from 'path';
import { GitSidebar } from './GitSidebar';
import { GitDiffView } from './GitDiffView';
import { getCommitHistory } from '../utils/gitUtils';

export class GitModal extends Modal {
    private filePath: string;
    private gitSidebar: GitSidebar;
    private gitDiffView: GitDiffView;

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
        this.modalEl.addClass('git-diff-modal'); // Add the unique class for styling
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

            // Fetch commit history for the file
            const commits = await getCommitHistory(dir, this.filePath);

            if (commits.length === 0) {
                contentEl.setText('No commit history found for this file.');
                return;
            }

            // Create the main container for the modal
            const container = contentEl.createDiv({ cls: 'git-modal-container' });

            // Instantiate GitSidebar and render the commit list
            this.gitSidebar = new GitSidebar(container);
            this.gitSidebar.renderCommitList(commits, async (commit, index) => {
                const prevCommitOid = index + 1 < commits.length ? commits[index + 1].oid : null;
                const currentCommitOid = commit.oid;
                await this.gitDiffView.renderDiff(dir, prevCommitOid, currentCommitOid, this.filePath);
            });

            // Instantiate GitDiffView for rendering diffs
            const diffWrapper = container.createDiv({ cls: 'git-diff-wrapper' });

            // Add centered headings for each column
            const headings = diffWrapper.createDiv({ cls: 'git-diff-headings' });
            headings.createDiv({ cls: 'git-diff-heading', text: 'Before' });
            headings.createDiv({ cls: 'git-diff-heading', text: 'After' });

            // Create content area for file diff
            const contentArea = diffWrapper.createDiv({ cls: 'git-content-area' });
            this.gitDiffView = new GitDiffView(contentArea);

            // The first commit will be automatically selected and its diff displayed by GitSidebar
        } catch (error) {
            new Notice('Error displaying commits.');
            console.error(error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
