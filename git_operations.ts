import { App, Notice, TFile } from "obsidian";
import git from "isomorphic-git";
import LightningFS from "@isomorphic-git/lightning-fs";
import { diffLines } from "diff";

// Initialize LightningFS and directory
const fs = new LightningFS("fs");
const dir = "/";
const pfs = fs.promises;

// Ensure the repository is initialized and ready
async function ensureRepoInitialized(): Promise<void> {
    try {
        const branches = await git.listBranches({ fs, dir });
        if (branches.length === 0) {
            await git.init({ fs, dir });
            await git.branch({ fs, dir, ref: "main" }); // Create 'main' branch if none exists
        }
    } catch (error) {
        console.error("Failed to initialize Git repository:", error);
        throw new Error("Git repository initialization failed.");
    }
}

// Read file content from the Obsidian vault
async function readFileContent(app: App, filePath: string): Promise<string> {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
        throw new Error(`File not found: ${filePath}`);
    }
    return app.vault.read(file);
}

// Get the latest committed content
async function getLatestCommitContent(filepath: string): Promise<string> {
    const commits = await git.log({ fs, dir, depth: 1, ref: "main" });
    if (commits.length === 0) {
        throw new Error("No commits found in the repository.");
    }
    const latestCommitOid = commits[0].oid;

    const { blob } = await git.readBlob({
        fs,
        dir,
        oid: latestCommitOid,
        filepath,
    });

    return new TextDecoder("utf-8").decode(blob);
}

// Generate the Git diff
export async function getGitDiff(app: App, filePath: string): Promise<string> {
    try {
        await ensureRepoInitialized();

        const content = await readFileContent(app, filePath);
        const virtualFilePath = `${dir}${filePath}`;

        // Write current file content to the virtual filesystem
        await pfs.writeFile(virtualFilePath, content);

        // Fetch the latest commit's content
        const latestContent = await getLatestCommitContent(filePath);

        // Generate and return the diff
        return formatDiff(latestContent, content);
    } catch (error) {
        console.error("Error generating Git diff:", error);
        new Notice("Unable to generate Git diff. Check console for details.");
        throw error;
    }
}

// Format diff results for HTML display
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

// Escape HTML for safe rendering
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
