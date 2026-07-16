export interface RetentionRule {
  readonly resourceType: string;
  readonly durationDays: number;
}

export interface PrivacyFlag {
  readonly key: string;
  readonly value: boolean;
}

export class ComplianceEngine {
  private retentionRules = new Map<string, RetentionRule>();
  private privacyFlags = new Map<string, PrivacyFlag>();

  registerRetentionRule(rule: RetentionRule) {
    this.retentionRules.set(rule.resourceType, rule);
  }

  setPrivacyFlag(flag: PrivacyFlag) {
    this.privacyFlags.set(flag.key, flag);
  }

  getRetentionFor(resourceType: string): RetentionRule | undefined {
    return this.retentionRules.get(resourceType);
  }

  checkPrivacy(key: string): boolean {
    return this.privacyFlags.get(key)?.value ?? false;
  }
}
