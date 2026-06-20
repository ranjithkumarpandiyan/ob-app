/**
 * impl/modules/users/auth.handlers.js
 * Handlers for bus address: users.auth.*
 *
 * Factory pattern — receives framework services, returns descriptor.
 * logger is pre-scoped to 'users' by the loader.
 *
 * Visibility:
 *   public: true  → exposed as HTTP API endpoint via ob-router
 *   (omitted)     → internal bus use only, no HTTP route generated
 *
 * Auto-registered by loadHandlers() as:
 *   users.auth.login      [public]
 *   users.auth.logout     [public]
 *   users.auth.findById   [private]
 */

export const portals = ['customer', 'mobile'];

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
        // private — no HTTP route generated, internal bus use only
        handler: async(payload, _ctx) => {
            const { id } = payload;
            logger.debug({ id }, 'findById');
            // TODO: real DB lookup
            return { id, email: 'stub@example.com' };
        },
    },
});
