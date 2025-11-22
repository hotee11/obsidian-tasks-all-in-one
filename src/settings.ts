import { App, PluginSettingTab, Setting } from 'obsidian';
import MyPlugin from './main';

// --- Localization ---
const en = {
    generalSettings: 'General Settings',
    inboxFolder: 'Inbox Folder',
    inboxFolderDesc: 'Only scan this folder for tasks (leave empty for all folders)',
    excludedFolders: 'Excluded Folders',
    excludedFoldersDesc: 'Folders to ignore (one per line)',
    excludedFilesName: 'Excluded Files (Name)',
    excludedFilesNameDesc: 'Exclude files if their name contains these strings (one per line)',
    excludedFilesProp: 'Excluded Files (Property)',
    excludedFilesPropDesc: 'Exclude files if they have these frontmatter properties (one per line). e.g. "archive" or "status: done"',
    importantTag: 'Important Tag',
    importantTagDesc: 'Tag to mark tasks as Important',
    urgentTag: 'Urgent Tag',
    urgentTagDesc: 'Tag to mark tasks as Urgent',
    treatHighPriority: 'Treat High Priority as Important',
    treatHighPriorityDesc: 'If enabled, tasks with "High" or "Highest" priority will be automatically marked as Important.',
    showCompleted: 'Show Completed Tasks',
    showCompletedDesc: 'Show completed tasks in the calendar view',
    calendarSettings: 'Calendar View Settings',
    startHour: 'Calendar Start Hour',
    startHourDesc: 'Start time for the calendar view (0-23)',
    endHour: 'Calendar End Hour',
    endHourDesc: 'End time for the calendar view (0-24)',
    firstDayOfWeek: 'First Day of Week',
    firstDayOfWeekDesc: 'Start day for the calendar week (0=Sunday, 1=Monday, etc.)',
    colorSettings: 'Color Settings',
    defaultColor: 'Default Task Color',
    defaultColorDesc: 'The default color for tasks that do not match any rules.',
    colorRules: 'Color Rules',
    colorRulesDesc: 'Define colors based on text or tags contained in the task.',
    addColorRule: 'Add Color Rule',
    maxRules: 'Maximum of 10 rules reached.',
    // New Settings
    defaultView: 'Default View',
    defaultViewDesc: 'The view to show when opening the dashboard.',
    showWeekNumbers: 'Show Week Numbers',
    showWeekNumbersDesc: 'Show week numbers in the calendar view.',
    hideWeekends: 'Hide Weekends',
    hideWeekendsDesc: 'Hide Saturday and Sunday in the calendar view.',
    matrixSettings: 'Matrix View Settings',
    matrixLabelQ1: 'Quadrant 1 Label',
    matrixLabelQ1Desc: 'Label for Important & Urgent (Top Left)',
    matrixLabelQ2: 'Quadrant 2 Label',
    matrixLabelQ2Desc: 'Label for Important & Not Urgent (Top Right)',
    matrixLabelQ3: 'Quadrant 3 Label',
    matrixLabelQ3Desc: 'Label for Not Important & Urgent (Bottom Left)',
    matrixLabelQ4: 'Quadrant 4 Label',
    matrixLabelQ4Desc: 'Label for Not Important & Not Urgent (Bottom Right)',
    matrixUrgencyDays: 'Urgency Threshold (Days)',
    matrixUrgencyDaysDesc: 'Tasks due within this many days are considered Urgent.',
    matrixImportantPriorities: 'Important Priorities',
    matrixImportantPrioritiesDesc: 'Select which priorities are considered Important.',
    // Custom Statuses
    customStatuses: 'Custom Statuses',
    customStatusesDesc: 'Define custom task statuses. Symbol must be a single character.',
    addStatus: 'Add Status',
    statusSymbol: 'Symbol',
    statusName: 'Name',
    statusColor: 'Color',
    statusCompleted: 'Completed?',
    // Section Headers
    inboxSettings: 'Inbox Settings',
    behaviorSettings: 'Behavior Settings',
    formatSettings: 'Format Settings',
    // Inbox Settings
    inboxGrouping: 'Inbox Grouping',
    inboxGroupingDesc: 'How to group tasks in the Inbox.',
    inboxSorting: 'Inbox Sorting',
    inboxSortingDesc: 'How to sort tasks in the Inbox.',
    // Behavior Settings
    defaultDuration: 'Default Duration (Minutes)',
    defaultDurationDesc: 'Default duration when dragging a task to the calendar.',
    clickBehavior: 'Click Behavior',
    clickBehaviorDesc: 'What happens when you click a task in the calendar.',
    // Format Settings
    dateFormat: 'Date Format',
    dateFormatDesc: 'Format used when writing dates back to Markdown.',
    timeFormat: 'Time Format',
    timeFormatDesc: 'Format used when writing times back to Markdown.',
    // Dropdown Options
    optionByFile: 'By File',
    optionByFolder: 'By Folder',
    optionByTag: 'By Tag',
    optionNone: 'None (Flat List)',
    optionByPriority: 'By Priority',
    optionByCreated: 'By Created Time (Line Number)',
    optionByFilename: 'By Filename',
    option15Min: '15 Minutes',
    option30Min: '30 Minutes',
    option1Hour: '1 Hour',
    option2Hours: '2 Hours',
    optionJump: 'Jump to File',
    optionPreview: 'Open in Side Leaf',
    optionEmoji: 'Emoji (📅 YYYY-MM-DD)',
    optionDataview: 'Dataview ([due:: YYYY-MM-DD])',
    optionWikilink: 'Wikilink ([[YYYY-MM-DD]])',
    option24h: '24 Hour (14:00)',
    option12h: '12 Hour (2:00 PM)',
};




