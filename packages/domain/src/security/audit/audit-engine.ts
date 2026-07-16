import { IdentityContext } from '../core/identity-context';
import { ResourceAction } from '../core/resource-action';

export interface AuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: IdentityContext;
  readonly resourceAction: ResourceAction;
  readonly result: 'Permit' | 'Deny' | 'Success' | 'Failure';
  readonly targetResourceId?: string;
  readonly metadata: Record<string, any>;
}

export class AuditEngine {
  private records: AuditRecord[] = [];

  log(record: Omit<AuditRecord, 'id' | 'timestamp'>) {
    const fullRecord: AuditRecord = {
      ...record,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString()
    };
    
    // In production, this would stream to a secure external log
    this.records.push(fullRecord);
  }

  getRecent(limit: number = 50): AuditRecord[] {
    return this.records.slice(-limit).reverse();
  }
}
