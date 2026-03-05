import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import promisePlugin from 'eslint-plugin-promise';

export default [
    {
        files: ['bot/**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: './tsconfig.json',
            },
            globals: {
                console: 'readonly',
                process: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                Buffer: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            'promise': promisePlugin,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            'default-case': 'warn',
            'no-console': 'warn',
            'no-return-await': 'warn',
            'require-await': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-confusing-void-expression': 'error',
            'no-use-before-define': 'error',
            'prefer-const': 'off',
            'no-unused-expressions': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
    },
];
