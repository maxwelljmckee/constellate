import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const migrationClient = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(migrationClient);
  console.log('[migrate] running migrations against', new URL(databaseUrl).hostname);
  await migrate(db, { migrationsFolder: './drizzle' });
  await migrationClient.end();
  console.log('[migrate] done');
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
