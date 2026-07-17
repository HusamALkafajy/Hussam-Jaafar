'use client';

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { SecurityGateway } from '@studyai/domain/security/security-gateway';
import { AuthorizationEngine } from '@studyai/domain/security/authorization/authorization-engine';
import { AuditEngine } from '@studyai/domain/security/audit/audit-engine';
import { ComplianceEngine } from '@studyai/domain/security/compliance/compliance-engine';
import { PolicyEngine } from '@studyai/domain/security/policy/policy-engine';
import { RoleRegistry } from '@studyai/domain/security/core/role-model';
import { SecurityContextViewModel, AuditRecordViewModel, ComplianceStatusViewModel } from '@studyai/domain/security/security-view-models';

interface SecurityContextValue {
  context: SecurityContextViewModel | null;
  audits: AuditRecordViewModel[];
  compliance: ComplianceStatusViewModel;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [roleRegistry] = useState(() => new RoleRegistry());
  const [policyEngine] = useState(() => new PolicyEngine());
  const [authEngine] = useState(() => new AuthorizationEngine(policyEngine, roleRegistry));
  const [auditEngine] = useState(() => new AuditEngine());
  const [complianceEngine] = useState(() => new ComplianceEngine());
  const [gateway] = useState(() => new SecurityGateway(authEngine, auditEngine, complianceEngine));

  const [context, setContext] = useState<SecurityContextViewModel | null>(null);
  const [audits, setAudits] = useState<AuditRecordViewModel[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatusViewModel>({ flagsActive: 0, rulesActive: 0 });

  useEffect(() => {
    // Mock user for UI
    setContext({
      identityId: 'usr_admin_123',
      activeRoles: ['Administrator'],
      permissions: ['document.read', 'document.write', 'admin.manage']
    });

    setAudits([
      { id: '1', timestamp: new Date().toISOString(), actorId: 'usr_admin_123', action: 'Read', resource: 'Document', result: 'Permit' }
    ]);
  }, []);

  const value = useMemo(() => ({
    context,
    audits,
    compliance
  }), [context, audits, compliance]);

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
}
