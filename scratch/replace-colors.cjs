const fs = require('fs');

function replaceFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content, 'utf8');
}

// HeroSection.tsx
replaceFile('apps/web/src/components/marketing/HeroSection.tsx', (content) => {
  return content
    .replace(/text-slate-400/g, 'text-muted-foreground')
    .replace(/border-slate-800\/40/g, 'border-border')
    .replace(/text-slate-500/g, 'text-muted-foreground')
    .replace(/border-slate-700\/30/g, 'border-border')
    .replace(/border-slate-750\/30/g, 'border-border')
    .replace(/text-slate-200/g, 'text-foreground/90')
    .replace(/text-white/g, 'text-foreground')
    .replace(/text-indigo-400/g, 'text-primary')
    .replace(/bg-indigo-500\/10/g, 'bg-primary/10');
});

// Services.tsx
replaceFile('apps/web/src/components/marketing/Services.tsx', (content) => {
  // We want to keep icon colors semantic if requested, wait:
  // "Feature icon colors may remain different: blue, purple, indigo, green, rose, amber"
  // "but normalize: saturation, opacity, icon tile darkness, visual weight."
  // The prompt says: "bg-indigo-500/10 text-indigo-400", "bg-purple-500/10 text-purple-400"
  // It's already fairly normalized in opacity (500/10) and text (400). I won't touch the icon colors, but I will fix the card bg and text.
  return content
    .replace(/text-slate-400/g, 'text-muted-foreground')
    .replace(/bg-slate-900\/40 border-slate-800\/80/g, 'bg-card border-border')
    .replace(/text-white/g, 'text-foreground')
    .replace(/text-slate-300/g, 'text-muted-foreground');
});

// Footer.tsx
replaceFile('apps/web/src/components/marketing/Footer.tsx', (content) => {
  return content
    .replace(/text-slate-400/g, 'text-muted-foreground')
    .replace(/text-slate-300/g, 'text-foreground')
    .replace(/text-slate-500/g, 'text-muted-foreground')
    .replace(/border-slate-800\/60/g, 'border-border')
    .replace(/bg-slate-900\/50/g, 'bg-card/50')
    .replace(/border-slate-800\/80/g, 'border-border')
    .replace(/text-white/g, 'text-foreground')
    .replace(/border-slate-800\/40/g, 'border-border');
});

// Header/Navbar? I'll check it. Let's do just these for now.
console.log('done');
