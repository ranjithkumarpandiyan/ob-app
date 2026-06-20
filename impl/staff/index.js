/**
 * impl/staff/index.js
 * Staff portal service definition.
 */

import { run } from 'ob-service';
import { StaffPortal } from '../portals/staff.js';
import { bootstrap } from '../index.js';

async function start() {
    await run({
        name: 'staff',
        PortalClass: StaffPortal,
        bootstrap,
    });
}

export { start };
