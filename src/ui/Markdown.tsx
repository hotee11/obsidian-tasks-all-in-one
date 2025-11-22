import React, { useEffect, useRef, useMemo } from 'react';
import { App, MarkdownRenderer, Component } from 'obsidian';

interface MarkdownProps {
    content: string;
    sourcePath: string;
    app: App;
    stripMarkdown?: boolean; // New prop to force plain text
}

const MARKDOWN_CHARS = ['*', '_', '[', ']', '`', '#', '-', '>', '!', '~', '=', '$'];

export const Markdown: React.FC<MarkdownProps> = React.memo(({ content, sourcePath, app, stripMarkdown }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Simple check for markdown syntax to avoid expensive renderer for plain text
    const hasMarkdown = useMemo(() => {
        if (stripMarkdown) return false;
        return MARKDOWN_CHARS.some(char => content.includes(char)) || content.includes('://');
    }, [content, stripMarkdown]);

    useEffect(() => {
        if (!hasMarkdown || !containerRef.current) return;

        const component = new Component();
        containerRef.current.empty();
        
        MarkdownRenderer.render(
            app,
            content,
            containerRef.current,
            sourcePath,
            component
        );

        return () => {
            component.unload();
        };
    }, [content, sourcePath, app, hasMarkdown]);

    if (!hasMarkdown) {
        // If stripping markdown, we should probably strip the characters too, but for now just rendering as plain text is a huge win.
        // A simple regex strip could be added if needed.
        return <span className="pw-markdown-plain">{content}</span>;
    }

    return (
        <div 
            ref={containerRef} 
            className="pw-markdown-preview" 
            style={{ display: 'inline-block' }}
        />
    );
});
