export type ResponseCardType = 
  | 'ExplanationCard'
  | 'SummaryCard'
  | 'DefinitionCard'
  | 'FormulaCard'
  | 'ExampleCard'
  | 'ComparisonCard'
  | 'TimelineCard'
  | 'KeyTakeawaysCard'
  | 'TextCard';

export interface ResponseCard {
  type: ResponseCardType;
  payload: any;
}
