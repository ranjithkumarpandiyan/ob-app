/**
 * services/ob-server/main.js
 * HTTP service entry point — infrastructure only.
 *
 * Boot order:
 *   1. Config
 *   2. Logger
 *   3. Cache
 *   4. Bus middleware
 *   5. Bootstrap impl modules (via impl/index.js)
 *   6. Start Express
 *   7. Mark ready (K8s readiness probe goes green)
 */

import config from 'ob-config';
import logger from 'ob-logger';
import cache from 'ob-cache';
import bus from 'ob-bus';
import middleware from 'ob-middleware';
import { createServer } from 'ob-server';
import { loadRoutes } from 'ob-router';
import { bootstrap } from '../../impl/index.js';

// ── 1. Config ────────────────────────────────────────────────────────────────
config.load();

const PORT = Number(config.get('PORT'));
const REDIS_URL = config.get('REDIS_URL');
const NODE_ENV = config.get('NODE_ENV');

// ── 2. Logger ────────────────────────────────────────────────────────────────
logger.setConfig(config);
const log = logger.get('ob-server');

// ── 3. Cache ─────────────────────────────────────────────────────────────────
cache.connect({ url: REDIS_URL, logger: log });

// ── 4. Bus middleware ────────────────────────────────────────────────────────
const busLog = logger.get('ob-bus');
bus.use(async(address, payload, ctx, next) => {
    const start = Date.now();
    try {
        const result = await next();
        busLog.debug({ address, duration: Date.now() - start }, '[bus] ✓');
        return result;
    } catch (err) {
        busLog.error({ address, err }, '[bus] ✗');
        throw err;
    }
});

// ── 5. Bootstrap impl ────────────────────────────────────────────────────────
await bootstrap({ bus, logger, cache, config });

// ── 6. HTTP server ───────────────────────────────────────────────────────────
const server = createServer({ port: PORT, logger: log });

middleware.applyTo(server.app);
await loadRoutes(server.app, { version: 1, basePath: 'impl/modules', logger: log });
middleware.applyTailTo(server.app);

server.onShutdown(async() => {
    await cache.close();
});

await server.start();

// ── 7. Mark ready ────────────────────────────────────────────────────────────
server.markReady();

log.info({ env: NODE_ENV, handlers: bus.list() }, '[ob-server] Boot complete');
