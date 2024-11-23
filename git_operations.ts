import git from "isomorphic-git";
import LightningFS from "@isomorphic-git/lightning-fs";
import { App } from "obsidian";
import { diffLines } from "diff";

const fs = new LightningFS("fs");

export async function getGitDiff(app: App, filePath: string): Promise<string> {
  const dir = "/";
  const vaultPath = app.vault.adapter.basePath;
  const fullPath = `${vaultPath}/${filePath}`;

  try {
    // Initialize git repository in-memory if not already initialized
    await git.init({ fs, dir });

    // Read current content into the in-memory file system
    const currentContent = await app.vault.adapter.read(filePath);
    await fs.promises.writeFile(fullPath, currentContent);

    // Get the latest commit's content
    const commits = await git.log({ fs, dir, filepath: filePath, depth: 1 });
    if (commits.length === 0) {
      throw new Error("No commits found for the selected file.");
    }

    const latestCommitOid = commits[0].oid;
    const { blob: latestContentBlob } = await git.readBlob({
      fs,
      dir,
      oid: latestCommitOid,
      filepath: filePath,
    });

    const latestContent = new TextDecoder("utf-8").decode(latestContentBlob);

    // Generate the diff and return as HTML
    return formatDiff(latestContent, currentContent);
  } catch (error) {
    console.error("Error generating Git diff:", error);
    throw new Error("Unable to generate Git diff.");
  }
}

function formatDiff(oldContent: string, newContent: string): string {
  const diffs = diffLines(oldContent, newContent);
  let diffHtml = "<div class='git-diff-view'>";

  diffs.forEach((part) => {
    const escapedText = escapeHtml(part.value);
    const lineClass = part.added
      ? "addition"
      : part.removed
      ? "deletion"
      : "unchanged";
    const style = part.added
      ? "background-color: rgba(0, 255, 0, 0.1); color: green;"
      : part.removed
      ? "background-color: rgba(255, 0, 0, 0.1); color: red;"
      : "color: black;";

    diffHtml += `<div class='line ${lineClass}' style="${style}">${escapedText}</div>`;
  });

  diffHtml += "</div>";
  return diffHtml;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`=\/]/g, (char) => {
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
    return escapeMap[char] || char;
  });
}
