import git from 'isomorphic-git';
import { App } from 'obsidian';
import { diffLines } from 'diff'; // Correct import for diffLines
import * as fs from 'fs';
import * as path from 'path';

export async function getGitDiff(app: App, filePath: string): Promise<string> {
  // Get the absolute path to the vault root
  const dir = (app.vault.adapter as any).getBasePath
    ? (app.vault.adapter as any).getBasePath()
    : path.resolve('.'); // Fallback if `getBasePath` is not available

  const relativeFilePath = filePath; // File path relative to the vault root

  try {
    // Read the current content of the file
    const currentContent = await app.vault.adapter.read(relativeFilePath);

    // Get the latest commit for the file
    const commits = await git.log({ fs, dir, filepath: relativeFilePath, depth: 1 });
    if (commits.length === 0) {
      throw new Error('No commits found for this file.');
    }

    const latestCommitOid = commits[0].oid;
    const { blob: latestContentBlob } = await git.readBlob({
      fs,
      dir,
      oid: latestCommitOid,
      filepath: relativeFilePath,
    });

    const latestContent = new TextDecoder('utf-8').decode(latestContentBlob);

    // Generate the diff using the `diff` library
    const diffs = diffLines(latestContent, currentContent); // Fixed `diffLines` import
    return diffs
      .map((part: { added?: boolean; removed?: boolean; value: string }) => {
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
