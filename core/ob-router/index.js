/**
 * ob-router
 * Auto-generates Express routes from bus.listByPortal(portalName).
 *
 * No manual *.routes.js files needed. Routes are derived directly from
 * handler addresses registered on the bus with public: true and a portal assignment.
 *
 * Address → HTTP route:
 *   'users.auth.login'      → POST /api/v1/users/auth/login
 *   'payments.charge.run'   → POST /api/v1/payments/charge/run
 *
 * Usage:
 *   import { mountRoutes } from 'ob-router'
 *   mountRoutes(app, bus, { portalName: 'customer', version: 1, logger })
 */

import express from 'express';
import cache from 'ob-cache';
import { createCtx } from 'ob-utils';

/**
 * Generate and mount Express routes for all public handlers assigned to portalName.
 *
 * @param {object} app         - Express app instance
 * @param {object} bus         - ob-bus singleton
 * @param {object} options
 * @param {string} options.portalName  - e.g. 'admin', 'customer', 'mobile'
 * @param {number} options.version     - API version (default: 1)
 * @param {object} options.logger
 */
function mountRoutes(app, bus, { portalName, version = 1, logger = console } = {}) {
    if (!portalName) {
        throw new Error('[ob-router] portalName is required');
    }

    const prefix = `/api/v${version}`;
    const addresses = bus.listByPortal(portalName);

    if (addresses.length === 0) {
        logger.warn(`[ob-router] No public handlers found for portal: ${portalName}`);
        return;
    }

    // Group addresses by module prefix to mount one router per module
    const byModule = groupByModule(addresses);

    for (const [modulePath, moduleAddresses] of Object.entries(byModule)) {
        const router = express.Router();

        for (const address of moduleAddresses) {
            const method = address.split('.').at(-1);
            const routePath = `/${method}`;

            router.post(routePath, async(req, res, next) => {
                try {
                    const payload = { ...req.body, ...req.params, ...req.query };
                    const ctx = createCtx(req, { portalName, cache });
                    const result = await bus.exec(address)(payload, ctx);
                    res.json({ ok: true, data: result });
                } catch (err) {
                    next(err);
                }
            });

            logger.info(`[ob-router] POST ${prefix}/${modulePath}/${method}  →  ${address}`);
        }

        app.use(`${prefix}/${modulePath}`, router);
    }

    logger.info(`[ob-router] Mounted ${addresses.length} route(s) for portal: ${portalName}`);
}

/**
 * Group addresses by their module path (everything except the last segment).
 *
 * 'users.auth.login'    → module: 'users/auth',  method: 'login'
 * 'payments.charge.run' → module: 'payments/charge', method: 'run'
 *
 * @param {string[]} addresses
 * @returns {Record<string, string[]>}
 */
function groupByModule(addresses) {
    const groups = {};
    for (const address of addresses) {
        const parts = address.split('.');
        const modulePath = parts.slice(0, -1).join('/');
        if (!groups[modulePath]) {
            groups[modulePath] = [];
        }
        groups[modulePath].push(address);
    }
    return groups;
}

export { mountRoutes, groupByModule };
