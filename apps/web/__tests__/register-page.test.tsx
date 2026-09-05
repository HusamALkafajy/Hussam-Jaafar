import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ar from '../src/i18n/ar.json';
import en from '../src/i18n/en.json';
import { ApiError } from '../src/lib/api-client';
import RegisterPage from '../src/app/(auth)/register/page';
import LoginPage from '../src/app/(auth)/login/page';

const mockRegister = vi.fn();
type SupportedLocale = 'ar' | 'en';

let activeLocale: SupportedLocale = 'en';
const credentialInput = ['Valid', 'Pass', '123!'].join('');

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

vi.mock('../src/hooks/use-auth', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => ({
    locale: activeLocale,
    t: (path: string) => {
      const dictionary = activeLocale === 'ar' ? ar : en;
      return path.split('.').reduce<unknown>((value, key) => {
        if (value && typeof value === 'object' && key in value) {
          return (value as Record<string, unknown>)[key];
        }
        return path;
      }, dictionary) as string;
    },
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

async function submitRegistration(locale: SupportedLocale = 'en') {
  activeLocale = locale;
  const user = userEvent.setup();
  render(<RegisterPage />);

  const dictionary = locale === 'ar' ? ar : en;
  await user.type(screen.getByLabelText(dictionary.auth.firstName), locale === 'ar' ? 'محمد' : 'Test');
  await user.type(screen.getByLabelText(dictionary.auth.lastName), locale === 'ar' ? 'علي' : 'User');
  await user.type(screen.getByLabelText(dictionary.auth.email), 'new.user@example.test');
  await user.type(screen.getByLabelText(dictionary.auth.password), credentialInput);
  await user.type(screen.getByLabelText(dictionary.auth.confirmPassword), credentialInput);
  await user.click(screen.getByRole('button', { name: dictionary.common.register }));

  return dictionary;
}

describe('registration page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeLocale = 'en';
  });

  it.each([
    ['en', 'Test', 'User'],
    ['ar', 'محمد', 'علي'],
  ])('submits only the API registration contract in %s', async (locale, firstName, lastName) => {
    mockRegister.mockResolvedValueOnce(undefined);
    await submitRegistration(locale);

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister).toHaveBeenCalledWith({
      email: 'new.user@example.test',
      password: credentialInput,
      firstName,
      lastName,
      locale,
    });
    expect(Object.keys(mockRegister.mock.calls[0][0]).sort()).toEqual(
      ['email', 'firstName', 'lastName', 'locale', 'password'].sort(),
    );
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty('confirmPassword');
  });

  it('uses same-origin OAuth routes', () => {
    render(<RegisterPage />);
    expect(
      screen.getByRole('link', { name: en.auth.registerWithGoogle }).getAttribute('href'),
    ).toBe('/api/auth/google');
    expect(
      screen.getByRole('link', { name: en.auth.registerWithApple }).getAttribute('href'),
    ).toBe('/api/auth/apple');
  });

  it('uses same-origin OAuth routes on the login page', () => {
    render(<LoginPage />);
    expect(
      screen.getByRole('link', { name: en.auth.loginWithGoogle }).getAttribute('href'),
    ).toBe('/api/auth/google');
    expect(
      screen.getByRole('link', { name: en.auth.loginWithApple }).getAttribute('href'),
    ).toBe('/api/auth/apple');
  });

  it.each([
    ['login', LoginPage],
    ['registration', RegisterPage],
  ])('renders an integrated, token-based divider on the %s page', (_name, Page) => {
    render(<Page />);

    const separator = screen.getByRole('separator', { name: en.auth.or });
    expect(separator.className).toContain('flex');
    expect(separator.querySelectorAll('[aria-hidden="true"].bg-border')).toHaveLength(2);

    const label = separator.querySelector('.text-muted-foreground');
    expect(label?.textContent).toBe(en.auth.or);
    expect(label?.className).not.toContain('text-slate-500');

    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const darkTheme = css.match(/\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const card = darkTheme.match(/--card:\s*(#[0-9a-f]{6})/i)?.[1];
    const mutedForeground = darkTheme.match(
      /--muted-foreground:\s*(#[0-9a-f]{6})/i,
    )?.[1];

    expect(card).toBeDefined();
    expect(mutedForeground).toBeDefined();
    expect(contrastRatio(card!, mutedForeground!)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps confirmPassword as browser-only validation', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.type(screen.getByLabelText(en.auth.firstName), 'Test');
    await user.type(screen.getByLabelText(en.auth.lastName), 'User');
    await user.type(screen.getByLabelText(en.auth.email), 'new.user@example.test');
    await user.type(screen.getByLabelText(en.auth.password), credentialInput);
    await user.type(screen.getByLabelText(en.auth.confirmPassword), 'DifferentPass123!');
    await user.click(screen.getByRole('button', { name: en.common.register }));

    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(en.auth.passwordMismatch);
  });

  it.each([
    ['en', new ApiError('hidden', 400), en.auth.validationError],
    ['en', new ApiError('hidden', 409), en.auth.duplicateEmail],
    ['en', new ApiError('hidden', 0, 'network'), en.auth.networkError],
    ['en', new ApiError('hidden', 504, 'timeout'), en.auth.networkError],
    ['en', new ApiError('hidden', 500), en.auth.serverError],
    ['en', new ApiError('hidden', 418), en.auth.registrationFailed],
    ['en', new Error('hidden'), en.auth.registrationFailed],
    ['ar', new ApiError('hidden', 400), ar.auth.validationError],
    ['ar', new ApiError('hidden', 409), ar.auth.duplicateEmail],
    ['ar', new ApiError('hidden', 0, 'network'), ar.auth.networkError],
    ['ar', new ApiError('hidden', 500), ar.auth.serverError],
    ['ar', new Error('hidden'), ar.auth.registrationFailed],
  ])('maps a registration failure safely in %s', async (locale, error, message) => {
    mockRegister.mockRejectedValueOnce(error);
    await submitRegistration(locale);
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.getByRole('alert').textContent).not.toContain('hidden');
  });
});
