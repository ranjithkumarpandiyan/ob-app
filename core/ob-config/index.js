/**
 * ob-config
 * Loads environment variables and validates required keys at boot.
 * Throws immediately if any required key is missing — fail fast, never run misconfigured.
 *
 * Usage:
 *   import config from 'ob-config'
 *   config.get('REDIS_URL')
 *   config.getAll()
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

class OgConfig {
    #store = {};
    #schema = {};

    /**
   * define(schema)
   * Register required/optional keys with defaults and descriptions.
   *
   * schema: {
   *   KEY_NAME: { required: true, default: 'value', description: '...' }
   * }
   */
    define(schema) {
        this.#schema = { ...this.#schema, ...schema };
        return this;
    }

    /**
   * load(envPath?)
   * Parse .env file if present, then read process.env, then validate schema.
   */
    load(envPath = resolve(process.cwd(), '.env')) {
    // load .env manually (no dotenv dep needed, but supports it if present)
        if (existsSync(envPath)) {
            const lines = readFileSync(envPath, 'utf-8').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {continue;}
                const eq = trimmed.indexOf('=');
                if (eq === -1) {continue;}
                const key = trimmed.slice(0, eq).trim();
                const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
                // process.env takes precedence over .env file
                if (process.env[key] === undefined) {
                    process.env[key] = val;
                }
            }
        }

        // Build store from process.env + schema defaults
        const errors = [];
        for (const [key, meta] of Object.entries(this.#schema)) {
            const val = process.env[key] ?? meta.default;
            if (meta.required && (val === undefined || val === '')) {
                errors.push(`  Missing required env var: ${key}${meta.description ? ` — ${meta.description}` : ''}`);
            } else {
                this.#store[key] = val;
            }
        }

        if (errors.length) {
            throw new Error(`[ob-config] Configuration errors:\n${errors.join('\n')}`);
        }

        return this;
    }

    get(key) {
        return this.#store[key] ?? process.env[key];
    }

    getAll() {
        return { ...this.#store };
    }
}

const config = new OgConfig();

// Default schema — all services share these base keys
config.define({
    NODE_ENV: { required: false, default: 'development', description: 'Runtime environment' },
    PORT: { required: false, default: '3000', description: 'HTTP listen port' },
    REDIS_URL: { required: false, default: 'redis://localhost:6379', description: 'Redis connection URL' },
    LOG_LEVEL: { required: false, default: 'info', description: 'Pino log level' },
});

export default config;
