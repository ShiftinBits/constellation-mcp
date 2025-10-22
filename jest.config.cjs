/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src', '<rootDir>/test'],
	testMatch: ['**/*.test.ts', '**/*.spec.ts'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/index.ts', // MCP server entry point
		'!src/types/**', // Type definitions
		'!src/tools/ConfigInfoTool.ts', // Example tool
		'!src/tools/ExampleTool.ts', // Example tool
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
	},
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@test/(.*)$': '<rootDir>/test/$1',
		'^(\\.{1,2}/.*)\\.js$': '$1',
		'^mcp-framework$': '<rootDir>/test/__mocks__/mcp-framework.js',
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
	transformIgnorePatterns: ['node_modules/(?!mcp-framework)'],
	modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
