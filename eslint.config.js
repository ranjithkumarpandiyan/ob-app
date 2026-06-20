import js from '@eslint/js';
import pluginPromise from 'eslint-plugin-promise';
import pluginNode from 'eslint-plugin-n';
import globals from 'globals';

export default [
    js.configs.recommended,
    pluginPromise.configs['flat/recommended'],

    {
        // ── Node.js globals (process, console, setTimeout, etc.) ──────────────
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },

        plugins: {
            n: pluginNode,
        },

        rules: {

            // ── Debugging ──────────────────────────────────────────────────────
            'no-console': 1,
            'no-debugger': 1,
            'no-alert': 1,

            // ── Variables ──────────────────────────────────────────────────────
            'no-var': 2,
            'prefer-const': 2,
            'no-unused-vars': [2, {
                vars: 'all',
                args: 'after-used',
                argsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],
            'no-shadow': 2,
            'no-param-reassign': 2,

            // ── Equality ───────────────────────────────────────────────────────
            'eqeqeq': [2, 'always'],

            // ── Error handling ─────────────────────────────────────────────────
            'no-throw-literal': 2,
            'no-unreachable': 2,
            'no-useless-return': 2,

            // ── Promises ───────────────────────────────────────────────────────
            'promise/catch-or-return': 1,
            'promise/always-return': 1,
            'no-async-promise-executor': 2,
            'no-await-in-loop': 1,

            // ── Process ────────────────────────────────────────────────────────
            'n/no-process-env': 1,
            'no-process-exit': 2,

            // ── Restricted imports ─────────────────────────────────────────────
            'no-restricted-imports': [2, {
                paths: [
                    { name: 'moment', message: 'Use native Date or date-fns instead.' },
                    { name: 'underscore', message: 'Use native ES6+ array/object methods.' },
                    { name: 'lodash', message: 'Use native ES6+ array/object methods.' },
                    { name: 'request', message: 'Use native fetch instead.' },
                    { name: 'superagent', message: 'Use native fetch instead.' },
                    { name: 'nconf', message: 'Use ob-config instead.' },
                ],
                patterns: [
                    {
                        group: ['**/impl/**'],
                        message: 'core/ modules must not import from impl/. Route through ob-bus.',
                    },
                ],
            }],

            // ── Style ──────────────────────────────────────────────────────────
            'indent': [2, 4, { SwitchCase: 1 }],
            'semi': [2, 'always'],
            'no-trailing-spaces': 2,
            'space-before-function-paren': [2, 'never'],
            'no-nested-ternary': 2,
            'no-else-return': 2,
            'object-shorthand': [2, 'always'],
            'prefer-template': 2,
            'prefer-arrow-callback': 2,
            'arrow-body-style': [2, 'as-needed'],
            'dot-notation': 2,
            'curly': [2, 'all'],
            'key-spacing': [2, { beforeColon: false, afterColon: true }],
            'comma-spacing': [2, { before: false, after: true }],
            'no-multi-spaces': 2,
        },
    },

    {
        // ── Service entry points ───────────────────────────────────────────────
        // main.js files bootstrap the process — console and process.exit allowed
        files: ['services/**/main.js'],
        rules: {
            'no-console': 'off',
            'n/no-process-env': 'off',
            'no-process-exit': 'off',
        },
    },

    {
        // ── ob-config — its sole purpose is reading process.env ───────────────
        files: ['core/ob-config/**'],
        rules: {
            'n/no-process-env': 'off',
        },
    },

    {
        // ── ob-server core — shutdown handler legitimately calls process.exit ──
        files: ['core/ob-server/**'],
        rules: {
            'no-process-exit': 'off',
            'n/no-process-env': 'off',
        },
    },

    {
        // ── ob-service — worker shutdown legitimately calls process.exit ────────
        files: ['core/ob-service/**'],
        rules: {
            'no-process-exit': 'off',
        },
    },

    {
        // ── Service entry points may import from impl/ ─────────────────────────
        // services/ wires core infrastructure to impl — this is the intended seam
        files: ['services/**'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },

    {
        ignores: [
            'node_modules/**',
            'coverage/**',
            '**/*.min.js',
        ],
    },
];
