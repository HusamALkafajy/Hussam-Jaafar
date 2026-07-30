import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FilesPage from '../src/app/(dashboard)/files/page';
import { UploadQueue } from '../src/components/upload/upload-queue';
import { Button } from '../src/components/ui/button';
import { SidebarNavButton } from '../src/components/ui/sidebar-nav';

const mocks = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  push: vi.fn(),
}));

vi.mock('../src/lib/api-client', () => ({
  api: {
    delete: (...args: unknown[]) => mocks.apiDelete(...args),
    get: (...args: unknown[]) => mocks.apiGet(...args),
    post: (...args: unknown[]) => mocks.apiPost(...args),
  },
}));

const translations: Record<string, string> = {
  'dashboard.uploadNewFile': 'Upload File',
  'files.allSubjects': 'All subjects',
  'files.allTypes': 'All types',
  'files.date': 'Date',
  'files.emptyState': 'No files',
  'files.mergingAndAnalyzing': 'Merging and analyzing',
  'files.searchPlaceholder': 'Search files',
  'files.statusCompleted': 'Completed',
  'files.statusFailed': 'Failed',
  'files.statusProcessing': 'Processing',
  'files.subject': 'Subject',
  'files.title': 'My Files',
  'files.uploadRequirements': 'PDF, Word, or image',
  'files.uploadZone': 'Choose a file',
  'files.uploadingChunk': 'Uploading chunk {chunk} of {total}',
};

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => ({
    locale: 'en',
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const file = {
  createdAt: '2026-07-31T00:00:00.000Z',
  fileSize: 1024,
  id: 'file-1',
  originalName: 'physics.pdf',
  processingStatus: 'completed',
};

function expectNoNestedInteractive(container: HTMLElement) {
  expect(
    container.querySelectorAll('a a, a button, button a, button button'),
  ).toHaveLength(0);
}

describe('files and legacy navigation semantics', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
    consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mocks.apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/files?')) {
        return Promise.resolve({
          data: [file],
          pagination: {
            limit: 10,
            page: 1,
            total: 1,
            totalPages: 1,
          },
        });
      }

      if (url === '/subjects') {
        return Promise.resolve([]);
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    mocks.apiDelete.mockResolvedValue({});
  });

  afterEach(() => {
    const semanticErrors = consoleError.mock.calls.filter((args) =>
      args.some(
        (value) =>
          typeof value === 'string' &&
          /expected a native <button>|validateDOMNesting|hydration|cannot be a descendant/i.test(
            value,
          ),
      ),
    );

    expect(semanticErrors).toEqual([]);
    consoleError.mockRestore();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('keeps file navigation and delete as separate keyboard controls', async () => {
    const { container } = render(<FilesPage />);

    await screen.findByText('physics.pdf');

    const openFile = screen.getByLabelText('Open physics.pdf');
    const deleteFile = screen.getByRole('button', {
      name: 'Delete physics.pdf',
    });
    const navigationActivation = vi.fn((event: Event) =>
      event.preventDefault(),
    );
    openFile.addEventListener('click', navigationActivation);

    expect(openFile.tagName).toBe('A');
    expect(openFile.getAttribute('href')).toBe('/files/file-1');
    expect(deleteFile.tagName).toBe('BUTTON');
    expect(deleteFile.getAttribute('type')).toBe('button');
    expectNoNestedInteractive(container);

    fireEvent.click(deleteFile);

    await waitFor(() =>
      expect(mocks.apiDelete).toHaveBeenCalledWith('/files/file-1'),
    );
    expect(navigationActivation).not.toHaveBeenCalled();
  });

  it('preserves upload action, submit type, and disabled behavior', async () => {
    render(<FilesPage />);
    await screen.findByText('physics.pdf');

    const uploadAction = screen.getByRole('button', { name: 'Upload File' });
    expect(uploadAction.getAttribute('type')).toBe('button');
    fireEvent.click(uploadAction);

    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    expect(submit.getAttribute('type')).toBe('submit');
    expect(submit.disabled).toBe(true);
  });

  it('renders representative converted navigation as one anchor', () => {
    const { container } = render(<UploadQueue variant="compact" />);
    const queueLink = screen.getByText('View All Queue').closest('a');

    expect(queueLink).not.toBeNull();
    expect(queueLink?.getAttribute('href')).toBe('/upload');
    expect(queueLink?.classList.contains('group/button')).toBe(true);
    expectNoNestedInteractive(container);
  });

  it('keeps loading controls native and disabled', () => {
    render(<Button loading>Save</Button>);
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

    expect(save.tagName).toBe('BUTTON');
    expect(save.getAttribute('type')).toBe('button');
    expect(save.disabled).toBe(true);
  });

  it('renders sidebar actions as native buttons', () => {
    const action = vi.fn();
    render(<SidebarNavButton onClick={action}>Sign out</SidebarNavButton>);

    const signOut = screen.getByRole('button', { name: 'Sign out' });
    expect(signOut.tagName).toBe('BUTTON');
    expect(signOut.getAttribute('type')).toBe('button');

    fireEvent.click(signOut);
    expect(action).toHaveBeenCalledOnce();
  });
});
