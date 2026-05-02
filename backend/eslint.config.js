import globals from 'globals';
import js      from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'module',
            globals: {
                ...globals.node,  // ← replaces env: { node: true }
            },
        },
        rules: {
            'no-unused-vars': ['warn', {
                argsIgnorePattern:  '^_',  // ignore _prefixed args
                varsIgnorePattern:  '^_',  // ignore _prefixed vars
            }],
            'no-undef': 'error',
        },
    },
];