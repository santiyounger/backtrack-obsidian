import { diffLines, diffWords } from 'diff';
import { escapeHtml, calculateSimilarity } from '../utils/diffUtils';
import { getFileContent } from '../utils/gitUtils';
import { detectMovedText, MovedTextInfo } from '../utils/movedTextDetector';

export class GitDiffView {
    constructor(private contentArea: HTMLElement) {}

    async renderDiff(dir: string, prevOid: string | null, currentOid: string, filepath: string, allPaths: string[]): Promise<void> {
        try {
            // Try to get content using each possible path until successful
            let currentContent = '';
            let prevContent = '';

            for (const path of allPaths) {
                try {
                    currentContent = await getFileContent(dir, currentOid, path);
                    if (currentContent) break;
                } catch (e) {
                    continue;
                }
            }

            if (prevOid) {
                for (const path of allPaths) {
                    try {
                        prevContent = await getFileContent(dir, prevOid, path);
                        if (prevContent) break;
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Generate the diff for the split view
            const diffs = diffLines(prevContent, currentContent);

            // Initialize arrays to hold the HTML for each row
            const beforeRows: string[] = [];
            const afterRows: string[] = [];

            const movedTexts = detectMovedText(diffs);

            for (let i = 0; i < diffs.length; i++) {
                const part = diffs[i];
                const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

                if (part.removed && nextPart?.added) {
                    const similarity = calculateSimilarity(part.value, nextPart.value);

                    if (similarity < 0.3) {
                        // Get the lines from both parts
                        const beforeLines = part.value.trim().split('\n').filter(line => line !== '');
                        const afterLines = nextPart.value.trim().split('\n').filter(line => line !== '');
                        
                        // Use the longer array's length to determine how many rows we need
                        const maxLines = Math.max(beforeLines.length, afterLines.length);
                        
                        // Create rows with corresponding before/after lines aligned
                        for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
                            const beforeLine = beforeLines[lineIndex] || '';
                            const afterLine = afterLines[lineIndex] || '';
                            
                            beforeRows.push(`<div class="diff-row"><div class="diff-before"><span class="empty-line"> </span></div></div>`);
                            afterRows.push(`
                                <div class="diff-row">
                                    <div class="diff-after">
                                        <span class="${movedTexts.some(moved => moved.newIndex === i) ? 'diff-moved' : 'diff-added'}">${escapeHtml(afterLine)}</span>
                                    </div>
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

                        beforeRows.push(`<div class="diff-row"><div class="diff-before">${beforeLine}</div></div>`);
                        afterRows.push(`<div class="diff-row"><div class="diff-after">${afterLine}</div></div>`);
                    }

                    i++;
                } else if (part.added) {
                    const partLines = part.value.trim().split('\n').filter(line => line !== '');
                    const isMovedText = movedTexts.some(moved => moved.newIndex === i);

                    partLines.forEach(line => {
                        beforeRows.push(`<div class="diff-row"><div class="diff-before"><span class="empty-line"> </span></div></div>`);
                        afterRows.push(`
                            <div class="diff-row">
                                <div class="diff-after">
                                    <span class="${isMovedText ? 'diff-moved' : 'diff-added'}">${escapeHtml(line)}</span>
                                </div>
                            </div>
                        `);
                    });
                } else if (part.removed) {
                    const partLines = part.value.trim().split('\n').filter(line => line !== '');
                    const isMovedText = movedTexts.some(moved => moved.originalIndex === i);

                    partLines.forEach(line => {
                        beforeRows.push(`
                            <div class="diff-row">
                                <div class="diff-before">
                                    <span class="${isMovedText ? 'diff-moved' : 'diff-removed'}">${escapeHtml(line)}</span>
                                </div>
                            </div>
                        `);
                        afterRows.push(`<div class="diff-row"><div class="diff-after"><span class="empty-line"> </span></div></div>`);
                    });
                } else {
                    const partLines = part.value.trim().split('\n').filter(line => line !== '');

                    partLines.forEach(line => {
                        beforeRows.push(`<div class="diff-row"><div class="diff-before">${escapeHtml(line)}</div></div>`);
                        afterRows.push(`<div class="diff-row"><div class="diff-after">${escapeHtml(line)}</div></div>`);
                    });
                }
            }

            // Wrap the content in selection containers
            this.contentArea.innerHTML = `
                <div class="git-diff-content">
                    <div class="selection-container before">
                        ${beforeRows.join('')}
                    </div>
                    <div class="selection-container after">
                        ${afterRows.join('')}
                    </div>
                </div>
            `;

            // Synchronize scrolling
            const beforeContainer = this.contentArea.querySelector('.selection-container.before');
            const afterContainer = this.contentArea.querySelector('.selection-container.after');

            if (beforeContainer && afterContainer) {
                beforeContainer.addEventListener('scroll', () => {
                    afterContainer.scrollTop = beforeContainer.scrollTop;
                });

                afterContainer.addEventListener('scroll', () => {
                    beforeContainer.scrollTop = afterContainer.scrollTop;
                });
            }

        } catch (error) {
            console.error('Error generating file diff:', error);
            this.contentArea.setText('Failed to generate file diff.');
        }
    }
}
