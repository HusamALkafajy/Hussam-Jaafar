import React from 'react';
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
