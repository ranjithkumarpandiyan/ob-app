/**
 * ob-service
 * Standard boot sequence for all portal and worker services.
 *
 * Handles the common infrastructure steps so impl/{service}/index.js
 * only needs to declare what is specific to that service.
 *
 * Usage (HTTP portal):
 *   import { run } from 'ob-service';
 *   await run({ name: 'admin', PortalClass: AdminPortal, bootstrap });
 *
 * Usage (worker):
 *   import { run } from 'ob-service    ';
 *   await run({ name: 'ob-worker', bootstrap: customBootstrap, onShutdown });
 *
 * Boot sequence:
 *   1. config.load()
 *   2. logger.setConfig(config)
 *   3. cache.connect()
 *   4. bus trace middleware
 *   5. portal.prepare()  — base middleware + health routes (HTTP services only)
 *   6. bootstrap({ portal, bus, logger, cache, config })
 *   7. portal.listen() + markReady()  (HTTP services only)
 *   8. Graceful shutdown hooks
 */

import config from 'ob-config';
import logger from 'ob-logger';
import cache from 'ob-cache';
import bus from 'ob-bus';

/**
 * Boot a service.
 *
 * @param {object}        options
 * @param {string}        options.name         - service name used for logger scope
 * @param {Function|null} options.PortalClass  - ObServer subclass (null for workers)
 * @param {Function}      options.bootstrap    - async ({ portal, bus, logger, cache, config }) => void
 * @param {Function|null} options.onShutdown   - async () => void — extra teardown (e.g. queue.close)
 */
async function run({ name, PortalClass = null, bootstrap, onShutdown = null } = {}) {

    // ── 1. Config ─────────────────────────────────────────────────────────────
    config.load(name);

    // ── 2. Logger ─────────────────────────────────────────────────────────────
    logger.setConfig(config);
    const log = logger.get(name);

    // ── 3. Cache ──────────────────────────────────────────────────────────────
    cache.connect({ url: config.get('REDIS_URL'), logger: log });

    // ── 4. Bus trace middleware ───────────────────────────────────────────────
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

    // ── 5. Create portal (HTTP services only) ─────────────────────────────────
    const portal = PortalClass
        ? new PortalClass({ port: Number(config.get('PORT')), logger: log })
        : null;

    // ── 6. Prepare portal — registers base middleware + health routes FIRST ───
    //    Must happen before bootstrap() so /healthz and /ready are registered
    //    before bootstrap's catch-all error handler is mounted.
    if (portal) {
        portal.prepare();
    }

    // ── 7. Bootstrap — loads handlers (business logic only) ──────────────────
    if (bootstrap) {
        await bootstrap({ portal, bus, logger, cache, config });
    }

    // ── 8. Wire HTTP — apply middleware + mount routes (portal only) ──────────
    if (portal) {
        portal.wire(bus, log);
    }

    // ── 9. Listen + shutdown ──────────────────────────────────────────────────
    if (portal) {
        portal.onShutdown(async() => {
            if (onShutdown) {
                await onShutdown({ bus, logger, cache, config });
            }
            await cache.close();
        });

        await portal.listen();
        portal.markReady();
    } else {
        // Worker — manual shutdown hooks
        const shutdown = async(signal) => {
            log.info(`[${name}] ${signal} received — shutting down`);
            try {
                if (onShutdown) {
                    await onShutdown({ bus, logger, cache, config });
                }
                await cache.close();
                log.info(`[${name}] Shutdown complete`);
                process.exit(0);
            } catch (err) {
                log.error({ err }, `[${name}] Shutdown error`);
                process.exit(1);
            }
        };
        process.once('SIGTERM', () => shutdown('SIGTERM'));
        process.once('SIGINT', () => shutdown('SIGINT'));
    }

    log.info({ env: config.get('NODE_ENV') }, `[${name}] Boot complete`);
}

export { run };
