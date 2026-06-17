'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy, Check, ChevronDown, ChevronUp, Maximize2, Minimize2,
  BookOpen, Clock, List, ChevronRight, Lightbulb, AlertTriangle,
  Info, Star, Hash, ArrowUp, Eye,
} from 'lucide-react';
import { useLocale } from '../../hooks/use-locale';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface ContentReaderProps {
  content: string;
  className?: string;
  /** Show reading progress bar */
  showProgress?: boolean;
  /** Show table of contents sidebar */
  showToc?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(/[*_`]/g, '').trim();
    toc.push({ id: slugify(text), text, level });
  }
  return toc;
}

// ─── Syntax tokenizer ────────────────────────────────────────────────────────

type TokenType = 'comment' | 'string' | 'keyword' | 'number' | 'function' | 'plain';

interface Token { type: TokenType; text: string }

function tokenize(code: string): Token[] {
  const regex =
    /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|import|export|from|class|extends|new|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|async|await|default|public|private|protected|interface|type|as|def|elif|print|self)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*(?=\())/g;
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex)
      tokens.push({ type: 'plain', text: code.substring(lastIndex, match.index) });
    if (match[1]) tokens.push({ type: 'comment', text: match[1] });
    else if (match[2]) tokens.push({ type: 'string', text: match[2] });
    else if (match[3]) tokens.push({ type: 'keyword', text: match[3] });
    else if (match[4]) tokens.push({ type: 'number', text: match[4] });
    else if (match[5]) tokens.push({ type: 'function', text: match[5] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < code.length)
    tokens.push({ type: 'plain', text: code.substring(lastIndex) });
  return tokens;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  comment: 'text-slate-500 italic',
  string: 'text-emerald-400',
  keyword: 'text-violet-400 font-semibold',
  number: 'text-amber-400',
  function: 'text-sky-400',
  plain: 'text-slate-300',
};

// ─── Code Block ──────────────────────────────────────────────────────────────

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tokens = tokenize(value);

  const codeBody = (
    <pre className="p-5 overflow-x-auto font-mono text-[13px] leading-[1.7] bg-transparent select-text">
      <code className="block select-text">
        {tokens.map((t, i) => (
          <span key={i} className={TOKEN_COLORS[t.type]}>{t.text}</span>
        ))}
      </code>
    </pre>
  );

  const block = (
    <div
      className={`my-6 rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-[#0d1117] ${
        fullscreen ? 'fixed inset-4 z-50 flex flex-col' : ''
      }`}
      dir="ltr"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#161b22] border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/70" />
          <span className="w-3 h-3 rounded-full bg-amber-500/70" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
          <span className="ml-3 text-[11px] font-mono font-bold text-slate-400 tracking-widest uppercase">
            {language || 'code'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!fullscreen && (
            <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5 text-indigo-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[11px] font-medium">
            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
          </button>
        </div>
      </div>
      {(!collapsed || fullscreen) && (
        <div className={fullscreen ? 'flex-1 overflow-y-auto' : ''}>{codeBody}</div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setFullscreen(false)} />
        {block}
      </>
    );
  }
  return block;
};

// ─── Reading Progress Bar ─────────────────────────────────────────────────────

const ReadingProgressBar = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-slate-900">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

// ─── Table of Contents ────────────────────────────────────────────────────────

const TableOfContents = ({ items, activeId }: { items: TocItem[]; activeId: string }) => {
  if (items.length < 2) return null;

  return (
    <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none">
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <List className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Contents</span>
        </div>
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs transition-all duration-150 group ${
                    item.level === 1 ? 'font-semibold' : item.level === 2 ? 'pl-4' : 'pl-7'
                  } ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-300'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {isActive && <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />}
                  <span className="line-clamp-2 leading-snug">{item.text}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

// ─── Callout Box ─────────────────────────────────────────────────────────────

const CALLOUT_PATTERNS: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  tip: {
    icon: <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />,
    className: 'bg-emerald-500/10 border-l-4 border-emerald-500/60 text-emerald-100',
    label: 'Tip',
  },
  note: {
    icon: <Info className="w-4 h-4 shrink-0 mt-0.5" />,
    className: 'bg-blue-500/10 border-l-4 border-blue-500/60 text-blue-100',
    label: 'Note',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />,
    className: 'bg-amber-500/10 border-l-4 border-amber-500/60 text-amber-100',
    label: 'Warning',
  },
  important: {
    icon: <Star className="w-4 h-4 shrink-0 mt-0.5" />,
    className: 'bg-violet-500/10 border-l-4 border-violet-500/60 text-violet-100',
    label: 'Important',
  },
};

function detectCallout(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of Object.keys(CALLOUT_PATTERNS)) {
    if (lower.startsWith(`**${key}**`) || lower.startsWith(`${key}:`)) return key;
  }
  return null;
}

// ─── Custom Markdown Components ───────────────────────────────────────────────

function buildComponents(headingRefs: React.MutableRefObject<Map<string, HTMLElement>>) {
  return {
    pre({ children }: any) {
      return <div className="w-full not-prose">{children}</div>;
    },

    code({ className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeContent = String(children).replace(/\n$/, '');
      const isBlock = !!match;

      if (isBlock) return <CodeBlock language={match![1]} value={codeContent} />;

      return (
        <code
          className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-md font-mono text-[0.85em] not-prose"
          {...props}
        >
          {children}
        </code>
      );
    },

    h1({ children }: any) {
      const text = String(children);
      const id = slugify(text);
      return (
        <h1
          id={id}
          ref={(el) => { if (el) headingRefs.current.set(id, el); }}
          className="scroll-mt-24 text-3xl font-extrabold text-white tracking-tight mt-12 mb-6 first:mt-0 flex items-center gap-3 group"
        >
          <span className="flex-1">{children}</span>
          <a href={`#${id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Hash className="w-5 h-5 text-indigo-500" />
          </a>
        </h1>
      );
    },

    h2({ children }: any) {
      const text = String(children);
      const id = slugify(text);
      return (
        <h2
          id={id}
          ref={(el) => { if (el) headingRefs.current.set(id, el); }}
          className="scroll-mt-24 text-2xl font-bold text-white/95 tracking-tight mt-10 mb-5 flex items-center gap-3 group border-b border-white/5 pb-3"
        >
          <span className="flex-1">{children}</span>
          <a href={`#${id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Hash className="w-4 h-4 text-indigo-500" />
          </a>
        </h2>
      );
    },

    h3({ children }: any) {
      const text = String(children);
      const id = slugify(text);
      return (
        <h3
          id={id}
          ref={(el) => { if (el) headingRefs.current.set(id, el); }}
          className="scroll-mt-24 text-xl font-bold text-white/90 mt-8 mb-4 flex items-center gap-2 group"
        >
          <span className="w-1 h-5 bg-indigo-500 rounded-full shrink-0" />
          <span className="flex-1">{children}</span>
          <a href={`#${id}`} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Hash className="w-4 h-4 text-indigo-500" />
          </a>
        </h3>
      );
    },

    p({ children }: any) {
      const text = typeof children === 'string' ? children : String(children ?? '');
      const calloutKey = detectCallout(text);
      if (calloutKey) {
        const c = CALLOUT_PATTERNS[calloutKey];
        return (
          <div className={`my-5 flex items-start gap-3 px-4 py-4 rounded-xl not-prose ${c.className}`}>
            {c.icon}
            <div className="text-sm leading-relaxed">{children}</div>
          </div>
        );
      }
      return (
        <p className="text-[1.0625rem] leading-[1.85] text-slate-300 mb-5">{children}</p>
      );
    },

    blockquote({ children }: any) {
      return (
        <blockquote className="my-6 not-prose relative pl-5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-gradient-to-b before:from-indigo-500 before:to-purple-500 before:rounded-full">
          <div className="text-slate-300 italic text-[1rem] leading-relaxed [&>p]:mb-0">{children}</div>
        </blockquote>
      );
    },

    ul({ children }: any) {
      return (
        <ul className="my-5 flex flex-col gap-2 not-prose">
          {React.Children.map(children, (child: any) => {
            if (!child || child.type !== 'li') return null;
            return (
              <li className="flex items-start gap-3 text-slate-300 text-[1.0625rem] leading-relaxed">
                <span className="mt-[0.45em] w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span>{child.props.children}</span>
              </li>
            );
          })}
        </ul>
      );
    },

    ol({ children }: any) {
      return (
        <ol className="my-5 flex flex-col gap-2 not-prose counter-reset-[item]">
          {React.Children.map(children, (child: any, i: number) => {
            if (!child || child.type !== 'li') return null;
            return (
              <li className="flex items-start gap-3 text-slate-300 text-[1.0625rem] leading-relaxed">
                <span className="mt-0.5 w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span>{child.props.children}</span>
              </li>
            );
          })}
        </ol>
      );
    },

    table({ children }: any) {
      return (
        <div className="my-6 not-prose overflow-x-auto rounded-xl border border-white/5 shadow-lg">
          <table className="w-full text-sm text-left text-slate-300">{children}</table>
        </div>
      );
    },

    thead({ children }: any) {
      return (
        <thead className="bg-indigo-500/10 text-indigo-300 text-xs uppercase tracking-wider">
          {children}
        </thead>
      );
    },

    th({ children }: any) {
      return <th className="px-5 py-3 font-bold">{children}</th>;
    },

    tr({ children }: any) {
      return (
        <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">{children}</tr>
      );
    },

    td({ children }: any) {
      return <td className="px-5 py-3 leading-relaxed">{children}</td>;
    },

    a({ href, children }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/40 hover:decoration-indigo-400 transition-colors"
        >
          {children}
        </a>
      );
    },

    hr() {
      return <hr className="my-10 border-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
    },

    strong({ children }: any) {
      return <strong className="font-bold text-white">{children}</strong>;
    },

    em({ children }: any) {
      return <em className="italic text-slate-200">{children}</em>;
    },
  };
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

