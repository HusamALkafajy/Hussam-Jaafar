import React from 'react';
import { useReaderState } from './reader-state';
import { OutlineTree } from './outline-tree';
import { BookmarksPanel } from './bookmarks-panel';
import { AITutorPanel } from '../ai/ai-tutor-panel';
import { Button } from '../ui/button';
import { List, Bookmark, Highlighter, StickyNote, Bot } from 'lucide-react';

export function ReaderSidebar() {
  const { session, updateSession } = useReaderState();

  type TabData = { id: 'outline' | 'bookmarks' | 'highlights' | 'notes' | 'ai', icon: React.ElementType, label: string, disabled?: boolean };
  const tabs: TabData[] = [
    { id: 'outline', icon: List, label: 'Outline' },
    { id: 'bookmarks', icon: Bookmark, label: 'Bookmarks' },
    { id: 'highlights', icon: Highlighter, label: 'Highlights', disabled: true },
    { id: 'notes', icon: StickyNote, label: 'Notes', disabled: true },
    { id: 'ai', icon: Bot, label: 'AI Tutor' },
  ];

  return (
    <div className="flex flex-col h-full bg-background border-e">
      {/* Sidebar Header / Tabs */}
      <div className="flex items-center gap-1 p-2 border-b overflow-x-auto no-scrollbar shrink-0">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = session.sidebarTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={`gap-2 shrink-0 ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => {
                if (!tab.disabled) {
                  updateSession({ sidebarTab: tab.id });
                }
              }}
              title={tab.disabled ? 'Coming in future updates' : tab.label}
            >
              <Icon className="size-4" />
              <span className="sr-only sm:not-sr-only sm:text-xs">{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {session.sidebarTab === 'outline' && <OutlineTree />}
        {session.sidebarTab === 'bookmarks' && <BookmarksPanel />}
        {session.sidebarTab === 'highlights' && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Highlights panel coming soon.
          </div>
        )}
        {session.sidebarTab === 'notes' && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Notes feature coming soon.
          </div>
        )}
        {session.sidebarTab === 'ai' && (
          <AITutorPanel />
        )}
      </div>
    </div>
  );
}
