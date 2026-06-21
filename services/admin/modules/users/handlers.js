/**
 * services/admin/modules/users/handlers.js
 * User management handlers for the admin portal.
 *
 * Bus addresses registered:
 *   users.list      [public]
 *   users.disable   [public]
 */

export const portals = ['admin'];

export default ({ logger }) => ({
    list: {
        public: true,
        handler: async(_payload, _ctx) => {
            logger.debug('list users');
            // TODO: real DB query with pagination
            return { users: [], total: 0 };
        },
    },

    disable: {
        public: true,
        handler: async(payload, _ctx) => {
            const { id } = payload;
            logger.info({ id }, 'disable user');
            // TODO: update DB + invalidate user sessions in cache
            return { success: true };
        },
    },
});
