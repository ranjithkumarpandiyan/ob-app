/**
 * services/staff/portal.js
 * Staff portal — extends ObServer with staff-specific configuration.
 * Only handlers with portals: ['staff'] get HTTP routes here.
 */

import { ObServer } from 'ob-server';

class StaffPortal extends ObServer {
    get portalName() { return 'staff'; }

    applyPortalMiddleware() {
        // TODO: staff JWT / role-based auth middleware
        // TODO: internal CORS
    }
}

export { StaffPortal };
