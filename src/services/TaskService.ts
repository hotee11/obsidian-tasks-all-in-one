import { App, TFile } from 'obsidian';
import { DateTime } from 'luxon';
import { MyPluginSettings } from '../settings';

export class TaskService {
    constructor(private app: App) {}

    async updateTaskTime(path: string, line: number, start: DateTime, end: DateTime, isAllDay: boolean, settings?: MyPluginSettings) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return;

        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        
        if (line < 0 || line >= lines.length) return;

        let taskLine = lines[line];
        
        // Regex to match checkbox: - [ ] or - [x]
        const checkboxRegex = /^(\s*-\s*\[.\]\s*)/;
        const match = taskLine.match(checkboxRegex);
        
        if (!match) return; // Not a task line

        const prefix = match[1];
        let body = taskLine.substring(prefix.length);

        // Format strings based on settings
        const timeFormat = settings?.timeFormat === '12h' ? 'h:mm a' : 'HH:mm';
        const timeStr = `${start.toFormat(timeFormat)}-${end.toFormat(timeFormat)}`;
        
        let dateStr = '';
        if (settings?.dateFormat === 'dataview') {
            dateStr = `[due:: ${start.toFormat('yyyy-MM-dd')}]`;
        } else if (settings?.dateFormat === 'wikilink') {
            dateStr = `[[${start.toFormat('yyyy-MM-dd')}]]`;
        } else {
            // Default: Emoji
            dateStr = `📅 ${start.toFormat('yyyy-MM-dd')}`;
        }

        // 1. Handle Time
        const timeRegex = /^(\d{1,2}:\d{2}(?: [AP]M)?-\d{1,2}:\d{2}(?: [AP]M)?\s*)/i; // Updated regex for 12h support
        if (isAllDay) {
            // Remove time if exists
            body = body.replace(timeRegex, '');
        } else {
            if (timeRegex.test(body)) {
                // Replace existing time
                body = body.replace(timeRegex, `${timeStr} `);
            } else {
                // Insert time at beginning
                body = `${timeStr} ${body}`;
            }
        }

        // 2. Handle Date
        // Remove existing date formats to avoid duplicates
        const emojiDateRegex = /(\s*📅\s*\d{4}-\d{2}-\d{2})/;
        const dataviewDateRegex = /(\s*\[due::\s*\d{4}-\d{2}-\d{2}\])/;
        const wikilinkDateRegex = /(\s*\[\[\d{4}-\d{2}-\d{2}\]\])/;

        body = body.replace(emojiDateRegex, '');
        body = body.replace(dataviewDateRegex, '');
        // Only remove wikilink date if it looks like a due date (this is risky, maybe just append if not found?)
        // For now, let's assume if we are writing back, we want to enforce our format.
        // But removing wikilinks might break other things.
        // Let's only replace if we find one of our known formats.
        
        // Strategy: Append new date format.
        body = `${body.trim()} ${dateStr}`;

        // Reconstruct line
        const newLine = `${prefix}${body}`;
        
        // Update lines array
        lines[line] = newLine;
        
        // Write back to file
        await this.app.vault.modify(file, lines.join('\n'));
    }

    async toggleTaskCompletion(path: string, line: number, completed: boolean) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return;

        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        
        if (line < 0 || line >= lines.length) return;

        let taskLine = lines[line];
        const checkboxRegex = /^(\s*-\s*\[)(.)(\]\s*)/;
        const match = taskLine.match(checkboxRegex);

        if (match) {
            const newStatus = completed ? 'x' : ' ';
            lines[line] = taskLine.replace(checkboxRegex, `$1${newStatus}$3`);
            await this.app.vault.modify(file, lines.join('\n'));
        }
    }

    getTasks() {
        return [];
    }
}
