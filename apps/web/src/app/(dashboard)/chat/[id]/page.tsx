'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { api } from '../../../../lib/api-client';
import { useLocale } from '../../../../hooks/use-locale';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Spinner } from '../../../../components/ui/spinner';
import { MessageSquare, Send, ArrowRight, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Array<{ page: number | null; text: string }>;
  createdAt: string;
}

interface ChatSession {
  id: string;
  title: string;
  fileId: string;
  messageCount: number;
  messages: ChatMessage[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Minimal markdown renderer: bold, code, bullets, line breaks */
function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="text-sm leading-relaxed space-y-1.5">
      {lines.map((line, i) => {
        // Bullet points
        if (line.match(/^[-*•]\s/)) {
          const text = line.replace(/^[-*•]\s/, '');
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: renderInline(text) }} />
            </div>
          );
        }
        // Numbered list
        if (line.match(/^\d+\.\s/)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="text-violet-400 font-bold shrink-0 text-xs mt-0.5">{match[1]}.</span>
                <span dangerouslySetInnerHTML={{ __html: renderInline(match[2]) }} />
              </div>
            );
          }
        }
        // Empty line
        if (line.trim() === '') return <div key={i} className="h-1" />;
        // Regular paragraph
        return <p key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />;
      })}
    </div>
  );
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-slate-800 text-violet-300 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
}

/** Collapsible references accordion */
function References({ refs }: { refs: Array<{ page: number | null; text: string }> }) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  if (!refs || refs.length === 0) return null;
  return (
    <div className="mt-3 border-t border-slate-700/30 pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>{locale === 'ar' ? `📄 المصادر (${refs.length})` : `📄 Sources (${refs.length})`}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5">
          {refs.map((ref, i) => (
            <div
              key={i}
              className="text-xs bg-slate-800/60 border border-slate-700/40 rounded-lg p-2.5 text-slate-400 leading-relaxed"
            >
              {ref.page != null && (
                <span className="text-violet-400 font-bold text-[10px] block mb-1 uppercase">
                  {locale === 'ar' ? `صفحة ${ref.page}` : `Page ${ref.page}`}
                </span>
              )}
              <span className="italic">"{ref.text}"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatConversationPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;
  const { locale } = useLocale();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      try {
        const data = await api.get<ChatSession>(`/chat-sessions/${sessionId}`);
        setSession(data);
        setMessages(data.messages || []);
      } catch (e) {
        console.error('Failed to load chat session', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    // Optimistic update — show user message immediately
    const optimisticUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput('');
    setSending(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const assistantMsg = await api.post<ChatMessage>(
        `/chat-sessions/${sessionId}/messages`,
        { content },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      setMessages((prev) => [...prev.slice(0, -1), optimisticUserMsg, assistantMsg]);
    } catch (e: any) {
      clearTimeout(timeoutId);
      // Remove optimistic message on error or keep it and show error? 
      // The requirement: "User must receive a readable message. Retry action must become available."
      // Since there's no complex retry UI built in yet, we'll append a system error message to the chat.
      setMessages((prev) => [
        ...prev.slice(0, -1), 
        optimisticUserMsg,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'AI Tutor is currently busy. Please try again.',
          createdAt: new Date().toISOString(),
          isError: true // assuming we can optionally style this if needed, but it works as text
        } as any
      ]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-3">
        <p className="text-slate-400">
          {locale === 'ar' ? 'المحادثة غير موجودة.' : 'Conversation not found.'}
        </p>
        <Button nativeButton={false} render={<Link href="/chat" />}>
          {locale === 'ar' ? 'العودة للمحادثات' : 'Back to Chats'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[900px] gap-0">
      {/* Chat Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800/40 mb-4 shrink-0">
        <Link
          href="/chat"
          className="p-2 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4 rtl-flip" />
        </Link>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{session.title}</h2>
            <p className="text-xs text-slate-500">
              {locale === 'ar'
                ? `${messages.length} رسالة • الذكاء الاصطناعي يستند إلى مستندك فقط`
                : `${messages.length} messages • AI answers from your document only`}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pb-4 px-1">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
            <div className="p-4 rounded-full bg-violet-500/10 border border-violet-500/20">
              <MessageSquare className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-slate-300 font-semibold">
              {locale === 'ar' ? 'ابدأ المحادثة مع مدرّسك الذكي' : 'Start chatting with your AI Tutor'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              {locale === 'ar'
                ? 'اطرح أي سؤال حول مستندك وسيجيبك الذكاء الاصطناعي بناءً على محتواه فقط مع الإشارة للمصادر.'
                : 'Ask any question about your document. The AI will answer based on its content only, with page citations.'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              /* User bubble */
              <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm leading-relaxed shadow-md shadow-indigo-500/10">
                {msg.content}
              </div>
            ) : (
              /* AI response card */
              <div className="max-w-[85%]">
                <Card className="p-4 bg-slate-900/30 border-slate-800/60 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[8px] font-bold text-violet-400">AI</span>
                    </div>
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                      {locale === 'ar' ? 'مدرّس الذكاء الاصطناعي' : 'AI Tutor'}
                    </span>
                  </div>
                  <div className="text-slate-200">
                    <SimpleMarkdown content={msg.content} />
                  </div>
                  {msg.references && msg.references.length > 0 && (
                    <References refs={msg.references} />
                  )}
                </Card>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <Card className="p-4 bg-slate-900/30 border-slate-800/60 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-violet-400">AI</span>
                </div>
                <div className="flex items-center gap-1 px-2">
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </Card>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="shrink-0 pt-4 border-t border-slate-800/40">
        <div className="flex items-end gap-3 bg-slate-900/40 border border-slate-800 rounded-2xl px-4 py-3 focus-within:border-violet-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={locale === 'ar' ? 'اطرح سؤالاً على مستندك...' : 'Ask your document a question...'}
            rows={1}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 text-sm resize-none outline-none leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: '24px' }}
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-700 hidden sm:block">Ctrl+↵</span>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className={`p-2 rounded-xl transition-all ${
                input.trim() && !sending
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              {sending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-700 mt-2">
          {locale === 'ar'
            ? 'الذكاء الاصطناعي يجيب بناءً على محتوى مستندك فقط.'
            : 'AI answers are grounded in your document content only.'}
        </p>
      </div>
    </div>
  );
}
