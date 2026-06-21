import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface AuthFastifyInstance extends FastifyInstance {
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}