const zh = {
    generalSettings: '通用设置',
    inboxFolder: 'Inbox 文件夹',
    inboxFolderDesc: '仅扫描此文件夹中的任务（留空则扫描所有文件夹）',
    excludedFolders: '排除文件夹',
    excludedFoldersDesc: '忽略的文件夹（每行一个）',
    excludedFilesName: '排除文件（按名称）',
    excludedFilesNameDesc: '如果文件名包含这些字符串则排除（每行一个）',
    excludedFilesProp: '排除文件（按属性）',
    excludedFilesPropDesc: '如果文件包含这些 Frontmatter 属性则排除（每行一个）。例如 "archive" 或 "status: done"',
    importantTag: '重要标签',
    importantTagDesc: '标记为“重要”的标签',
    urgentTag: '紧急标签',
    urgentTagDesc: '标记为“紧急”的标签',
    treatHighPriority: '将高优先级视为重要',
    treatHighPriorityDesc: '如果启用，优先级为“高”或“最高”的任务将自动标记为重要。',
    showCompleted: '显示已完成任务',
    showCompletedDesc: '在日历视图中显示已完成的任务',
    calendarSettings: '日历视图设置',
    startHour: '日历开始时间',
    startHourDesc: '日历视图的开始时间 (0-23)',
    endHour: '日历结束时间',
    endHourDesc: '日历视图的结束时间 (0-24)',
    firstDayOfWeek: '每周第一天',
    firstDayOfWeekDesc: '日历周的起始日 (0=周日, 1=周一, 等)',
    colorSettings: '颜色设置',
    defaultColor: '默认任务颜色',
    defaultColorDesc: '不匹配任何规则的任务的默认颜色。',
    colorRules: '颜色规则',
    colorRulesDesc: '根据任务中包含的文本或标签定义颜色。',
    addColorRule: '添加颜色规则',
    maxRules: '已达到 10 条规则上限。',
    // New Settings
    defaultView: '默认视图',
    defaultViewDesc: '打开仪表盘时显示的视图。',
    showWeekNumbers: '显示周号',
    showWeekNumbersDesc: '在日历视图中显示周号。',
    hideWeekends: '隐藏周末',
    hideWeekendsDesc: '在日历视图中隐藏周六和周日。',
    matrixSettings: '四象限视图设置',
    matrixLabelQ1: '第一象限标题',
    matrixLabelQ1Desc: '重要且紧急（左上）',
    matrixLabelQ2: '第二象限标题',
    matrixLabelQ2Desc: '重要不紧急（右上）',
    matrixLabelQ3: '第三象限标题',
    matrixLabelQ3Desc: '紧急不重要（左下）',
    matrixLabelQ4: '第四象限标题',
    matrixLabelQ4Desc: '不重要不紧急（右下）',
    matrixUrgencyDays: '紧急阈值 (天)',
    matrixUrgencyDaysDesc: '多少天内到期的任务被视为“紧急”。',
    matrixImportantPriorities: '重要优先级',
    matrixImportantPrioritiesDesc: '选择哪些优先级的任务被视为“重要”。',
    // Custom Statuses
    customStatuses: '自定义状态',
    customStatusesDesc: '定义自定义任务状态。符号必须是单个字符。',
    addStatus: '添加状态',
    statusSymbol: '符号',
    statusName: '名称',
    statusColor: '颜色',
    statusCompleted: 'Completed?',
    // Section Headers
    inboxSettings: 'Inbox 设置',
    behaviorSettings: '交互行为设置',
    formatSettings: '格式设置',
    // Inbox Settings
    inboxGrouping: 'Inbox 分组',
    inboxGroupingDesc: 'Inbox 中任务的分组方式。',
    inboxSorting: 'Inbox 排序',
    inboxSortingDesc: 'Inbox 中任务的排序方式。',
    // Behavior Settings
    defaultDuration: '默认时长 (分钟)',
    defaultDurationDesc: '将任务拖入日历时的默认时长。',
    clickBehavior: '点击行为',
    clickBehaviorDesc: '点击日历中的任务时发生的操作。',
    // Format Settings
    dateFormat: '日期格式',
    dateFormatDesc: '写回 Markdown 时使用的日期格式。',
    timeFormat: '时间格式',
    timeFormatDesc: '写回 Markdown 时使用的时间格式。',
    // Dropdown Options
    optionByFile: '按文件',
    optionByFolder: '按文件夹',
    optionByTag: '按标签',
    optionNone: '无 (扁平列表)',
    optionByPriority: '按优先级',
    optionByCreated: '按创建时间 (行号)',
    optionByFilename: '按文件名',
    option15Min: '15 分钟',
    option30Min: '30 分钟',
    option1Hour: '1 小时',
    option2Hours: '2 小时',
    optionJump: '跳转到文件',
    optionPreview: '在侧边栏预览',
    optionEmoji: 'Emoji (📅 YYYY-MM-DD)',
    optionDataview: 'Dataview ([due:: YYYY-MM-DD])',
    optionWikilink: 'Wikilink ([[YYYY-MM-DD]])',
    option24h: '24 小时制 (14:00)',
    option12h: '12 小时制 (2:00 PM)',
};

