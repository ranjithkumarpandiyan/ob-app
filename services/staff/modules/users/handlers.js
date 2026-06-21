/**
 * services/staff/modules/users/handlers.js
 * User handlers for the staff portal.
 *
 * Bus addresses registered:
 *   users.login   [public]
 *   users.logout  [public]
 */

export const portals = ['staff'];

export default ({ logger }) => ({
    login: {
        public: true,
        handler: async(payload, _ctx) => {
            const { email, password } = payload;
            logger.debug({ email }, 'staff login attempt');

            if (!email || !password) {
                const err = new Error('email and password are required');
                err.status = 400;
                throw err;
            }

            // TODO: real DB lookup with role check
            logger.info({ email }, 'staff login success');
            return {
                token: 'stub-staff-jwt-token',
                user: { id: 1, email, role: 'staff' },
            };
        },
    },

    logout: {
        public: true,
        handler: async(_payload, _ctx) => {
            logger.debug('staff logout');
            return { success: true };
        },
    },
});
