/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src', '<rootDir>/test'],
	testMatch: ['**/*.test.ts', '**/*.spec.ts'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/index.ts', // MCP server entry point (uses import.meta.url)
		'!src/code-mode/worker-path.ts', // Isolated import.meta.url (SB-258)
		'!src/code-mode/sandbox-worker.ts', // Child process entry point (SB-258, tested via IPC mocks)
		'!src/types/**', // Type definitions
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 70,
			lines: 70,
			statements: 70,
		},
	},
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@test/(.*)$': '<rootDir>/test/$1',
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
	testTimeout: 10000,
	verbose: true,
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
			},
		],
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
	extensionsToTreatAsEsm: ['.ts'],
	modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