export const t = (key: keyof typeof en): string => {
    // @ts-ignore
    const lang = window.moment?.locale() || 'en';
    if (lang && lang.toLowerCase().startsWith('zh')) {
        return zh[key] || en[key];
    }
    return en[key];
};

export interface ColorRule {
    keyword: string;
    color: string;
}

export interface TaskStatus {
    symbol: string;
    name: string;
    color: string;
    isCompleted: boolean;
}

export interface MyPluginSettings {
	inboxFolder: string;
    excludedFolders: string[];
    excludedFiles: string[]; // New: Exclude files by name
    excludedProperties: string[]; // New: Exclude files by frontmatter property
    importantTag: string;
    urgentTag: string;
    treatHighPriorityAsImportant: boolean; // New setting
    showCompleted: boolean;
    startHour: number;
    endHour: number;
    firstDayOfWeek: number;
    defaultColor: string;
    colorRules: ColorRule[];
    // New Settings
    defaultView: string;
    showWeekNumbers: boolean;
    hideWeekends: boolean;
    matrixLabelQ1: string;
    matrixLabelQ2: string;
    matrixLabelQ3: string;
    matrixLabelQ4: string;
    matrixUrgencyDays: number;
    matrixImportantPriorities: string[];
    customStatuses: TaskStatus[];
    // Inbox Settings
    inboxGrouping: 'file' | 'folder' | 'tag' | 'none';
    inboxSorting: 'priority' | 'created' | 'filename';
    // Behavior Settings
    defaultDurationMinutes: number;
    taskClickBehavior: 'jump' | 'preview' | 'modal';
    // Format Settings
    dateFormat: 'emoji' | 'dataview' | 'wikilink';
    timeFormat: '24h' | '12h';
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	inboxFolder: "",
    excludedFolders: ["Templates", "Archive"],
    excludedFiles: [],
    excludedProperties: [],
    importantTag: "#important",
    urgentTag: "#urgent",
    treatHighPriorityAsImportant: true,
    showCompleted: false,
    startHour: 6,
    endHour: 23,
    firstDayOfWeek: 1, // Monday
    defaultColor: "#3b82f6", // Light blue
    colorRules: [],
    // New Settings
    defaultView: 'timeGridWeek',
    showWeekNumbers: true,
    hideWeekends: false,
    matrixLabelQ1: "重要且紧急 🔥",
    matrixLabelQ2: "重要不紧急 📅",
    matrixLabelQ3: "紧急不重要 ⚡",
    matrixLabelQ4: "不重要不紧急 ☕",
    matrixUrgencyDays: 3,
    matrixImportantPriorities: ['highest', 'high'],
    customStatuses: [
        { symbol: 'x', name: 'Completed', color: '#10b981', isCompleted: true },
        { symbol: '/', name: 'In Progress', color: '#f59e0b', isCompleted: false },
        { symbol: '-', name: 'Cancelled', color: '#9ca3af', isCompleted: true },
        { symbol: '>', name: 'Deferred', color: '#8b5cf6', isCompleted: false },
        { symbol: '!', name: 'Important', color: '#ef4444', isCompleted: false },
        { symbol: '?', name: 'Question', color: '#f97316', isCompleted: false },
    ],
    // Inbox Settings
    inboxGrouping: 'file',
    inboxSorting: 'priority',
    // Behavior Settings
    defaultDurationMinutes: 60,
    taskClickBehavior: 'jump',
    // Format Settings
    dateFormat: 'emoji',
    timeFormat: '24h',
}

