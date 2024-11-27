import { diffLines, diffWords } from 'diff';
import { escapeHtml, calculateSimilarity } from '../utils/diffUtils';
import { getFileContent } from '../utils/gitUtils';
import { detectMovedText, MovedTextInfo } from '../utils/movedTextDetector';

export class GitDiffView {
    constructor(private contentArea: HTMLElement) {
        this.contentArea.addEventListener('click', this.handleClick.bind(this));

        // Add event listeners for the headings
        const beforeHeading = this.contentArea.querySelector('.git-diff-heading.before');
        const afterHeading = this.contentArea.querySelector('.git-diff-heading.after');

        if (beforeHeading) {
            beforeHeading.addEventListener('click', () => this.setSelectionMode('before'));
        }
        if (afterHeading) {
            afterHeading.addEventListener('click', () => this.setSelectionMode('after'));
        }
    }

    private handleClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const diffBefore = target.closest('.diff-before');
        const diffAfter = target.closest('.diff-after');

        if (diffBefore) {
            this.setSelectionMode('before');
        } else if (diffAfter) {
            this.setSelectionMode('after');
        }
    }

    private setSelectionMode(mode: 'before' | 'after'): void {
        const diffBeforeElements = this.contentArea.querySelectorAll('.diff-before');
        const diffAfterElements = this.contentArea.querySelectorAll('.diff-after');

        if (mode === 'before') {
            diffBeforeElements.forEach(el => {
                el.classList.add('selectable');
                el.classList.remove('non-selectable');
            });
            diffAfterElements.forEach(el => {
                el.classList.remove('selectable');
                el.classList.add('non-selectable');
            });
        } else if (mode === 'after') {
            diffBeforeElements.forEach(el => {
                el.classList.remove('selectable');
                el.classList.add('non-selectable');
            });
            diffAfterElements.forEach(el => {
                el.classList.add('selectable');
                el.classList.remove('non-selectable');
            });
        }
    }

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

            // Initialize an array to hold the HTML for each row
            const rows: string[] = [];

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
                } else if (part.removed) {
                    const partLines = part.value.trim().split('\n').filter(line => line !== '');
                    const isMovedText = movedTexts.some(moved => moved.originalIndex === i);

                    partLines.forEach(line => {
                        rows.push(`
                            <div class="diff-row">
                                <div class="diff-before">
                                    <span class="${isMovedText ? 'diff-moved' : 'diff-removed'}">${escapeHtml(line)}</span>
                                </div>
                                <div class="diff-after"></div>
                            </div>
                        `);
                    });
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
