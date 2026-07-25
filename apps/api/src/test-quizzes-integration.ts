import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LearningAssetPipeline } from './modules/learning-assets/learning-asset.pipeline';
import { db, exams, questions, users, files } from '@studyai/database';
import { eq } from 'drizzle-orm';
import { KnowledgeGraph } from './modules/knowledge/contracts/knowledge-graph';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pipeline = app.get(LearningAssetPipeline);
  
  const docId = randomUUID();
  const userId = randomUUID();

  await db.insert(users).values({
    id: userId,
    email: `test-${userId}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    passwordHash: 'hash',
  });

  await db.insert(files).values({
    id: docId,
    userId: userId,
    originalName: 'test.pdf',
    storageKey: 'test.pdf',
    storageUrl: 'http://test',
    fileType: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 100,
    processingStatus: 'completed',
  });

  const graph: KnowledgeGraph = {
    metadata: {
      documentId: docId,
      version: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    nodes: [
      {
        id: 'node-1',
        type: 'Concept',
        label: 'Node.js',
        content: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
        sourceChunkId: 'chunk-1',
        confidenceScore: 1.0,
        version: '1',
      },
      {
        id: 'node-2',
        type: 'Concept',
        label: 'Event Loop',
        content: 'The event loop is what allows Node.js to perform non-blocking I/O operations.',
        sourceChunkId: 'chunk-2',
        confidenceScore: 0.9,
        version: '1',
      }
    ],
    edges: [
      {
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        type: 'DEPENDS_ON',
        confidenceScore: 1.0,
      }
    ]
  };

  console.log('Generating assets via pipeline...');
  const assets = await pipeline.generateAssets(graph, { documentId: docId, userId });
  console.log(`Generated ${assets.length} assets.`);

  const quizAssets = assets.filter(a => a.assetType === 'QuizQuestion');
  console.log(`Generated ${quizAssets.length} quiz questions.`);

  const dbExams = await db.query.exams.findMany({ where: eq(exams.fileId, docId) });
  console.log(`Exams persisted: ${dbExams.length}`);
  
  if (dbExams.length > 0) {
    const examQuestions = await db.query.questions.findMany({ where: eq(questions.examId, dbExams[0].id) });
    console.log(`Questions persisted: ${examQuestions.length}`);
  }

  await app.close();
  process.exit(0);
}
bootstrap();
