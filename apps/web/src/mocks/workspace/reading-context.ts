import { Bookmark } from './bookmarks';
import { Highlight } from './highlights';

export interface ReadingContext {
  documentId: string;
  documentTitle: string;
  chapter: string | null;
  section: string | null;
  heading: string | null;
  hierarchy: string[];
  breadcrumbs: { id: string; label: string }[];
  currentNode: string;
  previousNodes: string[];
  nextNodes: string[];
  sectionStart: string | null;
  sectionEnd: string | null;
  visibleWindow: string[];
  selectedText: string | null;
  readerProgress: number;
  bookmarks: Bookmark[];
  highlights: Highlight[];
}

export const MOCK_READING_CONTEXT: ReadingContext = {
  documentId: 'doc_1',
  documentTitle: 'Biology 101 Midterm Notes',
  chapter: 'Chapter 2: Cellular Respiration',
  section: '2.2 The Krebs Cycle',
  heading: 'Mitochondrial Matrix',
  hierarchy: ['Chapter 2: Cellular Respiration', '2.2 The Krebs Cycle', 'Mitochondrial Matrix'],
  breadcrumbs: [
    { id: 'node_25', label: 'Chapter 2' },
    { id: 'node_42', label: '2.2 The Krebs Cycle' }
  ],
  currentNode: 'node_42',
  previousNodes: ['node_40', 'node_41'],
  nextNodes: ['node_43', 'node_44'],
  sectionStart: 'node_42',
  sectionEnd: 'node_50',
  visibleWindow: ['node_41', 'node_42', 'node_43'],
  selectedText: null,
  readerProgress: 45,
  bookmarks: [],
  highlights: []
};
