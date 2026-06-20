/**
 * impl/portals/admin.js
 * Admin portal — extends ObServer with admin-specific configuration.
 *
 * Portal name: 'admin'
 * Only handlers with portals: ['admin'] get HTTP routes here.
 *
 * Typical concerns:
 *   - Strict rate limiting (admin actions are low-volume)
 *   - Internal-only CORS (no public browser access)
 *   - Admin JWT / session auth middleware
 */

import { ObServer } from 'ob-server';

class AdminPortal extends ObServer {
    get portalName() { return 'admin'; }

    // Override to apply admin-specific middleware before routes are mounted
    applyPortalMiddleware() {
        // TODO: add admin auth middleware
        // TODO: restrict CORS to internal origins only
    }
}

export { AdminPortal };
