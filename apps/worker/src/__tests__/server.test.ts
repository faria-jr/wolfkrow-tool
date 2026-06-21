import { describe, it, expect } from 'vitest';

import { createServer } from '../server';

describe('Server', () => {
  it('health endpoint returns ok', async () => {
    const server = await createServer();
    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'wolfkrow-worker' });

    await server.close();
  });

  it('scheduler endpoints require authentication', async () => {
    const server = await createServer();
    const response = await server.inject({ method: 'GET', url: '/scheduler/tasks' });

    expect(response.statusCode).toBe(401);

    await server.close();
  });
});
