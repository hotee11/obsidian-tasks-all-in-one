import React, { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventInput } from '@fullcalendar/core';
import { App } from 'obsidian';
import { DateTime } from 'luxon';
import { TaskCache } from '../services/TaskCache';
import { TaskService } from '../services/TaskService';
import { Task } from '../services/TaskParser';
import { MyPluginSettings } from '../settings';
import { Markdown } from './Markdown';

export interface CalendarRef {
    prev: () => void;
    next: () => void;
    today: () => void;
    changeView: (view: string) => void;
}

interface CalendarViewProps {
    taskCache: TaskCache;
    settings: MyPluginSettings;
    app: App;
    onTitleChange: (title: string) => void;
    onViewChange: (view: string) => void;
    currentView: string;
    showAllDay: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
    'highest': '#d32f2f', // Critical/Highest
    'high': '#ef4444',    // High
    'medium': '#f59e0b',  // Medium
    'low': '#3b82f6',     // Low
    'lowest': '#64748b',  // Lowest
    'normal': '#374151'   // Normal
};

export const CalendarView = forwardRef<CalendarRef, CalendarViewProps>(({ taskCache, settings, app, onTitleChange, onViewChange, currentView, showAllDay }, ref) => {
    const [events, setEvents] = useState<EventInput[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<EventInput[]>([]);
    const [searchText, setSearchText] = useState('');
    const [manuallyToggled, setManuallyToggled] = useState<Map<string, boolean>>(new Map());
    
    const calendarRef = useRef<FullCalendar>(null);
    const taskService = useMemo(() => new TaskService(app), [app]);
    
    // Cache for subtask hierarchy: filePath -> (taskId -> subtasks[])
    const hierarchyCache = useRef<Map<string, Map<string, Task[]>>>(new Map());

    useImperativeHandle(ref, () => ({
        prev: () => calendarRef.current?.getApi().prev(),
        next: () => calendarRef.current?.getApi().next(),
        today: () => calendarRef.current?.getApi().today(),
        changeView: (view: string) => calendarRef.current?.getApi().changeView(view)
    }));

    useEffect(() => {
        if (calendarRef.current && currentView !== 'matrix') {
             const api = calendarRef.current.getApi();
             if (api.view.type !== currentView) {
                 api.changeView(currentView);
             }
        }
    }, [currentView]);

    // Refetch events when dependencies change
    useEffect(() => {
        const refetch = () => {
            hierarchyCache.current.clear(); // Invalidate cache on data update
            calendarRef.current?.getApi().refetchEvents();
        };

        taskCache.on('update', refetch);
        taskCache.on('initialized', refetch);

        return () => {
            taskCache.off('update', refetch);
            taskCache.off('initialized', refetch);
        };
    }, [taskCache]);

    // Refetch when settings or search changes
    useEffect(() => {
        calendarRef.current?.getApi().refetchEvents();
    }, [settings, searchText, showAllDay]);

    const fetchEvents = useCallback((info: any, successCallback: any, failureCallback: any) => {
        // console.log(`Fetching events for range: ${info.startStr} to ${info.endStr}`);
        const allTasks = taskCache.getAllTasks();
        
        // Optimization: Use string comparison for dates to avoid expensive DateTime.fromISO calls
        // info.startStr and info.endStr are ISO strings. We extract the date part YYYY-MM-DD.
        const startStr = info.startStr.substring(0, 10);
        const endStr = info.endStr.substring(0, 10);

        // 1. Filter by Date Range & Basic Criteria
        const visibleTasks = allTasks.filter(task => {
            if (!task.due) return false;
            if (!settings.showCompleted && task.completed) return false;
            
            // Fast string comparison (lexicographical comparison works for ISO dates)
            return task.due >= startStr && task.due < endStr;
        });

        // 2. Filter by Search
        const filtered = !searchText.trim() 
            ? visibleTasks 
            : visibleTasks.filter(t => t.text.toLowerCase().includes(searchText.toLowerCase()));

        // 3. Grouping & Subtask Logic (Only for relevant files)
        // Use a Map to deduplicate files by path to ensure we have the TFile object
        const relevantFiles = new Map<string, any>(); 
        
        filtered.forEach(t => {
            if (t.file) {
                relevantFiles.set(t.file.path, t.file);
            }
        });
        
        const subtaskMap = new Map<string, Task[]>();

        // Retrieve full task lists only for the files that have visible tasks
        for (const [path, file] of relevantFiles) {
            // Check cache first
            if (hierarchyCache.current.has(path)) {
                const fileSubtasks = hierarchyCache.current.get(path)!;
                for (const [taskId, subtasks] of fileSubtasks) {
                    subtaskMap.set(taskId, subtasks);
                }
                continue;
            }

            const fileTasks = taskCache.getTasks(file);
            if (fileTasks) {
                // Build hierarchy for this file
                // Sort by line number
                const sortedTasks = [...fileTasks].sort((a, b) => (a.line || 0) - (b.line || 0));
                const fileSubtaskMap = new Map<string, Task[]>();
                
                const stack: { task: Task, indent: number }[] = [];
                for (const task of sortedTasks) {
                    const indentMatch = task.originalText.match(/^(\s*)/);
                    const indent = indentMatch ? indentMatch[0].length : 0;
                    
                    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                        stack.pop();
                    }
                    
                    if (stack.length > 0) {
                        const parent = stack[stack.length - 1].task;
                        if (!fileSubtaskMap.has(parent.id)) {
                            fileSubtaskMap.set(parent.id, []);
                        }
                        fileSubtaskMap.get(parent.id)!.push(task);
                    }
                    
                    stack.push({ task, indent });
                }

                // Cache it
                hierarchyCache.current.set(path, fileSubtaskMap);

                // Merge into main map
                for (const [taskId, subtasks] of fileSubtaskMap) {
                    subtaskMap.set(taskId, subtasks);
                }
            }
        }

        // 4. Generate Events
        const calendarEvents: EventInput[] = filtered.map(task => {
            let color = settings.defaultColor || '#3b82f6';
            
            // 0. Check Custom Status Color
            if (task.status && task.status !== ' ') {
                const statusConfig = settings.customStatuses.find(s => s.symbol === task.status);
                if (statusConfig) color = statusConfig.color;
            }

            // 1. Check Rules (Override status color if rule matches? Or maybe status should be higher priority? 
            // Usually status color (like "Cancelled") is more important than tag color.
            // Let's keep status color as base, but allow rules to override if they are specific.
            // Actually, let's make status color priority if it exists.
            const statusConfig = settings.customStatuses.find(s => s.symbol === task.status);
            
            if (!statusConfig) {
                const matchedRule = settings.colorRules.find(rule => 
                    task.text.includes(rule.keyword) || task.tags.some(tag => tag.includes(rule.keyword))
                );

                if (matchedRule) {
                    color = matchedRule.color;
                } else if (task.priority !== 'normal' && PRIORITY_COLORS[task.priority]) {
                    color = PRIORITY_COLORS[task.priority];
                }
            } else {
                color = statusConfig.color;
            }

            const subtasks = subtaskMap.get(task.id) || [];
            const classNames = ['pw-event-item'];
            if (task.completed) classNames.push('pw-event-completed');
            
            return {
                id: task.id,
                title: task.text,
                start: task.due,
                end: task.end,
                allDay: !task.due?.includes('T'),
                backgroundColor: color,
                borderColor: color,
                classNames: classNames,
                extendedProps: {
                    originalTask: task,
                    subtasks: subtasks,
                    displayColor: color
                }
            };
        });

        successCallback(calendarEvents);
    }, [taskCache, settings, searchText]);

    // Update title when view or date changes
    const handleDatesSet = (arg: any) => {
        // Always update title
        onTitleChange(arg.view.title);
        
        // Sync view change back to parent if it happened internally
        // We check against currentView to avoid loops, but we must ensure
        // we catch the change if the internal view is different from props.
        if (arg.view.type !== currentView) {
            console.log(`View Sync: Internal ${arg.view.type} !== Prop ${currentView}`);
            onViewChange(arg.view.type);
        }
    };

    const formatTime = (hour: number) => {
        return `${hour.toString().padStart(2, '0')}:00:00`;
    };

    const handleDrop = (info: any) => {
        const date = DateTime.fromJSDate(info.date);
        const path = info.draggedEl.getAttribute('data-task-path');
        const line = info.draggedEl.getAttribute('data-task-line');
        const isAllDay = info.allDay;
        
        if (path && line) {
            // Use default duration from settings
            const durationMinutes = settings.defaultDurationMinutes || 60;
            const endDate = date.plus({ minutes: durationMinutes });
            taskService.updateTaskTime(path, parseInt(line), date, endDate, isAllDay, settings);
        }
    };

    const handleEventDrop = (info: any) => {
        const event = info.event;
        const originalTask = event.extendedProps.originalTask;
        if (originalTask && originalTask.file) {
            const start = DateTime.fromJSDate(event.start);
            const end = event.end ? DateTime.fromJSDate(event.end) : start.plus({ minutes: settings.defaultDurationMinutes || 60 });
            taskService.updateTaskTime(originalTask.file.path, originalTask.line, start, end, event.allDay, settings);
        }
    };

    const handleEventResize = (info: any) => {
        const event = info.event;
        const originalTask = event.extendedProps.originalTask;
        if (originalTask && originalTask.file) {
            const start = DateTime.fromJSDate(event.start);
            const end = event.end ? DateTime.fromJSDate(event.end) : start.plus({ minutes: settings.defaultDurationMinutes || 60 });
            taskService.updateTaskTime(originalTask.file.path, originalTask.line, start, end, event.allDay, settings);
        }
    };

    const handleEventClick = (info: any) => {
        const originalTask = info.event.extendedProps.originalTask;
        if (originalTask && originalTask.file && originalTask.line !== undefined) {
            if (settings.taskClickBehavior === 'preview') {
                app.workspace.getLeaf('split').openFile(originalTask.file, { eState: { line: originalTask.line } });
            } else {
                // Default: Jump
                app.workspace.getLeaf().openFile(originalTask.file, { eState: { line: originalTask.line } });
            }
        }
    };

    const handleTaskToggle = async (e: React.MouseEvent, originalTask: Task) => {
        e.stopPropagation(); // Prevent opening the file
        if (originalTask && originalTask.file && originalTask.line !== undefined) {
            await taskService.toggleTaskCompletion(originalTask.file.path, originalTask.line, !originalTask.completed);
        }
    };

    const setExpansionState = (e: React.MouseEvent, taskId: string, nextState: boolean) => {
        e.stopPropagation();
        setManuallyToggled(prev => {
            const next = new Map(prev);
            next.set(taskId, nextState);
            return next;
        });
    };

    const renderEventContent = (eventInfo: any) => {
        const priority = eventInfo.event.extendedProps.originalTask?.priority || 'normal';
        const subtasks = eventInfo.event.extendedProps.subtasks as Task[] || [];
        const originalTask = eventInfo.event.extendedProps.originalTask;
        const title = eventInfo.event.title;
        const isMonthView = eventInfo.view.type === 'dayGridMonth';
        const displayColor = eventInfo.event.extendedProps.displayColor;
        const isAllDay = eventInfo.event.allDay;
        const taskId = eventInfo.event.id;
        const status = originalTask?.status || ' ';
        const statusConfig = settings.customStatuses.find(s => s.symbol === status);
        
        // Expansion Logic
        // Default: All-Day -> Collapsed (false), Timed -> Expanded (true)
        const defaultExpanded = !isAllDay;
        const isExpanded = manuallyToggled.has(taskId) ? manuallyToggled.get(taskId)! : defaultExpanded;
        const hasSubtasks = subtasks.length > 0;

        // Format time: "6:00 AM"
        const startTime = (!isAllDay && eventInfo.event.start) 
            ? DateTime.fromJSDate(eventInfo.event.start).toFormat('h:mm a') 
            : '';

        return (
            <div 
                className={`pw-event-content pw-priority-${priority} ${isMonthView ? 'pw-is-month-view' : ''} ${isAllDay ? 'pw-is-all-day' : ''}`}
                style={{ color: displayColor }}
            >
                {/* Header: Time & Checkbox (Only for Day/Week view) */}
                {!isMonthView && !isAllDay && (
                    <div className="pw-event-header">
                        <span className="pw-event-time-badge">{startTime}</span>
                        <div 
                            className={`pw-event-checkbox ${originalTask?.completed ? 'is-checked' : ''}`}
                            onClick={(e) => handleTaskToggle(e, originalTask)}
                            style={{
                                borderColor: statusConfig ? statusConfig.color : 'currentColor',
                                backgroundColor: originalTask?.completed && statusConfig ? statusConfig.color : 'transparent',
                                color: originalTask?.completed ? '#fff' : (statusConfig ? statusConfig.color : 'currentColor'),
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}
                        >
                            {status !== ' ' && status !== 'x' && status !== 'X' ? (
                                <span>{status}</span>
                            ) : (
                                originalTask?.completed && (
                                    <svg viewBox="0 0 12 12" width="10" height="10">
                                        <path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* All-Day Layout: Single Row Header */}
                {!isMonthView && isAllDay && (
                    <div className="pw-event-header-allday">
                        {hasSubtasks && (
                            <div 
                                className={`pw-event-toggle ${isExpanded ? 'is-expanded' : ''}`}
                                onClick={(e) => setExpansionState(e, taskId, !isExpanded)}
                            >
                                <svg viewBox="0 0 10 10" width="8" height="8">
                                    <path d="M3 2l4 3-4 3" fill="currentColor"/>
                                </svg>
                            </div>
                        )}
                        <div className="pw-event-title-row">
                            <Markdown content={title} sourcePath="" app={app} stripMarkdown={false} />
                        </div>
                        <div 
                            className={`pw-event-checkbox ${originalTask?.completed ? 'is-checked' : ''}`}
                            onClick={(e) => handleTaskToggle(e, originalTask)}
                            style={{
                                borderColor: statusConfig ? statusConfig.color : 'currentColor',
                                backgroundColor: originalTask?.completed && statusConfig ? statusConfig.color : 'transparent',
                                color: originalTask?.completed ? '#fff' : (statusConfig ? statusConfig.color : 'currentColor'),
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}
                        >
                            {status !== ' ' && status !== 'x' && status !== 'X' ? (
                                <span>{status}</span>
                            ) : (
                                originalTask?.completed && (
                                    <svg viewBox="0 0 12 12" width="10" height="10">
                                        <path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* Main Content & Subtasks */}
                <div className="pw-event-main">
                    {(isMonthView || !isAllDay) && (
                        <div className="pw-event-title">
                            {/* Optimization: Strip markdown in month view for performance */}
                            <Markdown content={title} sourcePath="" app={app} stripMarkdown={isMonthView} />
                        </div>
                    )}
                    
                    {/* Subtasks - Render if Expanded */}
                    {!isMonthView && hasSubtasks && isExpanded && (
                        <div className="pw-event-subtasks">
                            {subtasks.map((st, i) => (
                                <div key={i} className="pw-subtask-item">
                                    {st.isTask ? (
                                        <div 
                                            className={`pw-subtask-checkbox ${st.completed ? 'is-checked' : ''}`}
                                            onClick={(e) => handleTaskToggle(e, st)}
                                        >
                                            {st.completed && (
                                                <svg viewBox="0 0 12 12" width="10" height="10">
                                                    <path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="pw-subtask-bullet">•</span>
                                    )}
                                    <div className={`pw-subtask-text ${st.completed ? 'is-completed' : ''}`}>
                                        <Markdown content={st.text} sourcePath="" app={app} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="pw-calendar-view" style={{ position: 'relative', height: '100%' }}>
            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={currentView === 'matrix' ? 'timeGridWeek' : currentView}
                headerToolbar={false} // Hide default header
                events={fetchEvents}
                eventContent={renderEventContent}
                nowIndicator={true}
                allDaySlot={showAllDay}
                dayMaxEvents={true}
                height="100%"
                expandRows={true}
                slotMinTime={formatTime(settings.startHour)}
                slotMaxTime={formatTime(settings.endHour)}
                firstDay={settings.firstDayOfWeek}
                weekends={!settings.hideWeekends}
                droppable={true}
                editable={true}
                drop={handleDrop}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
                weekNumbers={settings.showWeekNumbers}
                fixedWeekCount={true} /* Force 6 weeks to ensure uniform grid height */
                showNonCurrentDates={true} /* Fill the grid */
                weekText="W"
                navLinks={true}
                navLinkDayClick={(date, jsEvent) => {
                    const api = calendarRef.current?.getApi();
                    if (api) {
                        api.changeView('timeGridDay', date);
                    }
                }}
                navLinkWeekClick={(weekStart, jsEvent) => {
                    const api = calendarRef.current?.getApi();
                    if (api) {
                        api.changeView('timeGridWeek', weekStart);
                    }
                }}
                dayHeaderFormat={{ weekday: 'short' }}
                dayHeaderContent={(args) => {
                    // 1. 获取当前视图类型
                    const isMonthView = args.view.type === 'dayGridMonth';
                    
                    // 2. 获取星期几文本 (如 MON)
                    const weekday = args.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

                    // 3. 如果是月视图，只显示星期，不显示大数字
                    if (isMonthView) {
                        return (
                            <div style={{ 
                                paddingBottom: '8px', 
                                color: 'var(--pw-text-primary)', /* 更黑 */
                                fontWeight: 800, /* 更粗 */
                                fontSize: '14px', /* 更大 */
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                textAlign: 'center'
                            }}>
                                {weekday}
                            </div>
                        );
                    }

                    // 4. 如果是周/日视图，保持原来的 Figma 大数字风格
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                color: 'var(--pw-text-tertiary)', 
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {weekday}
                            </span>
                            <span style={{ 
                                fontSize: '24px', 
                                fontWeight: 400, 
                                color: 'var(--pw-text-primary)',
                                lineHeight: '1'
                            }}>
                                {args.date.getDate()}
                            </span>
                        </div>
                    );
                }}
            />
        </div>
    );
});
