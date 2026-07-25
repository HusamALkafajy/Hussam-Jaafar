import { TokenEstimator } from '../contracts/token-estimator';

export class HeuristicTokenEstimator implements TokenEstimator {
  /**
   * Deterministic, provider-independent token estimation heuristic.
   * Assumes 1 token ≈ 4 characters, common for English-heavy texts.
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}
