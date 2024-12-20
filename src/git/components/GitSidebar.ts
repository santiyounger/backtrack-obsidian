import { GitCommitItem } from './GitCommitItem';

export class GitSidebar {
    private sidebarElement: HTMLElement;
    private commitList: HTMLElement;
    private activeCommitItem: GitCommitItem | null = null;
    private commitItems: GitCommitItem[] = [];

    constructor(private container: HTMLElement) {
        this.sidebarElement = this.container.createDiv({ cls: 'git-sidebar' });
        
        // Create commit list first
        this.commitList = this.sidebarElement.createDiv({ cls: 'commit-list' });
        
        // Insert title before the commit list
        const titleElement = this.sidebarElement.insertBefore(
            createDiv({ cls: 'sidebar-title' }), 
            this.commitList
        );
        titleElement.setText('Snapshots History');
    }

    renderCommitList(commits: any[], onCommitSelect: (commit: any, index: number) => void): void {
        this.commitItems = commits.map((commit, index) => {
            const message = commit.commit.message;
            const isDefaultMessage = message.startsWith('snapshot by Backtrack - Version History - obsidian plugin');

            if (isDefaultMessage) {
                // Render only the date and title, leaving the message area empty
                const commitItem = new GitCommitItem({
                    ...commit,
                    commit: {
                        ...commit.commit,
                        message: '' // Set message to empty
                    }
                }, index, (commit, index) => {
                    this.handleCommitSelect(commitItem, commit, index, onCommitSelect);
                });
                this.commitList.appendChild(commitItem.getElement());
                return commitItem;
            } else {
                // Render the full commit item
                const commitItem = new GitCommitItem(commit, index, (commit, index) => {
                    this.handleCommitSelect(commitItem, commit, index, onCommitSelect);
                });
                this.commitList.appendChild(commitItem.getElement());
                return commitItem;
            }
        });

        if (this.commitItems.length > 0) {
            this.commitItems[0].getElement().click();
        }
    }

    private handleCommitSelect(
        selectedItem: GitCommitItem,
        commit: any,
        index: number,
        onCommitSelect: (commit: any, index: number) => void
    ): void {
        if (this.activeCommitItem) {
            this.activeCommitItem.setSelected(false);
        }
        selectedItem.setSelected(true);
        this.activeCommitItem = selectedItem;
        onCommitSelect(commit, index);
    }
}
