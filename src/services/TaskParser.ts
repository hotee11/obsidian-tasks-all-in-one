import { TFile } from 'obsidian';

export interface TaskAttributes {
    [key: string]: string | boolean | string[];
}

export interface Task {
    id: string; // Unique ID for the task (e.g., file path + line number)
    text: string; // The task text without attributes
    originalText: string; // The full original line
    status: string; // ' ' | 'x' | '-' | '/' | etc.
    completed: boolean;
    isTask: boolean; // True if it has a checkbox [ ], False if it's just a list item
    priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest' | 'normal';
    due?: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    end?: string; // YYYY-MM-DDTHH:mm:ss (Calculated from time range)
    scheduled?: string; // YYYY-MM-DD
    start?: string; // YYYY-MM-DD
    completedDate?: string; // YYYY-MM-DD
    tags: string[];
    attributes: TaskAttributes;
    file?: TFile;
    line?: number;
}

export class TaskParser {
    private static readonly PRIORITY_MAP: Record<string, string> = {
        '🔺': 'highest',
        '⏫': 'high',
        '🔼': 'medium',
        '🔽': 'low',
        '⏬': 'lowest'
    };

    private static readonly CHECKBOX_REGEX = /^\s*[-*]\s+\[(.)\]\s+(.*)$/;
    private static readonly LIST_ITEM_REGEX = /^\s*[-*]\s+(.*)$/;
    private static readonly TAG_REGEX = /#([^\s#]+)/g;
    private static readonly WIKILINK_DATE_REGEX = /\[\[(\d{4}-\d{2}-\d{2})\]\]/g;
    
