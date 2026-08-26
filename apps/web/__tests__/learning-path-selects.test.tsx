import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LearningPathsPage from '../src/app/(dashboard)/learning-paths/page';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../src/lib/api-client', () => ({
  api: {
    get: (...args: unknown[]) => mocks.apiGet(...args),
    post: (...args: unknown[]) => mocks.apiPost(...args),
  },
}));

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

describe('learning path Select controls', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.apiGet.mockResolvedValue([]);
    mocks.apiPost.mockResolvedValue({});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    vi.clearAllMocks();
    cleanup();
  });

  it('labels both parameters and preserves their independent values', async () => {
    const user = userEvent.setup();
    render(<LearningPathsPage />);

    await screen.findByText('No Learning Paths Yet');
    await user.click(
      screen.getAllByRole('button', { name: 'Create New Path' })[0],
    );

    const level = screen.getByRole('combobox', { name: 'Starting Level' });
    const time = screen.getByRole('combobox', {
      name: 'Daily Available Time',
    });

    expect(level.textContent).toContain('Beginner');
    expect(time.textContent).toContain('30 min / day');

    level.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await waitFor(() => expect(level.textContent).toContain('Intermediate'));
    expect(document.activeElement).toBe(level);
    expect(time.textContent).toContain('30 min / day');

    await user.click(time);
    await user.click(await screen.findByRole('option', { name: '60 min / day' }));
    await waitFor(() => expect(time.textContent).toContain('60 min / day'));
    expect(level.textContent).toContain('Intermediate');
  });
});
