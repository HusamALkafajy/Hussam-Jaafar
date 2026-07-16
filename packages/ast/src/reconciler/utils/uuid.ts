import { v5 as uuidv5 } from 'uuid';

export function generateEdgeId(documentId: string, sourceUuid: string, targetUuid: string, type: string): string {
  // We use a base namespace for all edges to guarantee determinism
  const MY_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
  
  // Hash the document ID first to create a document-specific namespace
  const docNamespace = uuidv5(documentId, MY_NAMESPACE);
  
  // Hash the unique edge properties
  const hashString = `${sourceUuid}_${type}_${targetUuid}`;
  return uuidv5(hashString, docNamespace);
}
