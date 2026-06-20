/**
 * impl/worker/index.js
 * Background worker service definition.
 *
 * No HTTP portal — bootstrap loads handlers onto the bus,
 * then registers BullMQ job processors.
 * onShutdown drains the queue before exiting.
 */

import { run } from 'ob-service';
import { getQueue } from 'ob-queue';
import { bootstrap } from '../index.js';

async function start() {
    let queue;

    await run({
        name: 'ob-worker',

        bootstrap: async(services) => {
            // Initialise queue with Redis connection
            queue = getQueue({
                connection: { url: services.config.get('REDIS_URL') },
                logger: services.logger.get('ob-queue'),
            });

            // Load all impl handlers onto the bus (same modules as HTTP portals)
            await bootstrap({ ...services, portal: null });

            // TODO: register job processors here
            // e.g. queue.process('email', 'send', emailWorker)
        },

        onShutdown: async() => {
            if (queue) {
                await queue.close();
            }
        },
    });
}

export { start };
