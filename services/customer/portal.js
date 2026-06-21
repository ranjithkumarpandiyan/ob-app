/**
 * services/customer/portal.js
 * Customer portal — extends ObServer with customer-facing configuration.
 * Only handlers with portals: ['customer'] get HTTP routes here.
 */

import { ObServer } from 'ob-server';

class CustomerPortal extends ObServer {
    get portalName() { return 'customer'; }

    applyPortalMiddleware() {
        // TODO: customer JWT auth middleware
        // TODO: public CORS
    }
}

export { CustomerPortal };
