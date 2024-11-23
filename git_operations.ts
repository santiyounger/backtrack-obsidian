import { App, Notice, TFile } from "obsidian";
import git from "isomorphic-git";
import * as LightningFS from "@isomorphic-git/lightning-fs";
import { diffLines } from "diff";

const fs = new LightningFS("fs");

export async function getGitDiff(app: App, filePath: string): Promise<string> {
    const vaultPath = app.vault.getAbstractFileByPath(filePath)?.path || filePath;
    const virtualDir = "/";

  try {
    // Initialize the in-memory Git repository if not already initialized
    await git.init({ fs, dir: virtualDir });

    // Read the current file content
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const currentContent = await app.vault.read(file);
    const virtualFilePath = `${vaultPath}/${filePath}`;
    await fs.promises.writeFile(virtualFilePath, currentContent);

    // Fetch the latest commit's content
    const commits = await git.log({ fs, dir: virtualDir, depth: 1 });
    if (commits.length === 0) {
      throw new Error(`No Git commits found for file: ${filePath}`);
    }

    const latestCommitOid = commits[0].oid;
    const { blob: latestContentBlob } = await git.readBlob({
      fs,
      dir: virtualDir,
      oid: latestCommitOid,
      filepath: filePath,
    });

    const latestContent = new TextDecoder("utf-8").decode(latestContentBlob);

    // Generate and return the diff as formatted HTML
    return formatDiff(latestContent, currentContent);
  } catch (error) {
    console.error("Error generating Git diff:", error);
    new Notice("Unable to generate Git diff. Check console for details.");
    throw error;
  }
}

function formatDiff(oldContent: string, newContent: string): string {
  const diffs = diffLines(oldContent, newContent);
  let diffHtml = `<div class="git-diff-view" style="font-family: monospace; white-space: pre-wrap;">`;

  diffs.forEach((part) => {
    const escapedText = escapeHtml(part.value);
    const className = part.added
      ? "addition"
      : part.removed
      ? "deletion"
      : "unchanged";

    const style = part.added
      ? "background-color: rgba(0, 255, 0, 0.1); color: green;"
      : part.removed
      ? "background-color: rgba(255, 0, 0, 0.1); color: red;"
      : "color: black;";

    diffHtml += `<div class="${className}" style="${style}">${escapedText}</div>`;
  });

  diffHtml += "</div>";
  return diffHtml;
}

function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
    "=": "&#61;",
    "/": "&#47;",
  };
  return text.replace(/[&<>"'`=\/]/g, (char) => escapeMap[char] || char);
}
