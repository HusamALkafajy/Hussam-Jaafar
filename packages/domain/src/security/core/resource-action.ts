export type Action = 
  | 'Create'
  | 'Read'
  | 'Update'
  | 'Delete'
  | 'Execute'
  | 'Cancel'
  | 'Manage'
  | 'Export';

export type Resource = 
  | 'Document'
  | 'Reader'
  | 'AI'
  | 'Analytics'
  | 'Workflow'
  | 'Integration'
  | 'Admin';

export interface ResourceAction {
  readonly resource: Resource;
  readonly action: Action;
}

// Immutable generic permission string format: `resource.action`
export type PermissionString = `${Lowercase<Resource>}.${Lowercase<Action>}`;
