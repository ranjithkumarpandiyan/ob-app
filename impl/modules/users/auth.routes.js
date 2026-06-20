/**
 * impl/modules/users/auth.routes.js
 * Example route file — auto-loaded by ob-router.
 * Mounted at: /api/v1/users/auth
 *
 * Routes call the bus rather than service logic directly.
 * This keeps routes thin and all business logic testable via bus.exec().
 */

import { Router } from 'express';
import bus from 'ob-bus';

const router = Router();

// POST /api/v1/users/auth/login
router.post('/login', async(req, res, next) => {
    try {
        const result = await bus.exec('users.auth.login')(req.body, {
            requestId: req.id,
            ip: req.ip,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/users/auth/logout
router.post('/logout', async(req, res, next) => {
    try {
        await bus.exec('users.auth.logout')({}, { requestId: req.id });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
