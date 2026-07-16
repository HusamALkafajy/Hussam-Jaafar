import { AnalyticsSnapshot } from './analytics-snapshot';
import { AnalyticsInsight } from './analytics-insight';

export interface AnalyticsQuery {
  getSnapshot(): AnalyticsSnapshot;
  getInsights(): AnalyticsInsight[];
}
