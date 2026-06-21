/**
 * services/mobile/portal.js
 * Mobile portal — extends ObServer for mobile client endpoints.
 * Only handlers with portals: ['mobile'] get HTTP routes here.
 */

import { ObServer } from 'ob-server';

class MobilePortal extends ObServer {
    get portalName() { return 'mobile'; }

    applyPortalMiddleware() {
        // TODO: mobile JWT / refresh token auth
        // TODO: device-based rate limiting
    }
}

export { MobilePortal };
