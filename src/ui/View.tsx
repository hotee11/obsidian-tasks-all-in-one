import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Dashboard } from './Dashboard';
import { TaskCache } from '../services/TaskCache';
import { MyPluginSettings, DEFAULT_SETTINGS } from '../settings';

export const VIEW_TYPE_DASHBOARD = 'dashboard-view';

export class DashboardView extends ItemView {
    root: Root | null = null;
    settings: MyPluginSettings;

    constructor(leaf: WorkspaceLeaf, settings: MyPluginSettings) {
        super(leaf);
        this.settings = settings;
    }

    getViewType() {
        return VIEW_TYPE_DASHBOARD;
    }

    getDisplayText() {
        return 'Dashboard';
    }

    async onOpen() {
        this.render();
    }

    async onClose() {
        this.root?.unmount();
    }

    public updateSettings(settings: MyPluginSettings) {
        this.settings = settings;
        this.render();
    }

    private render() {
        const container = this.containerEl.children[1];
        if (!this.root) {
            container.empty();
            this.root = createRoot(container);
        }
        
        const taskCache = TaskCache.getInstance(this.app);
        this.root.render(
            <React.StrictMode>
                <Dashboard taskCache={taskCache} app={this.app} settings={this.settings} />
            </React.StrictMode>
        );
    }
}
