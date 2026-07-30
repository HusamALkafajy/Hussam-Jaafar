import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../src/lib/api-client', () => ({
  api: {
    delete: (...args: unknown[]) => mocks.apiDelete(...args),
    get: (...args: unknown[]) => mocks.apiGet(...args),
    post: (...args: unknown[]) => mocks.apiPost(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
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

function accessibleDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ');
}

describe('files and legacy navigation semantics', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
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
          /expected a native <button>|validateDOMNesting|hydration|cannot be a descendant|DialogTitle|DialogDescription|accessible (name|description)/i.test(
            value,
          ),
      ),
    );

    expect(semanticErrors).toEqual([]);
    consoleError.mockRestore();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('keeps file navigation and destructive confirmation as separate controls', async () => {
    const user = userEvent.setup();
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

    await user.click(deleteFile);

    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Delete this file?',
    });
    expect(accessibleDescription(confirmation)).toBe(
      'physics.pdf will be permanently deleted. This action cannot be undone.',
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Cancel' }),
    );
    expect(mocks.apiDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete file' }));

    await waitFor(() =>
      expect(mocks.apiDelete).toHaveBeenCalledWith('/files/file-1'),
    );
    expect(navigationActivation).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'File deleted successfully.',
    );
  });

  it('keeps destructive cancel safe and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');

    const deleteFile = screen.getByRole('button', {
      name: 'Delete physics.pdf',
    });
    await user.click(deleteFile);

    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(cancel);
    await user.click(cancel);

    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).toBeNull(),
    );
    expect(document.activeElement).toBe(deleteFile);
    expect(mocks.apiDelete).not.toHaveBeenCalled();
  });

  it('provides an accessible upload dialog and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');

    const uploadAction = screen.getByRole('button', { name: 'Upload File' });
    expect(uploadAction.getAttribute('type')).toBe('button');
    await user.click(uploadAction);

    const dialog = await screen.findByRole('dialog', { name: 'Upload File' });
    expect(accessibleDescription(dialog)).toBe(
      'PDF, Word, or image. You can optionally choose a subject before uploading.',
    );

    const fileInput = screen.getByLabelText(/Choose a file/);
    expect(document.activeElement).toBe(fileInput);
    expect(fileInput.getAttribute('accept')).toBe('.pdf,.docx,image/*');
    expect(accessibleDescription(fileInput)).toBe('PDF, Word, or image');
    expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull();

    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    expect(submit.getAttribute('type')).toBe('submit');
    expect(submit.disabled).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancel' }).getAttribute('type'),
    ).toBe('button');

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).toBeNull(),
    );
    expect(document.activeElement).toBe(uploadAction);
  });

  it('keeps keyboard focus inside the upload dialog', async () => {
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));

    const dialog = await screen.findByRole('dialog', { name: 'Upload File' });
    for (let index = 0; index < 8; index += 1) {
      await user.tab();
      await waitFor(() =>
        expect(dialog.contains(document.activeElement)).toBe(true),
      );
    }
  });

  it('associates upload validation errors with the standard file input', async () => {
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));

    const fileInput = screen.getByLabelText(/Choose a file/);
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['plain text'], 'notes.txt', { type: 'text/plain' })],
      },
    });

    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('Choose a PDF, Word document, or image.');
    expect(fileInput.getAttribute('aria-invalid')).toBe('true');
    expect(fileInput.getAttribute('aria-describedby')).toContain(
      'upload-file-error',
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Start Upload & Analysis',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    const oversizedPdf = new File(['pdf'], 'large.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(oversizedPdf, 'size', {
      value: 50 * 1024 * 1024 + 1,
    });
    fireEvent.change(fileInput, {
      target: { files: [oversizedPdf] },
    });

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('The file must be 50MB or smaller.'),
    );
  });

  it('announces upload progress with meaningful accessible values', async () => {
    let resolveUpload: (value: { id: string }) => void = () => undefined;
    mocks.apiPost.mockImplementation(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));

    const fileInput = screen.getByLabelText(/Choose a file/);
    await user.upload(
      fileInput,
      new File(['pdf'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Start Upload & Analysis' }),
    );

    const progress = await screen.findByRole('progressbar', {
      name: 'File upload progress',
    });
    expect(progress.getAttribute('aria-valuemin')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('100');
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('status').textContent).toContain(
      'Keep this dialog open until the upload finishes.',
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Upload File' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    resolveUpload({ id: 'new-file' });
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/files/new-file'),
    );
  });

  it('reports delete failures without a native alert', async () => {
    mocks.apiDelete.mockRejectedValueOnce(new Error('network failure'));
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');

    await user.click(
      screen.getByRole('button', { name: 'Delete physics.pdf' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Delete file' }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Could not delete the file. Try again.',
      ),
    );
    expect(screen.getByRole('alertdialog', {
      name: 'Delete this file?',
    })).not.toBeNull();
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