export class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

        containerEl.createEl('h3', {text: t('generalSettings')});

        new Setting(containerEl)
            .setName(t('inboxFolder'))
            .setDesc(t('inboxFolderDesc'))
            .addText(text => text
                .setPlaceholder('Example: Inbox')
                .setValue(this.plugin.settings.inboxFolder)
                .onChange(async (value) => {
                    this.plugin.settings.inboxFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('excludedFolders'))
            .setDesc(t('excludedFoldersDesc'))
            .addTextArea(text => text
                .setPlaceholder('Templates\nArchive')
                .setValue(this.plugin.settings.excludedFolders.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludedFolders = value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('excludedFilesName'))
            .setDesc(t('excludedFilesNameDesc'))
            .addTextArea(text => text
                .setPlaceholder('Daily Note\nBackup')
                .setValue(this.plugin.settings.excludedFiles.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludedFiles = value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('excludedFilesProp'))
            .setDesc(t('excludedFilesPropDesc'))
            .addTextArea(text => text
                .setPlaceholder('archive\nignored')
                .setValue(this.plugin.settings.excludedProperties.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludedProperties = value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('importantTag'))
            .setDesc(t('importantTagDesc'))
            .addText(text => text
                .setPlaceholder('#important')
                .setValue(this.plugin.settings.importantTag)
                .onChange(async (value) => {
                    this.plugin.settings.importantTag = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('urgentTag'))
            .setDesc(t('urgentTagDesc'))
            .addText(text => text
                .setPlaceholder('#urgent')
                .setValue(this.plugin.settings.urgentTag)
                .onChange(async (value) => {
                    this.plugin.settings.urgentTag = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('treatHighPriority'))
            .setDesc(t('treatHighPriorityDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.treatHighPriorityAsImportant)
                .onChange(async (value) => {
                    this.plugin.settings.treatHighPriorityAsImportant = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('showCompleted'))
            .setDesc(t('showCompletedDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCompleted)
                .onChange(async (value) => {
                    this.plugin.settings.showCompleted = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('defaultView'))
            .setDesc(t('defaultViewDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('timeGridDay', 'Day View')
                .addOption('timeGridWeek', 'Week View')
                .addOption('dayGridMonth', 'Month View')
                .addOption('matrix', 'Matrix View')
                .setValue(this.plugin.settings.defaultView)
                .onChange(async (value) => {
                    this.plugin.settings.defaultView = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: t('calendarSettings')});

        new Setting(containerEl)
            .setName(t('showWeekNumbers'))
            .setDesc(t('showWeekNumbersDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showWeekNumbers)
                .onChange(async (value) => {
                    this.plugin.settings.showWeekNumbers = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('hideWeekends'))
            .setDesc(t('hideWeekendsDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideWeekends)
                .onChange(async (value) => {
                    this.plugin.settings.hideWeekends = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('startHour'))
            .setDesc(t('startHourDesc'))
            .addSlider(slider => slider
                .setLimits(0, 23, 1)
                .setValue(this.plugin.settings.startHour)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.startHour = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('endHour'))
            .setDesc(t('endHourDesc'))
            .addSlider(slider => slider
                .setLimits(0, 24, 1)
                .setValue(this.plugin.settings.endHour)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.endHour = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('firstDayOfWeek'))
            .setDesc(t('firstDayOfWeekDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('0', 'Sunday')
                .addOption('1', 'Monday')
                .addOption('2', 'Tuesday')
                .addOption('3', 'Wednesday')
                .addOption('4', 'Thursday')
                .addOption('5', 'Friday')
                .addOption('6', 'Saturday')
                .setValue(this.plugin.settings.firstDayOfWeek.toString())
                .onChange(async (value) => {
                    this.plugin.settings.firstDayOfWeek = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: t('matrixSettings')});

        new Setting(containerEl)
            .setName(t('matrixLabelQ1'))
            .setDesc(t('matrixLabelQ1Desc'))
            .addText(text => text
                .setValue(this.plugin.settings.matrixLabelQ1)
                .onChange(async (value) => {
                    this.plugin.settings.matrixLabelQ1 = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('matrixLabelQ2'))
            .setDesc(t('matrixLabelQ2Desc'))
            .addText(text => text
                .setValue(this.plugin.settings.matrixLabelQ2)
                .onChange(async (value) => {
                    this.plugin.settings.matrixLabelQ2 = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('matrixLabelQ3'))
            .setDesc(t('matrixLabelQ3Desc'))
            .addText(text => text
                .setValue(this.plugin.settings.matrixLabelQ3)
                .onChange(async (value) => {
                    this.plugin.settings.matrixLabelQ3 = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('matrixLabelQ4'))
            .setDesc(t('matrixLabelQ4Desc'))
            .addText(text => text
                .setValue(this.plugin.settings.matrixLabelQ4)
                .onChange(async (value) => {
                    this.plugin.settings.matrixLabelQ4 = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('matrixUrgencyDays'))
            .setDesc(t('matrixUrgencyDaysDesc'))
            .addSlider(slider => slider
                .setLimits(0, 30, 1)
                .setValue(this.plugin.settings.matrixUrgencyDays)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.matrixUrgencyDays = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h4', {text: t('matrixImportantPriorities')});
        containerEl.createEl('p', {text: t('matrixImportantPrioritiesDesc'), cls: 'setting-item-description'});

        const priorities = ['highest', 'high', 'medium', 'low', 'lowest', 'normal'];
        const priorityLabels: Record<string, string> = {
            'highest': 'Highest (🔺)',
            'high': 'High (⏫)',
            'medium': 'Medium (🔼)',
            'low': 'Low (🔽)',
            'lowest': 'Lowest (⏬)',
            'normal': 'Normal'
        };

        priorities.forEach(p => {
            new Setting(containerEl)
                .setName(priorityLabels[p])
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.matrixImportantPriorities.includes(p))
                    .onChange(async (value) => {
                        if (value) {
                            if (!this.plugin.settings.matrixImportantPriorities.includes(p)) {
                                this.plugin.settings.matrixImportantPriorities.push(p);
                            }
                        } else {
                            this.plugin.settings.matrixImportantPriorities = this.plugin.settings.matrixImportantPriorities.filter(x => x !== p);
                        }
                        await this.plugin.saveSettings();
                    }));
        });

        containerEl.createEl('h3', {text: t('customStatuses')});
        containerEl.createEl('p', {text: t('customStatusesDesc'), cls: 'setting-item-description'});

        this.plugin.settings.customStatuses.forEach((status, index) => {
            const div = containerEl.createDiv({cls: 'custom-status-item', attr: { style: 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;' }});
            
            new Setting(div)
                .setClass('status-symbol')
                .addText(text => text
                    .setPlaceholder('x')
                    .setValue(status.symbol)
                    .onChange(async (value) => {
                        if (value.length > 1) value = value[0];
                        this.plugin.settings.customStatuses[index].symbol = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setClass('status-name')
                .addText(text => text
                    .setPlaceholder('Name')
                    .setValue(status.name)
                    .onChange(async (value) => {
                        this.plugin.settings.customStatuses[index].name = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setClass('status-color')
                .addColorPicker(color => color
                    .setValue(status.color)
                    .onChange(async (value) => {
                        this.plugin.settings.customStatuses[index].color = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setClass('status-completed')
                .addToggle(toggle => toggle
                    .setTooltip(t('statusCompleted'))
                    .setValue(status.isCompleted)
                    .onChange(async (value) => {
                        this.plugin.settings.customStatuses[index].isCompleted = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .addButton(btn => btn
                    .setIcon('trash')
                    .setTooltip('Remove Status')
                    .onClick(async () => {
                        this.plugin.settings.customStatuses.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText(t('addStatus'))
                .onClick(async () => {
                    this.plugin.settings.customStatuses.push({ symbol: '?', name: 'New Status', color: '#000000', isCompleted: false });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // --- Inbox Settings ---
        containerEl.createEl('h3', {text: t('inboxSettings')});
        
        new Setting(containerEl)
            .setName(t('inboxGrouping'))
            .setDesc(t('inboxGroupingDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('file', t('optionByFile'))
                .addOption('folder', t('optionByFolder'))
                .addOption('tag', t('optionByTag'))
                .addOption('none', t('optionNone'))
                .setValue(this.plugin.settings.inboxGrouping)
                .onChange(async (value) => {
                    this.plugin.settings.inboxGrouping = value as any;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('inboxSorting'))
            .setDesc(t('inboxSortingDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('priority', t('optionByPriority'))
                .addOption('created', t('optionByCreated'))
                .addOption('filename', t('optionByFilename'))
                .setValue(this.plugin.settings.inboxSorting)
                .onChange(async (value) => {
                    this.plugin.settings.inboxSorting = value as any;
                    await this.plugin.saveSettings();
                }));

        // --- Behavior Settings ---
        containerEl.createEl('h3', {text: t('behaviorSettings')});

        new Setting(containerEl)
            .setName(t('defaultDuration'))
            .setDesc(t('defaultDurationDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('15', t('option15Min'))
                .addOption('30', t('option30Min'))
                .addOption('60', t('option1Hour'))
                .addOption('120', t('option2Hours'))
                .setValue(this.plugin.settings.defaultDurationMinutes.toString())
                .onChange(async (value) => {
                    this.plugin.settings.defaultDurationMinutes = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('clickBehavior'))
            .setDesc(t('clickBehaviorDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('jump', t('optionJump'))
                .addOption('preview', t('optionPreview'))
                // .addOption('modal', 'Open in Modal') // Not implemented yet
                .setValue(this.plugin.settings.taskClickBehavior)
                .onChange(async (value) => {
                    this.plugin.settings.taskClickBehavior = value as any;
                    await this.plugin.saveSettings();
                }));

        // --- Format Settings ---
        containerEl.createEl('h3', {text: t('formatSettings')});

        new Setting(containerEl)
            .setName(t('dateFormat'))
            .setDesc(t('dateFormatDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('emoji', t('optionEmoji'))
                .addOption('dataview', t('optionDataview'))
                .addOption('wikilink', t('optionWikilink'))
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFormat = value as any;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('timeFormat'))
            .setDesc(t('timeFormatDesc'))
            .addDropdown(dropdown => dropdown
                .addOption('24h', t('option24h'))
                .addOption('12h', t('option12h'))
                .setValue(this.plugin.settings.timeFormat)
                .onChange(async (value) => {
                    this.plugin.settings.timeFormat = value as any;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', {text: t('colorSettings')});

        new Setting(containerEl)
            .setName(t('defaultColor'))
            .setDesc(t('defaultColorDesc'))
            .addColorPicker(color => color
                .setValue(this.plugin.settings.defaultColor)
                .onChange(async (value) => {
                    this.plugin.settings.defaultColor = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h4', {text: t('colorRules')});
        containerEl.createEl('p', {text: t('colorRulesDesc'), cls: 'setting-item-description'});

        this.plugin.settings.colorRules.forEach((rule, index) => {
            const div = containerEl.createDiv({cls: 'color-rule-item', attr: { style: 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;' }});
            
            new Setting(div)
                .setClass('color-rule-keyword')
                .addText(text => text
                    .setPlaceholder('Text or #tag')
                    .setValue(rule.keyword)
                    .onChange(async (value) => {
                        this.plugin.settings.colorRules[index].keyword = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setClass('color-rule-color')
                .addColorPicker(color => color
                    .setValue(rule.color)
                    .onChange(async (value) => {
                        this.plugin.settings.colorRules[index].color = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .addButton(btn => btn
                    .setIcon('trash')
                    .setTooltip('Remove Rule')
                    .onClick(async () => {
                        this.plugin.settings.colorRules.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show removal
                    }));
        });

        if (this.plugin.settings.colorRules.length < 10) {
            new Setting(containerEl)
                .addButton(btn => btn
                    .setButtonText(t('addColorRule'))
                    .onClick(async () => {
                        this.plugin.settings.colorRules.push({ keyword: '', color: '#000000' });
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        } else {
            containerEl.createEl('p', {text: t('maxRules'), cls: 'setting-item-description'});
        }
	}
}
