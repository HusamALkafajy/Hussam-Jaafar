import React from 'react';
import { ActivityEvent } from '../mocks/workspace/activity';
import { FileText, BookOpen, MessageSquare, StickyNote, HelpCircle, FileQuestion, type LucideIcon } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { useLocale } from '../hooks/use-locale';

interface ActivityFeedProps {
  items: ActivityEvent[];
}

const ICON_MAP: Record<ActivityEvent['type'], LucideIcon> = {
  upload: FileText,
  read: BookOpen,
  ai_session: MessageSquare,
  note: StickyNote,
  flashcard: HelpCircle,
  quiz: FileQuestion,
};

const COLOR_MAP: Record<ActivityEvent['type'], string> = {
  upload: 'text-indigo-500 bg-indigo-500/10',
  read: 'text-emerald-500 bg-emerald-500/10',
  ai_session: 'text-purple-500 bg-purple-500/10',
  note: 'text-amber-500 bg-amber-500/10',
  flashcard: 'text-blue-500 bg-blue-500/10',
  quiz: 'text-rose-500 bg-rose-500/10',
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  const { locale } = useLocale();

  if (!items || items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const Icon = ICON_MAP[item.type] || FileText;
        const colorClass = COLOR_MAP[item.type] || 'text-muted-foreground bg-muted';

        return (
          <div key={item.id} className="flex gap-4 group">
            <div className={`mt-0.5 shrink-0 rounded-full p-2 h-fit ${colorClass}`}>
              <Icon className="size-4" />
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-sm font-medium leading-none text-foreground">
                {item.title}
              </span>
              {item.description && (
                <span className="text-sm text-muted-foreground line-clamp-1">
                  {item.description}
                </span>
              )}
              <span className="text-xs text-muted-foreground mt-1">
                {formatDate(item.timestamp, locale)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
