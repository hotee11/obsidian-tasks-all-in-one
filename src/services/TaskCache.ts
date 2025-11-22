import { App, TFile, TAbstractFile, Events, normalizePath, PluginManifest } from 'obsidian';
import { Task, TaskParser } from './TaskParser';
import { MyPluginSettings } from '../settings';

interface SerializedTask extends Omit<Task, 'file'> {
    filePath: string;
}

interface CacheEntry {
    mtime: number;
    tasks: SerializedTask[];
}

export class TaskCache extends Events {
    private static instance: TaskCache;
    private app: App;
    private parser: TaskParser;
    private cache: Map<string, Task[]> = new Map();
    private fileMtimes: Map<string, number> = new Map();
    private cachedAllTasks: Task[] | null = null;
    private initialized: boolean = false;
    private settings: MyPluginSettings | null = null;
    private cachePath: string;

    private constructor(app: App, manifest: PluginManifest) {
        super();
        this.app = app;
        this.parser = new TaskParser();
        this.cachePath = normalizePath(`${manifest.dir}/cache.json`);
    }

    public static getInstance(app: App, manifest?: PluginManifest): TaskCache {
        if (!TaskCache.instance) {
            if (!manifest) {
                throw new Error("TaskCache must be initialized with a manifest first");
            }
            TaskCache.instance = new TaskCache(app, manifest);
        }
        return TaskCache.instance;
    }

    public updateSettings(settings: MyPluginSettings) {
        this.settings = settings;
        
        // Update parser with custom completed symbols
        if (settings.customStatuses) {
            const completedSymbols = settings.customStatuses
                .filter(s => s.isCompleted)
                .map(s => s.symbol);
            
            // Ensure standard 'x' is always supported if not explicitly removed (though user can remove it from settings)
            // Actually, let's trust the settings. If user removes 'x', they probably mean it.
            // But for safety, let's add 'x' and 'X' if the list is empty, or just trust the default settings.
            // The default settings include 'x'.
            
            // Also add 'X' if 'x' is present, for case insensitivity usually expected
            if (completedSymbols.includes('x') && !completedSymbols.includes('X')) {
                completedSymbols.push('X');
            }
            
            this.parser.setCompletedSymbols(completedSymbols);
        }

        if (this.initialized) {
            this.reindex();
        }
    }

    private async reindex() {
        // Silent reindex
        const files = this.app.vault.getMarkdownFiles();
        
        for (const file of files) {
            await this.indexFile(file, undefined, true);
        }
        this.trigger('update', null);
        this.saveCache();
    }

    private async loadCache() {
        try {
            if (await this.app.vault.adapter.exists(this.cachePath)) {
                const data = await this.app.vault.adapter.read(this.cachePath);
                const json: Record<string, CacheEntry> = JSON.parse(data);
                
                for (const [path, entry] of Object.entries(json)) {
                    const file = this.app.vault.getAbstractFileByPath(path);
                    if (file instanceof TFile) {
                        const tasks: Task[] = entry.tasks.map(st => ({
                            ...st,
                            file: file
                        }));
                        this.cache.set(path, tasks);
                        this.fileMtimes.set(path, entry.mtime);
                    }
                }
                console.log(`TaskCache: Loaded ${Object.keys(json).length} files from disk cache.`);
                this.cachedAllTasks = null; // Invalidate cache after loading
            }
        } catch (e) {
            console.error("TaskCache: Failed to load cache", e);
        }
    }

    private async saveCache() {
        try {
            const json: Record<string, CacheEntry> = {};
            for (const [path, tasks] of this.cache.entries()) {
                const mtime = this.fileMtimes.get(path) || 0;
                json[path] = {
                    mtime: mtime,
                    tasks: tasks.map(t => {
                        const { file, ...rest } = t;
                        return { ...rest, filePath: path };
                    })
                };
            }
            await this.app.vault.adapter.write(this.cachePath, JSON.stringify(json));
        } catch (e) {
            console.error("TaskCache: Failed to save cache", e);
        }
    }

