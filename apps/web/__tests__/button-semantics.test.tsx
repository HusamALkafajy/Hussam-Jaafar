import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeroSection } from '../src/components/marketing/HeroSection';
import { Pricing } from '../src/components/marketing/Pricing';
import { Navbar } from '../src/components/shared/navbar';

const mockLogout = vi.fn();
const mockPush = vi.fn();
let mockUser: { id: string } | null = null;
let consoleError: ReturnType<typeof vi.spyOn>;

const translations: Record<string, string> = {
  'common.appName': 'StudyAI',
  'common.arabic': 'العربية',
  'common.english': 'English',
  'common.login': 'Log in',
  'common.logout': 'Log out',
  'common.register': 'Register',
  'dashboard.sidebarHome': 'Dashboard',
  'landing.examsCount': 'Exams',
  'landing.featuresTitle': 'Features',
  'landing.freePlan': 'Free',
  'landing.heroSubtitle': 'Study with AI',
  'landing.heroTitle': 'Learn smarter',
  'landing.institutionPlan': 'Institution',
  'landing.contactUs': 'تواصل معنا',
  'landing.mostPopular': 'Most popular',
  'landing.priceFree': '$0',
  'landing.priceInst': 'Contact us',
  'landing.pricePro': '$10',
  'landing.pricingFeature1': 'Free feature',
  'landing.pricingFeature2': 'Pro feature',
  'landing.pricingFeature3': 'Institution feature',
  'landing.pricingFeature4': 'Another pro feature',
  'landing.pricingTitle': 'Pricing',
  'landing.proPlan': 'Pro',
  'landing.startFree': 'Start free',
  'landing.subscribeNow': 'اشترك الآن',
  'landing.studentsCount': 'Students',
  'landing.summariesCount': 'Summaries',
  'landing.viewDemo': 'View demo',
};

vi.mock('../src/hooks/use-locale', () => ({
  useLocale: () => ({
    dir: 'ltr',
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock('../src/hooks/use-auth', () => ({
  useAuth: () => ({
    logout: mockLogout,
    user: mockUser,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function expectNoNestedInteractive(container: HTMLElement) {
  expect(
    container.querySelectorAll('a a, a button, button a, button button'),
  ).toHaveLength(0);
}

function getAnchorByText(text: string) {
  const anchor = screen.getByText(text).closest('a');
  expect(anchor).not.toBeNull();
  return anchor as HTMLAnchorElement;
}

describe('marketing button and link semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    expect(
      consoleError.mock.calls.some((args) =>
        args.some(
          (value) =>
            typeof value === 'string' &&
            value.includes('expected a native <button>'),
        ),
      ),
    ).toBe(false);
    consoleError.mockRestore();
    cleanup();
  });

  it('renders Navbar navigation CTAs as styled links and actions as native buttons', () => {
    const { container } = render(<Navbar />);

    const login = getAnchorByText('Log in');
    const register = getAnchorByText('Register');

    expect(login.getAttribute('href')).toBe('/login');
    expect(login.classList.contains('group/button')).toBe(true);
    expect(register.getAttribute('href')).toBe('/register');
    expect(register.classList.contains('group/button')).toBe(true);
    expect(screen.getByRole('button', { name: 'العربية' }).tagName).toBe(
      'BUTTON',
    );

    const menuToggle = container.querySelector('button.md\\:hidden');
    expect(menuToggle?.tagName).toBe('BUTTON');
    expectNoNestedInteractive(container);
  });

  it('preserves authenticated and mobile Navbar navigation and action semantics', () => {
    mockUser = { id: 'user-1' };
    const { container } = render(<Navbar />);

    const menuToggle = container.querySelector('button.md\\:hidden');
    expect(menuToggle).not.toBeNull();
    fireEvent.click(menuToggle as HTMLButtonElement);

    const dashboardLinks = screen
      .getAllByText('Dashboard')
      .map((label) => label.closest('a'))
      .filter((anchor): anchor is HTMLAnchorElement => anchor !== null);
    expect(dashboardLinks).toHaveLength(2);
    expect(
      dashboardLinks.every(
        (link) =>
          link.tagName === 'A' &&
          link.getAttribute('href') === '/files' &&
          link.classList.contains('group/button'),
      ),
    ).toBe(true);

    const logoutButtons = screen.getAllByRole('button', { name: 'Log out' });
    expect(logoutButtons).toHaveLength(2);
    expect(logoutButtons.every((button) => button.tagName === 'BUTTON')).toBe(
      true,
    );
    expectNoNestedInteractive(container);
  });

  it('renders Hero CTAs as keyboard-activatable styled links', async () => {
    const user = userEvent.setup();
    const { container } = render(<HeroSection />);

    const register = getAnchorByText('Start free');
    const features = getAnchorByText('View demo');
    const activation = vi.fn((event: Event) => event.preventDefault());
    features.addEventListener('click', activation);

    expect(register.getAttribute('href')).toBe('/register');
    expect([...register.classList]).toEqual(
      expect.arrayContaining(['group/button', 'px-8', 'font-bold']),
    );
    expect(features.getAttribute('href')).toBe('#features');
    expect([...features.classList]).toEqual(
      expect.arrayContaining(['group/button', 'px-6']),
    );

    features.focus();
    await user.keyboard('{Enter}');
    expect(activation).toHaveBeenCalledOnce();
    expectNoNestedInteractive(container);
  });

  it('renders Pricing navigation as links while checkout remains a native action', () => {
    const { container } = render(<Pricing />);

    const free = getAnchorByText('Start free');
    const contact = getAnchorByText('تواصل معنا');
    const checkout = screen.getByRole('button', { name: 'اشترك الآن' });

    expect(free.getAttribute('href')).toBe('/register');
    expect([...free.classList]).toEqual(
      expect.arrayContaining(['group/button', 'w-full', 'mt-8']),
    );
    expect(contact.getAttribute('href')).toBe('mailto:info@studyai.com');
    expect([...contact.classList]).toEqual(
      expect.arrayContaining(['group/button', 'w-full', 'mt-8']),
    );
    expect(checkout.tagName).toBe('BUTTON');

    fireEvent.click(checkout);
    expect(mockPush).toHaveBeenCalledWith('/register?plan=pro');
    expectNoNestedInteractive(container);
  });

  it('renders the affected marketing surface without semantic nesting', () => {
    const { container } = render(
      <>
        <Navbar />
        <HeroSection />
        <Pricing />
      </>,
    );

    expectNoNestedInteractive(container);
  });
});
