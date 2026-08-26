import React from 'react';
import { useReaderState } from './reader-state';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Settings2, Type, Maximize, Moon, Sun, Focus } from 'lucide-react';
import { Stack } from '../ui/stack';

export function TypographySettings() {
  const { session, updateSession } = useReaderState();

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" title="Typography & Settings" />}>
        <Settings2 className="size-5" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <Stack gap={6}>
          {/* Font Family */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Font Family</h4>
            <div className="flex bg-muted/50 p-1 rounded-lg">
              <Button 
                variant={session.fontFamily === 'sans' ? 'default' : 'ghost'} 
                className="flex-1 font-sans"
                onClick={() => updateSession({ fontFamily: 'sans' })}
              >
                Sans-serif
              </Button>
              <Button 
                variant={session.fontFamily === 'serif' ? 'default' : 'ghost'} 
                className="flex-1 font-serif"
                onClick={() => updateSession({ fontFamily: 'serif' })}
              >
                Serif
              </Button>
            </div>
          </div>

          {/* Text Size & Spacing */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Text Size & Spacing</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Size</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => updateSession({ fontSize: 'small' })} className={session.fontSize === 'small' ? 'bg-primary/10' : ''}>A</Button>
                <Button variant="outline" size="sm" onClick={() => updateSession({ fontSize: 'medium' })} className={session.fontSize === 'medium' ? 'bg-primary/10' : ''}>A</Button>
                <Button variant="outline" size="sm" onClick={() => updateSession({ fontSize: 'large' })} className={session.fontSize === 'large' ? 'bg-primary/10' : ''}>A</Button>
                <Button variant="outline" size="sm" onClick={() => updateSession({ fontSize: 'xlarge' })} className={session.fontSize === 'xlarge' ? 'bg-primary/10' : ''}>A</Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Spacing</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => updateSession({ lineHeight: 'tight' })} className={session.lineHeight === 'tight' ? 'bg-primary/10' : ''}>Tight</Button>
                <Button variant="outline" size="sm" onClick={() => updateSession({ lineHeight: 'normal' })} className={session.lineHeight === 'normal' ? 'bg-primary/10' : ''}>Normal</Button>
                <Button variant="outline" size="sm" onClick={() => updateSession({ lineHeight: 'relaxed' })} className={session.lineHeight === 'relaxed' ? 'bg-primary/10' : ''}>Relaxed</Button>
              </div>
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Theme</h4>
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={() => updateSession({ theme: 'system' })} className={session.theme === 'system' ? 'border-primary' : ''}>Auto</Button>
              <Button variant="outline" size="sm" onClick={() => updateSession({ theme: 'light' })} className={session.theme === 'light' ? 'border-primary' : ''}><Sun className="size-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => updateSession({ theme: 'sepia' })} className={session.theme === 'sepia' ? 'border-primary bg-[#f4ecd8] text-[#5b4636] hover:bg-[#e8dec0]' : 'bg-[#f4ecd8] text-[#5b4636] hover:bg-[#e8dec0] border-transparent'}>Sepia</Button>
              <Button variant="outline" size="sm" onClick={() => updateSession({ theme: 'dark' })} className={session.theme === 'dark' ? 'border-primary' : ''}><Moon className="size-4" /></Button>
            </div>
          </div>

        </Stack>
      </PopoverContent>
    </Popover>
  );
}
