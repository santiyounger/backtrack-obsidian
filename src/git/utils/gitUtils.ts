import git from 'isomorphic-git';
import * as fs from 'fs';

export async function getCommitHistory(dir: string, filepath: string) {
    return await git.log({ fs, dir, filepath });
}

export async function getFileContent(dir: string, oid: string, filepath: string) {
    const { blob } = await git.readBlob({
        fs,
        dir,
        oid,
        filepath,
    });
    return new TextDecoder('utf-8').decode(blob);
} 