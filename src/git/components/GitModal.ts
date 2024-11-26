import { App, Modal, Notice } from 'obsidian';
import * as path from 'path';
import { GitSidebar } from './GitSidebar';
import { GitDiffView } from './GitDiffView';
import { getCommitHistory } from '../utils/gitUtils';
import { FileTracker } from '../utils/FileTracker';

export class GitModal extends Modal {
    private filePath: string;
    private gitSidebar: GitSidebar;
    private gitDiffView: GitDiffView;
    private fileTracker: FileTracker;

    constructor(app: App) {
        super(app);
        const vaultPath = (this.app.vault.adapter as any).getBasePath();
        this.fileTracker = new FileTracker(vaultPath);

        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.filePath = activeFile.path;
            this.fileTracker.trackFile(this.filePath);
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

            const allPaths = this.fileTracker.getAllPathsForFile(this.filePath);
            const commits = await Promise.all(allPaths.map(path => getCommitHistory(dir, path)));
            const allCommits = commits.flat().sort((a, b) => 
                b.commit.author.timestamp - a.commit.author.timestamp
            );

            if (allCommits.length === 0) {
                contentEl.setText('No commit history found for this file.');
                return;
            }

            // Create the main container for the modal
            const container = contentEl.createDiv({ cls: 'git-modal-container' });

            // Create sidebar first (left side)
            this.gitSidebar = new GitSidebar(container);

            // Create diff view wrapper (right side)
            const diffWrapper = container.createDiv({ cls: 'git-diff-wrapper' });

            // Add centered headings for each column
            const headings = diffWrapper.createDiv({ cls: 'git-diff-headings' });
            headings.createDiv({ cls: 'git-diff-heading', text: 'Before' });
            headings.createDiv({ cls: 'git-diff-heading', text: 'After' });

            // Create content area and initialize GitDiffView
            const contentArea = diffWrapper.createDiv({ cls: 'git-content-area' });
            this.gitDiffView = new GitDiffView(contentArea);

            // Render the commit list
            this.gitSidebar.renderCommitList(allCommits, async (commit, index) => {
                const prevCommitOid = index + 1 < allCommits.length ? allCommits[index + 1].oid : null;
                const currentCommitOid = commit.oid;
                await this.gitDiffView.renderDiff(dir, prevCommitOid, currentCommitOid, this.filePath, allPaths);
            });

            // After rendering the commits, focus the latest one
            const commitItems = this.contentEl.querySelectorAll('.commit-item');
            if (commitItems.length > 0) {
                const latestCommit = commitItems[0] as HTMLElement; // Cast to HTMLElement
                latestCommit.click();
                latestCommit.classList.add('is-active');
            }
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
