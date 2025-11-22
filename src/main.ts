import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { MyPluginSettings, DEFAULT_SETTINGS, MyPluginSettingTab } from './settings';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './ui/View';
import { TaskCache } from './services/TaskCache';

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
    taskCache: TaskCache;

	async onload() {
		await this.loadSettings();

        // Load styles
        this.loadStyles();

        this.taskCache = TaskCache.getInstance(this.app, this.manifest);
        this.taskCache.updateSettings(this.settings);

        this.app.workspace.onLayoutReady(async () => {
            console.log("Layout ready, initializing TaskCache...");
            await this.taskCache.initialize();
        });

		this.registerView(
			VIEW_TYPE_DASHBOARD,
			(leaf) => new DashboardView(leaf, this.settings)
		);

		this.addRibbonIcon('calendar-with-checkmark', 'Open Dashboard', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-dashboard',
			name: 'Open Dashboard',
			callback: () => {
				this.activateView();
			}
		});

		this.addSettingTab(new MyPluginSettingTab(this.app, this));
        
        // Debug Notice
        new Notice("Tasks All-In-One: Plugin Reloaded (vFix)");
	}

	onunload() {

	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for example
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
            }
		}

		if (leaf) {
            workspace.revealLeaf(leaf);
        }
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

    loadStyles() {
        // In a real plugin, styles.css is usually loaded automatically if it's in the root.
        // However, since we are writing to src/styles.css, we might need to ensure it's bundled or imported.
        // If using esbuild with css loader, we can import it.
        // But standard Obsidian plugins just have styles.css in the root.
        // Let's assume the build process handles it or we need to move it.
        // For now, I'll leave this empty as Obsidian loads styles.css from the plugin folder automatically.
    }

	async saveSettings() {
		await this.saveData(this.settings);
        this.taskCache.updateSettings(this.settings);
        
        this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD).forEach(leaf => {
            if (leaf.view instanceof DashboardView) {
                leaf.view.updateSettings(this.settings);
            }
        });
	}
}
