import git from 'isomorphic-git';
import * as fs from 'fs';

export async function getCommitHistory(dir: string, filepath: string) {
    try {
        return await git.log({ fs, dir, filepath });
    } catch (error) {
        console.error('Error fetching commit history:', error);
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
        console.error(`Error reading blob for oid ${oid} and file ${filepath}:`, error);
        return '';
    }
}
