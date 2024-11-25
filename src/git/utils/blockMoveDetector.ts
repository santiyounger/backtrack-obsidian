import { DiffPart } from './diffUtils';

export interface BlockMove {
    originalStart: number;
    originalEnd: number;
    newStart: number;
    newEnd: number;
    content: string;
}

export function detectBlockMoves(diffs: DiffPart[]): BlockMove[] {
    const blockMoves: BlockMove[] = [];
    const removedBlocks: { content: string, start: number, end: number }[] = [];
    const addedBlocks: { content: string, start: number, end: number }[] = [];
    
    // Collect consecutive removed and added blocks
    let currentRemoved = { content: '', start: -1, end: -1 };
    let currentAdded = { content: '', start: -1, end: -1 };

    diffs.forEach((part, index) => {
        if (part.removed) {
            if (currentRemoved.start === -1) {
                currentRemoved.start = index;
            }
            currentRemoved.content += part.value;
            currentRemoved.end = index;
        } else if (currentRemoved.start !== -1) {
            removedBlocks.push({ ...currentRemoved });
            currentRemoved = { content: '', start: -1, end: -1 };
        }

        if (part.added) {
            if (currentAdded.start === -1) {
                currentAdded.start = index;
            }
            currentAdded.content += part.value;
            currentAdded.end = index;
        } else if (currentAdded.start !== -1) {
            addedBlocks.push({ ...currentAdded });
            currentAdded = { content: '', start: -1, end: -1 };
        }
    });

    // Add any remaining blocks
    if (currentRemoved.start !== -1) {
        removedBlocks.push(currentRemoved);
    }
    if (currentAdded.start !== -1) {
        addedBlocks.push(currentAdded);
    }

    // Compare blocks for moves
    removedBlocks.forEach(removed => {
        addedBlocks.forEach(added => {
            // Clean and normalize the content for comparison
            const normalizedRemoved = removed.content.trim().replace(/\s+/g, ' ');
            const normalizedAdded = added.content.trim().replace(/\s+/g, ' ');

            if (normalizedRemoved === normalizedAdded) {
                blockMoves.push({
                    originalStart: removed.start,
                    originalEnd: removed.end,
                    newStart: added.start,
                    newEnd: added.end,
                    content: removed.content
                });
            }
        });
    });

    return blockMoves;
} 