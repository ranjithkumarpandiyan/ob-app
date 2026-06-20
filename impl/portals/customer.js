/**
 * impl/portals/customer.js
 * Customer portal — extends ObServer with customer-facing configuration.
 *
 * Portal name: 'customer'
 * Only handlers with portals: ['customer'] get HTTP routes here.
 *
 * Typical concerns:
 *   - Public CORS (browser clients)
 *   - Customer JWT auth middleware
 *   - Higher rate limiting thresholds (public-facing)
 */

import { ObServer } from 'ob-server';

class CustomerPortal extends ObServer {
    get portalName() { return 'customer'; }

    applyPortalMiddleware() {
        // TODO: add customer auth middleware
        // TODO: configure public CORS
    }
}

export { CustomerPortal };
