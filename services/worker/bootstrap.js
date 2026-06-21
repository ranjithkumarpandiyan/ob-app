/**
 * services/worker/bootstrap.js
 * Loads worker modules and registers BullMQ job processors.
 */

import { loadHandlers } from 'ob-bus/loader.js';
import { loadErrors } from 'ob-errors';
import { getQueue } from 'ob-queue';

let queue;

export async function bootstrap({ bus, logger, cache, config }) {
    const errors = loadErrors(import.meta);
    const services = { bus, logger, cache, config, errors };

    queue = getQueue({
        connection: { url: config.get('REDIS_URL') },
        logger: logger.get('ob-queue'),
    });

    await loadHandlers(bus, {
        basePath: 'services/worker/modules',
        services,
        logger: logger.get('loader'),
    });

    await loadHandlers(bus, {
        basePath: 'impl/shared/modules',
        services,
        logger: logger.get('loader'),
    });

    // TODO: register job processors
    // queue.process('email', 'send', emailProcessor)
}

export async function onShutdown() {
    if (queue) {
        await queue.close();
    }
}
