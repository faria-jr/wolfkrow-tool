import { BUILT_IN_MCP_SERVERS, PLANNED_MCP_SERVERS } from '@wolfkrow/infra';
import { cookies } from 'next/headers';


import { getSession } from '@/lib/auth';

/**
 * GET /api/mcp-servers/catalog â€” exposes the static MCP catalog metadata so
 * the UI can label entries as `built-in` vs `planned` vs `custom` without
 * shipping the full infra package to the client.
 *
 * The names come from the `BUILT_IN_MCP_SERVERS` and `PLANNED_MCP_SERVERS`
 * arrays in `packages/infra/src/seed/built-in-mcps.ts`. Each server with a
 * matching `isBuiltIn` row in the DB is `built-in`; otherwise, if the name
 * matches a `PLANNED_MCP_SERVERS` entry, it's `planned`; otherwise `custom`.
 *
 * ( €” back-end for the `source` field in `McpServerData`.)
 */
export async function GET() {
 const cookieStore = await cookies();
 const session = await getSession(cookieStore.get('session')?.value);
 if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

 return Response.json({
 builtIn: BUILT_IN_MCP_SERVERS.map((s) => s.name),
 planned: PLANNED_MCP_SERVERS.map((s) => s.name),
 });
}
