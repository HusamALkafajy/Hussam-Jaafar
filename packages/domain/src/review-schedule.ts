export interface ReviewSchedule {
  readonly assetId: string;
  readonly reviewStage: number;
  readonly nextReview: string; // ISO Date String
  readonly intervalMinutes: number;
}
