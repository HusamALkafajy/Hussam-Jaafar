export interface TokenEstimator {
  estimateTokens(text: string): number;
}
