#!/usr/bin/env node

import { runJsonRpcServer } from '@wolfkrow/mcp-shared';

import { handlers } from './handlers.js';

runJsonRpcServer(process.stdin, process.stdout, handlers);
