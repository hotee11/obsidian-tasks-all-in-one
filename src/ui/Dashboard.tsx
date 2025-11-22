import React, { useEffect, useState, useRef, useMemo } from 'react';
import { App, TFile } from 'obsidian';
import { Draggable } from '@fullcalendar/interaction';
import { CalendarView, CalendarRef } from './CalendarView';
import { Markdown } from './Markdown';
import { TaskCache } from '../services/TaskCache';
import { Task } from '../services/TaskParser';
import { MyPluginSettings } from '../settings';

import { t } from '../settings';

interface DashboardProps {
    taskCache: TaskCache;
    app: App;
    settings: MyPluginSettings;
}

// --- Helper: Get Task Color ---
const getTaskColor = (task: Task, settings: MyPluginSettings) => {
    // 0. Check Custom Status Color
    if (task.status && task.status !== ' ') {
        const statusConfig = settings.customStatuses.find(s => s.symbol === task.status);
        if (statusConfig) return statusConfig.color;
    }

    const PRIORITY_COLORS: Record<string, string> = {
        'highest': '#d32f2f',
        'high': '#ef4444',
        'medium': '#f59e0b',
        'low': '#3b82f6',
        'lowest': '#64748b',
        'normal': '#374151'
    };

    // 1. Check Rules
    const matchedRule = settings.colorRules.find(rule => 
        task.text.includes(rule.keyword) || task.tags.some(tag => tag.includes(rule.keyword))
    );
    if (matchedRule) return matchedRule.color;

    // 2. Check Priority
    if (task.priority !== 'normal' && PRIORITY_COLORS[task.priority]) {
        return PRIORITY_COLORS[task.priority];
    }

    // 3. Default
    return settings.defaultColor || '#3b82f6';
};

// --- Icons ---
const ChevronLeft = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);
const ChevronRight = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const InboxIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
);
const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
);

interface QuadrantData {
    q1: Task[]; // Important & Urgent
    q2: Task[]; // Important & Not Urgent
    q3: Task[]; // Not Important & Urgent
    q4: Task[]; // Not Important & Not Urgent
    inbox: Task[]; // No Date & No Priority
}

interface InboxFileGroupProps {
    filePath: string;
    tasks: Task[];
    app: App;
    onTaskClick: (t: Task) => void;
}

interface TaskNode {
    task: Task;
    children: TaskNode[];
}

const buildTaskTree = (tasks: Task[]): TaskNode[] => {
    // Sort by line number to ensure correct order
    const sortedTasks = [...tasks].sort((a, b) => (a.line || 0) - (b.line || 0));
    
    const rootNodes: TaskNode[] = [];
    const stack: { node: TaskNode, indent: number }[] = [];

    sortedTasks.forEach(task => {
        const indentMatch = task.originalText.match(/^(\s+)/);
        const indent = indentMatch ? indentMatch[0].length : 0;
        const node: TaskNode = { task, children: [] };

        // Find parent
        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        if (stack.length > 0) {
            stack[stack.length - 1].node.children.push(node);
        } else {
            rootNodes.push(node);
        }

        stack.push({ node, indent });
    });

    return rootNodes;
};

