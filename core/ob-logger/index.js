/**
 * ob-logger
 * Named, level-scoped Pino logger.
 *
 * Each call to logger.get(name) returns a Pino child logger whose level is
 * resolved from config at first call:
 *
 *   LOG_LEVEL_<NAME_UPPER>  →  LOG_LEVEL  →  'info' (hardcoded fallback)
 *
 * Examples:
 *   logger.get('users')     reads LOG_LEVEL_USERS     → LOG_LEVEL
 *   logger.get('ob-server') reads LOG_LEVEL_OG_SERVER → LOG_LEVEL
 *
 * Usage:
 *   import logger from 'ob-logger';
 *   const log = logger.get('users');
 *   log.debug({ payload }, 'login attempt');
 *   log.error({ err }, 'login failed');
 *
 * In factories (impl/modules):
 *   export default ({ logger }) => ({ ... })
 *   // logger is already pre-scoped to the module name by the loader
 */

import pino from 'pino';

class OgLogger {
    #root;
    #children = new Map();
    #config = null;

    constructor() {
        this.#root = pino({
            // Root at trace — children filter to their own level
            level: 'trace',
            formatters: {
                level: (label) => ({ level: label }),
            },
        });
    }

    /**
     * Attach ob-config so levels can be read from env.
     * Called once at boot before any get() calls.
     */
    setConfig(config) {
        this.#config = config;
        return this;
    }

    /**
     * Return a named child logger, creating it on first call.
     * Level is resolved from config: LOG_LEVEL_<NAME> → LOG_LEVEL → 'info'
     *
     * @param {string} name - module or service name (e.g. 'users', 'ob-server')
     */
    get(name) {
        if (this.#children.has(name)) {
            return this.#children.get(name);
        }

        const level = this.#resolveLevel(name);
        const child = this.#root.child({ module: name }, { level });
        this.#children.set(name, child);
        return child;
    }

    /**
     * Resolve log level for a named scope.
     * Priority: LOG_LEVEL_<NAME_UPPER> → LOG_LEVEL → 'info'
     *
     * @param {string} name
     * @returns {string}
     */
    #resolveLevel(name) {
        if (!this.#config) {
            return 'info';
        }

        const scopeKey = `LOG_LEVEL_${name.toUpperCase().replace(/-/g, '_')}`;
        return this.#config.get(scopeKey) ?? this.#config.get('LOG_LEVEL') ?? 'info';
    }

    /**
     * Root logger — use only for framework-level boot messages.
     * Prefer get(name) for all application logging.
     */
    get root() {
        return this.#root;
    }
}

const logger = new OgLogger();

export default logger;
export { OgLogger };
