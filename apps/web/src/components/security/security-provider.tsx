'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { SecurityGateway } from '@studyai/domain/security/security-gateway';
import { AuthorizationEngine } from '@studyai/domain/security/authorization/authorization-engine';
import { AuditEngine } from '@studyai/domain/security/audit/audit-engine';
import { ComplianceEngine } from '@studyai/domain/security/compliance/compliance-engine';
import { PolicyEngine } from '@studyai/domain/security/policy/policy-engine';
import { RoleRegistry } from '@studyai/domain/security/core/role-model';
import { SecurityContextViewModel, AuditRecordViewModel, ComplianceStatusViewModel } from '@studyai/domain/security/security-view-models';
import { useAuth } from '../../hooks/use-auth';

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

  const [compliance, setCompliance] = useState<ComplianceStatusViewModel>({ flagsActive: 0, rulesActive: 0 });

  const { user, loading } = useAuth();
  const context = useMemo<SecurityContextViewModel | null>(() => {
    if (loading || !user || typeof user.id !== 'string' || user.id.trim().length === 0) {
      return null;
    }

    let permissions: string[];
    switch (user.role) {
      case 'admin':
        permissions = ['document.read', 'document.write', 'admin.manage'];
        break;
      case 'student':
        permissions = ['document.read', 'document.write'];
        break;
      case 'teacher':
        permissions = ['document.read', 'document.write'];
        break;
      case 'parent':
        permissions = ['document.read', 'document.write'];
        break;
      default:
        return null;
    }

    return {
      identityId: user.id,
      activeRoles: [user.role],
      permissions,
    };
  }, [user, loading]);
  // A profile change is not evidence of a successful audited login.
  const audits = useMemo<AuditRecordViewModel[]>(() => [], []);

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
