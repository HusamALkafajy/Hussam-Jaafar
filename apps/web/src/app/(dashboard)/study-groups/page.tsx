'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import {
  Users, Plus, LogIn, MessageSquare, Clock, Lock, Globe,
  Copy, Check, Trash2, ChevronRight, X, Crown,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  isPublic: boolean;
  ownerId: string;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
  myRole: 'owner' | 'admin' | 'member';
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: StudyGroup['myRole'] }) {
  if (role === 'owner') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
        <Crown className="w-2.5 h-2.5" /> Owner
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 rounded-full px-2 py-0.5">
        Admin
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-700/40 border border-slate-700 rounded-full px-2 py-0.5">
      Member
    </span>
  );
}

// ─── Modal: Create Group ──────────────────────────────────────────────────────

function CreateGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (group: StudyGroup) => void;
}) {
  const { locale } = useLocale();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const group = await api.post<StudyGroup>('/study-groups', {
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
      });
      onCreated(group);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0c1119] border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20">
              <Users className="w-4 h-4 text-violet-400" />
            </span>
            {locale === 'ar' ? 'إنشاء مجموعة جديدة' : 'Create Study Group'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {locale === 'ar' ? 'اسم المجموعة *' : 'Group Name *'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder={locale === 'ar' ? 'مثال: مجموعة الفيزياء' : 'e.g. Physics Study Group'}
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {locale === 'ar' ? 'الوصف (اختياري)' : 'Description (optional)'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={locale === 'ar' ? 'وصف المجموعة وأهدافها...' : 'What is this group about?'}
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${isPublic ? 'bg-violet-600' : 'bg-slate-700'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-200">
                {locale === 'ar' ? 'مجموعة عامة' : 'Public Group'}
              </span>
              <span className="text-xs text-slate-500">
                {locale === 'ar' ? 'مرئية لجميع المستخدمين' : 'Visible to all users'}
              </span>
            </div>
          </label>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" loading={loading} disabled={!name.trim()} className="flex-1">
              {locale === 'ar' ? 'إنشاء المجموعة' : 'Create Group'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Join Group ────────────────────────────────────────────────────────

function JoinGroupModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (group: StudyGroup) => void;
}) {
  const { locale } = useLocale();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const group = await api.post<StudyGroup>(`/study-groups/join/${code.trim().toUpperCase()}`);
      onJoined(group);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#0c1119] border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
              <LogIn className="w-4 h-4 text-emerald-400" />
            </span>
            {locale === 'ar' ? 'الانضمام إلى مجموعة' : 'Join a Group'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {locale === 'ar' ? 'رمز الدعوة' : 'Invite Code'}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              placeholder="e.g. A3F1B9C2"
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition text-center uppercase"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={code.trim().length < 6}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
            >
              {locale === 'ar' ? 'انضمام' : 'Join'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onDelete,
  deleting,
}: {
  group: StudyGroup;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="relative p-5 bg-slate-900/20 border border-slate-800/40 hover:border-violet-500/30 transition-all group overflow-hidden flex flex-col gap-4">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors pointer-events-none" />

      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="font-bold text-white text-sm leading-tight truncate group-hover:text-violet-300 transition-colors">
            {group.name}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <RoleBadge role={group.myRole} />
            {group.isPublic ? (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Globe className="w-2.5 h-2.5" /> {locale === 'ar' ? 'عامة' : 'Public'}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <Lock className="w-2.5 h-2.5" /> {locale === 'ar' ? 'خاصة' : 'Private'}
              </span>
            )}
          </div>
        </div>

        {group.myRole === 'owner' && (
          <button
            onClick={() => onDelete(group.id)}
            disabled={deleting}
            className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Description */}
      {group.description && (
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{group.description}</p>
      )}

      {/* Invite code chip */}
      <button
        onClick={copyCode}
        className="flex items-center gap-2 w-fit bg-slate-800/60 border border-slate-700/60 hover:border-violet-500/40 hover:bg-slate-800 rounded-lg px-3 py-1.5 transition group/code"
      >
        <span className="text-xs font-mono text-violet-300 tracking-widest">{group.inviteCode}</span>
        {copied
          ? <Check className="w-3 h-3 text-emerald-400" />
          : <Copy className="w-3 h-3 text-slate-500 group-hover/code:text-violet-400" />}
      </button>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          {new Date(group.updatedAt).toLocaleDateString(locale)}
        </span>
        <Link href={`/study-groups/${group.id}`}>
          <Button size="sm" className="font-bold flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            {locale === 'ar' ? 'فتح' : 'Open'}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudyGroupsPage() {
  const { locale } = useLocale();
  const router = useRouter();

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const raw = await api.get<any>('/study-groups');
      const data = Array.isArray(raw) ? raw : (raw?.data ?? []);
      setGroups(data);
    } catch (e) {
      console.error('Failed to fetch study groups', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCreated = (group: StudyGroup) => {
    setShowCreate(false);
    setGroups((prev) => [group, ...prev]);
    router.push(`/study-groups/${group.id}`);
  };

  const handleJoined = (group: StudyGroup) => {
    setShowJoin(false);
    router.push(`/study-groups/${group.id}`);
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm(locale === 'ar' ? 'هل تريد حذف هذه المجموعة نهائياً؟' : 'Permanently delete this group?')) return;
    setDeletingId(groupId);
    try {
      await api.delete(`/study-groups/${groupId}`);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Modals */}
      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} onJoined={handleJoined} />}

      {/* Page header */}
      <div className="flex items-start justify-between border-b border-slate-800/40 pb-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-500/15 border border-violet-500/20">
              <Users className="w-6 h-6 text-violet-400" />
            </div>
            <span>{locale === 'ar' ? 'مجموعات الدراسة' : 'Study Groups'}</span>
          </h2>
          <p className="text-sm text-slate-400">
            {locale === 'ar'
              ? 'تعاون مع زملائك، شارك المستندات، وادرس معاً في الوقت الفعلي.'
              : 'Collaborate with peers, share documents, and study together in real time.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowJoin(true)} className="flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            {locale === 'ar' ? 'انضمام' : 'Join'}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {locale === 'ar' ? 'مجموعة جديدة' : 'New Group'}
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner className="w-8 h-8" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center gap-4 bg-slate-900/10 border-dashed border-slate-800">
          <div className="bg-violet-500/10 p-5 rounded-full text-violet-400">
            <Users className="w-12 h-12" />
          </div>
          <h4 className="text-lg font-bold text-white">
            {locale === 'ar' ? 'لا توجد مجموعات بعد' : 'No Study Groups Yet'}
          </h4>
          <p className="text-sm text-slate-400 max-w-xs">
            {locale === 'ar'
              ? 'أنشئ مجموعتك الأولى أو انضم إلى مجموعة موجودة باستخدام رمز الدعوة.'
              : 'Create your first group or join an existing one with an invite code.'}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Button variant="secondary" onClick={() => setShowJoin(true)} className="flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              {locale === 'ar' ? 'انضمام برمز الدعوة' : 'Join with Code'}
            </Button>
            <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {locale === 'ar' ? 'إنشاء مجموعة' : 'Create Group'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onDelete={handleDelete}
              deleting={deletingId === group.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
