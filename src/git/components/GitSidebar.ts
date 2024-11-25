import { GitCommitItem } from './GitCommitItem';

export class GitSidebar {
    private sidebarElement: HTMLElement;
    private commitList: HTMLElement;
    private activeCommitItem: GitCommitItem | null = null;
    private commitItems: GitCommitItem[] = [];

    constructor(private container: HTMLElement) {
        this.initializeSidebar();
    }

    private initializeSidebar(): void {
        this.sidebarElement = this.container.createDiv({ cls: 'git-sidebar' });
        this.sidebarElement.setText('Commit History');
        this.commitList = this.sidebarElement.createDiv({ cls: 'commit-list' });
    }

    renderCommitList(commits: any[], onCommitSelect: (commit: any, index: number) => void): void {
        this.commitItems = commits.map((commit, index) => {
            const commitItem = new GitCommitItem(commit, index, (commit, index) => {
                this.handleCommitSelect(commitItem, commit, index, onCommitSelect);
            });
            this.commitList.appendChild(commitItem.getElement());
            return commitItem;
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