const TaskTreeItem: React.FC<{ node: TaskNode, app: App, onTaskClick: (t: Task) => void, level?: number }> = React.memo(({ node, app, onTaskClick, level = 0 }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const hasChildren = node.children.length > 0;
    const isRoot = level === 0;

    return (
        <li className="pw-task-tree-item">
            <div 
                className={`pw-task-item pw-priority-${node.task.priority} ${hasChildren ? 'has-children' : ''} ${!isRoot ? 'is-child-task' : ''}`} 
                onClick={(e) => {
                    // Only trigger click if not clicking on collapse or children
                    e.stopPropagation();
                    onTaskClick(node.task);
                }}
                style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'stretch' 
                }}
                data-task-path={node.task.file?.path}
                data-task-line={node.task.line}
                data-task-text={node.task.text}
                title={node.task.text}
            >
                <div className="pw-task-header-row" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {hasChildren ? (
                        <span 
                            className="pw-task-collapse"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsCollapsed(!isCollapsed);
                            }}
                            style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                        >
                            ›
                        </span>
                    ) : (
                        <span className="pw-task-collapse" style={{ cursor: 'default', opacity: 0 }}>›</span>
                    )}
                    
                    <div className="pw-task-main">
                        <Markdown content={node.task.text} sourcePath={node.task.file?.path || ''} app={app} />
                    </div>
                </div>

                {hasChildren && !isCollapsed && (
                    <ul className="pw-subtask-container" style={{ 
                        listStyle: 'none', 
                        margin: '4px 0 4px 10px', /* Left margin to align with text */
                        padding: '0 0 0 16px', /* Padding for content */
                        borderLeft: '2px solid var(--pw-zinc-200)' /* Visual guide line */
                    }}>
                        {node.children.map(child => (
                            <TaskTreeItem key={child.task.id} node={child} app={app} onTaskClick={onTaskClick} level={level + 1} />
                        ))}
                    </ul>
                )}
            </div>
        </li>
    );
});

const InboxFileGroup: React.FC<InboxFileGroupProps> = React.memo(({ filePath, tasks, app, onTaskClick }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    // Get filename without path and extension
    const fileName = filePath.split('/').pop()?.replace(/\.md$/, '') || filePath;
    
    const taskTree = buildTaskTree(tasks);

    return (
        <div className={`pw-inbox-group ${!isCollapsed ? 'expanded' : ''}`}>
            <div 
                className="pw-group-header" 
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={filePath}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
                <span className="pw-collapse-icon" style={{
                    display: 'inline-block',
                    marginRight: '6px',
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 0.2s',
                    fontSize: '0.8em'
                }}>▶</span>
                {fileName}
            </div>
            {!isCollapsed && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {taskTree.map(node => (
                        <TaskTreeItem key={node.task.id} node={node} app={app} onTaskClick={onTaskClick} />
                    ))}
                </ul>
            )}
        </div>
    );
});

