import { includeIgnoreFile } from '@eslint/compat';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gitignorePath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'.gitignore',
);

export default [
	includeIgnoreFile(gitignorePath),
	eslintPluginPrettierRecommended,
	{
		rules: {
			'prettier/prettier': [
				'error',
				{
					endOfLine: 'lf',
					tabWidth: 2,
					useTabs: true,
				},
			],
			// Disable import resolution to avoid the unrs-resolver issue
			'import/no-unresolved': 'off',
			'import/extensions': 'off',
			'perfectionist/sort-objects': 'off',
		},
	},
];
