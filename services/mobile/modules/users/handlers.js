/**
 * services/mobile/modules/users/handlers.js
 * User handlers for the mobile portal.
 *
 * Bus addresses registered:
 *   users.login    [public]
 *   users.logout   [public]
 */

export const portals = ['mobile'];

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

            // TODO: real DB lookup + bcrypt compare
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
            logger.debug('logout');
            return { success: true };
        },
    },
});
