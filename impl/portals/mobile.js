/**
 * impl/portals/mobile.js
 * Mobile API portal — extends ObServer for mobile client endpoints.
 *
 * Portal name: 'mobile'
 * Only handlers with portals: ['mobile'] get HTTP routes here.
 *
 * Typical concerns:
 *   - Mobile JWT / refresh token auth
 *   - Aggressive rate limiting per device
 *   - Optimised response payloads (smaller, versioned)
 */

import { ObServer } from 'ob-server';

class MobilePortal extends ObServer {
    get portalName() { return 'mobile'; }

    applyPortalMiddleware() {
        // TODO: add mobile auth middleware
        // TODO: add device-based rate limiting
    }
}

export { MobilePortal };
