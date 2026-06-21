/**
 * services/admin/portal.js
 * Admin portal — extends ObServer with admin-specific configuration.
 * Only handlers with portals: ['admin'] get HTTP routes here.
 */

import { ObServer } from 'ob-server';

class AdminPortal extends ObServer {
    get portalName() { return 'admin'; }

    applyPortalMiddleware() {
        // TODO: admin JWT auth middleware
        // TODO: restrict CORS to internal origins only
    }
}

export { AdminPortal };
