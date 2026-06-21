/**
 * ob-server
 * Express HTTP server factory.
 * Creates the app, mounts core middleware, and manages graceful shutdown.
 *
 * Usage:
 *   import { createServer } from 'ob-server'
 *   const server = await createServer({ port: 3000 })
 *   server.start()
 */

import express from 'express';
import http from 'http';
import { randomUUID } from 'crypto';
import middleware from 'ob-middleware';
import { mountRoutes } from 'ob-router';

class ObServer {
    #app;
    #httpServer;
    #port;
    #logger;
    #shutdownHandlers = [];
    #middlewareRegistry;

    constructor({ port = 3000, logger = console, middlewareRegistry = null } = {}) {
        this.#port = port;
        this.#logger = logger;
        this.#middlewareRegistry = middlewareRegistry;
        this.#app = express();
        this.#httpServer = http.createServer(this.#app);
    }

    get app() { return this.#app; }
    get httpServer() { return this.#httpServer; }

    // ─── Boot ───────────────────────────────────────────────────────────────────

    /**
     * Portal name — subclasses override this getter to declare their portal.
     * Used by ob-router to filter which handlers get HTTP routes.
     */
    get portalName() { return null; }

    /**
     * Portal-specific middleware hook — subclasses override to apply
     * auth, CORS, rate limiting specific to their portal.
     * Called during start(), after base middleware, before routes.
     */
    applyPortalMiddleware() {}

    /**
     * Register base middleware + health routes without starting the HTTP listener.
     * Call this BEFORE bootstrap() so /healthz and /ready are registered before
     * any catch-all error handlers that bootstrap mounts.
     */
    prepare() {
        this.#applyBaseMiddleware();
        this.applyPortalMiddleware();
        this.#applyHealthRoutes();
        return this;
    }

    /**
     * Start accepting connections. Call after bootstrap() has mounted API routes.
     */
    async listen() {
        this.#registerShutdownHooks();

        await new Promise((resolve, reject) => {
            this.#httpServer.listen(this.#port, (err) => {
                if (err) {return reject(err);}
                resolve();
            });
        });

        this.#logger.info(`[ob-server] Listening on port ${this.#port} (${process.env.NODE_ENV ?? 'development'})`);
        return this;
    }

    /**
     * Convenience: prepare() + listen() in one call.
     * Use directly only when bootstrap is not needed.
     */
    async start() {
        this.prepare();
        await this.listen();
        return this;
    }

    // ─── Base Middleware ────────────────────────────────────────────────────────

    #applyBaseMiddleware() {
    // Request ID — injected early so all logs carry it
        this.#app.use((req, _res, next) => {
            req.id = req.headers['x-request-id'] ?? randomUUID();
            next();
        });

        this.#app.use(express.json({ limit: '1mb' }));
        this.#app.use(express.urlencoded({ extended: true }));

        // If a middleware registry was passed (from ob-middleware), apply it
        if (this.#middlewareRegistry) {
            this.#middlewareRegistry.applyTo(this.#app);
        }
    }

    // ─── Health / Readiness ─────────────────────────────────────────────────────

    #ready = false;

    #applyHealthRoutes() {
    // Liveness — is the process alive?
        this.#app.get('/healthz', (_req, res) => {
            res.json({ status: 'ok', pid: process.pid });
        });

        // Readiness — is the app ready to serve traffic?
        // K8s will stop sending traffic until this returns 200
        this.#app.get('/ready', (_req, res) => {
            if (this.#ready) {
                res.json({ status: 'ready' });
            } else {
                res.status(503).json({ status: 'starting' });
            }
        });
    }

    markReady() {
        this.#ready = true;
        this.#logger.info('[ob-server] Marked as ready');
        return this;
    }

    // ─── HTTP + Route wiring ────────────────────────────────────────────────────

    /**
     * Apply middleware chain + mount all bus routes for this portal.
     * Call AFTER bootstrap() has registered handlers on the bus.
     *
     * @param {object} bus
     * @param {object} [logger]
     */
    wire(bus, logger = this.#logger) {
        middleware.applyTo(this.#app);
        mountRoutes(this.#app, bus, {
            portalName: this.portalName,
            logger: logger.get ? logger.get('ob-router') : logger,
        });
        middleware.applyTailTo(this.#app);
        return this;
    }

    mount(prefix, router) {
        this.#app.use(prefix, router);
        return this;
    }

    // ─── Graceful Shutdown ──────────────────────────────────────────────────────

    /**
   * Register a handler to run on SIGTERM / SIGINT.
   * Use this to close DB connections, drain queues, etc.
   * Handlers run in registration order.
   */
    onShutdown(fn) {
        this.#shutdownHandlers.push(fn);
        return this;
    }

    #registerShutdownHooks() {
        const shutdown = async(signal) => {
            this.#logger.info(`[ob-server] ${signal} received — shutting down gracefully`);
            this.#ready = false;

            // Stop accepting new connections
            this.#httpServer.close(async() => {
                try {
                    for (const fn of this.#shutdownHandlers) {
                        /* eslint-disable-next-line no-await-in-loop -- shutdown handlers must run sequentially to respect teardown order */
                        await fn();
                    }
                    this.#logger.info('[ob-server] Shutdown complete');
                    process.exit(0);
                } catch (err) {
                    this.#logger.error('[ob-server] Shutdown error:', err);
                    process.exit(1);
                }
            });

            // K8s default termination grace period is 30s
            setTimeout(() => {
                this.#logger.error('[ob-server] Forced shutdown after timeout');
                process.exit(1);
            }, 28_000);
        };

        process.once('SIGTERM', () => shutdown('SIGTERM'));
        process.once('SIGINT', () => shutdown('SIGINT'));
    }
}

function createServer(options = {}) {
    return new ObServer(options);
}

export { createServer, ObServer };
