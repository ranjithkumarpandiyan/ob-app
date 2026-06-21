/**
 * ob-config
 * Three-layer configuration loader.
 *
 * Priority (lowest → highest):
 *   1. config.json[serviceName]     — project defaults (committed, no secrets)
 *   2. ~/.config/ob/ob_{proj}_{env} — user profile file (secrets, never committed)
 *   3. process.env                  — K8s / CI always wins
 *
 * Profile file resolution (first found wins):
 *   ~/.config/ob/ob_{projectname}_{env}.json
 *   ~/.config/ob/ob_{projectname}_{env}.rc
 *   ~/.config/ob/ob_{env}.json              ← fallback if no project name
 *   ~/.config/ob/ob_{env}.rc
 *
 * Env names: dev | test | uat | prod  (read from OB_ENV, or mapped from NODE_ENV)
 * Project name: from root package.json "name", special chars stripped, lowercased.
 *
 * Usage:
 *   import config from 'ob-config'
 *   config.load('customer')
 *   config.get('PORT')        // → '3000'
 *   config.get('REDIS_URL')
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';

// ── Env name resolution ────────────────────────────────────────────────────────

const ENV_MAP = {
    development: 'dev',
    test: 'test',
    staging: 'uat',
    production: 'prod',
};

function resolveEnv() {
    if (process.env.OB_ENV) {
        return process.env.OB_ENV;
    }
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    return ENV_MAP[nodeEnv] ?? nodeEnv;
}

// ── Project name resolution ────────────────────────────────────────────────────

function resolveProjectName() {
    try {
        const pkgPath = resolve(process.cwd(), 'package.json');
        if (!existsSync(pkgPath)) {return null;}
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (!pkg.name) {return null;}
        // Strip all non-alphanumeric chars, lowercase
        return pkg.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    } catch {
        return null;
    }
}

// ── Profile file loader ────────────────────────────────────────────────────────

/**
 * Parse a .rc (KEY=VALUE) file into a plain object.
 */
function parseRc(content) {
    const result = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {continue;}
        const eq = trimmed.indexOf('=');
        if (eq === -1) {continue;}
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        result[key] = val;
    }
    return result;
}

/**
 * Find and parse the user profile file.
 * Returns a flat key/value object or {} if no file found.
 */
function loadProfileFile(projectName, env) {
    const dir = join(homedir(), '.config', 'ob');
    const candidates = projectName
        ? [
            join(dir, `ob_${projectName}_${env}.json`),
            join(dir, `ob_${projectName}_${env}.rc`),
            join(dir, `ob_${env}.json`),
            join(dir, `ob_${env}.rc`),
        ]
        : [
            join(dir, `ob_${env}.json`),
            join(dir, `ob_${env}.rc`),
        ];

    for (const candidate of candidates) {
        if (!existsSync(candidate)) {continue;}
        const content = readFileSync(candidate, 'utf-8');
        const parsed = candidate.endsWith('.json')
            ? JSON.parse(content)
            : parseRc(content);
        return { parsed, path: candidate };
    }
    return { parsed: {}, path: null };
}

// ── Config class ──────────────────────────────────────────────────────────────

class ObConfig {
    #store = {};
    #schema = {};

    /**
     * define(schema)
     * Register keys with optional defaults and descriptions.
     *
     * schema: { KEY: { required: true, default: 'value', description: '...' } }
     */
    define(schema) {
        this.#schema = { ...this.#schema, ...schema };
        return this;
    }

    /**
     * load(serviceName?)
     * Merges all three config layers, validates schema, builds the store.
     * Call once at boot via ob-service.run().
     */
    load(serviceName = null) {
        const env = resolveEnv();
        const projectName = resolveProjectName();

        // ── Layer 1: config.json[serviceName] ─────────────────────────────────
        const projectConfigPath = resolve(process.cwd(), 'config.json');
        const projectDefaults = {};
        if (existsSync(projectConfigPath)) {
            const all = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
            if (serviceName && all[serviceName]) {
                // Map known keys: port → PORT, logLevel → LOG_LEVEL
                const svc = all[serviceName];
                if (svc.port !== undefined) {projectDefaults.PORT = String(svc.port);}
                if (svc.logLevel !== undefined) {projectDefaults.LOG_LEVEL = svc.logLevel;}
            }
        }

        // ── Layer 2: user profile file ────────────────────────────────────────
        const { parsed: profileVars, path: profilePath } = loadProfileFile(projectName, env);

        // ── Layer 3: process.env (always wins) ───────────────────────────────
        // Merge: project defaults ← profile ← process.env
        const merged = { ...projectDefaults, ...profileVars, ...process.env };

        // ── Build store from schema ───────────────────────────────────────────
        const errors = [];
        for (const [key, meta] of Object.entries(this.#schema)) {
            const val = merged[key] ?? meta.default;
            if (meta.required && (val === undefined || val === '')) {
                errors.push(`  Missing: ${key}${meta.description ? ` — ${meta.description}` : ''}`);
            } else {
                this.#store[key] = val;
            }
        }

        if (errors.length) {
            throw new Error(`[ob-config] Configuration errors:\n${errors.join('\n')}`);
        }

        // Store env + profile path for diagnostics
        this.#store.OB_ENV = env;
        if (profilePath) {
            this.#store._PROFILE = profilePath;
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

const config = new ObConfig();

// Default schema — shared across all services
config.define({
    NODE_ENV: { required: false, default: 'development', description: 'Runtime environment' },
    PORT: { required: false, default: '3000', description: 'HTTP listen port' },
    REDIS_URL: { required: false, default: 'redis://localhost:6379', description: 'Redis connection URL' },
    LOG_LEVEL: { required: false, default: 'info', description: 'Pino log level' },
});

export default config;