    public async initialize() {
        if (this.initialized) return;

        console.log("TaskCache: Starting initialization...");
        await this.loadCache();

        const files = this.app.vault.getMarkdownFiles();
        console.log(`TaskCache: Found ${files.length} markdown files.`);
        
        let totalTasks = 0;
        let changedFiles = 0;

        for (const file of files) {
            const cachedMtime = this.fileMtimes.get(file.path);
            
            if (cachedMtime === undefined || cachedMtime !== file.stat.mtime) {
                await this.indexFile(file, undefined, true);
                changedFiles++;
            }

            const tasks = this.cache.get(file.path);
            if (tasks) totalTasks += tasks.length;
        }

        // Clean up cache for deleted files
        const filePaths = new Set(files.map(f => f.path));
        let cacheCleaned = false;
        for (const path of this.cache.keys()) {
            if (!filePaths.has(path)) {
                this.cache.delete(path);
                this.fileMtimes.delete(path);
                cacheCleaned = true;
            }
        }
        
        if (cacheCleaned) {
            this.cachedAllTasks = null;
        }

        if (changedFiles > 0) {
            console.log(`TaskCache: Re-indexed ${changedFiles} changed files.`);
            this.saveCache();
        }

        // Register events
        this.app.metadataCache.on('changed', (file, data, cache) => {
            this.indexFile(file, data);
            this.saveCache();
        });

        this.app.vault.on('delete', (file) => {
            this.removeFile(file);
            this.saveCache();
        });
        
        this.app.vault.on('rename', (file, oldPath) => {
            this.renameFile(file, oldPath);
            this.saveCache();
        });

        this.initialized = true;
        this.trigger('initialized');
        console.log(`TaskCache: Initialized with ${totalTasks} tasks from ${this.cache.size} files.`);
    }

    private async indexFile(file: TFile, content?: string, silent: boolean = false) {
        if (file.extension !== 'md') return;

        if (this.settings) {
            // Check Inbox Folder (Whitelist)
            if (this.settings.inboxFolder && !file.path.startsWith(this.settings.inboxFolder)) {
                // console.log(`Skipping ${file.path} (not in inbox folder)`);
                return;
            }
            
            // Check Excluded Folders (Blacklist)
            if (this.settings.excludedFolders.some(folder => file.path.startsWith(folder))) {
                // console.log(`Skipping ${file.path} (excluded)`);
                return;
            }

            // Check Excluded Files (Name)
            if (this.settings.excludedFiles && this.settings.excludedFiles.length > 0) {
                if (this.settings.excludedFiles.some(keyword => file.name.includes(keyword))) {
                    return;
                }
            }

            // Check Excluded Properties (Frontmatter)
            if (this.settings.excludedProperties && this.settings.excludedProperties.length > 0) {
                const cache = this.app.metadataCache.getFileCache(file);
                if (cache && cache.frontmatter) {
                    const hasExcludedProp = this.settings.excludedProperties.some(prop => {
                        // Support "key: value" or just "key"
                        if (prop.includes(':')) {
                            const [key, value] = prop.split(':').map(s => s.trim());
                            return cache.frontmatter![key] === value || cache.frontmatter![key] === (value === 'true' ? true : (value === 'false' ? false : value));
                        } else {
                            return Object.prototype.hasOwnProperty.call(cache.frontmatter, prop);
                        }
                    });
                    if (hasExcludedProp) return;
                }
            }
        }

        try {
            // Optimization: Use cachedRead for faster repeated reads
            const fileContent = content !== undefined ? content : await this.app.vault.cachedRead(file);
            const lines = fileContent.split('\n');
            const tasks: Task[] = [];

            lines.forEach((line, index) => {
                const task = this.parser.parse(line, file, index);
                if (task) {
                    tasks.push(task);
                }
            });

            if (tasks.length > 0) {
                // console.log(`Indexed ${file.path}: ${tasks.length} tasks`);
            }
            this.cache.set(file.path, tasks);
            this.fileMtimes.set(file.path, file.stat.mtime);
            this.cachedAllTasks = null; // Invalidate cache
            
            if (!silent) {
                this.trigger('update', file);
            }
        } catch (e) {
            console.error(`Failed to index file ${file.path}`, e);
        }
    }

    private removeFile(file: TAbstractFile) {
        if (this.cache.has(file.path)) {
            this.cache.delete(file.path);
            this.fileMtimes.delete(file.path);
            this.cachedAllTasks = null; // Invalidate cache
            this.trigger('update', null);
        }
    }

    private renameFile(file: TAbstractFile, oldPath: string) {
        if (this.cache.has(oldPath)) {
            const tasks = this.cache.get(oldPath);
            this.cache.delete(oldPath);
            this.fileMtimes.delete(oldPath);
            this.cachedAllTasks = null; // Invalidate cache
            
            if (tasks && file instanceof TFile) {
                // Update file reference in tasks? 
                // Ideally we should re-index because the ID might depend on path
                this.indexFile(file); 
            }
        }
    }

    public getTasks(file: TFile): Task[] {
        return this.cache.get(file.path) || [];
    }

    public getAllTasks(): Task[] {
        if (this.cachedAllTasks) {
            return this.cachedAllTasks;
        }
        const allTasks: Task[] = [];
        for (const tasks of this.cache.values()) {
            for (let i = 0; i < tasks.length; i++) {
                allTasks.push(tasks[i]);
            }
        }
        this.cachedAllTasks = allTasks;
        return allTasks;
    }
}
