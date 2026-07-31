import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ar from '../src/i18n/ar.json';
import en from '../src/i18n/en.json';
import { LocaleProvider, useLocale } from '../src/hooks/use-locale';

type Dictionary = Record<string, unknown>;

function flatten(dictionary: Dictionary, prefix = '', result: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(dictionary)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Dictionary, keyPath, result);
    } else if (typeof value === 'string') {
      result[keyPath] = value;
    }
  }
  return result;
}

const arabic = flatten(ar as Dictionary);
const english = flatten(en as Dictionary);
const affectedNamespaces = ['common.', 'landing.', 'auth.', 'dashboard.', 'files.', 'uploadQueue.', 'workspace.', 'flashcards.', 'exams.', 'tutor.', 'achievements.'];

const coreFiles = [
  'src/app/(auth)/forgot-password/page.tsx',
  'src/app/(auth)/login/page.tsx',
  'src/app/(auth)/register/page.tsx',
  'src/app/(auth)/reset-password/page.tsx',
  'src/app/(dashboard)/layout.tsx',
  'src/app/(dashboard)/dashboard/page.tsx',
  'src/app/(dashboard)/files/page.tsx',
  'src/app/(dashboard)/files/[id]/page.tsx',
  'src/app/(dashboard)/flashcards/page.tsx',
  'src/app/(dashboard)/flashcards/[id]/page.tsx',
  'src/app/(dashboard)/exams/page.tsx',
  'src/app/(dashboard)/exams/[id]/page.tsx',
  'src/app/(dashboard)/chat/page.tsx',
  'src/app/(dashboard)/chat/[id]/page.tsx',
  'src/components/activity-feed.tsx',
  'src/components/gamification-celebration.tsx',
  'src/components/gamification-widget.tsx',
  'src/components/global-command-palette.tsx',
  'src/components/ui/content-reader.tsx',
  'src/components/marketing/Footer.tsx',
  'src/components/marketing/HeroSection.tsx',
  'src/components/marketing/Pricing.tsx',
  'src/components/marketing/Services.tsx',
  'src/components/onboarding/ftue-dashboard-empty.tsx',
  'src/components/shared/navbar.tsx',
  'src/components/upload/upload-queue.tsx',
] as const;

function TranslationHarness({ fileName }: { fileName: string }) {
  const { dir, locale, setLocale, t } = useLocale();

  return (
    <main dir={dir} data-locale={locale}>
      <nav aria-label={t('dashboard.sidebarHome')}>
        {t('dashboard.sidebarFiles')} · {t('dashboard.sidebarExams')} ·{' '}
        {t('dashboard.sidebarFlashcards')}
      </nav>
      <h1>{t('files.title')}</h1>
      <p>{t('files.statusProcessing')}</p>
      <button aria-label={t('files.deleteFileNamed', { fileName })}>
        {t('files.deleteTitle')}
      </button>
      <section aria-label={t('dashboard.uploadNewFile')}>
        {t('files.uploadRequirements')} · {t('files.startUpload')}
      </section>
      <p>
        {t('workspace.summary')} · {t('flashcards.title')} · {t('exams.title')} ·{' '}
        {t('tutor.assistantName')}
      </p>
      <button onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
        {t(locale === 'ar' ? 'common.english' : 'common.arabic')}
      </button>
    </main>
  );
}

describe('core Arabic and English translation contract', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.cookie = 'locale=; path=/; max-age=0';
    localStorage.clear();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    const relevantErrors = consoleError.mock.calls.filter((args) =>
      args.some(
        (value) =>
          typeof value === 'string' &&
          /hydration|missing translation|validateDOMNesting|DialogTitle|Select/i.test(value),
      ),
    );
    expect(relevantErrors).toEqual([]);
    consoleError.mockRestore();
    cleanup();
  });

  it('keeps affected dictionary paths and interpolation variables identical', () => {
    const affectedArabic = Object.keys(arabic).filter((key) =>
      affectedNamespaces.some((namespace) => key.startsWith(namespace)),
    );
    const affectedEnglish = Object.keys(english).filter((key) =>
      affectedNamespaces.some((namespace) => key.startsWith(namespace)),
    );

    expect(affectedArabic.sort()).toEqual(affectedEnglish.sort());

    for (const key of affectedEnglish) {
      const placeholders = (value: string) =>
        [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(placeholders(arabic[key]), key).toEqual(placeholders(english[key]));
    }
  });

  it('renders the canonical Arabic core labels, accessible names, and user filename', () => {
    render(
      <LocaleProvider initialLocale="ar">
        <TranslationHarness fileName="فيزياء-1.pdf" />
      </LocaleProvider>,
    );

    expect(screen.getByRole('main').getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('heading', { name: 'ملفاتي' })).not.toBeNull();
    expect(screen.getAllByText(/الامتحانات/)).toHaveLength(2);
    expect(screen.getByText(/البطاقات التعليمية التفاعلية/)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'حذف فيزياء-1.pdf' })).not.toBeNull();
    expect(screen.queryByText(/workspace\.|files\.|tutor\./)).toBeNull();
  });

  it('renders English and switches locale without a broken state reset', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider initialLocale="en">
        <TranslationHarness fileName="physics.pdf" />
      </LocaleProvider>,
    );

    const main = screen.getByRole('main');
    expect(main.getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('heading', { name: 'My Files' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Delete physics.pdf' })).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'العربية' }));

    expect(main.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('heading', { name: 'ملفاتي' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'حذف physics.pdf' })).not.toBeNull();
  });

  it('guards canonical core source against recurring inline bilingual copy', () => {
    const approvedLiteralTokens = ['StudyAI', 'AI', 'PDF', 'PPTX', 'DOCX', 'Word', 'Ctrl+↵'];
    const knownHardcodedLabels = [
      'Recent Processing Jobs',
      'Upload New File',
      'Interactive Flashcards',
      'Generate Smart Exam',
      'Delete this file?',
      'Ask anything about this document',
      "label: 'Exams'",
      "label: 'Flashcards'",
      'Search workspace...',
      'alt="Avatar"',
      'AI Tutor is currently busy',
      'تصفح ملفاتي',
      'جارٍ التوليد',
    ];

    for (const relativePath of coreFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).not.toMatch(/[\u0600-\u06ff]/);
      for (const label of knownHardcodedLabels) {
        expect(source, `${relativePath}: ${label}`).not.toContain(label);
      }

      const rawVisibleEnglish = [...source.matchAll(/>\s*([A-Z][^<{]*?)\s*</g)]
        .map((match) => match[1].trim())
        .filter((text) => !approvedLiteralTokens.some((token) => text === token));
      expect(rawVisibleEnglish, relativePath).toEqual([]);
    }
  });

  it('ensures every literal core translation call resolves in both dictionaries', () => {
    for (const relativePath of coreFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      const keys = [...source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      );
      for (const key of keys) {
        expect(english[key], `${relativePath}: ${key} (en)`).toBeTypeOf('string');
        expect(arabic[key], `${relativePath}: ${key} (ar)`).toBeTypeOf('string');
      }
    }
  });
});
