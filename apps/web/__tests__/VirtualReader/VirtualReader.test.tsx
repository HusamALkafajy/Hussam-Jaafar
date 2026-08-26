import React from 'react';
import { render, screen } from '@testing-library/react';
import { VirtualReader } from '@/components/VirtualReader/VirtualReader';
import * as useVirtualReaderHook from '@/components/VirtualReader/useVirtualReader';
import { vi } from 'vitest';

vi.mock('@/components/VirtualReader/useVirtualReader');

describe('VirtualReader Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    (useVirtualReaderHook.useVirtualReader as any).mockReturnValue({
      nodes: [],
      isLoading: true,
      error: null,
      onScroll: vi.fn()
    });

    render(<VirtualReader documentId="doc-1" rootNodeId="root-1" />);
    
    expect(screen.getByRole('region', { name: 'Document Reader' })).toBeTruthy();
    expect(screen.getByText('Loading more content...')).toBeTruthy();
    expect(screen.getByRole('region').getAttribute('aria-label')).toBe('Document Reader');
  });

  it('renders error state', () => {
    (useVirtualReaderHook.useVirtualReader as any).mockReturnValue({
      nodes: [],
      isLoading: false,
      error: new Error('Failed'),
      onScroll: vi.fn()
    });

    render(<VirtualReader documentId="doc-1" rootNodeId="root-1" />);
    
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Failed to load document.')).toBeTruthy();
  });

  it('renders nodes securely mapping Canonical UUID to React Key', () => {
    const mockNodes = [
      { id: 'uuid-1', nodeType: 'HEADING', content: { text: 'Heading 1' }, metadata: { level: 1 } },
      { id: 'uuid-2', nodeType: 'PARAGRAPH', content: { text: 'Para 1' }, metadata: {} },
    ];

    (useVirtualReaderHook.useVirtualReader as any).mockReturnValue({
      nodes: mockNodes,
      isLoading: false,
      error: null,
      onScroll: vi.fn()
    });

    render(<VirtualReader documentId="doc-1" rootNodeId="root-1" />);
    
    const nodes = screen.getAllByRole('document');
    expect(nodes).toHaveLength(2);
    expect(nodes[0].getAttribute('data-node-id')).toBe('uuid-1');
    expect(nodes[1].getAttribute('data-node-id')).toBe('uuid-2');
    
    // A11y tests
    expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toBeTruthy();
    expect(screen.getByText('Para 1')).toBeTruthy();
    expect(nodes[0].getAttribute('tabIndex')).toBe('0'); // keyboard focusable
  });
});
