import React, { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src/components/ui/select';

function SelectHarness({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  const [value, setValue] = useState('basic');

  return (
    <div dir={dir}>
      <span id="level-label">Level</span>
      <Select value={value} onValueChange={(next) => next && setValue(next)}>
        <SelectTrigger aria-labelledby="level-label" className="w-full">
          <SelectValue>
            {value === 'advanced' ? 'Advanced' : 'Basic'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent dir={dir}>
          <SelectItem value="basic">Basic</SelectItem>
          <SelectItem value="blocked" disabled>
            Blocked
          </SelectItem>
          <SelectItem value="advanced">Advanced</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

describe('shared Select accessibility contract', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    cleanup();
  });

  it('opens by keyboard, rejects disabled options, selects, and restores focus', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);

    const trigger = screen.getByRole('combobox', { name: 'Level' });
    expect(trigger.textContent).toContain('Basic');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.focus();
    await user.keyboard(' ');

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByRole('listbox')).not.toBeNull();
    expect(
      screen.getByRole('option', { name: 'Blocked' }).getAttribute('aria-disabled'),
    ).toBe('true');
    await user.click(screen.getByRole('option', { name: 'Blocked' }));
    expect(trigger.textContent).toContain('Basic');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    await waitFor(() => expect(trigger.textContent).toContain('Advanced'));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    await user.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('applies explicit LTR and RTL direction to portaled popups', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SelectHarness dir="ltr" />);

    await user.click(screen.getByRole('combobox', { name: 'Level' }));
    expect(await screen.findByRole('listbox')).not.toBeNull();
    expect(
      document.querySelector('[data-slot="select-content"]')?.getAttribute('dir'),
    ).toBe('ltr');

    await user.keyboard('{Escape}');
    rerender(<SelectHarness dir="rtl" />);
    await user.click(screen.getByRole('combobox', { name: 'Level' }));
    expect(await screen.findByRole('listbox')).not.toBeNull();
    expect(
      document.querySelector('[data-slot="select-content"]')?.getAttribute('dir'),
    ).toBe('rtl');
  });
});
