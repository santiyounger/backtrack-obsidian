import { App, Notice, TFile } from "obsidian";
import git from "isomorphic-git";
import LightningFS from "@isomorphic-git/lightning-fs";
import { diffLines } from "diff";

// Initialize LightningFS
const fs = new LightningFS("fs");
const pfs = fs.promises;

// Get the latest commit's content for a specific file
async function getLatestCommitContent(app: App, filepath: string): Promise<string> {
    // @ts-ignore - Obsidian's internal API
    const dir = (app.vault.adapter as any).basePath;
    
    try {
        // Check if .git directory exists
        try {
            await fs.promises.stat(`${dir}/.git`);
        } catch {
            return ''; // Return empty string if no git repository exists
        }

        try {
            const commits = await git.log({ fs, dir, depth: 1 });
            if (commits.length === 0) {
                return '';
            }
            const latestCommitOid = commits[0].oid;

            try {
                const { blob } = await git.readBlob({
                    fs,
                    dir,
                    oid: latestCommitOid,
                    filepath,
                });
                return new TextDecoder("utf-8").decode(blob);
            } catch (error) {
                if (error.code === 'NotFoundError') {
                    return '';
                }
                throw error;
            }
        } catch (error) {
            if (error.message.includes('Could not find HEAD')) {
                return ''; // Return empty string if no commits exist
            }
            throw error;
        }
    } catch (error) {
        console.error("Error fetching latest commit content:", error);
        throw new Error("Failed to fetch the latest commit content.");
    }
}

// Read the current file's content from the Obsidian vault
async function readFileContent(app: App, filePath: string): Promise<string> {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
        throw new Error(`File not found: ${filePath}`);
    }
    return app.vault.read(file);
}

// Generate the Git diff for a file
export async function getGitDiff(app: App, filePath: string): Promise<string> {
    try {
        // Read the current file's content
        const content = await readFileContent(app, filePath);

        // Fetch the latest committed content
        const latestContent = await getLatestCommitContent(app, filePath);

        // Generate and return the formatted diff
        return formatDiff(latestContent, content);
    } catch (error) {
        console.error("Error generating Git diff:", error);
        new Notice("Unable to generate Git diff. Check console for details.");
        throw error;
    }
}

// Format the diff for HTML display
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
