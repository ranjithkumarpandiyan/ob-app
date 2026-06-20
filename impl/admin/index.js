/**
 * impl/admin/index.js
 * Admin portal service definition.
 *
 * Declares what ob-service needs to boot the admin portal:
 *   - which portal class to use
 *   - the shared bootstrap (loads all impl modules)
 */

import { run } from 'ob-service';
import { AdminPortal } from '../portals/admin.js';
import { bootstrap } from '../index.js';

async function start() {
    await run({
        name: 'admin',
        PortalClass: AdminPortal,
        bootstrap,
    });
}

export { start };
