import { App, MarkdownView, Notice, Modal } from 'obsidian';
import { exec } from 'child_process';
import * as path from 'path';

export class DraftKeep {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async gitStageCommitPush(view: MarkdownView) {
        const filePath = view.file?.path;

        if (!filePath) {
            console.error('No file is open.');
            new Notice('No file is open.');
            return;
        }

        await (this.app as any).commands.executeCommandById('editor:save-file');

        const vaultPath = this.getVaultBasePath();
        if (!vaultPath) {
            console.error('Failed to fetch the vault base path.');
            new Notice('Failed to fetch the vault base path.');
            return;
        }

        const fullFilePath = path.join(vaultPath, filePath);
        this.prepareForCommit(vaultPath, filePath, fullFilePath);
    }

    private getVaultBasePath(): string | null {
        const adapter = this.app.vault.adapter;
        if ((adapter as any).getBasePath) {
            return (adapter as any).getBasePath();
        }
        console.error('Adapter does not support getBasePath().');
        new Notice('Adapter does not support getBasePath().');
        return null;
    }

    private prepareForCommit(vaultPath: string, filePath: string, fullFilePath: string) {
        exec(`git -C "${vaultPath}" add "${filePath}"`, (err, stdout, stderr) => {
            if (err) {
                console.error('Error staging file:', { error: err, stderr });
                new Notice('Error staging the file. Check the console for details.', 5000);
                return;
            }

            exec(`git -C "${vaultPath}" diff --cached --quiet`, (err) => {
                if (err) {
                    new CommitMessageModal(this.app, async (commitMessage) => {
                        if (!commitMessage.trim()) {
                            const timestamp = new Date().toLocaleString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            }).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3_$1_$2 - $4:$5:$6');

                            commitMessage = `snapshot by Backtrack - Version History - obsidian plugin - captured file: ${filePath} at: ${timestamp}`;
                        }

                        new Notice('Saving snapshot...', 2000);
                        this.runGitCommands(vaultPath, commitMessage);
                    }).open();
                } else {
                    new Notice('This version has already been saved before. Keep writing and try again.', 5000);
                }
            });
        });
    }

    private async runGitCommands(vaultPath: string, commitMessage: string) {
        exec(`git -C "${vaultPath}" commit -m "${commitMessage}"`, (err, stdout, stderr) => {
            if (err) {
                console.error('Error committing file:', { error: err, stderr });
                new Notice('Error committing file. Check the console for details.', 5000);
                return;
            }

            exec(`git -C "${vaultPath}" push`, (err) => {
                if (err) {
                    console.error('Error pushing changes:', { error: err });
                    new Notice('Error pushing changes. Check the console for details.', 5000);
                    return;
                }
                new Notice('Snapshot successfully saved', 5000);
            });
        });
    }
}

export class CommitMessageModal extends Modal {
    onSubmit: (commitMessage: string) => void;

    constructor(app: App, onSubmit: (commitMessage: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Name this snapshot (optional)' });

        const form = contentEl.createEl('form');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';

        const inputEl = form.createEl('input', {
            type: 'text',
            placeholder: 'Write a name here, or leave it empty and simply press ENTER',
        });
        inputEl.style.width = '100%';
        inputEl.style.marginBottom = '1em';
        inputEl.style.padding = '0.5em';
        inputEl.style.border = '1px solid var(--background-modifier-border)';
        inputEl.style.borderRadius = '4px';

        const submitButton = form.createEl('button', { text: 'Save' });
        submitButton.style.padding = '0.5em 1em';
        submitButton.style.border = 'none';
        submitButton.style.borderRadius = '4px';
        submitButton.style.backgroundColor = 'var(--interactive-accent)';
        submitButton.style.color = 'white';
        submitButton.style.cursor = 'pointer';

        const handleSubmit = (e: Event) => {
            e.preventDefault();
            const commitMessage = inputEl.value.trim();
            this.onSubmit(commitMessage);
            this.close();
        };

        form.addEventListener('submit', handleSubmit);
        inputEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit(event);
            }
        });

        contentEl.appendChild(form);
    }

    onClose() {
        this.contentEl.empty();
    }
} 