export const ContentReaderSkeleton = () => (
  <div className="animate-pulse space-y-5 max-w-[850px] mx-auto px-6 py-10">
    <div className="h-8 bg-white/5 rounded-xl w-2/3" />
    <div className="space-y-3">
      <div className="h-4 bg-white/5 rounded-lg w-full" />
      <div className="h-4 bg-white/5 rounded-lg w-11/12" />
      <div className="h-4 bg-white/5 rounded-lg w-4/5" />
    </div>
    <div className="h-6 bg-white/5 rounded-xl w-1/2 mt-8" />
    <div className="space-y-3">
      <div className="h-4 bg-white/5 rounded-lg w-full" />
      <div className="h-4 bg-white/5 rounded-lg w-10/12" />
      <div className="h-4 bg-white/5 rounded-lg w-9/12" />
      <div className="h-4 bg-white/5 rounded-lg w-full" />
    </div>
    <div className="h-32 bg-white/5 rounded-2xl mt-6" />
    <div className="space-y-3 mt-6">
      <div className="h-4 bg-white/5 rounded-lg w-full" />
      <div className="h-4 bg-white/5 rounded-lg w-3/4" />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const ContentReader = ({
  content,
  className = '',
  showProgress = true,
  showToc = true,
}: ContentReaderProps) => {
  const { locale } = useLocale();
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const headingRefs = useRef<Map<string, HTMLElement>>(new Map());
  const readerRef = useRef<HTMLDivElement>(null);

  const toc = extractToc(content);
  const readingTime = estimateReadingTime(content);
  const wordCount = content.trim().split(/\s+/).length;
  const components = buildComponents(headingRefs);

  // Active heading tracker using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-20% 0% -60% 0%', threshold: 0 },
    );

    headingRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [content]);

  // Back to top visibility
  useEffect(() => {
    const handle = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  const isRtl = locale === 'ar';

  return (
    <>
      {showProgress && <ReadingProgressBar />}

      {/* Mobile TOC toggle */}
      {showToc && toc.length > 1 && (
        <div className="xl:hidden mb-4">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/60 border border-white/5 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <List className="w-4 h-4 text-indigo-400" />
              Table of Contents
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${tocOpen ? 'rotate-90' : ''}`} />
          </button>
          {tocOpen && (
            <div className="mt-2 rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
              <ul className="p-3 flex flex-col gap-0.5">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                        setTocOpen(false);
                      }}
                      className={`block py-1.5 px-3 rounded-lg text-sm transition-colors ${
                        item.level === 1 ? 'font-semibold' : item.level === 2 ? 'pl-5' : 'pl-8'
                      } ${
                        item.id === activeHeadingId
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Layout: TOC sidebar + content */}
      <div className="flex gap-8 items-start">
        {/* Desktop TOC */}
        {showToc && toc.length > 1 && (
          <aside className="hidden xl:block w-64 shrink-0">
            <TableOfContents items={toc} activeId={activeHeadingId} />
          </aside>
        )}

        {/* Reader column */}
        <div className="flex-1 min-w-0">
          {/* Document meta bar */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>{readingTime} min read</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <Eye className="w-4 h-4 text-purple-400" />
              <span>{wordCount.toLocaleString()} words</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <BookOpen className="w-4 h-4 text-pink-400" />
              <span>{toc.length} sections</span>
            </div>
          </div>

          {/* The actual prose content */}
          <div
            ref={readerRef}
            dir={isRtl ? 'rtl' : 'ltr'}
            className={`
              max-w-[850px]
              ${isRtl ? 'mr-auto' : 'mx-auto'}
              ${className}
            `}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components as any}>
              {content}
            </ReactMarkdown>
          </div>

          {/* End of content card */}
          <div className="max-w-[850px] mx-auto mt-16 pt-8 border-t border-white/5">
            <div className="backdrop-blur-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 text-center">
              <div className="text-2xl mb-2">🎓</div>
              <p className="text-sm font-semibold text-white mb-1">You've reached the end!</p>
              <p className="text-xs text-slate-400">
                Use the tabs above to generate a summary, quiz, or flashcards from this content.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-40 w-11 h-11 rounded-full bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-lg shadow-lg shadow-indigo-500/20 flex items-center justify-center text-white transition-all hover:scale-110 border border-indigo-500/40"
          aria-label="Back to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </>
  );
};
