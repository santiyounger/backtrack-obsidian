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
    // Initialize git repository if not already initialized
    await git.init({ fs, dir });

    // Read the current file content
    const currentContent = await app.vault.adapter.read(filePath);
    await fs.promises.writeFile(fullPath, currentContent);

    // Get the latest commit for the file
    const commits = await git.log({ fs, dir, filepath: filePath, depth: 1 });
    if (commits.length === 0) {
      throw new Error('No commits found for this file.');
    }

    const latestCommitOid = commits[0].oid;
    const { blob: latestContentBlob } = await git.readBlob({
      fs,
      dir,
      oid: latestCommitOid,
      filepath: filePath,
    });

    const latestContent = new TextDecoder('utf-8').decode(latestContentBlob);

    // Generate diff using `diff` library
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
    throw new Error('Failed to generate git diff.');
  }
}
