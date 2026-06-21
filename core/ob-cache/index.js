/**
 * ob-cache
 * Redis-backed cache abstraction. One shared ioredis connection per process.
 *
 * Usage:
 *   import cache from 'ob-cache'
 *
 *   await cache.set('user:123', { name: 'Alice' }, 300)  // TTL in seconds
 *   const user = await cache.get('user:123')
 *   await cache.del('user:123')
 *   await cache.invalidateByPrefix('user:')              // bulk delete
 */

import Redis from 'ioredis';

class OgCache {
    #client = null;
    #logger = console;
    #defaultTTL = 300; // 5 minutes

    connect({ url, logger = console, defaultTTL = 300 } = {}) {
        this.#logger = logger;
        this.#defaultTTL = defaultTTL;

        // Skip Redis entirely if no URL is configured (e.g. local dev without Redis)
        if (!url) {
            this.#logger.warn('[ob-cache] No REDIS_URL configured — cache disabled (no-op mode)');
            return this;
        }

        const MAX_RETRIES = 3;
        let errorLogged = false;

        this.#client = new Redis(url, {
            maxRetriesPerRequest: 0,
            enableReadyCheck: true,
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times >= MAX_RETRIES) { return null; } // triggers 'end' event → no-op
                return Math.min(times * 500, 2000);
            },
        });

        this.#client.on('connect', () => {
            errorLogged = false;
            this.#logger.info('[ob-cache] Redis connected');
        });

        this.#client.on('error', (err) => {
            if (!errorLogged) {
                errorLogged = true;
                this.#logger.warn(`[ob-cache] Redis unavailable — ${err.message}`);
            }
        });

        // Fired when retryStrategy returns null (retries exhausted) — switch to no-op
        this.#client.on('end', () => {
            if (this.#client) {
                this.#logger.warn('[ob-cache] Redis retries exhausted — switching to no-op mode');
                this.#client = null;
            }
        });

        this.#client.connect().catch(() => {
            // Connection errors are surfaced via the 'error' event
        });

        return this;
    }

    // ─── Core operations ────────────────────────────────────────────────────────

    /**
   * Get a cached value. Returns null on miss.
   */
    async get(key) {
        if (!this.#client) { return null; }
        const raw = await this.#client.get(key);
        if (raw === null) {return null;}
        try {
            return JSON.parse(raw);
        } catch {
            return raw; // stored as plain string
        }
    }

    /**
   * Set a value with optional TTL (seconds).
   * Serializes objects to JSON automatically.
   */
    async set(key, value, ttl = this.#defaultTTL) {
        if (!this.#client) { return false; }
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttl > 0) {
            await this.#client.set(key, serialized, 'EX', ttl);
        } else {
            await this.#client.set(key, serialized);
        }
        return true;
    }

    /**
   * Delete a single key.
   */
    async del(key) {
        if (!this.#client) { return 0; }
        return this.#client.del(key);
    }

    /**
   * Check if a key exists.
   */
    async has(key) {
        if (!this.#client) { return false; }
        return (await this.#client.exists(key)) === 1;
    }

    /**
   * Get remaining TTL for a key in seconds. -1 = no TTL, -2 = not found.
   */
    async ttl(key) {
        if (!this.#client) { return -2; }
        return this.#client.ttl(key);
    }

    // ─── Cache-aside helper ─────────────────────────────────────────────────────

    /**
   * get-or-set: return cached value, or call fn(), cache the result, return it.
   *
   *   const user = await cache.remember('user:123', 300, () => db.findUser(123))
   */
    async remember(key, ttl, fn) {
        const cached = await this.get(key);
        if (cached !== null) {return cached;}
        const value = await fn();
        if (value !== null && value !== undefined) {
            await this.set(key, value, ttl);
        }
        return value;
    }

    // ─── Bulk operations ────────────────────────────────────────────────────────

    /**
   * Delete all keys matching a prefix pattern.
   * Uses SCAN to avoid blocking Redis with KEYS on large datasets.
   */
    async invalidateByPrefix(prefix) {
        if (!this.#client) { return 0; }
        let cursor = '0';
        let deleted = 0;
        do {
            /* eslint-disable-next-line no-await-in-loop -- Redis SCAN is cursor-based and must run sequentially */
            const [next, keys] = await this.#client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
            cursor = next;
            if (keys.length) {
                /* eslint-disable-next-line no-await-in-loop -- must follow the SCAN result before next iteration */
                await this.#client.del(...keys);
                deleted += keys.length;
            }
        } while (cursor !== '0');
        this.#logger.info(`[ob-cache] Invalidated ${deleted} key(s) with prefix "${prefix}"`);
        return deleted;
    }

    // ─── Pub/Sub (used by ob-event-bridge for realtime) ─────────────────────────

    /**
   * Publish a message to a Redis channel.
   */
    async publish(channel, message) {
        if (!this.#client) { return 0; }
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        return this.#client.publish(channel, payload);
    }

    /**
   * Subscribe to a Redis channel.
   * Returns a dedicated subscriber client (ioredis can't mix pub/sub and commands).
   */
    subscribe(channel, handler) {
        if (!this.#client) { return null; }
        const subscriber = this.#client.duplicate();
        subscriber.subscribe(channel);
        subscriber.on('message', (_ch, message) => {
            try {
                handler(JSON.parse(message));
            } catch {
                handler(message);
            }
        });
        return subscriber; // caller can call subscriber.quit() to stop
    }

    // ─── Lifecycle ──────────────────────────────────────────────────────────────

    async close() {
        if (this.#client) {
            await this.#client.quit();
            this.#logger.info('[ob-cache] Redis connection closed');
        }
    }

    client() {
        this.#assertConnected();
        return this.#client;
    }

    get connected() {
        return this.#client !== null;
    }

    #assertConnected() {
        if (!this.#client) {
            throw new Error('[ob-cache] Not connected. Call cache.connect() first.');
        }
    }
}

const cache = new OgCache();

export default cache;
export { OgCache };
