export class GitSidebar {
    constructor(private container: HTMLElement) {}

    renderCommitList(commits: any[], onCommitSelect: (commit: any, index: number) => void) {
        const sidebar = this.container.createDiv({ cls: 'git-sidebar' });
        sidebar.setText('Commit History');
        const commitList = sidebar.createDiv({ cls: 'commit-list' });

        let activeCommitItem: HTMLDivElement | null = null;

        commits.forEach((commit, index) => {
            const commitItem = this.createCommitItem(commit, index);
            commitList.appendChild(commitItem);

            commitItem.onclick = () => {
                if (activeCommitItem) {
                    activeCommitItem.removeClass('selected');
                }
                commitItem.addClass('selected');
                activeCommitItem = commitItem;
                onCommitSelect(commit, index);
            };

            if (index === 0) {
                commitItem.click();
            }
        });
    }

    private createCommitItem(commit: any, index: number): HTMLDivElement {
        const commitItem = document.createElement('div');
        commitItem.className = 'commit-item';
        
        const TRUNCATION_LIMIT = 30;
        commitItem.innerHTML = `
            <strong class="commit-date">${new Date(commit.commit.author.timestamp * 1000).toISOString().split('T')[0].replace(/-/g, '/')} - ${new Date(commit.commit.author.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
            <div class="commit-details">
                ${commit.commit.message.length > TRUNCATION_LIMIT ? commit.commit.message.substring(0, TRUNCATION_LIMIT) + '...' : commit.commit.message}<br>
            </div>
        `;
        
        return commitItem;
    }
} 