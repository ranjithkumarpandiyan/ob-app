/**
 * core/ob-bus/loader.js
 * Auto-registers handlers onto the bus from descriptor files.
 *
 * Each *.handlers.js file exports:
 *
 *   export const portals = ['customer', 'mobile'];  // module-level portal assignment
 *
 *   export default ({ bus, logger, cache, config }) => ({  // factory (B)
 *     methodName: {
 *       public:  true,
 *       handler: async(payload, ctx) => { ... }
 *     }
 *   })
 *
 * Plain object export (A) is also supported (no portals, bus-only):
 *   export default { methodName: { handler: async(payload, ctx) => { ... } } }
 *
 * Address derived from file path + key:
 *   impl/modules/users/auth.handlers.js + key 'login'
 *   → bus.register('users.auth.login', handler, true, ['customer', 'mobile'])
 *
 * Usage:
 *   await loadHandlers(bus, { basePath: 'impl/modules', services: { bus, logger, cache, config } })
 */

import { readdirSync, statSync } from 'fs';
import { resolve, relative, join } from 'path';
import { pathToFileURL } from 'url';

/**
 * @param {object}   bus
 * @param {object}   options
 * @param {string}   options.basePath
 * @param {boolean}  options.override
 * @param {object}   options.logger
 * @param {object}   options.services   - { bus, logger, cache, config }
 */
async function loadHandlers(bus, { basePath = 'impl/modules', override = false, logger = console, services = {} } = {}) {
    const absBase = resolve(process.cwd(), basePath);
    const files = scanHandlerFiles(absBase);

    if (files.length === 0) {
        logger.warn(`[ob-bus/loader] No handler files found in: ${basePath}`);
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

        // Module-level portal assignment — read named export
        const portals = Array.isArray(mod.portals) ? mod.portals : [];

        // Resolve descriptor — factory (B) or plain object (A)
        let descriptor;
        if (typeof exported === 'function') {
            const prefix = derivePrefix(absBase, filePath);
            const moduleName = prefix.split('.')[0];
            const moduleLogger = services.logger ? services.logger.get(moduleName) : logger;
            descriptor = exported({ ...services, logger: moduleLogger });
        } else if (typeof exported === 'object') {
            descriptor = exported;
        } else {
            logger.warn(`[ob-bus/loader] Skipping ${filePath} — default export must be an object or factory function`);
            continue;
        }

        if (!descriptor || typeof descriptor !== 'object') {
            logger.warn(`[ob-bus/loader] Skipping ${filePath} — factory returned invalid descriptor`);
            continue;
        }

        const prefix = derivePrefix(absBase, filePath);

        for (const [name, entry] of Object.entries(descriptor)) {
            if (!entry || typeof entry.handler !== 'function') {
                logger.warn(`[ob-bus/loader] Skipping "${name}" in ${filePath} — missing handler function`);
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
 * Derive dot-notation prefix from handler file path.
 * impl/modules/users/auth.handlers.js → 'users.auth'
 */
function derivePrefix(absBase, filePath) {
    const rel = relative(absBase, filePath);
    return rel
        .replace(/\.handlers\.js$/, '')
        .replace(/\\/g, '/')
        .split('/')
        .join('.');
}

/**
 * Recursively find all *.handlers.js files under dir.
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
        } else if (entry.name.endsWith('.handlers.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

export { loadHandlers, derivePrefix, scanHandlerFiles };
