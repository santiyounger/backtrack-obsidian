import { diffLines, diffWords } from 'diff';
import { calculateSimilarity, escapeHtml } from '../utils/diffUtils';
import { getFileContent } from '../utils/gitUtils';

export class GitDiffView {
    constructor(private contentArea: HTMLElement) {}

    async renderDiff(dir: string, prevOid: string | null, currentOid: string, filepath: string): Promise<void> {
        try {
            const currentContent = await getFileContent(dir, currentOid, filepath);
            const prevContent = prevOid ? await getFileContent(dir, prevOid, filepath) : '';

            const diffs = diffLines(prevContent, currentContent);
            const rows = this.generateDiffRows(diffs);
            this.contentArea.innerHTML = rows.join('');
        } catch (error) {
            console.error('Error generating file diff:', error);
            throw new Error('Failed to generate file diff.');
        }
    }

    private generateDiffRows(diffs: any[]): string[] {
        const rows: string[] = [];
        // ... (existing diff generation logic from getFileDiff)
        // Move the complex diff generation logic here
        return rows;
    }
} 