import { diffLines, diffWords } from 'diff';
import { escapeHtml, calculateSimilarity } from '../utils/diffUtils';
import { getFileContent } from '../utils/gitUtils';
import { detectMovedText, MovedTextInfo } from '../utils/movedTextDetector';

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

            const movedTexts = detectMovedText(diffs);

            for (let i = 0; i < diffs.length; i++) {
                const part = diffs[i];
                const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

                if (part.removed && nextPart?.added) {
                    // Use diffWords instead of character-by-character comparison
                    const wordDiffs = diffWords(part.value, nextPart.value);
                    
                    let beforeLine = '';
                    let afterLine = '';
                    
                    wordDiffs.forEach(diff => {
                        if (diff.removed) {
                            beforeLine += `<span class="diff-word-removed">${escapeHtml(diff.value)}</span>`;
                        } else if (diff.added) {
                            afterLine += `<span class="diff-word-added">${escapeHtml(diff.value)}</span>`;
                        } else {
                            beforeLine += escapeHtml(diff.value);
                            afterLine += escapeHtml(diff.value);
                        }
                    });
                    
                    rows.push(`
                        <div class="diff-row">
                            <div class="diff-before">${beforeLine}</div>
                            <div class="diff-after">${afterLine}</div>
                        </div>
                    `);
                    
                    i++; // Skip the next part since we've handled it
                } else if (part.added) {
                    const partLines = part.value.split('\n').filter(line => line !== '');
                    const isMovedText = movedTexts.some(moved => moved.newIndex === i);
                    
                    partLines.forEach(line => {
                        rows.push(
                            `<div class="diff-row"><div class="diff-before"></div><div class="diff-after"><span class="${isMovedText ? 'diff-moved' : 'diff-added'}">${escapeHtml(line)}</span></div></div>`
                        );
                    });
                } else if (part.removed) {
                    const partLines = part.value.split('\n').filter(line => line !== '');
                    const isMovedText = movedTexts.some(moved => moved.originalIndex === i);
                    
                    partLines.forEach(line => {
                        rows.push(
                            `<div class="diff-row"><div class="diff-before"><span class="${isMovedText ? 'diff-moved' : 'diff-removed'}">${escapeHtml(line)}</span></div><div class="diff-after"></div></div>`
                        );
                    });
                } else {
                    // Unchanged lines
                    const partLines = part.value.split('\n').filter(line => line !== '');
                    
                    partLines.forEach(line => {
                        rows.push(
                            `<div class="diff-row"><div class="diff-before">${escapeHtml(line)}</div><div class="diff-after">${escapeHtml(line)}</div></div>`
                        );
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
