import React, { Suspense } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatConversationPage from './page';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('../../../../lib/api-client', () => ({ api: apiMocks }));
vi.mock('../../../../hooks/use-locale', () => ({
  useLocale: () => ({ locale: 'en', t: (key: string) => key }),
}));
vi.mock('../../../../components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="chat-card" className={className}>
      {children}
    </div>
  ),
}));
vi.mock('../../../../components/ui/spinner', () => ({
  Spinner: () => <span aria-label="Loading" />,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

type Role = 'user' | 'assistant';
interface FixtureMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

function message(role: Role, content: string, id = 'fixture-message'): FixtureMessage {
  return { id, role, content, createdAt: '2026-01-01T00:00:00Z' };
}

async function openChat(messages: readonly FixtureMessage[]) {
  apiMocks.get.mockResolvedValue({
    id: 'fixture-session',
    title: 'Synthetic chat',
    fileId: 'fixture-file',
    messageCount: messages.length,
    messages,
  });
  const params = Promise.resolve({ id: 'fixture-session' });
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(
      <Suspense fallback={<span>Waiting for parameters</span>}>
        <ChatConversationPage params={params} />
      </Suspense>,
    );
  });
  if (!view) throw new Error('CHAT_RENDER_NOT_CREATED');
  await view.findByRole('textbox');
  return view;
}

function messageRoot(view: ReturnType<typeof render>, role: Role, index = 0): Element {
  const root =
    role === 'user'
      ? view.container.querySelectorAll('.rounded-br-md')[index]
      : view.getAllByTestId('chat-card')[index]?.querySelector('.text-slate-200');
  if (!root) throw new Error('MESSAGE_NOT_RENDERED');
  return root;
}

function expectInertContent(root: Element) {
  expect(
    root.querySelector(
      'script,img,svg,math,iframe,object,embed,form,input,button,audio,video,style,link,meta,base',
    ),
  ).toBeNull();
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      expect(/^on/i.test(attribute.name)).toBe(false);
      expect(attribute.name.toLowerCase()).not.toBe('style');
      if (['href', 'src', 'xlink:href'].includes(attribute.name.toLowerCase())) {
        expect(['http:', 'https:']).toContain(new URL(attribute.value).protocol);
      }
    }
  }
}

// Inert strings only: no handler is dispatched, link clicked, or resource loaded.
const adversarialCases = [
  ['script', '<script>/* inert */</script>'],
  ['image-handler', '<img src="" onerror="">'],
  ['svg-handler', '<svg onload=""><circle /></svg>'],
  ['mathml', '<math><mtext>inert</mtext></math>'],
  ['mixed-case-handler', '<span oNcLiCk="">inert</span>'],
  ['javascript-link', '[inert](javascript:void%280%29)'],
  ['mixed-case-scheme', '[inert](JaVaScRiPt:void%280%29)'],
  ['entity-encoded-scheme', '[inert](jav&#x61;script:void%280%29)'],
  ['percent-encoded-scheme', '[inert](java%73cript:void%280%29)'],
  ['data-html-link', '[inert](data:text/html,inert)'],
  ['iframe', '<iframe></iframe>'],
  ['object-embed-form', '<object><embed></object><form>inert</form>'],
  ['nested-malformed-html', '<div><svg><g onload=""></div>'],
  ['style-attribute', '<span style="color:red">inert</span>'],
  ['markdown-image', '![inert](https://example.invalid/inert.png)'],
  ['protocol-relative-link', '[inert](//example.invalid/inert)'],
] as const;

const formattingCases = [
  ['bold', '**strong marker**', 'strong', 'strong marker'],
  ['emphasis', '*emphasis marker*', 'em', 'emphasis marker'],
  ['inline-code', '`<inert-code>`', 'code', '<inert-code>'],
  ['fenced-code', '```text\n<inert-code>\n```', 'pre > code', '<inert-code>\n'],
  ['unordered-list', '- first item\n- second item', 'ul > li', 'first item'],
  ['ordered-list', '1. first item\n2. second item', 'ol > li', 'first item'],
  ['blockquote', '> quoted marker', 'blockquote', 'quoted marker'],
] as const;

beforeEach(() => {
  apiMocks.get.mockReset();
  apiMocks.post.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('UNEXPECTED_NETWORK_REQUEST'))));
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

