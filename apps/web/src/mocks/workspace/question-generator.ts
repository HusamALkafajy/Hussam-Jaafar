import { ReadingContext } from './reading-context';

export interface SuggestedQuestion {
  id: string;
  label: string;
  prompt: string;
}

export const getSuggestedQuestions = (context: ReadingContext): SuggestedQuestion[] => {
  return [
    {
      id: 'q1',
      label: 'Explain this topic',
      prompt: `Explain the topic: ${context.heading || context.documentTitle}`
    },
    {
      id: 'q2',
      label: 'Summarize section',
      prompt: `Summarize the key points of the current section.`
    },
    {
      id: 'q3',
      label: 'Generate examples',
      prompt: `Provide real-world examples for this concept.`
    }
  ];
};
