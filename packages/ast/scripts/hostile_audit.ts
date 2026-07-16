import { ASTValidator } from '../src/validator';
import { ASTNode } from '../src/types';
import * as v8 from 'v8';

function createHostileNode(id: string): any {
  return {
    id: id,
    parent_id: Math.random() > 0.5 ? `node-${Math.floor(Math.random() * 1000)}` : null,
    node_type: Math.random() > 0.1 ? 'paragraph' : 'UNKNOWN_TYPE',
    lexo_rank: Math.random() > 0.1 ? `rank-${Math.random()}` : null,
    content: Math.random() > 0.5 ? { text: 'some text' } : { text: '' },
    annotations: Math.random() > 0.9 ? [{ start_offset: 10, end_offset: 5, exact_text: 'bad' }] : undefined,
    relationships: Math.random() > 0.9 ? [{ target_id: `node-${Math.floor(Math.random() * 1000)}`, type: 'internal_link' }] : undefined,
  };
}

async function runAudit() {
  console.log("=== HOSTILE AUDIT START ===");

  // 1. Concurrency Audit
  console.log("\\n--- 1. Concurrency Audit ---");
  const baseNodes: ASTNode[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `node-${i}`,
    parent_id: i === 0 ? null : `node-${Math.floor((i - 1) / 5)}`,
    node_type: 'paragraph',
    lexo_rank: `rank-${i}`
  }));

  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(Promise.resolve().then(() => ASTValidator.validate(baseNodes)));
  }
  const concurrencyResults = await Promise.all(promises);
  const allSame = concurrencyResults.every(r => r.valid === true && r.statistics.nodeCount === 1000);
  console.log(`Concurrency safe: ${allSame}`);

  // 2. Fuzzing Audit
  console.log("\\n--- 2. Fuzzing Audit ---");
  let fuzzedPassed = 0;
  let fuzzedCrashed = 0;
  for (let i = 0; i < 100; i++) {
    const fuzzedNodes = Array.from({ length: 500 }, (_, idx) => createHostileNode(`node-${idx}`));
    try {
      ASTValidator.validate(fuzzedNodes);
      fuzzedPassed++;
    } catch (e) {
      fuzzedCrashed++;
    }
  }
  console.log(`Fuzzing runs: ${fuzzedPassed} survived, ${fuzzedCrashed} crashed`);

  // 3. Performance Profiling
  console.log("\\n--- 3. Performance Benchmark ---");
  const sizes = [1000, 10000, 100000, 500000, 1000000];
  
  for (const size of sizes) {
    if (size > 100000 && process.env.SKIP_LARGE) continue;
    
    // Garbage collection to get clean heap measurements if exposed
    if (global.gc) global.gc();
    
    const nodes: ASTNode[] = [];
    nodes.push({ id: 'root', parent_id: null, node_type: 'document', lexo_rank: 'root' });
    
    for (let i = 1; i < size; i++) {
      nodes.push({
        id: `node-${i}`,
        parent_id: Math.floor((i - 1) / 5) === 0 ? 'root' : `node-${Math.floor((i - 1) / 5)}`,
        node_type: 'paragraph',
        lexo_rank: `rank-${i}`
      });
    }

    const startHeap = process.memoryUsage().heapUsed;
    const start = performance.now();
    const result = ASTValidator.validate(nodes);
    const end = performance.now();
    const endHeap = process.memoryUsage().heapUsed;

    console.log(`Size: ${size} | Valid: ${result.valid} | Time: ${(end - start).toFixed(2)}ms | Heap Delta: ${((endHeap - startHeap) / 1024 / 1024).toFixed(2)} MB`);
  }

  console.log("\\n=== HOSTILE AUDIT END ===");
}

runAudit().catch(console.error);
