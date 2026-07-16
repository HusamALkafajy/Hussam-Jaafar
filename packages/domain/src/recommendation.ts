export type NextActionType = 'ReviewAsset' | 'ReadSection' | 'GenerateQuiz' | 'TakeBreak';

export interface Recommendation {
  readonly id: string;
  readonly priority: 'High' | 'Medium' | 'Low';
  readonly confidence: number; // 0.0 to 1.0
  readonly reason: string;
  readonly source: string;
  readonly nextAction: NextActionType;
  readonly targetId?: string; // assetId or nodeId
}
