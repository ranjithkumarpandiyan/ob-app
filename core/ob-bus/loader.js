/**
 * core/ob-bus/loader.js
 * Auto-registers handlers onto the bus from handler files.
 *
 * Each module folder contains a handlers.js file:
 *
 *   services/customer/modules/users/handlers.js
 *
 * handlers.js exports:
 *
 *   export const portals = ['customer'];  // portal assignment
 *
 *   export default ({ bus, logger, cache, config }) => ({  // factory
 *     methodName: {
 *       public:  true,
 *       handler: async(payload, ctx) => { ... }
 *     }
 *   })
 *
 * Bus address derived from folder path relative to modules/:
 *   services/customer/modules/users/handlers.js
 *   → prefix: 'users'  → addresses: users.login, users.logout, ...
 *
 * Usage:
 *   await loadHandlers(bus, {
 *     basePath: 'services/customer/modules',
 *     services: { bus, logger, cache, config }
 *   })
 */

import { readdirSync, statSync } from 'fs';
import { resolve, relative, join } from 'path';
import { pathToFileURL } from 'url';

/**
 * @param {object}   bus
 * @param {object}   options
 * @param {string}   options.basePath  - path to modules directory
 * @param {boolean}  options.override  - register as override (replaces existing)
 * @param {object}   options.logger
 * @param {object}   options.services  - { bus, logger, cache, config }
 */
async function loadHandlers(bus, { basePath, override = false, logger = console, services = {} } = {}) {
    const absBase = resolve(process.cwd(), basePath);
    const files = scanHandlerFiles(absBase);

    if (files.length === 0) {
        logger.debug(`[ob-bus/loader] No handlers.js files found in: ${basePath}`);
        return;
    }

    let registered = 0;

    for (const filePath of files) {
        /* eslint-disable-next-line no-await-in-loop -- sequential load prevents duplicate registration races */
        const mod = await import(pathToFileURL(filePath).href);
        const exported = mod.default;

        if (!exported) {
            logger.warn(`[ob-bus/loader] Skipping ${filePath} — no default export`);
            continue;
        }

        // Module-level portal assignment
        const portals = Array.isArray(mod.portals) ? mod.portals : [];

        // Resolve descriptor — factory or plain object
        const prefix = derivePrefix(absBase, filePath);
        let descriptor;

        if (typeof exported === 'function') {
            const moduleName = prefix.split('.')[0];
            const moduleLogger = services.logger ? services.logger.get(moduleName) : logger;
            descriptor = exported({ ...services, logger: moduleLogger });
        } else if (typeof exported === 'object') {
            descriptor = exported;
        } else {
            logger.warn(`[ob-bus/loader] Skipping ${filePath} — default export must be object or factory`);
            continue;
        }

        if (!descriptor || typeof descriptor !== 'object') {
            logger.warn(`[ob-bus/loader] Skipping ${filePath} — factory returned invalid descriptor`);
            continue;
        }

        for (const [name, entry] of Object.entries(descriptor)) {
            if (!entry || typeof entry.handler !== 'function') {
                logger.warn(`[ob-bus/loader] Skipping "${name}" in ${filePath} — missing handler`);
                continue;
            }

            const address = `${prefix}.${name}`;
            const isPublic = entry.public === true && portals.length > 0;
            const visibility = isPublic ? `public [${portals.join(', ')}]` : 'private';

            if (override) {
                bus.override(address, entry.handler, isPublic, portals);
                logger.info(`[ob-bus/loader] ↺ override  [${visibility}]  ${address}`);
            } else {
                bus.register(address, entry.handler, isPublic, portals);
                logger.info(`[ob-bus/loader] ✓ register  [${visibility}]  ${address}`);
            }

            registered++;
        }
    }

    logger.info(`[ob-bus/loader] Loaded ${registered} handler(s) from "${basePath}"`);
}

/**
 * Derive dot-notation prefix from handlers.js file path.
 * services/customer/modules/users/handlers.js → 'users'
 * services/customer/modules/orders/cart/handlers.js → 'orders.cart'
 */
function derivePrefix(absBase, filePath) {
    const rel = relative(absBase, filePath);
    return rel
        .replace(/[/\\]handlers\.js$/, '')
        .replace(/\\/g, '/')
        .split('/')
        .join('.');
}

/**
 * Recursively find all handlers.js files under dir.
 */
function scanHandlerFiles(dir) {
    const results = [];
    if (!statSync(dir, { throwIfNoEntry: false })) {
        return results;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...scanHandlerFiles(fullPath));
        } else if (entry.name === 'handlers.js') {
            results.push(fullPath);
        }
    }
    return results;
}

export { loadHandlers, derivePrefix, scanHandlerFiles };
