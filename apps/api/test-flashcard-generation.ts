import { db, flashcardSets, flashcards, files, users } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { FlashcardsRepository } from './src/modules/flashcards/flashcards.repository';
import { FlashcardEngine } from './src/modules/flashcards/engine/flashcard.engine';
import { FlashcardGenerator } from './src/modules/flashcards/engine/flashcard.generator';
import { KnowledgeGraphRepository } from './src/modules/knowledge/knowledge-graph.repository';
import { KnowledgeGraphConsumer } from './src/modules/knowledge/providers/knowledge-graph-consumer';

async function main() {
  // Try to find a user
  let user = await db.query.users.findFirst();
  if (!user) {
    console.log("Creating dummy user...");
    const [inserted] = await db.insert(users).values({
      id: 'dummy-user-id',
      email: 'dummy@example.com',
      firstName: 'Dummy',
      lastName: 'User'
    }).returning();
    user = inserted;
  }

  // Create dummy file
  const [file] = await db.insert(files).values({
    userId: user.id,
    originalName: 'dummy-file.txt',
    storageKey: 'dummy',
    storageUrl: 'http://dummy.url',
    fileType: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 100,
    processingStatus: 'completed'
  }).returning();

  const repo = new FlashcardsRepository();
  const engine = new FlashcardEngine();
  const graphRepo = new KnowledgeGraphRepository();
  const graphConsumer = new KnowledgeGraphConsumer(graphRepo);
  const generator = new FlashcardGenerator(engine, repo, graphConsumer);

  const mockGraph = {
    metadata: { version: '1.0', documentId: file.id },
    nodes: [
      { id: 'node-1', type: 'Concept', label: 'Photosynthesis', content: 'What is photosynthesis?', metadata: {} },
      { id: 'node-2', type: 'Definition', label: 'Definition', content: 'The process by which plants make their own food using sunlight.', metadata: {} }
    ],
    edges: [
      { id: 'edge-1', sourceNodeId: 'node-2', targetNodeId: 'node-1', type: 'DEFINES', metadata: {} }
    ]
  };

  // Mock the graphConsumer for this test to return the mockGraph instead of hitting DB
  (graphConsumer as any).resolveGraph = async () => mockGraph;

  const payloads = await generator.generatePayloads(mockGraph as any);
  console.log('Payloads generated:', payloads.length);
  
  const assets = payloads.map(p => generator.mapToAsset(p, mockGraph as any));

  console.log('Persisting assets...');
  await generator.persist(assets, { fileId: file.id, userId: user.id });

  console.log('Fetching persisted sets...');
  const sets = await db.select().from(flashcardSets).where(eq(flashcardSets.fileId, file.id));
  const cards = await db.select().from(flashcards).where(eq(flashcards.setId, sets[0].id));

  console.log(`Successfully persisted ${sets.length} sets and ${cards.length} cards!`);
  
  // Cleanup dummy
  await db.delete(flashcards).where(eq(flashcards.setId, sets[0].id));
  await db.delete(flashcardSets).where(eq(flashcardSets.id, sets[0].id));
  await db.delete(files).where(eq(files.id, file.id));
  
  process.exit(0);
}

main().catch(console.error);
