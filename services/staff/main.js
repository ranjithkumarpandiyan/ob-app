import { run } from 'ob-service';
import { StaffPortal } from './portal.js';
import { bootstrap } from './bootstrap.js';

await run({ name: 'staff', PortalClass: StaffPortal, bootstrap });
