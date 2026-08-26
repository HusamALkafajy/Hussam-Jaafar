import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentReader } from '../src/components/ui/content-reader';

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => ({
    dir: 'ltr',
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => key,
  }),
}));

describe('ContentReader accessibility', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect(): void {}
        observe(): void {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uses a compliant light-theme body token while preserving the dark-theme token', () => {
    render(
      <ContentReader
        content="Readable extracted document text."
        showProgress={false}
        showToc={false}
      />,
    );

    const paragraph = screen.getByText('Readable extracted document text.');
    const classes = Array.from(paragraph.classList);

    expect(paragraph.tagName).toBe('P');
    expect(classes).toContain('text-slate-600');
    expect(classes).toContain('dark:text-slate-300');
    expect(classes).not.toContain('text-slate-300');
    expect(classes).toEqual(
      expect.arrayContaining(['text-[1.0625rem]', 'leading-[1.85]', 'mb-5']),
    );
  });
});
