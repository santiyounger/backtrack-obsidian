import { App, Modal, Notice } from 'obsidian';
import * as path from 'path';
import { GitSidebar } from './GitSidebar';
import { GitDiffView } from './GitDiffView';
import { getCommitHistory, ReadCommitResult } from '../utils/gitUtils';
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
        this.modalEl.addClass('git-diff-modal');
        
        // Create a header container for title and commit message
        const headerEl = this.titleEl.createDiv({ cls: 'modal-header-container' });
        
        // Move the title text into the container
        const titleTextEl = headerEl.createDiv({ cls: 'modal-title-text' });
        titleTextEl.setText('Backtrack - Version History');
        
        // Create commit message element in the header
        const commitMessageEl = headerEl.createDiv({ cls: 'commit-details' });

        if (!this.filePath) {
            new Notice('No file selected.');
            this.close();
            return;
        }

        try {
            const dir = (this.app.vault.adapter as any).getBasePath();

            const allPaths = this.fileTracker.getAllPathsForFile(this.filePath);
            const commits = await Promise.all(allPaths.map(path => getCommitHistory(dir, path)));
            const allCommits = commits.reduce<ReadCommitResult[]>((acc, curr) => [...acc, ...curr], [])
                .sort((a: ReadCommitResult, b: ReadCommitResult) => 
                    b.commit.author.timestamp - a.commit.author.timestamp
                );

            if (allCommits.length === 0) {
                contentEl.setText('No history found for this file.');
                return;
            }

            const container = contentEl.createDiv({ cls: 'git-modal-container' });
            this.gitSidebar = new GitSidebar(container);
            const diffWrapper = container.createDiv({ cls: 'git-diff-wrapper' });

            const headings = diffWrapper.createDiv({ cls: 'git-diff-headings' });
            headings.createDiv({ cls: 'git-diff-heading', text: 'Before' });
            headings.createDiv({ cls: 'git-diff-heading', text: 'After' });

            const contentArea = diffWrapper.createDiv({ cls: 'git-content-area' });
            this.gitDiffView = new GitDiffView(contentArea);

            this.gitSidebar.renderCommitList(allCommits, async (commit, index) => {
                const prevCommitOid = index + 1 < allCommits.length ? allCommits[index + 1].oid : null;
                const currentCommitOid = commit.oid;
                
                // Update commit message in header
                const isDefaultMessage = commit.commit.message.startsWith('snapshot by Backtrack - Version History - obsidian plugin');
                if (!isDefaultMessage) {
                    commitMessageEl.setText(commit.commit.message);
                    commitMessageEl.style.display = 'block';
                } else {
                    commitMessageEl.style.display = 'none';
                }

                await this.gitDiffView.renderDiff(dir, prevCommitOid, currentCommitOid, this.filePath, allPaths);
            });

            const commitItems = this.contentEl.querySelectorAll('.commit-item');
            if (commitItems.length > 0) {
                const latestCommitItem = commitItems[0] as HTMLElement;
                latestCommitItem.click();
                latestCommitItem.classList.add('is-active');
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
