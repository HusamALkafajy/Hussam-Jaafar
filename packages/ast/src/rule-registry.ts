import { ValidationRule, ValidationContext } from './types';

export class RuleRegistry {
  private rules: ValidationRule[] = [];

  register(rule: ValidationRule): void {
    if (this.rules.find(r => r.id === rule.id)) {
      throw new Error(`Rule with id ${rule.id} already registered`);
    }
    this.rules.push(rule);
  }

  getRules(): ValidationRule[] {
    return [...this.rules];
  }

  clear(): void {
    this.rules = [];
  }
}

// Global default registry instance
export const defaultRegistry = new RuleRegistry();
