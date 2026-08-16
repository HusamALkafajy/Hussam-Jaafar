const fs = require('fs');

function replaceFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content, 'utf8');
}

// navbar.tsx
replaceFile('apps/web/src/components/shared/navbar.tsx', (content) => {
  return content
    .replace(/border-slate-800\/40/g, 'border-border')
    .replace(/text-slate-300/g, 'text-foreground')
    .replace(/text-slate-400/g, 'text-muted-foreground')
    .replace(/border-slate-800\/20/g, 'border-border/50')
    .replace(/border-slate-800/g, 'border-border')
    .replace(/bg-slate-800/g, 'bg-muted')
    .replace(/bg-slate-850/g, 'bg-muted')
    .replace(/hover:text-white/g, 'hover:text-foreground');
});

// Pricing.tsx
replaceFile('apps/web/src/components/marketing/Pricing.tsx', (content) => {
  return content
    .replace(/text-slate-400/g, 'text-muted-foreground')
    .replace(/bg-slate-900\/40/g, 'bg-card')
    .replace(/border-slate-800\/80/g, 'border-border')
    .replace(/bg-slate-800/g, 'bg-border')
    .replace(/bg-slate-700/g, 'bg-muted-foreground')
    .replace(/text-slate-200/g, 'text-foreground')
    .replace(/text-slate-300/g, 'text-muted-foreground')
    .replace(/text-white/g, 'text-foreground');
});

console.log('done');
