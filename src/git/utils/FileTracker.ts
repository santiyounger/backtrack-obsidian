interface TrackedFile {
    id: string;
    currentPath: string;
    previousPaths: string[];
}

interface FileTrackerData {
    files: TrackedFile[];
}

export class FileTracker {
    private static TRACKER_FILE = '.backtrack.json';
    private data: FileTrackerData;

    constructor(private vaultPath: string) {
        this.data = this.loadTrackerFile();
    }

    private loadTrackerFile(): FileTrackerData {
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(this.vaultPath, FileTracker.TRACKER_FILE);
            
            if (!fs.existsSync(filePath)) {
                return { files: [] };
            }

            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Error loading tracker file:', error);
            return { files: [] };
        }
    }

    private saveTrackerFile(): void {
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(this.vaultPath, FileTracker.TRACKER_FILE);
            fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving tracker file:', error);
        }
    }

    public handleFileRename(oldPath: string, newPath: string): void {
        const fileByOldPath = this.data.files.find(file => 
            file.currentPath === oldPath
        );

        if (fileByOldPath) {
            fileByOldPath.previousPaths.push(fileByOldPath.currentPath);
            fileByOldPath.currentPath = newPath;
            this.saveTrackerFile();
            return;
        }

        const fileByNewPath = this.data.files.find(file => 
            file.currentPath === newPath
        );

        if (fileByNewPath) {
            if (!fileByNewPath.previousPaths.includes(oldPath)) {
                fileByNewPath.previousPaths.push(oldPath);
                this.saveTrackerFile();
            }
            return;
        }

        const newFile: TrackedFile = {
            id: this.generateUUID(),
            currentPath: newPath,
            previousPaths: [oldPath]
        };
        this.data.files.push(newFile);
        this.saveTrackerFile();
    }

    public trackFile(currentPath: string): string {
        const existingFile = this.data.files.find(file => 
            file.currentPath === currentPath || 
            file.previousPaths.includes(currentPath)
        );

        if (existingFile) {
            return existingFile.id;
        }

        const newFile: TrackedFile = {
            id: this.generateUUID(),
            currentPath: currentPath,
            previousPaths: []
        };

        this.data.files.push(newFile);
        this.saveTrackerFile();
        return newFile.id;
    }

    public getFilePathById(id: string): string | null {
        const file = this.data.files.find(f => f.id === id);
        return file ? file.currentPath : null;
    }

    public getAllPathsForFile(currentPath: string): string[] {
        const file = this.data.files.find(f => 
            f.currentPath === currentPath || 
            f.previousPaths.includes(currentPath)
        );

        if (!file) return [currentPath];

        const allPaths = [file.currentPath];
        
        file.previousPaths.reverse().forEach(path => {
            if (!allPaths.includes(path)) {
                allPaths.push(path);
            }
        });

        return allPaths;
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
} 