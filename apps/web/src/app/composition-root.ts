// Security
import { RoleRegistry } from '@studyai/domain/security/core/role-model';
import { PolicyEngine as SecurityPolicyEngine } from '@studyai/domain/security/policy/policy-engine';
import { AuthorizationEngine } from '@studyai/domain/security/authorization/authorization-engine';
import { AuditEngine } from '@studyai/domain/security/audit/audit-engine';
import { ComplianceEngine } from '@studyai/domain/security/compliance/compliance-engine';
import { SecurityGateway } from '@studyai/domain/security/security-gateway';

// Integration
import { ConnectorRegistry } from '@studyai/domain/integration/connector-registry';
import { IntegrationGateway } from '@studyai/domain/integration/integration-gateway';

// Workflow
import { WorkflowCommandBus } from '@studyai/domain/workflow/cqrs/workflow-command-bus';
import { JobQueue } from '@studyai/domain/workflow/job/job-queue';
import { WorkflowExecutor } from '@studyai/domain/workflow/core/workflow-executor';
import { WorkflowManager } from '@studyai/domain/workflow/core/workflow-manager';

export class CompositionRoot {
  // Security
  public readonly roleRegistry: RoleRegistry;
  public readonly securityPolicyEngine: SecurityPolicyEngine;
  public readonly authorizationEngine: AuthorizationEngine;
  public readonly auditEngine: AuditEngine;
  public readonly complianceEngine: ComplianceEngine;
  public readonly securityGateway: SecurityGateway;

  // Integration
  public readonly connectorRegistry: ConnectorRegistry;
  public readonly integrationGateway: IntegrationGateway;

  // Workflow
  public readonly workflowCommandBus: WorkflowCommandBus;
  public readonly jobQueue: JobQueue;
  public readonly workflowExecutor: WorkflowExecutor;
  public readonly workflowManager: WorkflowManager;

  constructor() {
    // 1. Initialize Security
    this.roleRegistry = new RoleRegistry();
    this.securityPolicyEngine = new SecurityPolicyEngine();
    this.authorizationEngine = new AuthorizationEngine(this.securityPolicyEngine, this.roleRegistry);
    this.auditEngine = new AuditEngine();
    this.complianceEngine = new ComplianceEngine();
    this.securityGateway = new SecurityGateway(this.authorizationEngine, this.auditEngine, this.complianceEngine);

    // 2. Initialize Integration
    this.connectorRegistry = new ConnectorRegistry();
    this.integrationGateway = new IntegrationGateway(this.connectorRegistry);

    // 3. Initialize Workflow
    this.workflowCommandBus = new WorkflowCommandBus();
    this.jobQueue = new JobQueue();
    this.workflowExecutor = new WorkflowExecutor(this.jobQueue);
    this.workflowManager = new WorkflowManager(this.workflowCommandBus, this.workflowExecutor);

    // Further domain engines (Learning, Assessment, Revision, Analytics) would be initialized here,
    // receiving references to the SecurityGateway and WorkflowManager.
  }
}

export const compositionRoot = new CompositionRoot();
