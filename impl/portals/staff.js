/**
 * impl/portals/staff.js
 * Staff portal — extends ObServer with staff-specific configuration.
 *
 * Portal name: 'staff'
 * Only handlers with portals: ['staff'] (or ['admin', 'staff']) get HTTP routes here.
 *
 * Typical concerns:
 *   - Staff JWT / role-based auth middleware
 *   - Standard rate limiting
 *   - Internal CORS
 */

import { ObServer } from 'ob-server';

class StaffPortal extends ObServer {
    get portalName() { return 'staff'; }

    applyPortalMiddleware() {
        // TODO: add staff auth middleware
    }
}

export { StaffPortal };
