/**
 * ob-bus
 * Central command bus. The single communication channel across all modules.
 *
 * Address format:  'service.module.method'
 *   service  — bounded context (users, orders, notifications …)
 *   module   — feature area within that context (auth, payment …)
 *   method   — specific action (login, process, send …)
 *
 * Usage:
 *   // Register a handler
 *   bus.register('users.auth.login', handler, { isPublic: true, portals: ['customer', 'mobile'] })
 *
 *   // Execute from anywhere
 *   const result = await bus.exec('users.auth.login')({ email, password })
 *
 * Middleware runs on every exec call (logging, tracing, auth, etc.)
 *   bus.use(async (address, payload, ctx, next) => { ... return next() })
 */

class OgBus {
    #handlers = new Map();
    #visibility = new Map(); // address → boolean (public)
    #portals = new Map(); // address → string[] (portal names)
    #middleware = [];
    #transport = null;

    // ─── Registration ──────────────────────────────────────────────────────────

    /**
     * Register a handler for an address.
     * Throws if the same address is registered twice (catches typos early).
     *
     * @param {string}   address          - bus address e.g. 'users.auth.login'
     * @param {Function} handler          - async handler function
     * @param {boolean}  isPublic         - true = callable from HTTP routes
     * @param {string[]} portals          - portal names this handler is exposed to
     */
    register(address, handler, isPublic = false, portals = []) {
        if (this.#handlers.has(address)) {
            throw new Error(`[ob-bus] Handler already registered: "${address}"`);
        }
        if (typeof handler !== 'function') {
            throw new Error(`[ob-bus] Handler must be a function: "${address}"`);
        }
        this.#handlers.set(address, handler);
        this.#visibility.set(address, Boolean(isPublic));
        this.#portals.set(address, portals);
        return this;
    }

    /**
     * Override an existing handler (used by impl/overrides/).
     * Silently replaces. Preserves portals/visibility if not explicitly passed.
     */
    override(address, handler, isPublic, portals) {
        if (typeof handler !== 'function') {
            throw new Error(`[ob-bus] Handler must be a function: "${address}"`);
        }
        this.#handlers.set(address, handler);
        if (isPublic !== undefined) {
            this.#visibility.set(address, Boolean(isPublic));
        } else if (!this.#visibility.has(address)) {
            this.#visibility.set(address, false);
        }
        if (portals !== undefined) {
            this.#portals.set(address, portals);
        } else if (!this.#portals.has(address)) {
            this.#portals.set(address, []);
        }
        return this;
    }

    /**
     * Unregister a handler (useful in tests).
     */
    unregister(address) {
        this.#handlers.delete(address);
        this.#visibility.delete(address);
        this.#portals.delete(address);
        return this;
    }

    // ─── Middleware ─────────────────────────────────────────────────────────────

    /**
     * Add a middleware function.
     * Middleware signature: async (address, payload, ctx, next) => any
     */
    use(fn) {
        this.#middleware.push(fn);
        return this;
    }

    // ─── Execution ──────────────────────────────────────────────────────────────

    /**
     * Execute a registered handler.
     *   bus.exec('users.auth.login')({ email, password })
     */
    exec(address) {
        return async(payload = {}, ctx = {}) => {
            const dispatch = async() => this.#dispatch(address, payload, ctx);
            const chain = this.#middleware.reduceRight(
                (next, mw) => () => mw(address, payload, ctx, next),
                dispatch
            );
            return chain();
        };
    }

    async #dispatch(address, payload, ctx) {
        if (this.#handlers.has(address)) {
            return this.#handlers.get(address)(payload, ctx);
        }
        if (this.#transport) {
            return this.#transport.call(address, payload, ctx);
        }
        throw new Error(`[ob-bus] No handler registered for: "${address}"`);
    }

    // ─── Transport ──────────────────────────────────────────────────────────────

    setTransport(transport) {
        this.#transport = transport;
        return this;
    }

    // ─── Introspection ──────────────────────────────────────────────────────────

    /** All registered addresses */
    list() {
        return [...this.#handlers.keys()];
    }

    /** Public addresses exposed to at least one portal */
    listPublic() {
        return [...this.#visibility.entries()]
            .filter(([, pub]) => pub)
            .map(([address]) => address);
    }

    /** Private addresses (bus only) */
    listPrivate() {
        return [...this.#visibility.entries()]
            .filter(([, pub]) => !pub)
            .map(([address]) => address);
    }

    /**
     * Public addresses exposed to a specific portal.
     * Used by ob-router to generate routes per portal.
     *
     * @param {string} portalName - e.g. 'admin', 'customer', 'mobile'
     * @returns {string[]}
     */
    listByPortal(portalName) {
        return [...this.#handlers.keys()].filter((address) => {
            if (!this.#visibility.get(address)) {return false;}
            const portals = this.#portals.get(address) ?? [];
            return portals.includes(portalName);
        });
    }

    /** Portals assigned to an address */
    getPortals(address) {
        return this.#portals.get(address) ?? [];
    }

    has(address) {
        return this.#handlers.has(address);
    }

    isPublic(address) {
        return this.#visibility.get(address) === true;
    }

    isPrivate(address) {
        return this.#visibility.get(address) !== true;
    }
}

const bus = new OgBus();

export default bus;
export { OgBus };
