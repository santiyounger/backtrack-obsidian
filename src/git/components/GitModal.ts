import { App, Modal, Notice } from 'obsidian';
import * as path from 'path';
import { GitSidebar } from './GitSidebar';
import { GitDiffView } from './GitDiffView';
import { getCommitHistory } from '../utils/gitUtils';
import { FileTracker } from '../utils/fileTracking';
import { ReadCommitResult } from 'isomorphic-git';

export class GitModal extends Modal {
    private filePath: string;
    private fileId: string;
    private fileTracker: FileTracker;
    private gitSidebar: GitSidebar;
    private gitDiffView: GitDiffView;

    constructor(app: App) {
        super(app);
        this.fileTracker = new FileTracker(app);

        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.filePath = activeFile.path;
            this.fileId = this.fileTracker.getFileId(this.filePath) || '';
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
                : path.resolve('.');

            // Get all historical paths for this file
            const allPaths = this.fileTracker.getAllPaths(this.fileId);
            
            // Fetch commit history for all paths
            const allCommits: ReadCommitResult[][] = await Promise.all(
                allPaths.map(path => getCommitHistory(dir, path))
            );

            // Merge and sort commits by timestamp, removing duplicates
            const commits = Array.from(new Set(
                allCommits.reduce((acc, curr) => [...acc, ...curr], [])
                    .map(commit => JSON.stringify(commit)) // Convert to string for deduplication
            ))
            .map(commitStr => JSON.parse(commitStr)) // Convert back to objects
            .sort((a: ReadCommitResult, b: ReadCommitResult) => 
                b.commit.author.timestamp - a.commit.author.timestamp
            );

            if (commits.length === 0) {
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
            this.gitSidebar.renderCommitList(commits, async (commit, index) => {
                const prevCommitOid = index + 1 < commits.length ? commits[index + 1].oid : null;
                const currentCommitOid = commit.oid;
                await this.gitDiffView.renderDiff(dir, prevCommitOid, currentCommitOid, this.filePath);
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
