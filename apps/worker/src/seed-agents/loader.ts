import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { SeedAgentSchema, type SeedAgent } from './schema';

export async function loadSeedAgents(dir: string): Promise<SeedAgent[]> {
  const entries = await readdir(dir);
  const yamlFiles = entries.filter((f) => f.endsWith('.yaml')).map((f) => join(dir, f));
  return Promise.all(
    yamlFiles.map(async (file) => {
      const raw = await readFile(file, 'utf-8');
      const parsed = parseYaml(raw) as unknown;
      return SeedAgentSchema.parse(parsed);
    }),
  );
}