    // Dataview syntax: [key:: value]
    private static readonly DATAVIEW_REGEX = /\[([^:\]]+)::([^\]]+)\]/g;
    
    // Classic syntax: @key(value) or @key
    private static readonly CLASSIC_REGEX = /@(\w+)(?:\(([^)]+)\))?/g;

    // Tasks plugin emojis
    private static readonly TASKS_EMOJI_REGEX = {
        due: /📅\s*(\d{4}-\d{2}-\d{2})/,
        scheduled: /⏳\s*(\d{4}-\d{2}-\d{2})/,
        start: /🛫\s*(\d{4}-\d{2}-\d{2})/,
        completed: /✅\s*(\d{4}-\d{2}-\d{2})/
    };

    // Regex for time range: HH:mm-HH:mm
    private static readonly TIME_RANGE_REGEX = /(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/;

    private completedSymbols: Set<string> = new Set(['x', 'X']);

    public setCompletedSymbols(symbols: string[]) {
        this.completedSymbols = new Set(symbols);
    }

    public parse(line: string, file?: TFile, lineNumber?: number): Task | null {
        const checkboxMatch = line.match(TaskParser.CHECKBOX_REGEX);
        const listItemMatch = !checkboxMatch ? line.match(TaskParser.LIST_ITEM_REGEX) : null;

        if (!checkboxMatch && !listItemMatch) {
            return null;
        }

        const isTask = !!checkboxMatch;
        const status = checkboxMatch ? checkboxMatch[1] : '';
        // Use configured symbols to determine completion
        const completed = isTask && this.completedSymbols.has(status);
        let content = checkboxMatch ? checkboxMatch[2] : listItemMatch![1];
        const originalText = line;
        const attributes: TaskAttributes = {};
        const tags: string[] = [];

        // 1. Parse Tags
        const tagMatches = content.match(TaskParser.TAG_REGEX);
        if (tagMatches) {
            tagMatches.forEach(tag => {
                tags.push(tag.substring(1)); // Remove #
                // We keep tags in text usually, but if we want to strip them:
                // content = content.replace(tag, ''); 
            });
        }

        // 2. Parse Dataview Inline Fields [key:: value]
        let match;
        while ((match = TaskParser.DATAVIEW_REGEX.exec(content)) !== null) {
            const key = match[1].trim();
            const value = match[2].trim();
            attributes[key] = value;
            content = content.replace(match[0], '');
        }

        // 3. Parse Classic Attributes @key(value)
        while ((match = TaskParser.CLASSIC_REGEX.exec(content)) !== null) {
            const key = match[1].trim();
            const value = match[2] ? match[2].trim() : true;
            attributes[key] = value;
            content = content.replace(match[0], '');
        }

        // 4. Parse Tasks Plugin Emojis
        let due = attributes['due'] as string;
        let scheduled = attributes['scheduled'] as string;
        let start = attributes['start'] as string;
        let completedDate = attributes['completed'] as string;

        // Parse time range if present
        const timeMatch = content.match(TaskParser.TIME_RANGE_REGEX);
        let startTimeStr = '';
        let endTimeStr = '';
        if (timeMatch) {
            startTimeStr = timeMatch[1];
            endTimeStr = timeMatch[2];
            // We don't store end time in Task interface yet, but we could if needed.
            // For now, we just need to combine it with the due date.
            content = content.replace(timeMatch[0], '');
        }

        const parseEmojiDate = (key: string, regex: RegExp) => {
            const m = content.match(regex);
            if (m) {
                attributes[key] = m[1];
                content = content.replace(m[0], '');
                return m[1];
            }
            return undefined;
        };

        if (!due) due = parseEmojiDate('due', TaskParser.TASKS_EMOJI_REGEX.due) as string;
        if (!scheduled) scheduled = parseEmojiDate('scheduled', TaskParser.TASKS_EMOJI_REGEX.scheduled) as string;
        if (!start) start = parseEmojiDate('start', TaskParser.TASKS_EMOJI_REGEX.start) as string;
        if (!completedDate) completedDate = parseEmojiDate('completed', TaskParser.TASKS_EMOJI_REGEX.completed) as string;

        // If we found a time range and a due date, append the time to the due date
        // Format: YYYY-MM-DDTHH:mm:ss
        let end: string | undefined;
        if (due && startTimeStr) {
            const datePart = due; // Assuming due is YYYY-MM-DD
            due = `${datePart}T${startTimeStr}:00`;
            if (endTimeStr) {
                end = `${datePart}T${endTimeStr}:00`;
            }
        }

        // 5. Parse Priority Icons
        let priority: Task['priority'] = 'normal';
        for (const [icon, level] of Object.entries(TaskParser.PRIORITY_MAP)) {
            if (content.includes(icon)) {
                priority = level as Task['priority'];
                attributes['priority'] = level;
                content = content.replace(icon, '');
                break;
            }
        }
        
        // Check for priority in attributes
        if (attributes['priority']) {
             const p = attributes['priority'];
             if (typeof p === 'string' && ['highest', 'high', 'medium', 'low', 'lowest'].includes(p)) {
                 priority = p as Task['priority'];
             }
        }

        // 6. Parse Wikilink Dates [[YYYY-MM-DD]] as due date if not present
        const wikilinkMatches = [...content.matchAll(TaskParser.WIKILINK_DATE_REGEX)];
        if (wikilinkMatches.length > 0) {
            // Use the last one or first one? Logic says maybe the one that looks like a due date.
            // For now, if no due date is set, use the first found date.
            if (!due) {
                due = wikilinkMatches[0][1];
                attributes['due'] = due;
            }
            // Remove wikilink dates from text? Maybe not, they might be part of the context.
            // content = content.replace(wikilinkMatches[0][0], '');
        }

        // Clean up text
        content = content.replace(/\s+/g, ' ').trim();

        return {
            id: file ? `${file.path}:${lineNumber}` : `unknown:${Date.now()}`,
            text: content,
            originalText,
            status,
            completed,
            isTask,
            priority,
            due,
            end,
            scheduled,
            start,
            completedDate,
            tags,
            attributes,
            file,
            line: lineNumber
        };
    }
}
