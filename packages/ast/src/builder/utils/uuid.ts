import { v5 as uuidv5 } from 'uuid';

export function generateDeterministicId(documentId: string, extractorId: string): string {
  // Use the documentId as the namespace for UUIDv5. 
  // If documentId isn't a valid UUID format, we hash it into one or require it to be valid.
  // We assume documentId is a valid UUID, but if not we can use a hardcoded namespace to hash the docId first.
  const MY_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
  
  // First ensure docId is a valid namespace by hashing it with our base namespace
  const docNamespace = uuidv5(documentId, MY_NAMESPACE);
  
  // Now hash the extractorId against the document namespace
  return uuidv5(extractorId, docNamespace);
}
