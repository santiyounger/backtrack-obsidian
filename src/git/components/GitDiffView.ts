import { diffLines, diffWords } from 'diff';
import { escapeHtml, calculateSimilarity } from '../utils/diffUtils';
import { getFileContent } from '../utils/gitUtils';

export class GitDiffView {
    constructor(private contentArea: HTMLElement) {}

    async renderDiff(dir: string, prevOid: string | null, currentOid: string, filepath: string): Promise<void> {
        try {
            const currentContent = await getFileContent(dir, currentOid, filepath);
            const prevContent = prevOid ? await getFileContent(dir, prevOid, filepath) : '';

            // Generate the diff for the split view
            const diffs = diffLines(prevContent, currentContent);

            // Initialize an array to hold the HTML for each row
            const rows: string[] = [];

            for (let i = 0; i < diffs.length; i++) {
                const part = diffs[i];
                const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

                if (part.removed && nextPart?.added) {
                    // Check if this is a modification rather than a pure removal/addition
                    const similarity = calculateSimilarity(part.value, nextPart.value);
                    
                    if (similarity > 0.5) { // Threshold for considering it a modification
                        const partLines = part.value.split('\n').filter(line => line !== '');
                        const nextPartLines = nextPart.value.split('\n').filter(line => line !== '');

                        partLines.forEach((line, idx) => {
                            if (idx < nextPartLines.length) {
                                // Generate word-level diff for the modified lines
                                const wordDiffs = diffWords(line, nextPartLines[idx]);
                                
                                // Build the before line (with removed words in red)
                                let beforeLine = '';
                                wordDiffs.forEach(wordPart => {
                                    if (wordPart.removed) {
                                        beforeLine += `<span class="diff-word-removed">${escapeHtml(wordPart.value)}</span>`;
                                    } else if (!wordPart.added) {
                                        beforeLine += escapeHtml(wordPart.value);
                                    }
                                });

                                // Build the after line (with added words in green)
                                let afterLine = '';
                                wordDiffs.forEach(wordPart => {
                                    if (wordPart.added) {
                                        afterLine += `<span class="diff-word-added">${escapeHtml(wordPart.value)}</span>`;
                                    } else if (!wordPart.removed) {
                                        afterLine += escapeHtml(wordPart.value);
                                    }
                                });

                                rows.push(`
                                    <div class="diff-row">
                                        <div class="diff-before">${beforeLine}</div>
                                        <div class="diff-after">${afterLine}</div>
                                    </div>
                                `);
                            }
                        });

                        i++; // Skip the next part since we've handled it
                    } else {
                        // Handle as regular removal/addition
                        const partLines = part.value.split('\n').filter(line => line !== '');
                        
                        partLines.forEach(line => {
                            rows.push(`
                                <div class="diff-row">
                                    <div class="diff-before"><span class="diff-removed">${escapeHtml(line)}</span></div>
                                    <div class="diff-after"></div>
                                </div>
                            `);
                        });
                    }
                } else if (part.added) {
                    const partLines = part.value.split('\n').filter(line => line !== '');
                    
                    partLines.forEach(line => {
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before"></div>
                                <div class="diff-after"><span class="diff-added">${escapeHtml(line)}</span></div>
                            </div>
                        `);
                    });
                } else if (part.removed) {
                    const partLines = part.value.split('\n').filter(line => line !== '');
                    
                    partLines.forEach(line => {
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before"><span class="diff-removed">${escapeHtml(line)}</span></div>
                                <div class="diff-after"></div>
                            </div>
                        `);
                    });
                } else {
                    // Unchanged lines
                    const partLines = part.value.split('\n').filter(line => line !== '');
                    
                    partLines.forEach(line => {
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before">${escapeHtml(line)}</div>
                                <div class="diff-after">${escapeHtml(line)}</div>
                            </div>
                        `);
                    });
                }
            }

            this.contentArea.innerHTML = rows.join('');
        } catch (error) {
            console.error('Error generating file diff:', error);
            this.contentArea.setText('Failed to generate file diff.');
        }
    }
}
