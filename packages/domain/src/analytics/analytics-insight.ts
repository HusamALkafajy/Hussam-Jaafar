export type InsightSeverity = 'Low' | 'Medium' | 'High';
export type InsightCategory = 'Progress' | 'Risk' | 'Strength' | 'Weakness' | 'Consistency' | 'Retention' | 'Recommendations';

export interface AnalyticsInsight {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: InsightSeverity;
  readonly confidence: number;
  readonly category: InsightCategory;
  readonly recommendation?: string;
  readonly source: string;
}
