export interface ReaderSession {
  documentId: string;
  currentNodeId: string;
  scrollPosition: number;
  focusMode: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  lineHeight: 'tight' | 'normal' | 'relaxed';
  readingWidth: 'narrow' | 'medium' | 'wide';
  theme: 'light' | 'dark' | 'system' | 'sepia';
  fontFamily: 'sans' | 'serif';
  sidebarTab: 'outline' | 'bookmarks' | 'highlights' | 'notes' | 'ai';
  isSidebarOpen: boolean;
  lastReadAt: string;
}

export const DEFAULT_SESSION: Omit<ReaderSession, 'documentId'> = {
  currentNodeId: '',
  scrollPosition: 0,
  focusMode: false,
  fontSize: 'medium',
  lineHeight: 'normal',
  readingWidth: 'medium',
  theme: 'system',
  fontFamily: 'sans',
  sidebarTab: 'outline',
  isSidebarOpen: true,
  lastReadAt: new Date().toISOString(),
};
