import { defineConfig } from 'drizzle-kit';
import path from 'path';

const dbPath = path.resolve(process.env.WOLFKROW_DB_PATH ?? './.wolfkrow/data/wolfkrow.db');

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
  verbose: true,
  strict: true,
});
