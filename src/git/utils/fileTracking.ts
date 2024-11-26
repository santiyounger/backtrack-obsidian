import { App } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { TAbstractFile, TFile, Events } from 'obsidian';

interface FileMapping {
    id: string;
    currentPath: string;
    previousPaths: string[];
}

interface DraftKeepConfig {
    files: FileMapping[];
}

export class FileTracker {
    private configPath: string;
    private config: DraftKeepConfig;

    constructor(private app: App) {
        this.configPath = path.join(this.getVaultPath(), '.draft-keep.json');
        this.config = this.loadConfig();
        
        // Register rename event handler
        this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            if (file instanceof TFile) {
                this.handleFileRename(oldPath, file.path);
            }
        });
    }

    private handleFileRename(oldPath: string, newPath: string): void {
        // First try to find mapping with the old path
        const existingOld = this.config.files.find(f => 
            f.currentPath === oldPath || f.previousPaths.includes(oldPath)
        );

        // Also check if there's already a mapping for the new path
        const existingNew = this.config.files.find(f => 
            f.currentPath === newPath || f.previousPaths.includes(newPath)
        );

        if (existingOld) {
            // Update the existing mapping
            if (existingOld.currentPath === oldPath) {
                if (!existingOld.previousPaths.includes(oldPath)) {
                    existingOld.previousPaths.push(oldPath);
                }
                existingOld.currentPath = newPath;
            }
            
            // If we found a separate mapping for the new path, merge them
            if (existingNew && existingNew !== existingOld) {
                // Merge the paths from existingNew into existingOld
                existingOld.previousPaths = [...new Set([
                    ...existingOld.previousPaths,
                    ...existingNew.previousPaths,
                    existingNew.currentPath
                ])];
                
                // Remove the duplicate mapping
                this.config.files = this.config.files.filter(f => f !== existingNew);
            }
            
            this.saveConfig();
        } else if (existingNew) {
            // If we only found a mapping for the new path, add the old path to its history
            if (!existingNew.previousPaths.includes(oldPath)) {
                existingNew.previousPaths.push(oldPath);
            }
            this.saveConfig();
        }
    }

    private getVaultPath(): string {
        return (this.app.vault.adapter as any).getBasePath();
    }

    private loadConfig(): DraftKeepConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading .draft-keep.json:', error);
        }
        return { files: [] };
    }

    private saveConfig(): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving .draft-keep.json:', error);
        }
    }

    public getFileId(filePath: string): string | null {
        // First check if file already has an ID
        const existing = this.config.files.find(f => 
            f.currentPath === filePath || f.previousPaths.includes(filePath)
        );

        if (existing) {
            // Update current path if it's changed
            if (existing.currentPath !== filePath) {
                existing.previousPaths.push(existing.currentPath);
                existing.currentPath = filePath;
                this.saveConfig();
            }
            return existing.id;
        }

        // If no existing ID, create new one
        const newId = uuidv4();
        this.config.files.push({
            id: newId,
            currentPath: filePath,
            previousPaths: []
        });
        this.saveConfig();
        return newId;
    }

    public getFilePath(fileId: string): string | null {
        const mapping = this.config.files.find(f => f.id === fileId);
        return mapping ? mapping.currentPath : null;
    }

    public getAllPaths(fileId: string): string[] {
        const mapping = this.config.files.find(f => f.id === fileId);
        if (!mapping) return [];

        // Return all paths, including the current one
        return [mapping.currentPath, ...mapping.previousPaths];
    }
} 