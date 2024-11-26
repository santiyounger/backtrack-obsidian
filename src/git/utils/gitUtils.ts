import git from 'isomorphic-git';
import * as fs from 'fs';

export async function getCommitHistory(dir: string, filepath: string) {
    try {
        return await git.log({ fs, dir, filepath });
    } catch (error) {
        console.debug(`Unable to fetch history for ${filepath}:`, error);
        return [];
    }
}

export async function getFileContent(dir: string, oid: string, filepath: string): Promise<string> {
    try {
        const { blob } = await git.readBlob({
            fs,
            dir,
            oid,
            filepath,
        });
        return new TextDecoder('utf-8').decode(blob);
    } catch (error) {
        console.debug(`Unable to read content for ${filepath} at ${oid}:`, error);
        return '';
    }
}

export type ReadCommitResult = {
    oid: string;
    commit: {
        author: {
            timestamp: number;
            // ... other author properties ...
        };
        // ... other commit properties ...
    };
};
