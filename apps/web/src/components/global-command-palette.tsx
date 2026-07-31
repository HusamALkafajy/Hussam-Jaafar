'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '../hooks/use-locale';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './ui/command';
import { GraduationCap, Home } from 'lucide-react';

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('dashboard.commandPalette')}
      description={t('dashboard.commandPaletteDescription')}
    >
      <CommandInput placeholder={t('dashboard.commandSearch')} />
      <CommandList>
        <CommandEmpty>{t('dashboard.commandNoResults')}</CommandEmpty>
        <CommandGroup heading={t('dashboard.commandSuggestions')}>
          <CommandItem onSelect={() => runCommand(() => router.push('/files'))}>
            <Home className="mr-2 h-4 w-4 rtl:ml-2" />
            <span>{t('dashboard.commandGoToFiles')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/exams'))}>
            <GraduationCap className="mr-2 h-4 w-4 rtl:ml-2" />
            <span>{t('dashboard.commandGoToExams')}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
