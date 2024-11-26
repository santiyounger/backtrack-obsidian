export class GitCommitItem {
    private element: HTMLDivElement;
    private static readonly TRUNCATION_LIMIT = 30;

    constructor(
        private commit: any,
        private index: number,
        private onSelect: (commit: any, index: number) => void
    ) {
        this.element = this.createCommitElement();
    }

    private createCommitElement(): HTMLDivElement {
        const commitItem = document.createElement('div');
        commitItem.className = 'commit-item';
        
        const date = new Date(this.commit.commit.author.timestamp * 1000);
        const formattedDate = date.toISOString().split('T')[0].replace(/-/g, '/');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedMonth = monthNames[date.getMonth()];
        const formattedTime = date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
        const formattedDateTime = `${formattedDate.split('/')[0]}/${formattedMonth}/${formattedDate.split('/')[2]} | ${formattedTime.split(':').slice(0, 2).join(':')} | ${formattedTime.split(':')[2]}s`;

        const message = this.truncateMessage(this.commit.commit.message);
        
        commitItem.innerHTML = `
            <strong class="commit-date">${formattedDateTime}</strong>
            <div class="commit-details">
                ${message}<br>
            </div>
        `;

        commitItem.onclick = () => this.onSelect(this.commit, this.index);
        
        return commitItem;
    }

    private truncateMessage(message: string): string {
        return message.length > GitCommitItem.TRUNCATION_LIMIT 
            ? message.substring(0, GitCommitItem.TRUNCATION_LIMIT) + '...' 
            : message;
    }

    getElement(): HTMLDivElement {
        return this.element;
    }

    setSelected(selected: boolean): void {
        if (selected) {
            this.element.addClass('selected');
        } else {
            this.element.removeClass('selected');
        }
    }
}
