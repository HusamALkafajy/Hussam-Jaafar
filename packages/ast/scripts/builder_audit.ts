import { ASTBuilder, BuilderDTO, BuilderOptions } from '../src/builder';

function formatMemoryUsage(data: number) {
  return `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;
}

function runBenchmark(nodeCount: number) {
  console.log(`\n--- Benchmarking ${nodeCount.toLocaleString()} nodes ---`);
  const dtos: BuilderDTO[] = [];
  const options: BuilderOptions = { documentId: '2b671a64-40d5-491e-99b0-da01ff1f3342' };

  dtos.push({ extractor_id: 'root', extractor_parent_id: null, node_type: 'document' });

  for (let i = 1; i < nodeCount; i++) {
    dtos.push({
      extractor_id: `node-${i}`,
      extractor_parent_id: i % 100 === 0 ? 'root' : `node-${i - 1}`, // Deep hierarchy interspersed with branches
      node_type: 'paragraph',
      content: { text: `This is node ${i}` },
      metadata: { author: 'HostileAudit' }
    });
  }

  const startMem = process.memoryUsage();
  const start = performance.now();
  
  const result = ASTBuilder.buildAndValidate(dtos, options);
  
  const end = performance.now();
  const endMem = process.memoryUsage();

  console.log(`Execution Time: ${Math.round(end - start)} ms`);
  console.log(`Heap Used Delta: ${formatMemoryUsage(endMem.heapUsed - startMem.heapUsed)}`);
  console.log(`Total Heap Used: ${formatMemoryUsage(endMem.heapUsed)}`);
  console.log(`Result Success: ${result.success}`);
  console.log(`Builder Errors: ${result.builderErrors.length}`);
}

console.log("Starting Builder Performance Audit...");
runBenchmark(10_000);
runBenchmark(100_000);
runBenchmark(1_000_000);
