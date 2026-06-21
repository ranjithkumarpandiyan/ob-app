import { run } from 'ob-service';
import { AdminPortal } from './portal.js';
import { bootstrap } from './bootstrap.js';

await run({ name: 'admin', PortalClass: AdminPortal, bootstrap });
