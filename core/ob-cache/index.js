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

    connect({ url = 'redis://localhost:6379', logger = console, defaultTTL = 300 } = {}) {
        this.#logger = logger;
        this.#defaultTTL = defaultTTL;

        this.#client = new Redis(url, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
        });

        this.#client.on('connect', () =>
            this.#logger.info('[ob-cache] Redis connected')
        );
        this.#client.on('error', (err) =>
            this.#logger.error('[ob-cache] Redis error:', err.message)
        );

        return this;
    }

    // ─── Core operations ────────────────────────────────────────────────────────

    /**
   * Get a cached value. Returns null on miss.
   */
    async get(key) {
        this.#assertConnected();
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
        this.#assertConnected();
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
        this.#assertConnected();
        return this.#client.del(key);
    }

    /**
   * Check if a key exists.
   */
    async has(key) {
        this.#assertConnected();
        return (await this.#client.exists(key)) === 1;
    }

    /**
   * Get remaining TTL for a key in seconds. -1 = no TTL, -2 = not found.
   */
    async ttl(key) {
        this.#assertConnected();
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
        this.#assertConnected();
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
        this.#assertConnected();
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        return this.#client.publish(channel, payload);
    }

    /**
   * Subscribe to a Redis channel.
   * Returns a dedicated subscriber client (ioredis can't mix pub/sub and commands).
   */
    subscribe(channel, handler) {
        this.#assertConnected();
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

    #assertConnected() {
        if (!this.#client) {
            throw new Error('[ob-cache] Not connected. Call cache.connect() first.');
        }
    }
}

const cache = new OgCache();

export default cache;
export { OgCache };
