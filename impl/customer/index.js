/**
 * impl/customer/index.js
 * Customer portal service definition.
 */

import { run } from 'ob-service';
import { CustomerPortal } from '../portals/customer.js';
import { bootstrap } from '../index.js';

async function start() {
    await run({
        name: 'customer',
        PortalClass: CustomerPortal,
        bootstrap,
    });
}

export { start };
