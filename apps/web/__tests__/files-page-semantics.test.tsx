import React, { Suspense } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FilesPage from '../src/app/(dashboard)/files/page';
import FileDetailPage from '../src/app/(dashboard)/files/[id]/page';
import { UploadQueue } from '../src/components/upload/upload-queue';
import { Button } from '../src/components/ui/button';
import { SidebarNavButton } from '../src/components/ui/sidebar-nav';
import { ApiError, QuotaError } from '../src/lib/api-client';

const mocks = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  locale: 'en' as 'ar' | 'en',
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../src/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/api-client')>();
  return {
    ...original,
    api: {
      delete: (...args: unknown[]) => mocks.apiDelete(...args),
      get: (...args: unknown[]) => mocks.apiGet(...args),
      post: (...args: unknown[]) => mocks.apiPost(...args),
    },
  };
});

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
  'files.deleteDescription': '{fileName} will be permanently deleted. This action cannot be undone.',
  'files.deleteFailure': 'Could not delete the file. Try again.',
  'files.deleteFile': 'Delete file',
  'files.deleteFileNamed': 'Delete {fileName}',
  'files.deleteSuccess': 'File deleted successfully.',
  'files.deleteTitle': 'Delete this file?',
  'files.date': 'Date',
  'files.emptyState': 'No files',
  'files.fileTypeFilter': 'File type filter',
  'files.fileTypeImage': 'Image',
  'files.tabExam': 'Quiz',
  'files.invalidType': 'Choose a PDF, Word document, or image.',
  'files.maxSize': 'The file must be 50 MiB or smaller.',
  'files.documentTitle': 'Document title (optional)',
  'files.documentTitlePlaceholder': 'Enter the book or document title',
  'files.documentTitleHelp': 'Metadata or filename fallback.',
  'files.untitledDocument': 'Untitled document',
  'files.mergingAndAnalyzing': 'Merging and analyzing',
  'files.monthlyUploadAllowance': 'Monthly upload allowance',
  'files.monthlyUploadLimitReached': 'Monthly upload limit reached. New uploads become available after the monthly reset.',
  'files.monthlyUploadUsageUnavailable': 'Monthly upload allowance is temporarily unavailable.',
  'files.monthlyUploadsRemaining': 'Uploads remaining this month: {remaining}',
  'files.monthlyUploadsReset': 'Resets on {date}',
  'files.monthlyUploadsResetUnavailable': 'Reset date unavailable',
  'files.monthlyUploadsUsed': 'Monthly uploads used: {used} / {limit}',
  'files.noSubject': 'No Subject',
  'files.openFile': 'Open {fileName}',
  'files.quotaExceeded': 'You have reached your monthly upload limit. New uploads become available after the monthly reset.',
  'files.searchPlaceholder': 'Search files',
  'files.startUpload': 'Start Upload & Analysis',
  'files.statusCompleted': 'Completed',
  'files.statusFailed': 'Failed',
  'files.statusPending': 'Queued',
  'files.statusProcessing': 'Processing',
  'files.subject': 'Subject',
  'files.subjectFilter': 'Subject filter',
  'files.title': 'My Files',
  'files.unnamedFile': 'This file',
  'files.uploadDescription': 'You can optionally choose a subject before uploading.',
  'files.uploadFailed': 'Upload failed',
  'files.uploadKeepOpen': 'Keep this dialog open until the upload finishes.',
  'files.uploadProgress': 'File upload progress',
  'files.uploadRequirements': 'PDF, Word, or image',
  'files.uploadSuccess': 'File uploaded successfully!',
  'files.uploadSuccessDescription': 'AI analysis started in the background.',
  'files.uploadZone': 'Choose a file',
  'files.uploadingChunk': 'Uploading chunk {chunk} of {total}',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'uploadQueue.recentJobs': 'Recent Processing Jobs',
  'uploadQueue.viewAll': 'View All Queue',
  'uploadQueue.stageUploading': 'Uploading',
  'uploadQueue.stageQueued': 'Queued',
  'uploadQueue.stageExtracting': 'Extracting content',
  'uploadQueue.stageBuildingAst': 'Structuring content',
  'uploadQueue.stageValidating': 'Validating',
  'uploadQueue.stageIndexing': 'Indexing content',
  'uploadQueue.stageFinalizing': 'Finalizing',
  'uploadQueue.stageCompleted': 'Completed',
  'workspace.difficulty': 'Difficulty Level',
  'workspace.easy': 'Easy',
  'workspace.generateExam': 'Generate Smart Exam',
  'workspace.generateExamAction': 'Generate Exam',
  'workspace.hard': 'Hard',
  'workspace.inProgress': 'In progress',
  'workspace.mcqOnlyReleaseNote': 'Multiple-choice questions are available in the current release.',
  'workspace.medium': 'Medium',
  'workspace.multipleChoice': 'Multiple Choice',
  'workspace.previousExams': 'Previous quizzes',
  'workspace.questionCount': 'Questions',
  'workspace.questions': '{count} questions',
  'workspace.questionTypes': 'Question Types',
  'workspace.takeExam': 'Take quiz',
  'workspace.trueFalse': 'True / False',
  'workspace.viewResults': 'View results',
  'exams.draftUnavailableAction': 'Not available yet',
};

