/**
 * ob-utils
 * Shared utilities used across the framework.
 *
 * createCtx(req, options)
 *   Builds the ctx object passed as the second argument to every handler.
 *
 *   handler: async(payload, ctx) => { ... }
 *
 * ctx properties:
 *   requestId  {string}       — trace ID (from X-Request-Id header or generated)
 *   portalName {string}       — portal this request came through (e.g. 'customer')
 *   user       {object|null}  — authenticated user, set by auth middleware
 *   ip         {string}       — client IP address
 *   userAgent  {string}       — client user agent string
 *   timestamp  {number}       — epoch ms when request was received
 *   cache      {object}       — ob-cache instance for request-scoped caching
 */

// ─── createCtx ────────────────────────────────────────────────────────────────

/**
 * Build a ctx object from an Express request.
 *
 * @param {object} req               - Express request
 * @param {object} options
 * @param {string} options.portalName  - portal name (e.g. 'customer')
 * @param {object} [options.cache]     - ob-cache instance
 * @returns {object} ctx
 */
function createCtx(req, { portalName, cache = null } = {}) {
    return {
        requestId: req.id ?? req.headers['x-request-id'] ?? null,
        portalName,
        user: req.user ?? null,
        ip: req.ip ?? req.socket?.remoteAddress ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        timestamp: Date.now(),
        cache,
    };
}

export { createCtx };