export const Dashboard: React.FC<DashboardProps> = ({ taskCache, app, settings }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    // const [quadrants, setQuadrants] = useState<QuadrantData>({ q1: [], q2: [], q3: [], q4: [], inbox: [] }); // Removed in favor of useMemo
    const [mainView, setMainView] = useState<string>(settings.defaultView || 'timeGridWeek');
    const [showAllDay, setShowAllDay] = useState(true);
    const [currentTitle, setCurrentTitle] = useState('');
    const [showInbox, setShowInbox] = useState(true);
    
    // --- Search State (Debounced) ---
    const [searchText, setSearchText] = useState("");
    const [deferredSearchText, setDeferredSearchText] = useState("");

    const inboxRef = useRef<HTMLDivElement>(null);
    const calendarRef = useRef<CalendarRef>(null);
    
    // Optimization: Reuse TaskService instance
    const taskService = useMemo(() => {
        const { TaskService } = require('../services/TaskService');
        return new TaskService(app);
    }, [app]);

    const handlePrev = () => calendarRef.current?.prev();
    const handleNext = () => calendarRef.current?.next();
    const handleToday = () => calendarRef.current?.today();

    // --- Debounce Search ---
    useEffect(() => {
        const handler = setTimeout(() => {
            setDeferredSearchText(searchText);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchText]);

    // --- Filter Tasks (Search Only) ---
    const searchedTasks = useMemo(() => {
        if (!deferredSearchText) return tasks;
        const lowerQuery = deferredSearchText.toLowerCase();
        return tasks.filter(t => t.text.toLowerCase().includes(lowerQuery));
    }, [tasks, deferredSearchText]);

    // --- Classify Tasks (Memoized) ---
    // 1. Inbox Tasks (Lightweight)
    const inboxTasks = useMemo(() => {
        if (!showInbox) return [];

        // Use searchedTasks to respect search filter
        return searchedTasks.filter(t => 
            t.isTask &&
            !t.completed && 
            !t.due && 
            t.priority === 'normal'
        );
    }, [searchedTasks, showInbox]);

    // 2. Matrix Tasks (Heavyweight)
    const matrixData = useMemo(() => {
        if (mainView !== 'matrix') {
            return { q1: [], q2: [], q3: [], q4: [] };
        }

        const allTasks = searchedTasks;
        const now = new Date();
        // Use settings for urgency threshold
        const urgencyDays = settings.matrixUrgencyDays !== undefined ? settings.matrixUrgencyDays : 3;
        const urgencyThresholdDate = new Date(now.getTime() + urgencyDays * 24 * 60 * 60 * 1000);

        const cleanTag = (tag: string) => tag.startsWith('#') ? tag.substring(1) : tag;
        const importantTag = cleanTag(settings.importantTag);
        const urgentTag = cleanTag(settings.urgentTag);

        const isImportant = (t: Task) => {
            if (t.tags.includes(importantTag)) return true;
            // Use new settings for important priorities
            if (settings.matrixImportantPriorities && settings.matrixImportantPriorities.length > 0) {
                return settings.matrixImportantPriorities.includes(t.priority);
            }
            // Fallback to old setting if new one is empty (migration safety)
            if (settings.treatHighPriorityAsImportant && ['highest', 'high'].includes(t.priority)) return true;
            return false;
        };
        
        const isUrgent = (t: Task) => {
            if (t.tags.includes(urgentTag)) return true;

            if (!t.due) return false;
            const dueDate = new Date(t.due);
            if (isNaN(dueDate.getTime())) return false;
            return dueDate <= urgencyThresholdDate;
        };

        const data = { q1: [] as Task[], q2: [] as Task[], q3: [] as Task[], q4: [] as Task[] };

        allTasks.forEach(t => {
            if (t.completed) return; 
            if (!t.isTask) return;

            const important = isImportant(t);
            const urgent = isUrgent(t);

            // Exclude Inbox tasks from Matrix (No Due, Normal Priority, Not Important, Not Urgent)
            // Robust check: !t.due (undefined or empty) AND priority is normal
            const isInbox = (!t.due || t.due === '') && (t.priority === 'normal' || !t.priority);
            
            if (isInbox && !important && !urgent) {
                return;
            }

            if (important && urgent) data.q1.push(t);
            else if (important && !urgent) data.q2.push(t);
            else if (!important && urgent) data.q3.push(t);
            else data.q4.push(t); 
        });

        return data;
    }, [searchedTasks, settings, mainView]);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const updateTasks = () => {
            const allTasks = taskCache.getAllTasks();
            console.log('Dashboard: Updating tasks', allTasks.length);
            setTasks(allTasks);
            // setQuadrants(classifyTasks(allTasks)); // Handled by useMemo now
        };

        const debouncedUpdate = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(updateTasks, 200);
        };

        // Initial load
        updateTasks();

        // Subscribe to updates
        taskCache.on('update', debouncedUpdate);
        taskCache.on('initialized', updateTasks);

        return () => {
            taskCache.off('update', debouncedUpdate);
            taskCache.off('initialized', updateTasks);
            clearTimeout(timeoutId);
        };
    }, [taskCache]); // Removed settings dependency as it's handled in useMemo

    useEffect(() => {
        if (!inboxRef.current) return;

        const draggable = new Draggable(inboxRef.current, {
            itemSelector: '.pw-task-item',
            eventData: (eventEl) => {
                const path = eventEl.getAttribute('data-task-path');
                const line = eventEl.getAttribute('data-task-line');
                const text = eventEl.getAttribute('data-task-text');
                
                return {
                    title: text || 'New Task',
                    duration: '01:00',
                    extendedProps: {
                        path: path,
                        line: line ? parseInt(line) : undefined
                    }
                };
            }
        });

        return () => {
            draggable.destroy();
        };
    }, [showInbox]);

    const handleTaskClick = (t: Task) => {
        if (t.file && t.line !== undefined) {
            app.workspace.getLeaf().openFile(t.file, { eState: { line: t.line } });
        }
    };

    const handleTaskToggle = async (e: React.MouseEvent, originalTask: Task) => {
        e.stopPropagation(); // Prevent opening the file
        if (originalTask && originalTask.file && originalTask.line !== undefined) {
            await taskService.toggleTaskCompletion(originalTask.file.path, originalTask.line, !originalTask.completed);
        }
    };

    const renderTaskItem = (t: Task) => {
        // Simple indentation check: if original text starts with spaces/tabs
        const indentMatch = t.originalText.match(/^(\s+)/);
        const isSubtask = indentMatch && indentMatch[0].length > 0;
        const indentStyle = isSubtask ? { paddingLeft: '16px', borderLeft: '2px solid var(--pw-border)' } : {};

        const color = getTaskColor(t, settings);
        const statusConfig = settings.customStatuses.find(s => s.symbol === t.status);

        return (
            <li 
                key={t.id} 
                className={`pw-task-item pw-priority-${t.priority}`} 
                onClick={() => handleTaskClick(t)}
                style={{ ...indentStyle, color: color, '--pw-task-color': color } as React.CSSProperties & { [key: string]: string }} // Apply calculated color
            >
                {/* Checkbox (Visual & Functional) */}
                <div 
                    className={`pw-event-checkbox ${t.completed ? 'is-checked' : ''}`}
                    onClick={(e) => handleTaskToggle(e, t)}
                    style={{ 
                        marginRight: '8px', 
                        width: '16px', 
                        height: '16px', 
                        flexShrink: 0,
                        borderColor: statusConfig ? statusConfig.color : 'currentColor',
                        backgroundColor: t.completed && statusConfig ? statusConfig.color : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: t.completed ? '#fff' : (statusConfig ? statusConfig.color : 'currentColor')
                    }}
                >
                    {/* Render Symbol if not standard checkmark, or if it is a custom status */}
                    {t.status !== ' ' && t.status !== 'x' && t.status !== 'X' ? (
                        <span>{t.status}</span>
                    ) : (
                        t.completed && (
                            <svg viewBox="0 0 12 12" width="10" height="10">
                                <path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )
                    )}
                </div>

                <div className="pw-task-main">
                    {isSubtask && <span style={{color: 'var(--pw-text-muted)', marginRight: '4px'}}>└</span>}
                    <Markdown content={t.text} sourcePath={t.file?.path || ''} app={app} />
                </div>
                {/* Removed Date/Meta to match Calendar View style more closely, or keep it subtle? 
                    User said "Style is obviously different". Calendar view usually hides date in the block.
                    But Matrix view needs context. Let's keep it but make it very subtle if needed.
                    Actually, let's keep it for now but maybe the user wants the 'look' of the card.
                */}
                <div className="pw-task-meta">
                    {t.file && (
                        <span 
                            className="pw-task-source-pill"
                            onClick={(e) => {
                                e.stopPropagation();
                                app.workspace.openLinkText(t.file!.path, '', false);
                            }}
                            title={t.file.path}
                        >
                            {t.file.basename}
                        </span>
                    )}
                    {t.due && <span className="pw-task-date">{t.due}</span>}
                </div>
            </li>
        );
    };

    const renderMatrixView = () => {
        const LIMIT = 50;
        const renderQuadrant = (title: string, tasks: Task[], className: string) => (
            <div className={`pw-quadrant ${className}`}>
                <div className="pw-quadrant-header">
                    <span>{title}</span>
                    <span className="pw-count-badge">{tasks.length}</span>
                </div>
                <div className="pw-quadrant-content">
                    <ul>
                        {tasks.slice(0, LIMIT).map(renderTaskItem)}
                        {tasks.length > LIMIT && (
                            <li className="pw-more-tasks">
                                ... and {tasks.length - LIMIT} more tasks
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        );

        return (
            <div className="pw-matrix-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="pw-quadrant-container pw-quadrant-full" style={{ flex: 1 }}>
                    {renderQuadrant(settings.matrixLabelQ1 || "重要且紧急 🔥", matrixData.q1, "pw-quadrant-q1")}
                    {renderQuadrant(settings.matrixLabelQ2 || "重要不紧急 📅", matrixData.q2, "pw-quadrant-q2")}
                    {renderQuadrant(settings.matrixLabelQ3 || "紧急不重要 ⚡", matrixData.q3, "pw-quadrant-q3")}
                    {renderQuadrant(settings.matrixLabelQ4 || "不重要不紧急 ☕", matrixData.q4, "pw-quadrant-q4")}
                </div>
            </div>
        );
    };

    const renderInbox = useMemo(() => {
        if (!showInbox) return null; // Skip rendering if hidden

        // 1. Sort Tasks
        const sortedTasks = [...inboxTasks].sort((a, b) => {
            if (settings.inboxSorting === 'priority') {
                const pMap: Record<string, number> = { 'highest': 0, 'high': 1, 'medium': 2, 'normal': 3, 'low': 4, 'lowest': 5 };
                const pa = pMap[a.priority] ?? 3;
                const pb = pMap[b.priority] ?? 3;
                if (pa !== pb) return pa - pb;
            } else if (settings.inboxSorting === 'filename') {
                const fa = a.file?.basename || '';
                const fb = b.file?.basename || '';
                return fa.localeCompare(fb);
            }
            // Default: Created (Line Number / File Order) - already roughly sorted by cache
            return (a.line || 0) - (b.line || 0);
        });

        // 2. Group Tasks
        const groupedTasks: Record<string, Task[]> = {};
        
        if (settings.inboxGrouping === 'none') {
            groupedTasks['All Tasks'] = sortedTasks;
        } else if (settings.inboxGrouping === 'folder') {
            sortedTasks.forEach(t => {
                const folder = t.file?.parent?.path || 'Unknown';
                if (!groupedTasks[folder]) groupedTasks[folder] = [];
                groupedTasks[folder].push(t);
            });
        } else if (settings.inboxGrouping === 'tag') {
            sortedTasks.forEach(t => {
                const tag = t.tags.length > 0 ? t.tags[0] : '#untagged';
                if (!groupedTasks[tag]) groupedTasks[tag] = [];
                groupedTasks[tag].push(t);
            });
        } else {
            // Default: File
            sortedTasks.forEach(t => {
                const path = t.file?.path || 'Unknown';
                if (!groupedTasks[path]) groupedTasks[path] = [];
                groupedTasks[path].push(t);
            });
        }

        const entries = Object.entries(groupedTasks);
        const INBOX_LIMIT = 50; // Increased limit

        return (
            <>
                {entries.slice(0, INBOX_LIMIT).map(([groupName, tasks]) => (
                    <InboxFileGroup 
                        key={groupName} 
                        filePath={groupName} 
                        tasks={tasks} 
                        app={app} 
                        onTaskClick={handleTaskClick} 
                    />
                ))}
                {entries.length > INBOX_LIMIT && (
                    <div style={{ padding: '8px', color: 'var(--pw-text-tertiary)', fontSize: '12px', textAlign: 'center' }}>
                        ... {entries.length - INBOX_LIMIT} more groups
                    </div>
                )}
            </>
        );
    }, [inboxTasks, app, settings.inboxGrouping, settings.inboxSorting]);

    return (
        <div 
            className="pw-dashboard-grid" 
            style={{ 
                '--pw-plugin-theme-color': settings.defaultColor || '#3b82f6'
            } as React.CSSProperties}
        >
            <div className="pw-dashboard-card" style={{
                display: 'grid',
                gridTemplateColumns: showInbox ? '4fr 1fr' : '1fr 0px',
                height: '100%',
                width: '100%',
                overflow: 'hidden'
            }}>
                <div className="pw-main-area">
                {/* --- 统一 Header (永远显示) --- */}
                <div className="pw-calendar-header">
                    <div className="pw-header-left">
                        {mainView !== 'matrix' && (
                            <div className="pw-nav-group">
                                <button className="pw-nav-btn pw-nav-prev" onClick={handlePrev} title="Previous">
                                    <ChevronLeft />
                                </button>
                                <button className="pw-nav-btn pw-nav-today" onClick={handleToday}>
                                    Today
                                </button>
                                <button className="pw-nav-btn pw-nav-next" onClick={handleNext} title="Next">
                                    <ChevronRight />
                                </button>
                            </div>
                        )}
                        <div style={{ marginLeft: '12px', fontWeight: 600, fontSize: '15px' }}>
                            {mainView === 'matrix' ? 'Eisenhower Matrix' : currentTitle}
                        </div>
                    </div>

                    <div className="pw-header-center">
                        <div className="pw-view-toggle-group">
                            <button 
                                className={`pw-view-toggle ${mainView === 'timeGridDay' ? 'active' : ''}`}
                                onClick={() => setMainView('timeGridDay')}
                            >
                                Day
                            </button>
                            <button 
                                className={`pw-view-toggle ${mainView === 'timeGridWeek' ? 'active' : ''}`}
                                onClick={() => setMainView('timeGridWeek')}
                            >
                                Week
                            </button>
                            <button 
                                className={`pw-view-toggle ${mainView === 'dayGridMonth' ? 'active' : ''}`}
                                onClick={() => setMainView('dayGridMonth')}
                            >
                                Month
                            </button>
                            <button 
                                className={`pw-view-toggle ${mainView === 'matrix' ? 'active' : ''}`}
                                onClick={() => setMainView('matrix')}
                            >
                                Matrix
                            </button>
                        </div>
                    </div>

                    <div className="pw-header-right">
                        {(mainView === 'timeGridWeek' || mainView === 'timeGridDay') && (
                            <button 
                                className={`pw-icon-btn ${showAllDay ? 'active' : ''}`}
                                onClick={() => setShowAllDay(!showAllDay)}
                                title={showAllDay ? "Hide All-Day" : "Show All-Day"}
                                style={{ fontSize: '12px', width: 'auto', padding: '0 8px' }}
                            >
                                {showAllDay ? 'Hide All-Day' : 'Show All-Day'}
                            </button>
                        )}
                        <div className="pw-search-container">
                            <SearchIcon />
                            <input 
                                type="text" 
                                className="pw-search-input" 
                                placeholder="Search..." 
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>

                        <button 
                            className={`pw-icon-btn ${showInbox ? 'active' : ''}`} 
                            onClick={() => setShowInbox(!showInbox)} 
                            title="Toggle Inbox"
                        >
                            <InboxIcon />
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, display: mainView === 'matrix' ? 'none' : 'flex', flexDirection: 'column', height: '100%' }}>
                        <CalendarView 
                            ref={calendarRef}
                            taskCache={taskCache} 
                            settings={settings} 
                            app={app}
                            onTitleChange={setCurrentTitle}
                            onViewChange={setMainView}
                            currentView={mainView === 'matrix' ? 'timeGridWeek' : mainView}
                            showAllDay={showAllDay}
                        />
                    </div>
                    {mainView === 'matrix' && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {renderMatrixView()}
                        </div>
                    )}
                </div>
            </div>
                <div className="pw-sidebar" style={{ display: showInbox ? 'flex' : 'none' }}>
                    <div className="pw-inbox-header">
                        <span className="pw-inbox-title">INBOX ({inboxTasks.length})</span>
                        <button 
                            className="pw-icon-btn"
                            onClick={() => {
                                const allTasks = taskCache.getAllTasks();
                                console.log('Manual Inbox Refresh:', allTasks.length);
                                setTasks(allTasks);
                            }}
                            title="Force Refresh"
                            style={{ width: '28px', height: '28px' }}
                        >
                            <RefreshIcon />
                        </button>
                    </div>
                    <div className="pw-inbox" ref={inboxRef}>
                        {renderInbox}
                    </div>
                </div>
            </div>
        </div>
    );
};
