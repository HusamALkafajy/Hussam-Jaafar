'use client';

import React, { useEffect, useState, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { api } from '../../../../lib/api-client';
import { useLocale } from '../../../../hooks/use-locale';
import { Button } from '../../../../components/ui/button';
import { Spinner } from '../../../../components/ui/spinner';
import {
  Users, MessageSquare, FileText, Send, ArrowLeft, Copy, Check,
  Trash2, Crown, Shield, UserCircle2, LogOut, MessageCircle, X,
  FolderOpen, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupRole = 'owner' | 'admin' | 'member';

interface Member {
  id: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface SharedFile {
  id: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  processingStatus: string;
  sharedByUserId: string;
  sharedAt: string;
}

interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderFirstName?: string;
  senderLastName?: string;
  senderAvatarUrl?: string | null;
  content: string;
  createdAt: string;
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  ownerId: string;
  isPublic: boolean;
  maxMembers: number;
  myRole: GroupRole;
  members: Member[];
  sharedFiles: SharedFile[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RoleIcon({ role }: { role: GroupRole }) {
  if (role === 'owner') return <Crown className="w-3 h-3 text-amber-400" />;
  if (role === 'admin') return <Shield className="w-3 h-3 text-indigo-400" />;
  return <UserCircle2 className="w-3 h-3 text-slate-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="w-7 h-7 rounded-full object-cover" />;
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Share File Modal ─────────────────────────────────────────────────────────

function ShareFileModal({
  groupId,
  onClose,
  onShared,
}: {
  groupId: string;
  onClose: () => void;
  onShared: (file: SharedFile) => void;
}) {
  const { locale } = useLocale();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<any>('/files').then((raw) => {
      const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
      setFiles(arr.filter((f: any) => f.processingStatus === 'completed' || f.status === 'completed'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleShare = async (fileId: string) => {
    setSharing(fileId);
    setError('');
    try {
      const result = await api.post<SharedFile>(`/study-groups/${groupId}/files`, { fileId });
      onShared(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSharing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0c1119] border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-violet-400" />
            {locale === 'ar' ? 'مشاركة مستند' : 'Share a Document'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner className="w-6 h-6" /></div>
          ) : files.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">
              {locale === 'ar' ? 'لا توجد مستندات محللة بعد.' : 'No analyzed documents yet.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleShare(file.id)}
                  disabled={sharing === file.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-violet-500/40 hover:bg-violet-500/5 text-left transition-all group w-full disabled:opacity-60"
                >
                  <FileText className="w-4 h-4 text-slate-500 group-hover:text-violet-400 shrink-0" />
                  <span className="text-sm text-slate-200 font-medium truncate flex-1">{file.originalName}</span>
                  {sharing === file.id && <Spinner className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function StudyGroupDetailPage({ params }: PageProps) {
  const { id: groupId } = use(params);
  const { locale } = useLocale();
  const router = useRouter();

  // ── State ──
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [unsharingId, setUnsharingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'files'>('members');
  const [codeCopied, setCodeCopied] = useState(false);

  // ── Refs ──
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Data fetching ──
  const fetchGroup = useCallback(async () => {
    try {
      const data = await api.get<GroupDetail>(`/study-groups/${groupId}`);
      setGroup(data);
    } catch {
      router.push('/study-groups');
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  const fetchHistory = useCallback(async () => {
    try {
      const history = await api.get<any>(`/study-groups/${groupId}/messages?page=1`);
      const msgs = Array.isArray(history) ? history : (history?.data ?? []);
      setMessages(msgs);
    } catch (e) {
      console.error('Failed to fetch message history', e);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
    fetchHistory();
  }, [fetchGroup, fetchHistory]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── WebSocket setup ───────────────────────────────────────────────────────
  useEffect(() => {
    /**
     * Derive the backend base URL (no /api suffix) from the env variable that
     * the rest of the app already uses.  The fallback must match APP_URL in .env
     * (http://localhost:4000).
     *
     * NEXT_PUBLIC_API_URL is used by lib/api.ts as the REST base — it already
     * points to the API server without the /api path segment.
     */
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? '' // same-origin in production (Nginx proxies both REST and WS)
        : 'http://localhost:4000');

    /**
     * socket.io-client accepts the namespace as a path suffix on the URL.
     * The server-side @WebSocketGateway has namespace: '/study-groups'.
     *
     * IMPORTANT: transports must start with 'polling' so that the Engine.IO
     * HTTP handshake runs first. The browser's httpOnly access_token cookie is
     * forwarded during this first HTTP request.  After the handshake, socket.io
     * upgrades to WebSocket automatically.
     */
    const socket = io(`${API_BASE}/study-groups`, {
      withCredentials: true,                       // send cookies (access_token)
      transports: ['polling', 'websocket'],         // polling FIRST — required for cookie auth
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinGroup', { groupId });
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.info('[WS] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
      setConnected(false);
    });

    socket.on('newGroupMessage', (msg: GroupMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content || sending || !socketRef.current?.connected) return;

    setSending(true);
    socketRef.current.emit('sendGroupMessage', { groupId, content }, () => {
      setSending(false);
    });
    setInput('');
    textareaRef.current?.focus();
  }, [input, sending, groupId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleUnshare = async (fileId: string) => {
    if (!confirm(locale === 'ar' ? 'إلغاء مشاركة هذا المستند؟' : 'Remove this shared file?')) return;
    setUnsharingId(fileId);
    try {
      await api.delete(`/study-groups/${groupId}/files/${fileId}`);
      setGroup((g) => g ? { ...g, sharedFiles: g.sharedFiles.filter((f) => f.fileId !== fileId) } : g);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUnsharingId(null);
    }
  };

  const handleLeave = async () => {
    if (!confirm(locale === 'ar' ? 'هل تريد مغادرة المجموعة؟' : 'Leave this group?')) return;
    try {
      await api.delete(`/study-groups/${groupId}/leave`);
      router.push('/study-groups');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const copyInviteCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const canUnshare = (file: SharedFile) =>
    group?.myRole === 'owner' || group?.myRole === 'admin' || file.sharedByUserId === group?.ownerId;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!group) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-8rem)]">
      {showShareModal && (
        <ShareFileModal
          groupId={groupId}
          onClose={() => setShowShareModal(false)}
          onShared={(file) => {
            setGroup((g) => g ? { ...g, sharedFiles: [file, ...g.sharedFiles] } : g);
            setShowShareModal(false);
          }}
        />
      )}

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/40 mb-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/study-groups"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            aria-label={locale === 'ar' ? 'العودة للمجموعات' : 'Back to Groups'}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h2 className="font-bold text-white text-base leading-tight truncate">{group.name}</h2>
            {group.description && (
              <p className="text-xs text-slate-500 truncate">{group.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* WS connection dot */}
          <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {connected ? (locale === 'ar' ? 'متصل' : 'Live') : (locale === 'ar' ? 'منقطع' : 'Offline')}
          </span>

          {/* Invite code */}
          <button
            onClick={copyInviteCode}
            className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/60 hover:border-violet-500/40 rounded-lg px-3 py-1.5 transition"
          >
            <span className="text-xs font-mono text-violet-300 tracking-widest">{group.inviteCode}</span>
            {codeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
          </button>

          <Button variant="ghost" size="sm" onClick={handleLeave} className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex flex-1 gap-4 min-h-0 mt-4">

        {/* ════ LEFT PANEL ════════════════════════════════════════════════ */}
        <div className="w-72 shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-900/40 border border-slate-800/60 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'members' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-3.5 h-3.5" />
              {locale === 'ar' ? `الأعضاء (${group.members.length})` : `Members (${group.members.length})`}
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'files' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <FileText className="w-3.5 h-3.5" />
              {locale === 'ar' ? `الملفات (${group.sharedFiles.length})` : `Files (${group.sharedFiles.length})`}
            </button>
          </div>

          {/* Members tab */}
          {activeTab === 'members' && (
            <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900/30 border border-slate-800/40 hover:border-slate-700/60 transition"
                >
                  <Avatar
                    name={`${member.firstName} ${member.lastName}`}
                    url={member.avatarUrl}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {member.firstName} {member.lastName}
                    </span>
                  </div>
                  <RoleIcon role={member.role} />
                </div>
              ))}
            </div>
          )}

          {/* Files tab */}
          {activeTab === 'files' && (
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowShareModal(true)}
                className="w-full flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                {locale === 'ar' ? 'مشاركة مستند' : 'Share a Document'}
              </Button>

              {group.sharedFiles.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">
                  {locale === 'ar' ? 'لا توجد مستندات مشتركة بعد.' : 'No shared documents yet.'}
                </p>
              ) : (
                group.sharedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-slate-900/30 border border-slate-800/40 hover:border-slate-700/60 transition"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-slate-200 truncate flex-1 leading-tight">
                        {file.originalName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">{formatFileSize(file.fileSize)}</span>
                    <div className="flex gap-1.5">
                      {/* Chat with this shared file */}
                      <Link
                        href={`/chat?fileId=${file.fileId}`}
                        className="flex-1 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30 text-violet-300 text-[10px] font-semibold transition"
                      >
                        <MessageCircle className="w-3 h-3" />
                        {locale === 'ar' ? 'محادثة' : 'Chat'}
                      </Link>

                      {/* Unshare — only for owner/admin or the uploader */}
                      {canUnshare(file) && (
                        <button
                          onClick={() => handleUnshare(file.fileId)}
                          disabled={unsharingId === file.fileId}
                          className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-[10px] transition disabled:opacity-50"
                        >
                          {unsharingId === file.fileId ? <Spinner className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ════ RIGHT PANEL — Chat ══════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900/20 border border-slate-800/40 rounded-2xl overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/40 bg-slate-900/30">
            <MessageSquare className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-200">
              {locale === 'ar' ? 'محادثة المجموعة' : 'Group Chat'}
            </span>
            <span className="text-xs text-slate-500 ml-auto">
              {locale === 'ar' ? 'Enter للإرسال' : 'Enter to send'}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-500">
                  {locale === 'ar' ? 'لا توجد رسائل بعد. كن أول من يبدأ!' : 'No messages yet. Be the first to say something!'}
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const senderName = msg.senderFirstName
                ? `${msg.senderFirstName} ${msg.senderLastName ?? ''}`.trim()
                : 'Member';
              const isMine = msg.senderId === group.members.find(() => true)?.userId; // Approximate — replace with actual currentUserId if available

              return (
                <div key={msg.id} className="flex items-start gap-2.5 group">
                  <Avatar name={senderName} url={msg.senderAvatarUrl} />
                  <div className="flex flex-col gap-0.5 min-w-0 max-w-[75%]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold text-violet-300">{senderName}</span>
                      <span className="text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {new Date(msg.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-slate-200 leading-relaxed break-words">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator shown when sending */}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 pl-9">
                <Spinner className="w-3 h-3" />
                {locale === 'ar' ? 'جارٍ الإرسال...' : 'Sending...'}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div className="px-4 py-3 border-t border-slate-800/40 bg-slate-900/30">
            {!connected && (
              <p className="text-xs text-amber-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {locale === 'ar' ? 'جارٍ إعادة الاتصال...' : 'Reconnecting to live chat...'}
              </p>
            )}
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  connected
                    ? (locale === 'ar' ? 'اكتب رسالتك...' : 'Type a message...')
                    : (locale === 'ar' ? 'في انتظار الاتصال...' : 'Waiting for connection...')
                }
                disabled={!connected}
                rows={1}
                className="flex-1 bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition resize-none max-h-32 disabled:opacity-50"
                style={{ overflowY: 'auto' }}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || !connected || sending}
                loading={sending}
                className="px-4 py-2.5 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
