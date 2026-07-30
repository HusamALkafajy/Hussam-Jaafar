'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import { MessageSquare, Clock, FolderOpen, Trash2, Plus, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChatSession {
  id: string;
  fileId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FileItem {
  id: string;
  originalName: string;
  status: string;
}

export default function ChatSessionsPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [sessionsResponse, filesResponse] = await Promise.all([
        api.get<any>('/chat-sessions'),
        api.get<any>('/files'),
      ]);
      
      const rawSessions = sessionsResponse?.data || sessionsResponse;
      const safeSessions = Array.isArray(rawSessions) ? rawSessions : [];
      setSessions(safeSessions);

      const rawFiles = filesResponse?.data || filesResponse;
      const safeFiles = Array.isArray(rawFiles) ? rawFiles : [];
      console.log('Fetched files:', safeFiles);
      setFiles(safeFiles);
    } catch (e) {
      console.error('Failed to load chat data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSession = async (fileId: string) => {
    setCreating(true);
    setShowFilePicker(false);
    try {
      const session = await api.post<ChatSession>('/chat-sessions', { fileId });
      router.push(`/chat/${session.id}`);
    } catch (e) {
      console.error('Failed to create chat session', e);
      alert(locale === 'ar' ? 'فشل في إنشاء المحادثة' : 'Failed to create chat session');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm(locale === 'ar' ? 'هل تريد حذف هذه المحادثة؟' : 'Delete this conversation?')) return;
    setDeletingId(sessionId);
    try {
      await api.delete(`/chat-sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (e) {
      console.error('Failed to delete session', e);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/40 pb-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-500/15 border border-violet-500/20">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            <span>{locale === 'ar' ? 'محادثة AI — مدرّسك الذكي' : 'AI Tutor Chat'}</span>
          </h2>
          <p className="text-sm text-slate-400">
            {locale === 'ar'
              ? 'اطرح أسئلة على مستنداتك واحصل على شرح تفصيلي مدعوم بالذكاء الاصطناعي.'
              : 'Ask questions about your documents and get detailed AI-powered explanations.'}
          </p>
        </div>
        <Button
          onClick={() => setShowFilePicker(true)}
          loading={creating}
          className="flex items-center gap-2 font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>{locale === 'ar' ? 'محادثة جديدة' : 'New Chat'}</span>
        </Button>
      </div>

      {/* File picker modal */}
      {showFilePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-[#0f1420] border-slate-800 flex flex-col gap-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {locale === 'ar' ? 'اختر مستنداً للمحادثة' : 'Choose a Document to Chat With'}
              </h3>
              <button
                onClick={() => setShowFilePicker(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            {files.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                {locale === 'ar'
                  ? 'لا توجد مستندات محللة. ارفع وحلّل مستنداً أولاً.'
                  : 'No analyzed documents found. Upload and analyze a document first.'}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => handleCreateSession(file.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-violet-500/40 hover:bg-violet-500/5 text-left transition-all group"
                  >
                    <FolderOpen className="w-4 h-4 text-slate-500 group-hover:text-violet-400 shrink-0" />
                    <span className="text-sm text-slate-200 font-medium truncate">{file.originalName}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 bg-slate-900/10 border-dashed border-slate-800">
          <div className="bg-violet-500/10 p-4 rounded-full text-violet-400">
            <MessageSquare className="w-10 h-10" />
          </div>
          <h4 className="text-lg font-bold text-white">
            {locale === 'ar' ? 'لا توجد محادثات بعد' : 'No Conversations Yet'}
          </h4>
          <p className="text-sm text-slate-400 max-w-sm">
            {locale === 'ar'
              ? 'ابدأ محادثة جديدة مع أي مستند محلل لتحصل على شرح فوري.'
              : 'Start a new chat with any analyzed document to get instant tutoring.'}
          </p>
          <Button onClick={() => setShowFilePicker(true)} className="mt-2 font-semibold">
            <span>{locale === 'ar' ? 'ابدأ محادثة الآن' : 'Start a Conversation'}</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="p-5 bg-slate-900/10 border border-slate-800/40 hover:border-violet-500/30 transition-all flex flex-col justify-between gap-4 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors" />

              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-violet-300 transition-colors">
                    {session.title}
                  </h3>
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(session.id); }}
                    disabled={deletingId === session.id}
                    className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    {deletingId === session.id ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {locale === 'ar' ? `${session.messageCount} رسالة` : `${session.messageCount} messages`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(session.updatedAt).toLocaleDateString(locale)}
                  </span>
                </div>
              </div>

              <Button
                nativeButton={false}
                render={<Link href={`/chat/${session.id}`} />}
                size="sm"
                className="w-full font-bold flex items-center justify-center gap-1"
              >
                <span>{locale === 'ar' ? 'فتح المحادثة' : 'Open Chat'}</span>
                <ChevronRight className="w-4 h-4 rtl-flip" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
