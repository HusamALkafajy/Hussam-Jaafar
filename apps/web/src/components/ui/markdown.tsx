'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { useLocale } from '../../hooks/use-locale';

interface MarkdownProps {
  content: string;
  className?: string;
}

interface Token {
  type: string;
  text: string;
}

// Lightweight syntax tokenizer for common programming keywords, strings, comments, numbers
function tokenize(code: string): Token[] {
  const regex = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|import|export|from|class|extends|new|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|async|await|default|public|private|protected|interface|type|as|from|def|elif|print|self|import|as)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*(?=\())/g;
  
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'plain', text: code.substring(lastIndex, match.index) });
    }
    
    if (match[1]) {
      tokens.push({ type: 'comment', text: match[1] });
    } else if (match[2]) {
      tokens.push({ type: 'string', text: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'keyword', text: match[3] });
    } else if (match[4]) {
      tokens.push({ type: 'number', text: match[4] });
    } else if (match[5]) {
      tokens.push({ type: 'function', text: match[5] });
    }
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < code.length) {
    tokens.push({ type: 'plain', text: code.substring(lastIndex) });
  }
  
  return tokens;
}

function getClassForType(type: string): string {
  switch (type) {
    case 'comment':
      return 'text-slate-500 italic';
    case 'string':
      return 'text-emerald-400';
    case 'keyword':
      return 'text-pink-400 font-semibold';
    case 'number':
      return 'text-amber-400';
    case 'function':
      return 'text-sky-400';
    default:
      return 'text-slate-300';
  }
}

// macOS style custom code block component
const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tokens = tokenize(value);

  const codeContent = (
    <pre className="p-4 overflow-x-auto font-mono text-[12px] leading-relaxed text-slate-350 bg-slate-950/20 select-text flex-1">
      <code className="block select-text font-mono">
        {tokens.map((token, i) => (
          <span key={i} className={getClassForType(token.type)}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );

  const blockLayout = (
    <div className={`w-full bg-[#030712] border border-slate-800/80 rounded-xl overflow-hidden my-6 shadow-xl text-left flex flex-col ${isFullscreen ? 'fixed inset-4 sm:inset-10 z-50 max-w-5xl mx-auto h-[calc(100vh-5rem)]' : ''}`} dir="ltr">
      {/* Top Header Bar */}
      <div className="bg-[#0b0f19]/80 border-b border-slate-800/40 px-4 py-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-[10px] text-slate-500 uppercase font-mono font-bold tracking-widest leading-none">
            {language || 'code'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Collapse/Expand Toggle */}
          {!isFullscreen && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              type="button"
              title={isCollapsed ? 'Expand Code' : 'Collapse Code'}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            type="button"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            type="button"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1 text-[11px]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold px-0.5 text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="font-semibold px-0.5">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Text Window */}
      {(!isCollapsed || isFullscreen) && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {codeContent}
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-md" onClick={() => setIsFullscreen(false)} />
        {blockLayout}
      </>
    );
  }

  return blockLayout;
};

// Custom ReactMarkdown elements mapping
const markdownComponents = {
  pre({ children }: any) {
    return <div className="w-full">{children}</div>;
  },
  code({ node, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');
    const isInline = !className;

    if (!isInline && match) {
      return <CodeBlock language={match[1]} value={codeContent} />;
    }

    return (
      <code className="bg-slate-950/60 border border-slate-800/40 text-pink-400 px-1.5 py-0.5 rounded font-mono text-xs" {...props}>
        {children}
      </code>
    );
  }
};

export const Markdown = ({ content, className = '' }: MarkdownProps) => {
  const { locale } = useLocale();

  return (
    <div
      className={`prose prose-invert prose-indigo max-w-none leading-relaxed prose-headings:font-bold prose-headings:tracking-tight prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500/40 prose-blockquote:bg-indigo-500/5 prose-blockquote:p-4 prose-blockquote:rounded-r-lg ${
        locale === 'ar' ? 'prose-rtl text-right' : 'text-left'
      } ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
