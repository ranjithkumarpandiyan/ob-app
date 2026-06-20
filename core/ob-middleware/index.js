/**
 * ob-middleware
 * Core middleware registry and built-in middleware for Express.
 *
 * Built-ins (applied in order):
 *   1. requestId    — attaches req.id
 *   2. logger       — logs method, path, status, duration
 *   3. security     — basic security headers (helmet-lite)
 *   4. cors         — CORS with configurable origins
 *   5. rateLimit    — per-IP sliding window
 *   --- your impl middleware goes here ---
 *   6. notFound     — 404 handler
 *   7. errorHandler — unified error response
 *
 * Override any built-in from impl/overrides/:
 *   import middleware from 'ob-middleware'
 *   middleware.override('logger', myCustomLogger)
 *
 * Usage:
 *   import middleware from 'ob-middleware'
 *   middleware.applyTo(app)
 */

import { randomUUID } from 'crypto';

// ─── Built-in middleware functions ───────────────────────────────────────────

function requestIdMiddleware() {
    return (req, _res, next) => {
        req.id = req.headers['x-request-id'] ?? randomUUID();
        next();
    };
}

function loggerMiddleware(logger = console) {
    return (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const ms = Date.now() - start;
            let level = 'info';
            if (res.statusCode >= 500) {
                level = 'error';
            } else if (res.statusCode >= 400) {
                level = 'warn';
            }
            logger[level]?.(`[${req.id}] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
        });
        next();
    };
}

function securityMiddleware() {
    return (_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.removeHeader('X-Powered-By');
        next();
    };
}

function corsMiddleware(origins = '*') {
    return (req, res, next) => {
        let origin = origins;
        if (Array.isArray(origins)) {
            origin = origins.includes(req.headers.origin) ? req.headers.origin : '';
        }
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
        if (req.method === 'OPTIONS') {return res.sendStatus(204);}
        next();
    };
}

function rateLimitMiddleware({ windowMs = 60_000, max = 200 } = {}) {
    // Simple in-process sliding window — replace with Redis-backed in prod
    const counts = new Map();
    setInterval(() => counts.clear(), windowMs).unref();

    return (req, res, next) => {
        const key = req.ip;
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        if (count > max) {
            return res.status(429).json({
                error: 'Too Many Requests',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
        next();
    };
}

function notFoundMiddleware() {
    return (req, res) => {
        res.status(404).json({
            error: 'Not Found',
            path: req.path,
            requestId: req.id
        });
    };
}

function errorHandlerMiddleware(logger = console) {
    // Express error handler must have 4 params

    return (err, req, res, _next) => {
        const status = err.status ?? err.statusCode ?? 500;
        const message = status < 500 ? err.message : 'Internal Server Error';

        if (status >= 500) {
            logger.error?.(`[${req.id}] Unhandled error:`, err);
        }

        res.status(status).json({
            error: message,
            requestId: req.id,
            /* eslint-disable-next-line n/no-process-env -- stack trace only shown outside production */
            ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { stack: err.stack } : {})
        });
    };
}

// ─── Registry ────────────────────────────────────────────────────────────────

class OgMiddleware {
    #registry = new Map();
    #customMiddleware = [];
    #logger = console;

    constructor() {
    // Register built-ins
        this.#registry.set('requestId', requestIdMiddleware);
        this.#registry.set('logger', () => loggerMiddleware(this.#logger));
        this.#registry.set('security', securityMiddleware);
        this.#registry.set('cors', () => corsMiddleware());
        this.#registry.set('rateLimit', () => rateLimitMiddleware());
        this.#registry.set('notFound', notFoundMiddleware);
        this.#registry.set('errorHandler', () => errorHandlerMiddleware(this.#logger));
    }

    setLogger(logger) {
        this.#logger = logger;
        return this;
    }

    /**
   * Override a built-in by name.
   * fn must be a factory: () => expressMiddlewareFn
   */
    override(name, fn) {
        this.#registry.set(name, fn);
        return this;
    }

    /**
   * Add custom middleware to the chain (inserted before notFound/errorHandler).
   * Pass a ready-to-use Express middleware function.
   */
    add(fn) {
        this.#customMiddleware.push(fn);
        return this;
    }

    /**
   * Configure built-in middleware options.
   */
    configure(name, options = {}) {
        const original = this.#registry.get(name);
        if (!original) {throw new Error(`[ob-middleware] Unknown middleware: "${name}"`);}
        this.#registry.set(name, () => original(options));
        return this;
    }

    /**
   * Apply all middleware to an Express app instance.
   * Call once after app is created, before routes are mounted.
   */
    applyTo(app) {
    // Early middleware (before routes)
        for (const name of ['requestId', 'logger', 'security', 'cors', 'rateLimit']) {
            const factory = this.#registry.get(name);
            if (factory) {app.use(factory());}
        }

        // Custom middleware from impl/
        for (const fn of this.#customMiddleware) {
            app.use(fn);
        }

        // Tail middleware (after routes) — registered via applyTailTo()
        return this;
    }

    /**
   * Apply 404 + error handler — call AFTER all routes are mounted.
   */
    applyTailTo(app) {
        app.use(this.#registry.get('notFound')());
        app.use(this.#registry.get('errorHandler')());
        return this;
    }
}

const middleware = new OgMiddleware();

export default middleware;
export {
    OgMiddleware,
    requestIdMiddleware,
    loggerMiddleware,
    securityMiddleware,
    corsMiddleware,
    rateLimitMiddleware,
    notFoundMiddleware,
    errorHandlerMiddleware,
};