describe.each(['user', 'assistant'] as const)('stored %s messages', (role) => {
  it.each(adversarialCases)('contains %s as inert content', async (_name, payload) => {
    const content = 'begin ' + payload + ' end';
    const original = Object.freeze(message(role, content));
    const view = await openChat(Object.freeze([original]));
    const root = messageRoot(view, role);
    expectInertContent(root);
    expect(root.textContent).toContain('begin');
    expect(root.textContent).toContain('end');
    expect(original.content).toBe(content);
    expect(console.error).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(formattingCases)('preserves %s', async (_name, content, selector, text) => {
    const view = await openChat([message(role, content)]);
    const root = messageRoot(view, role);
    expect(root.querySelector(selector)?.textContent).toContain(text);
    expectInertContent(root);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('preserves plain angle brackets and soft line-break text', async () => {
    const content = '2 < 3 and 5 > 4\nsecond line';
    const view = await openChat([message(role, content)]);
    const root = messageRoot(view, role);
    expect(root.textContent).toBe(content);
    expect(root.querySelector('p')?.className).toContain('whitespace-pre-wrap');
    expectInertContent(root);
  });

  it.each(['http', 'https'])('allows a safe %s link', async (scheme) => {
    const url = scheme + '://example.invalid/document';
    const view = await openChat([message(role, '[safe destination](' + url + ')')]);
    const root = messageRoot(view, role);
    const link = root.querySelector('a');
    expect(link?.getAttribute('href')).toBe(url);
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toBe('safe destination');
    expectInertContent(root);
  });
});

describe('API-returned assistant messages', () => {
  it.each(adversarialCases)('contains returned %s as inert content', async (_name, payload) => {
    const content = 'begin ' + payload + ' end';
    const reply = Object.freeze(message('assistant', content, 'reply'));
    apiMocks.post.mockResolvedValue(reply);
    const view = await openChat([]);
    const textbox = view.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'synthetic question' } });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByText('begin', { exact: false })).toBeTruthy());
    const root = messageRoot(view, 'assistant');
    expectInertContent(root);
    expect(root.textContent).toContain('begin');
    expect(root.textContent).toContain('end');
    expect(reply.content).toBe(content);
    expect(console.error).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the optimistic user message, reply order, and input state', async () => {
    let resolveReply!: (value: FixtureMessage) => void;
    apiMocks.post.mockImplementation(
      () => new Promise<FixtureMessage>((resolve) => { resolveReply = resolve; }),
    );
    const history = Object.freeze(message('assistant', '**history marker**', 'history'));
    const view = await openChat(Object.freeze([history]));
    const textbox = view.getByRole('textbox') as HTMLTextAreaElement;
    const content = '**question marker** <img src="" onerror="">';
    fireEvent.change(textbox, { target: { value: content } });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledTimes(1));
    const optimistic = messageRoot(view, 'user');
    expectInertContent(optimistic);
    expect(optimistic.querySelector('strong')?.textContent).toBe('question marker');
    expect(textbox.value).toBe('');
    await act(async () => {
      resolveReply(message('assistant', '**reply marker**', 'reply'));
    });
    const historyRoot = messageRoot(view, 'assistant', 0);
    const replyRoot = messageRoot(view, 'assistant', 1);
    expect(replyRoot.querySelector('strong')?.textContent).toBe('reply marker');
    expect(
      historyRoot.compareDocumentPosition(optimistic) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      optimistic.compareDocumentPosition(replyRoot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(history.content).toBe('**history marker**');
    expect(document.activeElement).toBe(textbox);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('keeps the existing safe error message and releases the sending state', async () => {
    apiMocks.post.mockRejectedValue(new Error('SYNTHETIC_API_FAILURE'));
    const view = await openChat([]);
    const textbox = view.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textbox, { target: { value: 'synthetic question' } });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
    await view.findByText('tutor.busy');
    expect(messageRoot(view, 'user').textContent).toBe('synthetic question');
    expectInertContent(messageRoot(view, 'assistant'));
    await waitFor(() => expect(document.activeElement).toBe(textbox));
    expect(console.error).not.toHaveBeenCalled();
  });
});

// These additions target the three original assistant-rendering branches.
// Stored history and completed API replies are covered; streaming is not.
const originalSinkBranches = [
  ['paragraph', ''],
  ['bullet-list', '- '],
  ['numbered-list', '1. '],
] as const;

describe.each(['stored-history', 'completed-api-reply'] as const)(
  'original sink coverage: %s',
  (delivery) => {
    describe.each(originalSinkBranches)('%s branch', (_branch, prefix) => {
      it.each(adversarialCases)('contains hostile %s without active DOM', async (_name, payload) => {
        const content = prefix + 'branch-begin ' + payload + ' branch-end';
        const original = Object.freeze(message('assistant', content, 'branch-reply'));
        let view: Awaited<ReturnType<typeof openChat>>;

        if (delivery === 'stored-history') {
          view = await openChat(Object.freeze([original]));
        } else {
          apiMocks.post.mockResolvedValue(original);
          view = await openChat([]);
          const textbox = view.getByRole('textbox');
          fireEvent.change(textbox, { target: { value: 'synthetic branch question' } });
          fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
          await waitFor(() => expect(apiMocks.post).toHaveBeenCalledTimes(1));
          await view.findByText('branch-begin', { exact: false });
        }

        const root = messageRoot(view, 'assistant');
        // Keep the security assertion first: the unchanged baseline must fail
        // because of unsafe DOM, not merely because its formatting differs.
        expectInertContent(root);
        expect(root.textContent).toContain('branch-begin');
        expect(root.textContent).toContain('branch-end');
        expect(original.content).toBe(content);
        expect(console.error).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
      });
    });
  },
);
