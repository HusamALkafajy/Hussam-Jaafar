'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  NotebookPen,
  Pin,
  PinOff,
  Trash2,
  FileText,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useLocale } from '../../../hooks/use-locale';
import { api } from '../../../lib/api';

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  aiSummary: string | null;
  lastAnalyzedAt: string | null;
  updatedAt: string;
  fileId: string | null;
}

const COLOR_MAP: Record<string, { bg: string; border: string; dot: string }> = {
  default: { bg: 'bg-slate-800/60', border: 'border-slate-700/50', dot: 'bg-slate-500' },
  red:     { bg: 'bg-rose-950/40',  border: 'border-rose-700/40',  dot: 'bg-rose-500' },
  green:   { bg: 'bg-emerald-950/40', border: 'border-emerald-700/40', dot: 'bg-emerald-500' },
  blue:    { bg: 'bg-indigo-950/40', border: 'border-indigo-700/40', dot: 'bg-indigo-500' },
  yellow:  { bg: 'bg-amber-950/40',  border: 'border-amber-700/40',  dot: 'bg-amber-500' },
  purple:  { bg: 'bg-purple-950/40', border: 'border-purple-700/40', dot: 'bg-purple-500' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotesPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const isRtl = locale === 'ar';

  const [notes, setNotes] = useState<Note[]>([]);
  const [filtered, setFiltered] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Note[]>('/notes');
      setNotes(data);
      setFiltered(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    const q = search.toLowerCase();
    const safeNotes = Array.isArray(notes) ? notes : [];
    setFiltered(safeNotes.filter((n) => n?.title?.toLowerCase().includes(q) || n?.content?.toLowerCase().includes(q)));
  }, [search, notes]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const note = await api.post<Note>('/notes', { title: isRtl ? 'ملاحظة جديدة' : 'New Note', content: '' });
      router.push(`/notes/${note.id}`);
    } catch {
      setError(isRtl ? 'فشل إنشاء الملاحظة' : 'Failed to create note');
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(isRtl ? 'هل تريد حذف هذه الملاحظة؟' : 'Delete this note?')) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      //setError(isRtl ? 'فشل الحذف' : 'Failed to delete');
    }
  };

  const handlePin = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !note.isPinned }),
      });
      setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, isPinned: !n.isPinned } : n));
    } catch { /* silent */ }
  };

  const safeNotes = Array.isArray(filtered) ? filtered : [];

  const pinnedNotes = safeNotes.filter((n) => n.isPinned);
  const unpinnedNotes = safeNotes.filter((n) => !n.isPinned);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <NotebookPen className="w-6 h-6 text-indigo-400" />
            {isRtl ? 'ملاحظاتي' : 'My Notes'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isRtl
              ? 'دوّن أفكارك، وحلّلها بالذكاء الاصطناعي لتوليد ملخصات وأسئلة تدريبية'
              : 'Capture your thoughts, then analyze with AI to get summaries and quiz questions'}
          </p>
        </div>
        <Button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 gradient-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          {creating ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'ملاحظة جديدة' : 'New Note')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isRtl ? 'ابحث في ملاحظاتك...' : 'Search notes...'}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center">
            <NotebookPen className="w-8 h-8 text-slate-600" />
          </div>
          <div>
            <p className="text-slate-400 font-medium">{isRtl ? 'لا توجد ملاحظات بعد' : 'No notes yet'}</p>
            <p className="text-slate-600 text-sm mt-1">{isRtl ? 'أنشئ أول ملاحظة لك الآن' : 'Create your first note above'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {pinnedNotes.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                <Pin className="w-3 h-3" />{isRtl ? 'مثبّتة' : 'Pinned'}
              </p>
              <NoteGrid notes={pinnedNotes} onOpen={(id) => router.push(`/notes/${id}`)} onDelete={handleDelete} onPin={handlePin} />
            </section>
          )}
          {unpinnedNotes.length > 0 && (
            <section>
              {pinnedNotes.length > 0 && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{isRtl ? 'الأخرى' : 'Other Notes'}</p>
              )}
              <NoteGrid notes={unpinnedNotes} onOpen={(id) => router.push(`/notes/${id}`)} onDelete={handleDelete} onPin={handlePin} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function NoteGrid({ notes, onOpen, onDelete, onPin }: {
  notes: Note[];
  onOpen: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onPin: (note: Note, e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {notes.map((note) => {
        const style = COLOR_MAP[note.color] || COLOR_MAP.default;
        return (
          <div
            key={note.id}
            onClick={() => onOpen(note.id)}
            className={`group relative rounded-2xl border p-4 cursor-pointer hover:scale-[1.01] transition-all duration-200 ${style.bg} ${style.border}`}
          >
            {/* Color dot + Title */}
            <div className="flex items-start gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${style.dot}`} />
              <h3 className="font-semibold text-white text-sm line-clamp-1 flex-1">{note.title || 'Untitled'}</h3>
            </div>

            {/* Content preview */}
            <p className="text-slate-400 text-xs line-clamp-3 mb-3 min-h-[3rem]">{note.content || '...'}</p>

            {/* AI badge */}
            {note.aiSummary && (
              <div className="flex items-center gap-1 text-xs text-indigo-400 mb-2">
                <Sparkles className="w-3 h-3" />
                <span>AI Analyzed</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{timeAgo(note.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => onPin(note, e)}
                  className="p-1 hover:text-indigo-400 transition-colors"
                  title={note.isPinned ? 'Unpin' : 'Pin'}
                >
                  {note.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={(e) => onDelete(note.id, e)}
                  className="p-1 hover:text-rose-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
