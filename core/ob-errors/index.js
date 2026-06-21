/**
 * ob-errors
 * Structured error class and JSON-driven error factory.
 *
 * errors.json shape (flat or namespaced):
 *
 *   Flat (shared):
 *     { "internalError": { "message": "Something went wrong", "level": "error" } }
 *
 *   Namespaced (per-service):
 *     { "users": { "invalidCredentials": { "message": "...", "status": 401, "level": "warn" } } }
 *
 * Usage in a handler:
 *   const errors = loadErrors(import.meta)
 *   throw errors.users.invalidCredentials()
 *   throw errors.users.invalidCredentials('Custom override message')
 *   throw errors.users.invalidCredentials({ detail: 'locked after 5 attempts' })
 *
 * ObError properties:
 *   message  {string}  — human-readable description
 *   code     {string}  — dot-notation path, e.g. 'users.invalidCredentials'
 *   status   {number}  — HTTP status code (default: 500)
 *   level    {string}  — log level: 'warn' | 'error' (default: 'error')
 *   meta     {object}  — any extra fields passed at throw time
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── ObError ──────────────────────────────────────────────────────────────────

class ObError extends Error {
    /**
     * @param {string} message
     * @param {object} options
     * @param {string} options.code    - dot-notation error code
     * @param {number} [options.status]  - HTTP status (default 500)
     * @param {string} [options.level]   - 'warn' | 'error' (default 'error')
     * @param {object} [options.meta]    - extra context
     */
    constructor(message, { code, status, level = 'error', ...meta } = {}) {
        super(message);
        this.name = 'ObError';
        this.code = code;
        this.status = status ?? 500;
        this.level = level;
        this.meta = meta;
    }
}

// ─── buildErrors ──────────────────────────────────────────────────────────────

/**
 * Recursively converts a definitions object into callable error factories.
 *
 * Leaf node: { message, status?, level } → factory function
 * Branch node: { key: { ... } } → nested object of factories
 *
 * @param {object} definitions - parsed errors.json content
 * @param {string} [prefix]    - dot-notation prefix for code building
 * @returns {object}
 */
function buildErrors(definitions, prefix = '') {
    const result = {};

    for (const [key, value] of Object.entries(definitions)) {
        const code = prefix ? `${prefix}.${key}` : key;

        if (isLeaf(value)) {
            // Leaf — create a factory function
            result[key] = (overrides = {}) => {
                const isString = typeof overrides === 'string';
                const message = isString ? overrides : (overrides.message ?? value.message);
                const extra = isString ? {} : overrides;

                return new ObError(message, {
                    code,
                    status: extra.status ?? value.status,
                    level: extra.level ?? value.level ?? 'error',
                    ...extra,
                });
            };
        } else {
            // Branch — recurse
            result[key] = buildErrors(value, code);
        }
    }

    return result;
}

/**
 * A value is a leaf if it has a 'message' string property.
 */
function isLeaf(value) {
    return value !== null
        && typeof value === 'object'
        && typeof value.message === 'string';
}

// ─── loadErrors ───────────────────────────────────────────────────────────────

/**
 * Load and merge shared + service-level errors.json files.
 *
 * Shared errors  : impl/shared/errors.json  (flat, framework-level)
 * Service errors : {serviceDir}/errors.json  (namespaced per module)
 *
 * Service definitions are merged on top of shared ones.
 * Name conflicts: service wins.
 *
 * @param {string|object} serviceRef - absolute directory path OR import.meta object
 * @returns {object} nested error factories
 */
function loadErrors(serviceRef) {
    // Accept import.meta or a plain directory string
    let serviceDir;
    if (typeof serviceRef === 'string') {
        serviceDir = serviceRef;
    } else if (serviceRef?.url) {
        serviceDir = dirname(fileURLToPath(serviceRef.url));
    } else {
        throw new TypeError('[ob-errors] loadErrors: pass a directory path or import.meta');
    }

    const sharedPath = resolve(process.cwd(), 'impl/shared/errors.json');
    const servicePath = resolve(serviceDir, 'errors.json');

    const sharedDefs = existsSync(sharedPath) ? readJSON(sharedPath) : {};
    const serviceDefs = existsSync(servicePath) ? readJSON(servicePath) : {};

    return buildErrors({ ...sharedDefs, ...serviceDefs });
}

function readJSON(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
        throw new Error(`[ob-errors] Failed to parse ${filePath}: ${err.message}`);
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { ObError, buildErrors, loadErrors };
