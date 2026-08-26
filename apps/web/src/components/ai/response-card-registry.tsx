'use React';
import React from 'react';
import { ResponseCard, ResponseCardType } from '../../mocks/workspace/response-card-registry';

interface CardRendererProps {
  card: ResponseCard;
}

export function TextCard({ payload }: { payload: any }) {
  return <div className="text-sm prose prose-sm dark:prose-invert">{payload.text}</div>;
}

export function ExplanationCard({ payload }: { payload: any }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
      <h4 className="text-sm font-semibold text-primary">{payload.title}</h4>
      <p className="text-sm text-foreground">{payload.content}</p>
    </div>
  );
}

export function KeyTakeawaysCard({ payload }: { payload: any }) {
  return (
    <div className="bg-muted border rounded-lg p-3 space-y-2 mt-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Takeaways</h4>
      <ul className="list-disc list-inside text-sm space-y-1">
        {payload.points?.map((point: string, i: number) => (
          <li key={i}>{point}</li>
        ))}
      </ul>
    </div>
  );
}

export function ResponseCardRenderer({ card }: CardRendererProps) {
  switch (card.type) {
    case 'TextCard':
      return <TextCard payload={card.payload} />;
    case 'ExplanationCard':
      return <ExplanationCard payload={card.payload} />;
    case 'KeyTakeawaysCard':
      return <KeyTakeawaysCard payload={card.payload} />;
    default:
      return <div className="text-sm text-muted-foreground italic">Unsupported card type: {card.type}</div>;
  }
}
