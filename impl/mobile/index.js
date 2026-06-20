/**
 * impl/mobile/index.js
 * Mobile API portal service definition.
 */

import { run } from 'ob-service';
import { MobilePortal } from '../portals/mobile.js';
import { bootstrap } from '../index.js';

async function start() {
    await run({
        name: 'mobile',
        PortalClass: MobilePortal,
        bootstrap,
    });
}

export { start };
