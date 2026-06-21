/**
 * services/admin/bootstrap.js
 * Loads admin service modules and mounts HTTP routes.
 */

import { loadHandlers } from 'ob-bus/loader.js';
import { loadErrors } from 'ob-errors';

export async function bootstrap({ bus, logger, cache, config }) {
    const errors = loadErrors(import.meta);
    const services = { bus, logger, cache, config, errors };

    await loadHandlers(bus, {
        basePath: 'services/admin/modules',
        services,
        logger: logger.get('loader'),
    });

    await loadHandlers(bus, {
        basePath: 'impl/shared/modules',
        services,
        logger: logger.get('loader'),
    });
}
