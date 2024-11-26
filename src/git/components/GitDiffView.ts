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
                    const similarity = calculateSimilarity(part.value, nextPart.value);

                    if (similarity < 0.3) {
                        const beforeLines = part.value.trim().split('\n').filter(line => line !== '');
                        const afterLines = nextPart.value.trim().split('\n').filter(line => line !== '');
                        
                        // Match lines one-to-one when possible
                        const maxLines = Math.max(beforeLines.length, afterLines.length);
                        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
                            const beforeLine = beforeLines[lineIndex] || '';
                            const afterLine = afterLines[lineIndex] || '';
                            
                            rows.push(`
                                <div class="diff-row">
                                    <div class="diff-before">${beforeLine ? `<span class="diff-removed">${escapeHtml(beforeLine)}</span>` : ''}</div>
                                    <div class="diff-after">${afterLine ? `<span class="diff-added">${escapeHtml(afterLine)}</span>` : ''}</div>
                                </div>
                            `);
                        }
                    } else {
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
                    }

                    i++;
                } else if (part.added) {
                    const partLines = part.value.trim().split('\n').filter(line => line !== '');
                    const isMovedText = movedTexts.some(moved => moved.newIndex === i);

                    partLines.forEach(line => {
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before"></div>
                                <div class="diff-after">
                                    <span class="${isMovedText ? 'diff-moved' : 'diff-added'}">${escapeHtml(line)}</span>
                                </div>
                            </div>
                        `);
                    });
                } else if (part.removed && i < diffs.length - 1 && diffs[i + 1].added) {
                    const nextPart = diffs[i + 1];
                    const similarity = calculateSimilarity(part.value, nextPart.value);
                    const isMovedText = movedTexts.some(moved => moved.originalIndex === i);

                    if (similarity < 0.3 && !isMovedText) {
                        const beforeLine = part.value.trim();
                        const afterLine = nextPart.value.trim();
                        
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before"><span class="diff-removed">${escapeHtml(beforeLine)}</span></div>
                                <div class="diff-after"><span class="diff-added">${escapeHtml(afterLine)}</span></div>
                            </div>
                        `);
                        i++; // Skip the next part since we've handled it here
                    }
                } else {
                    const partLines = part.value.trim().split('\n').filter(line => line !== '');

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
