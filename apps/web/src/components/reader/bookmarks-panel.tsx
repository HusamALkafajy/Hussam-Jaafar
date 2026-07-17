import React from 'react';
import { useReaderState } from './reader-state';
import { Button } from '../ui/button';
import { Bookmark as BookmarkIcon, Trash2, Clock } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { useLocale } from '../../hooks/use-locale';

export function BookmarksPanel() {
  const { bookmarks, removeBookmark, updateSession } = useReaderState();
  const { locale } = useLocale();

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-64 text-muted-foreground">
        <BookmarkIcon className="size-10 mb-4 opacity-20" />
        <h4 className="text-sm font-semibold text-foreground mb-1">No Bookmarks</h4>
        <p className="text-xs">
          Select text and click the Bookmark icon to save important locations for later.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-2 px-3 gap-2 overflow-y-auto">
      {bookmarks.map(bookmark => (
        <div 
          key={bookmark.id} 
          className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors group cursor-pointer"
          onClick={() => updateSession({ currentNodeId: bookmark.nodeId })}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-tight line-clamp-2">{bookmark.title}</h4>
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-6 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                removeBookmark(bookmark.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{formatDate(bookmark.createdAt, locale)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
