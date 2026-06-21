import { run } from 'ob-service';
import { MobilePortal } from './portal.js';
import { bootstrap } from './bootstrap.js';

await run({ name: 'mobile', PortalClass: MobilePortal, bootstrap });
