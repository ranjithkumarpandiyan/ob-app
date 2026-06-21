/**
 * services/customer/modules/users/handlers.js
 * User handlers for the customer portal.
 *
 * Bus addresses registered:
 *   users.login      [public]
 *   users.logout     [public]
 *   users.findById   [private]
 */

export const portals = ['customer'];

export default ({ logger }) => ({
    login: {
        public: true,
        handler: async(payload, _ctx) => {
            const { email, password } = payload;
            logger.debug({ email }, 'login attempt');

            if (!email || !password) {
                const err = new Error('email and password are required');
                err.status = 400;
                throw err;
            }

            // TODO: replace with real DB lookup + bcrypt compare
            logger.info({ email }, 'login success');
            return {
                token: 'stub-jwt-token',
                user: { id: 1, email },
            };
        },
    },

    logout: {
        public: true,
        handler: async(_payload, _ctx) => {
            // TODO: invalidate token in cache
            logger.debug('logout');
            return { success: true };
        },
    },

    findById: {
        handler: async(payload, _ctx) => {
            const { id } = payload;
            logger.debug({ id }, 'findById');
            // TODO: real DB lookup
            return { id, email: 'stub@example.com' };
        },
    },
});
