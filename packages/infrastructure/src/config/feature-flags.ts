import { IFeatureFlagProvider } from './contracts';

export class FeatureFlagPlatform implements IFeatureFlagProvider {
  // In a real system, this could read from a remote service (LaunchDarkly), database, or env vars.
  // We'll simulate it based on environment variables starting with FF_
  private flags: Map<string, boolean> = new Map();

  constructor() {
    this.loadFromEnv();
  }

  private loadFromEnv() {
    for (const key in process.env) {
      if (key.startsWith('FF_')) {
        const flagName = key.replace('FF_', '').toLowerCase();
        this.flags.set(flagName, process.env[key] === 'true');
      }
    }
  }

  isEnabled(flag: string, context?: Record<string, any>): boolean {
    // Basic boolean flags for now
    const flagKey = flag.toLowerCase();
    
    // Default to false if not found
    if (!this.flags.has(flagKey)) {
      return false;
    }

    const isEnabled = this.flags.get(flagKey)!;

    // Simulate percentage rollout if context contains userId
    if (isEnabled && context && context.userId) {
      // Very basic pseudo-random for rollout logic. 
      // A production system would use murmurhash or similar on the userId for sticky evaluation.
      return true;
    }

    return isEnabled;
  }
}