const arabicTranslations: Record<string, string> = {
  'files.monthlyUploadAllowance': 'حد الرفع الشهري',
  'files.monthlyUploadLimitReached': 'بلغت حد الرفع الشهري. ستتوفر عمليات رفع جديدة بعد إعادة الضبط الشهرية.',
  'files.monthlyUploadsRemaining': 'عمليات الرفع المتبقية هذا الشهر: {remaining}',
  'files.monthlyUploadsReset': 'يُعاد الضبط في {date}',
  'files.monthlyUploadsUsed': 'عمليات الرفع المستخدمة شهرياً: {used} / {limit}',
  'files.subjectFilter': 'تصفية حسب المادة',
};

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => ({
    locale: mocks.locale,
    t: (key: string, params?: Record<string, string | number>) => {
      const value =
        (mocks.locale === 'ar' ? arabicTranslations[key] : undefined) ??
        translations[key] ??
        key;
      return value.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        params && Object.prototype.hasOwnProperty.call(params, name)
          ? String(params[name])
          : placeholder,
      );
    },
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

const belowLimitAllowance = {
  currentPeriodEnd: '2026-09-01T00:00:00.000Z',
  filesUsedThisMonth: 2,
  monthlyFileLimit: 5,
};

const atLimitAllowance = {
  currentPeriodEnd: '2026-09-01T00:00:00.000Z',
  filesUsedThisMonth: 5,
  monthlyFileLimit: 5,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function mockAllowanceRequests(...responses: unknown[]) {
  let allowanceRequest = 0;
  mocks.apiGet.mockImplementation((url: string) => {
    if (url.startsWith('/files?')) {
      return Promise.resolve({
        data: [file],
        pagination: { limit: 10, page: 1, total: 1, totalPages: 1 },
      });
    }
    if (url === '/subjects') return Promise.resolve([]);
    if (url === '/subscriptions/current') {
      const response = responses[Math.min(allowanceRequest, responses.length - 1)];
      allowanceRequest += 1;
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

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

function pageUploadAction() {
  const action = document.querySelector<HTMLButtonElement>('[data-slot="dialog-trigger"]');
  if (!action) throw new Error('Page upload action was not rendered');
  return action;
}

describe('files and legacy navigation semantics', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locale = 'en';
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
        return Promise.resolve([
          { id: 'subject-physics', name: 'Physics' },
          { id: 'subject-math', name: 'Mathematics' },
        ]);
      }

      if (url === '/subscriptions/current') {
        return Promise.resolve({
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
          filesUsedThisMonth: 2,
          monthlyFileLimit: 5,
        });
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

  it('shows the trusted monthly upload allowance without storage or checkout guidance', async () => {
    render(<FilesPage />);

    const allowance = await screen.findByRole('region', {
      name: 'Monthly upload allowance',
    });

    expect(within(allowance).getByText('Monthly uploads used: 2 / 5')).not.toBeNull();
    expect(within(allowance).getByText('Uploads remaining this month: 3')).not.toBeNull();
    expect(within(allowance).getByText('Resets on Sep 1, 2026')).not.toBeNull();
    expect(allowance.textContent).not.toMatch(/storage|delete|remove|upgrade/i);
  });

  it.each([
    ['en', 'Monthly upload limit reached. New uploads become available after the monthly reset.'],
    ['ar', 'بلغت حد الرفع الشهري. ستتوفر عمليات رفع جديدة بعد إعادة الضبط الشهرية.'],
  ] as const)('shows accurate at-limit messaging in %s', async (locale, message) => {
    mocks.locale = locale;
    mocks.apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/files?')) {
        return Promise.resolve({
          data: [file],
          pagination: { limit: 10, page: 1, total: 1, totalPages: 1 },
        });
      }
      if (url === '/subjects') return Promise.resolve([]);
      if (url === '/subscriptions/current') {
        return Promise.resolve({
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
          filesUsedThisMonth: 5,
          monthlyFileLimit: 5,
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(<FilesPage />);

    const allowance = await screen.findByRole('region', {
      name: locale === 'ar' ? 'حد الرفع الشهري' : 'Monthly upload allowance',
    });
    expect(within(allowance).getByText(message)).not.toBeNull();
    expect(allowance.textContent).not.toMatch(/delete|remove|upgrade|احذف|ترقية|رقِّ/i);
    expect(within(allowance).queryByRole('link')).toBeNull();
  });

  it('exposes a natively disabled described upload action and blocks mouse and keyboard at the cap', async () => {
    mockAllowanceRequests(atLimitAllowance);
    const user = userEvent.setup();
    render(<FilesPage />);

    const allowance = await screen.findByRole('region', {
      name: 'Monthly upload allowance',
    });
    const uploadAction = pageUploadAction();

    expect(uploadAction.disabled).toBe(true);
    expect(uploadAction.getAttribute('aria-disabled')).not.toBe('false');
    expect(accessibleDescription(uploadAction)).toBe(
      'Monthly upload limit reached. New uploads become available after the monthly reset.',
    );
    expect(within(allowance).getByText(/Monthly upload limit reached/)).not.toBeNull();

    await user.click(uploadAction);
    uploadAction.blur();
    await user.tab();
    expect(document.activeElement).not.toBe(uploadAction);
    await user.keyboard('{Enter} ');
    expect(screen.queryByRole('dialog', { name: 'Upload File' })).toBeNull();
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });

  it('disables every page upload trigger when an at-cap account has no files', async () => {
    mocks.apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/files?')) {
        return Promise.resolve({
          data: [],
          pagination: { limit: 10, page: 1, total: 0, totalPages: 1 },
        });
      }
      if (url === '/subjects') return Promise.resolve([]);
      if (url === '/subscriptions/current') return Promise.resolve(atLimitAllowance);
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    const user = userEvent.setup();
    render(<FilesPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Upload File' })).toHaveLength(2);
    });
    const actions = screen.getAllByRole('button', { name: 'Upload File' });
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect((action as HTMLButtonElement).disabled).toBe(true);
      expect(accessibleDescription(action)).toBe(
        'Monthly upload limit reached. New uploads become available after the monthly reset.',
      );
      await user.click(action);
    }
    expect(screen.queryByRole('dialog', { name: 'Upload File' })).toBeNull();
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });

  it('keeps an open modal stable but disables and guards submission when the cap becomes known', async () => {
    const capResponse = deferred<typeof atLimitAllowance>();
    mockAllowanceRequests(belowLimitAllowance, capResponse.promise);
    const uploadId = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    vi.stubGlobal('crypto', { randomUUID: uploadId });
    const user = userEvent.setup();
    render(<FilesPage />);

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upload File' });
    const title = screen.getByLabelText('Document title (optional)') as HTMLInputElement;
    const fileInput = screen.getByLabelText(/Choose a file/) as HTMLInputElement;
    await user.type(title, 'Preserved title');
    await user.upload(fileInput, new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }));

    window.dispatchEvent(new Event('focus'));
    capResponse.resolve(atLimitAllowance);

    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(true));
    expect(within(dialog).getByText(/Monthly upload limit reached/)).not.toBeNull();
    expect(accessibleDescription(submit)).toContain('Monthly upload limit reached');
    expect(title.value).toBe('Preserved title');
    expect(fileInput.files).toHaveLength(1);

    fireEvent.submit(submit.closest('form')!);
    expect(uploadId).not.toHaveBeenCalled();
    expect(mocks.apiPost).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Upload File' })).not.toBeNull();
  });

  it('latches a structured monthly files rejection and prevents repeated upload IDs and requests', async () => {
    mockAllowanceRequests(belowLimitAllowance);
    const uploadId = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    vi.stubGlobal('crypto', { randomUUID: uploadId });
    mocks.apiPost.mockRejectedValueOnce(
      new QuotaError('safe', 'QUOTA_EXCEEDED', 'files', 5, 5, 'free'),
    );
    const user = userEvent.setup();
    render(<FilesPage />);

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Upload & Analysis' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('You have reached your monthly upload limit.'),
    );
    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(pageUploadAction().disabled).toBe(true);
    expect(mocks.apiPost).toHaveBeenCalledOnce();
    expect(uploadId).toHaveBeenCalledOnce();

    await user.click(submit);
    fireEvent.submit(submit.closest('form')!);
    expect(mocks.apiPost).toHaveBeenCalledOnce();
    expect(uploadId).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'a non-files quota',
      new QuotaError('safe', 'QUOTA_EXCEEDED', 'tokens', 100, 100, 'free'),
    ],
    [
      'a storage failure',
      new ApiError('safe', 503, 'http', 'UPLOAD_STORAGE_FAILED'),
    ],
  ])('does not latch %s', async (_label, error) => {
    mockAllowanceRequests(belowLimitAllowance);
    mocks.apiPost.mockRejectedValue(error);
    const user = userEvent.setup();
    render(<FilesPage />);

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Upload & Analysis' }));
    await screen.findByRole('alert');

    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    expect(pageUploadAction().disabled).toBe(false);
    await user.click(submit);
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(2));
  });

  it('unlocks a rejection latch only after an authoritative below-limit refresh', async () => {
    mockAllowanceRequests(belowLimitAllowance, belowLimitAllowance);
    mocks.apiPost.mockRejectedValueOnce(
      new QuotaError('safe', 'QUOTA_EXCEEDED', 'files', 5, 5, 'free'),
    );
    const user = userEvent.setup();
    render(<FilesPage />);

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Upload & Analysis' }));
    await screen.findByRole('alert');

    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(pageUploadAction().disabled).toBe(false);
  });

  it('revalidates at the monthly boundary and unlocks only from a fresh period response', async () => {
    const resetAt = new Date(Date.now() + 2_000).toISOString();
    const currentPeriod = { ...belowLimitAllowance, currentPeriodEnd: resetAt };
    const newPeriod = {
      ...belowLimitAllowance,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      filesUsedThisMonth: 0,
    };
    mockAllowanceRequests(currentPeriod, newPeriod);
    mocks.apiPost.mockRejectedValueOnce(
      new QuotaError('safe', 'QUOTA_EXCEEDED', 'files', 5, 5, 'free'),
    );
    const user = userEvent.setup();
    render(<FilesPage />);

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Upload & Analysis' }));
    await screen.findByRole('alert');

    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await waitFor(() => expect(submit.disabled).toBe(false), { timeout: 3_000 });
  });

  it('preserves a server-derived latch when reset revalidation is unavailable', async () => {
    const resetAt = new Date(Date.now() + 80).toISOString();
    mockAllowanceRequests(
      { ...belowLimitAllowance, currentPeriodEnd: resetAt },
      new Error('unavailable'),
    );
    mocks.apiPost.mockRejectedValueOnce(
      new QuotaError('safe', 'QUOTA_EXCEEDED', 'files', 5, 5, 'free'),
    );
    const user = userEvent.setup();
    render(<FilesPage />);

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Upload & Analysis' }));
    await screen.findByRole('alert');

    const submit = screen.getByRole('button', {
      name: 'Start Upload & Analysis',
    }) as HTMLButtonElement;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(submit.disabled).toBe(true);
    expect(mocks.apiPost).toHaveBeenCalledOnce();
  });

  it('guards handler re-entry while the first upload request remains active', async () => {
    mockAllowanceRequests(belowLimitAllowance);
    const uploadResponse = deferred<{ id: string }>();
    const uploadId = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    vi.stubGlobal('crypto', { randomUUID: uploadId });
    mocks.apiPost.mockReturnValue(uploadResponse.promise);
    const user = userEvent.setup();
    render(<FilesPage />);

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    const form = screen.getByRole('button', { name: 'Start Upload & Analysis' }).closest('form')!;

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(mocks.apiPost).toHaveBeenCalledOnce();
    expect(uploadId).toHaveBeenCalledOnce();

    uploadResponse.resolve({ id: 'new-file' });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/files/new-file'));
  });

  it('normalizes over-limit usage and handles a missing reset date defensively', async () => {
    mocks.apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/files?')) {
        return Promise.resolve({
          data: [file],
          pagination: { limit: 10, page: 1, total: 1, totalPages: 1 },
        });
      }
      if (url === '/subjects') return Promise.resolve([]);
      if (url === '/subscriptions/current') {
        return Promise.resolve({
          currentPeriodEnd: null,
          filesUsedThisMonth: 7,
          monthlyFileLimit: 5,
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(<FilesPage />);

    const allowance = await screen.findByRole('region', {
      name: 'Monthly upload allowance',
    });
    expect(within(allowance).getByText('Uploads remaining this month: 0')).not.toBeNull();
    expect(within(allowance).getByText('Reset date unavailable')).not.toBeNull();
    const progress = within(allowance).getByRole('progressbar', {
      name: 'Monthly upload allowance',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('5');
    expect(progress.getAttribute('aria-valuemax')).toBe('5');
  });

  it('keeps the files page available when allowance data is malformed', async () => {
    const user = userEvent.setup();
    mocks.apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/files?')) {
        return Promise.resolve({
          data: [file],
          pagination: { limit: 10, page: 1, total: 1, totalPages: 1 },
        });
      }
      if (url === '/subjects') return Promise.resolve([]);
      if (url === '/subscriptions/current') {
        return Promise.resolve({ filesUsedThisMonth: -1, monthlyFileLimit: '5' });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(<FilesPage />);

    expect(await screen.findByText('physics.pdf')).not.toBeNull();
    expect(
      await screen.findByText('Monthly upload allowance is temporarily unavailable.'),
    ).not.toBeNull();
    const uploadAction = screen.getByRole('button', { name: 'Upload File' }) as HTMLButtonElement;
    expect(uploadAction.disabled).toBe(false);
    await user.click(uploadAction);
    expect(await screen.findByRole('dialog', { name: 'Upload File' })).not.toBeNull();
  });

  it('keeps the files page available when allowance retrieval fails', async () => {
    const user = userEvent.setup();
    mocks.apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/files?')) {
        return Promise.resolve({
          data: [file],
          pagination: { limit: 10, page: 1, total: 1, totalPages: 1 },
        });
      }
      if (url === '/subjects') return Promise.resolve([]);
      if (url === '/subscriptions/current') return Promise.reject(new Error('unavailable'));
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(<FilesPage />);

    expect(await screen.findByText('physics.pdf')).not.toBeNull();
    expect(
      await screen.findByText('Monthly upload allowance is temporarily unavailable.'),
    ).not.toBeNull();
    const uploadAction = screen.getByRole('button', { name: 'Upload File' }) as HTMLButtonElement;
    expect(uploadAction.disabled).toBe(false);
    await user.click(uploadAction);
    expect(await screen.findByRole('dialog', { name: 'Upload File' })).not.toBeNull();
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
    expect(fileInput.getAttribute('accept')).toBe('.pdf,.docx,.jpg,.jpeg,.png,.webp');
    expect(accessibleDescription(fileInput)).toBe('PDF, Word, or image');
    expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull();
    expect(
      screen.getByRole('combobox', { name: 'Subject' }).textContent,
    ).toContain('No Subject');

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

  it('keeps the files filters labeled, keyboard operable, and independent', async () => {
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');

    const subjectFilter = screen.getByRole('combobox', {
      name: 'Subject filter',
    });
    const typeFilter = screen.getByRole('combobox', {
      name: 'File type filter',
    });

    expect(subjectFilter.textContent).toContain('All subjects');
    expect(typeFilter.textContent).toContain('All types');
    expect(subjectFilter.getAttribute('aria-expanded')).toBe('false');

    subjectFilter.focus();
    await user.keyboard('{Enter}');
    expect(subjectFilter.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByRole('listbox')).not.toBeNull();

    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(subjectFilter.textContent).toContain('Physics'));
    expect(subjectFilter.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(subjectFilter);
    await waitFor(() =>
      expect(mocks.apiGet).toHaveBeenCalledWith(
        expect.stringMatching(/\/files\?.*subjectId=subject-physics/),
      ),
    );

    await user.click(typeFilter);
    await user.click(await screen.findByRole('option', { name: 'Word' }));
    await waitFor(() => expect(typeFilter.textContent).toContain('Word'));
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await waitFor(() =>
      expect(mocks.apiGet).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/files\?.*subjectId=subject-physics.*fileType=docx/,
        ),
      ),
    );

    subjectFilter.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(subjectFilter.getAttribute('aria-expanded')).toBe('false'),
    );
    await waitFor(() => expect(document.activeElement).toBe(subjectFilter));
    expect(typeFilter.textContent).toContain('Word');
  });

  it('exposes only MCQ creation and sends an exact MCQ-only Exam request', async () => {
    mocks.apiGet.mockImplementation((url: string) => {
      if (url === '/files/file-1') {
        return Promise.resolve({
          ...file,
          extractedText: 'Course content',
          fileType: 'docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      }
      if (url === '/exams' || url === '/flashcard-sets') return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    mocks.apiPost.mockResolvedValueOnce({ id: 'exam-mcq' });
    const params = Object.assign(Promise.resolve({ id: 'file-1' }), {
      status: 'fulfilled',
      value: { id: 'file-1' },
    });
    const user = userEvent.setup();

    render(
      <Suspense fallback={<div>Loading fixture</div>}>
        <FileDetailPage params={params} />
      </Suspense>,
    );

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Quiz' }));

    expect(screen.getByText('Multiple Choice')).not.toBeNull();
    expect(
      screen.getByText('Multiple-choice questions are available in the current release.'),
    ).not.toBeNull();
    expect(screen.queryByText('True / False')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Generate Exam' }));

    await waitFor(() =>
      expect(mocks.apiPost).toHaveBeenCalledWith('/exams', {
        fileId: 'file-1',
        difficulty: 'medium',
        totalQuestions: 10,
        questionTypes: ['mcq'],
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith('/exams/exam-mcq');
  });

  it('exposes file-history actions only for eligible active and completed exams', async () => {
    const examFixture = {
      fileId: 'file-1',
      difficulty: 'medium',
      totalQuestions: 1,
      createdAt: '2026-08-14T00:00:00.000Z',
      status: 'active',
      attemptEligible: false,
    };
    mocks.apiGet.mockImplementation((url: string) => {
      if (url === '/files/file-1') {
        return Promise.resolve({
          ...file,
          extractedText: 'Course content',
          fileType: 'docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      }
      if (url === '/flashcard-sets') return Promise.resolve([]);
      if (url === '/exams') {
        return Promise.resolve([
          {
            ...examFixture,
            id: 'exam-eligible',
            title: 'Eligible active quiz',
            attemptEligible: true,
          },
          {
            ...examFixture,
            id: 'exam-completed',
            title: 'Completed quiz',
            status: 'completed',
            score: '80.00',
          },
          { ...examFixture, id: 'exam-draft', title: 'Draft quiz', status: 'draft' },
          { ...examFixture, id: 'exam-unsupported', title: 'Unsupported quiz' },
          { ...examFixture, id: 'exam-mixed', title: 'Mixed quiz' },
          { ...examFixture, id: 'exam-unknown', title: 'Unknown quiz' },
          { ...examFixture, id: 'exam-malformed', title: 'Malformed quiz' },
          {
            ...examFixture,
            id: 'exam-invalid-status',
            title: 'Invalid-status quiz',
            status: 'archived',
          },
        ]);
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    const params = Object.assign(Promise.resolve({ id: 'file-1' }), {
      status: 'fulfilled',
      value: { id: 'file-1' },
    });
    const user = userEvent.setup();

    render(
      <Suspense fallback={<div>Loading fixture</div>}>
        <FileDetailPage params={params} />
      </Suspense>,
    );

    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Quiz' }));

    const eligibleCard = screen.getByText('Eligible active quiz').closest('.rounded-2xl');
    const completedCard = screen.getByText('Completed quiz').closest('.rounded-2xl');
    expect(eligibleCard).not.toBeNull();
    expect(completedCard).not.toBeNull();
    expect(within(eligibleCard!).getByText('Take quiz').closest('a')?.getAttribute('href')).toBe(
      '/exams/exam-eligible',
    );
    expect(within(completedCard!).getByText('View results').closest('a')?.getAttribute('href')).toBe(
      '/exams/exam-completed',
    );

    for (const title of [
      'Draft quiz',
      'Unsupported quiz',
      'Mixed quiz',
      'Unknown quiz',
      'Malformed quiz',
      'Invalid-status quiz',
    ]) {
      const blockedCard = screen.getByText(title).closest('.rounded-2xl');
      expect(blockedCard).not.toBeNull();
      expect(within(blockedCard!).getByText('Not available yet')).not.toBeNull();
      expect(blockedCard!.querySelector('a')).toBeNull();
    }
  });

  it('renders the files filter popup with explicit Arabic RTL direction', async () => {
    mocks.locale = 'ar';
    document.documentElement.dir = 'rtl';
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');

    const subjectFilter = screen.getByRole('combobox', {
      name: 'تصفية حسب المادة',
    });
    await user.click(subjectFilter);

    expect(await screen.findByRole('listbox')).not.toBeNull();
    expect(
      document.querySelector('[data-slot="select-content"]')?.getAttribute('dir'),
    ).toBe('rtl');
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
      expect.stringContaining('The file must be 50 MiB or smaller.'),
    );
  });

  it('sends the confirmed title and authoritative upload contract with every chunk', async () => {
    mocks.apiPost.mockResolvedValue({ id: 'new-file' });
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.type(screen.getByLabelText('Document title (optional)'), 'كتاب الفيزياء');
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Upload & Analysis' }));

    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledOnce());
    const form = mocks.apiPost.mock.calls[0][1] as FormData;
    expect(form.get('title')).toBe('كتاب الفيزياء');
    expect(form.get('fileSize')).toBe('4');
    expect(form.get('mimeType')).toBe('application/pdf');
  });

  it('uses a valid UUID upload identifier when randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(17);
        return bytes;
      },
    });
    mocks.apiPost.mockResolvedValue({ id: 'new-file' });
    const user = userEvent.setup();
    render(<FilesPage />);
    await screen.findByText('physics.pdf');
    await user.click(screen.getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText(/Choose a file/),
      new File(['%PDF'], 'lesson.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Start Upload & Analysis' }));

    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledOnce());
    const form = mocks.apiPost.mock.calls[0][1] as FormData;
    expect(form.get('uploadId')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('uses the persisted document title consistently on card and detail surfaces', async () => {
    const intendedTitle = 'تعلم n8n من الصفر إلى الاحتراف';
    const titledFile = { ...file, title: intendedTitle, titleSource: 'metadata' };
    mocks.apiGet.mockImplementation((url: string) => {
      if (url.startsWith('/files?')) return Promise.resolve({ data: [titledFile], pagination: { limit: 10, page: 1, total: 1, totalPages: 1 } });
      if (url === '/subjects') return Promise.resolve([]);
      if (url === '/files/file-1') return Promise.resolve(titledFile);
      if (url === '/exams/file/file-1') return Promise.resolve([]);
      if (url === '/flashcards/file/file-1') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const { unmount } = render(<FilesPage />);
    const cardTitle = await screen.findByText(intendedTitle);
    expect(cardTitle.getAttribute('dir')).toBe('auto');
    expect(cardTitle.className).toContain('[unicode-bidi:plaintext]');
    unmount();

    const params = Object.assign(Promise.resolve({ id: 'file-1' }), {
      status: 'fulfilled',
      value: { id: 'file-1' },
    });
    render(
      <Suspense fallback={<div>Loading fixture</div>}>
        <FileDetailPage params={params} />
      </Suspense>,
    );
    const detailTitle = await screen.findByText(intendedTitle);
    expect(detailTitle.getAttribute('dir')).toBe('auto');
    expect(detailTitle.className).toContain('[unicode-bidi:plaintext]');
    expect(detailTitle.className).toContain('text-foreground');
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
