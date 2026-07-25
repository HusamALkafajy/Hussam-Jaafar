import { db, flashcardSets, flashcards } from '@studyai/database';
import { sql } from 'drizzle-orm';

async function main() {
  const sets = await db.select({ count: sql<number>`count(*)` }).from(flashcardSets);
  const cards = await db.select({ count: sql<number>`count(*)` }).from(flashcards);
  console.log(`Sets: ${sets[0].count}`);
  console.log(`Cards: ${cards[0].count}`);
  process.exit(0);
}

main().catch(console.error);
