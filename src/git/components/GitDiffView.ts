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
                    // Find the common prefix and suffix
                    const oldText = part.value;
                    const newText = nextPart.value;
                    
                    // Find common prefix length
                    let prefixLength = 0;
                    while (prefixLength < oldText.length && 
                           prefixLength < newText.length && 
                           oldText[prefixLength] === newText[prefixLength]) {
                        prefixLength++;
                    }
                    
                    // Find common suffix length
                    let suffixLength = 0;
                    while (suffixLength < oldText.length - prefixLength && 
                           suffixLength < newText.length - prefixLength && 
                           oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]) {
                        suffixLength++;
                    }
                    
                    // Extract the modified portions
                    const removedPortion = oldText.slice(prefixLength, oldText.length - suffixLength);
                    const addedPortion = newText.slice(prefixLength, newText.length - suffixLength);
                    
                    // Build the before line
                    const beforeLine = 
                        escapeHtml(oldText.slice(0, prefixLength)) +
                        `<span class="diff-word-removed">${escapeHtml(removedPortion)}</span>` +
                        escapeHtml(oldText.slice(oldText.length - suffixLength));
                        
                    // Build the after line
                    const afterLine = 
                        escapeHtml(newText.slice(0, prefixLength)) +
                        `<span class="diff-word-added">${escapeHtml(addedPortion)}</span>` +
                        escapeHtml(newText.slice(newText.length - suffixLength));
                    
                    rows.push(`
                        <div class="diff-row">
                            <div class="diff-before">${beforeLine}</div>
                            <div class="diff-after">${afterLine}</div>
                        </div>
                    `);
                    
                    i++; // Skip the next part since we've handled it
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
