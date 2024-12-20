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
        const commitMessageEl = headerEl.createDiv({ cls: 'commit-details-top' });

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
            const beforeButton = headings.createEl('button', { cls: 'git-diff-heading before', text: 'Before' });
            const afterButton = headings.createEl('button', { cls: 'git-diff-heading after', text: 'After' });

            const contentArea = diffWrapper.createDiv({ cls: 'git-content-area' });
            this.gitDiffView = new GitDiffView(contentArea);

            // Function to clear text selection
            const clearSelection = () => {
                if (window.getSelection) {
                    const selection = window.getSelection();
                    if (selection) {
                        selection.removeAllRanges();
                    }
                }
            };

            // Initialize selection mode
            let currentMode: 'before' | 'after' | null = null;

            const setMode = (mode: 'before' | 'after' | null) => {
                clearSelection(); // Clear selection when changing modes
                currentMode = mode;
                if (mode === 'before') {
                    diffWrapper.classList.add('select-before');
                    diffWrapper.classList.remove('select-after');
                    beforeButton.classList.add('active');
                    afterButton.classList.remove('active');
                } else if (mode === 'after') {
                    diffWrapper.classList.add('select-after');
                    diffWrapper.classList.remove('select-before');
                    afterButton.classList.add('active');
                    beforeButton.classList.remove('active');
                } else {
                    diffWrapper.classList.remove('select-before', 'select-after');
                    beforeButton.classList.remove('active');
                    afterButton.classList.remove('active');
                }
            };

            beforeButton.addEventListener('click', () => {
                setMode(currentMode === 'before' ? null : 'before');
            });

            afterButton.addEventListener('click', () => {
                setMode(currentMode === 'after' ? null : 'after');
            });

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

                // Reset selection mode when a new commit is selected
                setMode(null);
            });

            const commitItems = this.contentEl.querySelectorAll('.commit-item');
            if (commitItems.length > 0) {
                const latestCommitItem = commitItems[0] as HTMLElement;
                latestCommitItem.click();
                latestCommitItem.classList.add('is-active');
            }

            // Add event listener for copy event
            document.addEventListener('copy', (event) => {
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) return;
            
                const range = selection.getRangeAt(0);
                const activeColumnClass = currentMode === 'before' ? 'diff-before' : 'diff-after';
            
                const tempContainer = document.createElement('div');
                tempContainer.appendChild(range.cloneContents());
            
                const filteredContent = Array.from(tempContainer.querySelectorAll(`.${activeColumnClass}`))
                    .map(node => node.textContent)
                    .filter(text => text && text.length > 0)
                    .map(text => text ? text.trim() : '') // Trim leading/trailing spaces on each block
                    .join('\n\n'); // Use double line breaks between blocks
            
                if (filteredContent) {
                    event.clipboardData?.setData('text/plain', filteredContent);
                    event.preventDefault();
                }
            });
            
            
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
