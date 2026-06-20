/**
 * impl/index.js
 * Application bootstrap — owns all module loading and route mounting.
 *
 * Services call bootstrap() with their portal instance.
 * This is the only place that knows about impl/modules and impl/overrides.
 *
 * Boot order:
 *   1. Load impl/modules  — all handlers onto the bus
 *   2. Load impl/overrides — selective handler replacements
 *   3. Mount HTTP routes  — only for handlers assigned to this portal
 */

import { loadHandlers } from 'ob-bus/loader.js';
import { mountRoutes } from 'ob-router';
import middleware from 'ob-middleware';

/**
 * Bootstrap the application for a given portal.
 *
 * @param {object}   options
 * @param {object}   options.portal   - portal instance (extends ObServer), or null for worker
 * @param {object}   options.bus      - ob-bus singleton
 * @param {object}   options.logger   - ob-logger singleton
 * @param {object}   options.cache    - ob-cache singleton
 * @param {object}   options.config   - ob-config singleton
 */
async function bootstrap({ portal = null, bus, logger, cache, config }) {
    const services = { bus, logger, cache, config };
    const loaderLog = logger.get('loader');

    // ── Load all handlers onto the bus ────────────────────────────────────────
    await loadHandlers(bus, {
        basePath: 'impl/modules',
        services,
        logger: loaderLog,
    });

    await loadHandlers(bus, {
        basePath: 'impl/overrides',
        override: true,
        services,
        logger: loaderLog,
    });

    // ── Mount HTTP routes (portal servers only) ───────────────────────────────
    if (portal && portal.portalName) {
        const routerLog = logger.get('ob-router');
        middleware.applyTo(portal.app);
        mountRoutes(portal.app, bus, { portalName: portal.portalName, logger: routerLog });
        middleware.applyTailTo(portal.app);
    }
}

export { bootstrap };
