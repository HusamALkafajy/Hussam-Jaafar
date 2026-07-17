import { LucideIcon, Sparkles, FileText, Languages, Scale, Lightbulb, HelpCircle, GraduationCap } from 'lucide-react';

export interface AICapability {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  availability: 'always' | 'selection' | 'future';
  requiredContext: string[];
  placeholder?: string;
  execute: (payload: any) => Promise<void>;
}

export const MOCK_CAPABILITY_REGISTRY: Record<string, AICapability> = {
  'ask-ai': {
    id: 'ask-ai',
    title: 'Ask AI',
    description: 'Ask a question about the current reading context.',
    icon: HelpCircle,
    availability: 'always',
    requiredContext: ['currentNode'],
    execute: async () => {}
  },
  'explain': {
    id: 'explain',
    title: 'Explain',
    description: 'Get a detailed explanation of the selected text or current section.',
    icon: Sparkles,
    availability: 'selection',
    requiredContext: ['selectedText', 'currentNode'],
    execute: async () => {}
  },
  'summarize': {
    id: 'summarize',
    title: 'Summarize',
    description: 'Summarize the current section into key takeaways.',
    icon: FileText,
    availability: 'always',
    requiredContext: ['sectionStart', 'sectionEnd'],
    execute: async () => {}
  },
  'simplify': {
    id: 'simplify',
    title: 'Simplify',
    description: 'Rewrite the concept in simpler terms.',
    icon: GraduationCap,
    availability: 'selection',
    requiredContext: ['selectedText'],
    execute: async () => {}
  },
  'translate': {
    id: 'translate',
    title: 'Translate',
    description: 'Translate the selected text.',
    icon: Languages,
    availability: 'selection',
    requiredContext: ['selectedText'],
    execute: async () => {}
  },
  'compare': {
    id: 'compare',
    title: 'Compare Concepts',
    description: 'Compare the current topic with another concept.',
    icon: Scale,
    availability: 'always',
    requiredContext: ['currentNode'],
    execute: async () => {}
  },
  'generate-examples': {
    id: 'generate-examples',
    title: 'Generate Examples',
    description: 'Create real-world examples for the current concept.',
    icon: Lightbulb,
    availability: 'always',
    requiredContext: ['currentNode'],
    execute: async () => {}
  }
};
