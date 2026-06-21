import { run } from 'ob-service';
import { CustomerPortal } from './portal.js';
import { bootstrap } from './bootstrap.js';

await run({ name: 'customer', PortalClass: CustomerPortal, bootstrap });
