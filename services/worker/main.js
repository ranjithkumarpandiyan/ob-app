import { run } from 'ob-service';
import { bootstrap, onShutdown } from './bootstrap.js';

await run({ name: 'worker', bootstrap, onShutdown });
