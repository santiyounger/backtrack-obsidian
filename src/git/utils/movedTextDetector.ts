import { DiffPart } from './diffUtils';
import { calculateSimilarity } from './diffUtils';

export interface MovedTextInfo {
    originalIndex: number;
    newIndex: number;
    content: string;
}

export function detectMovedText(diffs: DiffPart[]): MovedTextInfo[] {
    const movedTexts: MovedTextInfo[] = [];
    const removedParts: { content: string, index: number }[] = [];
    const addedParts: { content: string, index: number }[] = [];

    // First pass: collect removed and added parts
    diffs.forEach((part, index) => {
        if (part.removed) {
            removedParts.push({ content: part.value, index });
        } else if (part.added) {
            addedParts.push({ content: part.value, index });
        }
    });

    // Second pass: detect moved text
    removedParts.forEach(removed => {
        addedParts.forEach(added => {
            const similarity = calculateSimilarity(removed.content, added.content);
            if (similarity > 0.9) { // Threshold for considering text as moved
                movedTexts.push({
                    originalIndex: removed.index,
                    newIndex: added.index,
                    content: removed.content
                });
            }
        });
    });

    return movedTexts;
} 