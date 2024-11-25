import { diffLines, diffWords } from 'diff';
import { calculateSimilarity, escapeHtml } from '../utils/diffUtils';
import { getFileContent } from '../utils/gitUtils';

export class GitDiffView {
    constructor(private contentArea: HTMLElement) {}

    async renderDiff(dir: string, prevOid: string | null, currentOid: string, filepath: string): Promise<void> {
        try {
            const currentContent = await getFileContent(dir, currentOid, filepath);
            const prevContent = prevOid ? await getFileContent(dir, prevOid, filepath) : '';

            const lineDiffs = diffLines(prevContent, currentContent);
            const rows = this.generateDiffRows(lineDiffs);
            this.contentArea.innerHTML = rows.join('');
        } catch (error) {
            console.error('Error generating file diff:', error);
            throw new Error('Failed to generate file diff.');
        }
    }

    private generateDiffRows(lineDiffs: any[]): string[] {
        const rows: string[] = [];
        
        lineDiffs.forEach(part => {
            if (part.added || part.removed) {
                // Get the previous and current content
                const prevContent = part.removed ? part.value : '';
                const currentContent = part.added ? part.value : '';
                
                // If both contents exist, or if there's a partial modification
                if ((prevContent && currentContent) || 
                    (prevContent && prevContent.includes(currentContent)) || 
                    (currentContent && currentContent.includes(prevContent))) {
                    
                    // Handle modified lines with word-level diff
                    const wordDiffs = diffWords(prevContent, currentContent);
                    
                    let beforeContent = '';
                    let afterContent = '';
                    
                    wordDiffs.forEach(wordPart => {
                        const escapedValue = escapeHtml(wordPart.value);
                        if (wordPart.removed) {
                            beforeContent += `<span class="diff-word-removed">${escapedValue}</span>`;
                        } else if (wordPart.added) {
                            afterContent += `<span class="diff-word-added">${escapedValue}</span>`;
                        } else {
                            beforeContent += escapedValue;
                            afterContent += escapedValue;
                        }
                    });
                    
                    rows.push(`
                        <div class="diff-row">
                            <div class="diff-before">${beforeContent}</div>
                            <div class="diff-after">${afterContent}</div>
                        </div>
                    `);
                } else {
                    // Handle complete additions or deletions
                    const escapedValue = escapeHtml(part.value);
                    if (part.removed) {
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before"><span class="diff-word-removed">${escapedValue}</span></div>
                                <div class="diff-after"></div>
                            </div>
                        `);
                    } else {
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before"></div>
                                <div class="diff-after"><span class="diff-word-added">${escapedValue}</span></div>
                            </div>
                        `);
                    }
                }
            } else {
                // Handle unchanged lines
                const escapedValue = escapeHtml(part.value);
                rows.push(`
                    <div class="diff-row">
                        <div class="diff-before">${escapedValue}</div>
                        <div class="diff-after">${escapedValue}</div>
                    </div>
                `);
            }
        });
        
        return rows;
    }
} 