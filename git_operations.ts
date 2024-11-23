// git_operations.ts

import git from 'isomorphic-git';
import LightningFS from '@isomorphic-git/lightning-fs';
import { App } from 'obsidian';
import { Diff } from 'diff';

const fs = new LightningFS('fs');

export async function getGitDiff(app: App, filePath: string): Promise<string> {
  const dir = '/';
  const vaultPath = app.vault.adapter.getBasePath();
  const fullPath = `${vaultPath}/${filePath}`;

  try {
    // Initialize git if not already initialized
    await git.init({ fs, dir });

    // Read file content into the in-memory fs
    const currentContent = await app.vault.adapter.read(filePath);
    await fs.promises.writeFile(fullPath, currentContent);

    // Fetch the latest commit content for the file
    const commits = await git.log({ fs, dir, filepath: filePath, depth: 1 });
    if (commits.length === 0) {
      throw new Error('No commits found for the current file.');
    }

    const latestCommitOid = commits[0].oid;
    const { blob: latestContentBlob } = await git.readBlob({
      fs,
      dir,
      oid: latestCommitOid,
      filepath: filePath,
    });

    const latestContent = new TextDecoder('utf-8').decode(latestContentBlob);

    // Generate the diff
    const diffs = Diff.diffLines(latestContent, currentContent);
    return diffs
      .map((part) => {
        const color = part.added ? 'green' : part.removed ? 'red' : 'black';
        const background = part.added
          ? 'rgba(0, 255, 0, 0.1)'
          : part.removed
          ? 'rgba(255, 0, 0, 0.1)'
          : 'transparent';
        return `<div style="color:${color}; background:${background}; white-space:pre-wrap;">${part.value}</div>`;
      })
      .join('');
  } catch (error) {
    console.error('Error generating git diff:', error);
    throw new Error('Unable to generate git diff.');
  }
}
