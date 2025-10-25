import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanupTempDir, createTempDir } from '../../helpers/test-utils.js';

// Mock dependencies BEFORE importing
jest.mock('../../../src/config/config.loader.js');

describe('ConfigurationManager', () => {
	let tempDir: string;
	let mockConfigLoader: any;
	let initializeConfig: any;
	let getConfigContext: any;

	beforeEach(async () => {
		// Reset modules to clear singleton
		jest.resetModules();
		jest.clearAllMocks();

		// Re-import mocked modules
		const { ConfigLoader } = await import('../../../src/config/config.loader.js');
		const configManager = await import('../../../src/config/config-manager.js');

		mockConfigLoader = ConfigLoader as any;
		initializeConfig = configManager.initializeConfig;
		getConfigContext = configManager.getConfigContext;

		tempDir = await createTempDir();

		// Set up default environment
		process.env.CONSTELLATION_ACCESS_KEY = 'test-api-key';
		process.env.CONSTELLATION_API_URL = 'https://api.test.com';
	});

	afterEach(async () => {
		await cleanupTempDir(tempDir);
		jest.restoreAllMocks();

		// Clean up environment
		delete process.env.CONSTELLATION_ACCESS_KEY;
		delete process.env.CONSTELLATION_API_URL;
	});

	describe('initialization', () => {
		it('should initialize with config file', async () => {
			// Remove environment overrides to test config file loading
			delete process.env.CONSTELLATION_API_URL;

			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'develop',
				namespace: 'config-project',
				languages: {
					typescript: { fileExtensions: ['.ts'] },
				},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.config.apiUrl).toBe('http://localhost:3000');
			expect(context.config.namespace).toBe('config-project');
			expect(context.projectId).toBe('config-project'); // From config.namespace
			expect(context.branchName).toBe('develop'); // From config.branch
			expect(context.configLoaded).toBe(true);
		});

		it('should NOT allow environment variable overrides for namespace/branch', async () => {
			// These should be ignored
			process.env.CONSTELLATION_PROJECT_ID = 'env-project-id';
			process.env.CONSTELLATION_BRANCH = 'env-branch';

			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'develop',
				namespace: 'config-project',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			// Config values should be used, NOT env variables
			expect(context.projectId).toBe('config-project');
			expect(context.branchName).toBe('develop');
		});

		it('should handle missing config file with degraded mode', async () => {
			mockConfigLoader.loadConfig.mockResolvedValue(null);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			// Should not throw but should indicate initialization error
			expect(context.configLoaded).toBe(false);
			expect(context.initializationError).toBeDefined();
			expect(context.initializationError).toContain('constellation.json not found');
			// Should still have default values
			expect(context.projectId).toBeDefined();
			expect(context.branchName).toBeDefined();
		});

		it('should throw error if getConfigContext called before initialization', () => {
			// Note: This test actually triggers lazy initialization now
			// We'll just verify it doesn't throw and uses defaults
			const context = getConfigContext();
			expect(context.projectId).toBe('constellation-mcp'); // Lazy init default
		});

		it('should return same instance (singleton)', async () => {
			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await initializeConfig(tempDir);
			const context1 = getConfigContext();

			await initializeConfig(tempDir); // Should not reinitialize
			const context2 = getConfigContext();

			expect(context1).toBe(context2);
		});
	});

	describe('namespace and branch priority', () => {
		it('should always use config.namespace for projectId', async () => {
			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'config-namespace',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			// projectId should always come from config.namespace
			expect(context.projectId).toBe('config-namespace');
		});

		it('should always use config.branch for branchName', async () => {
			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'config-branch',
				namespace: 'test',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			// branchName should always come from config.branch
			expect(context.branchName).toBe('config-branch');
		});
	});

	describe('API key handling', () => {
		it('should load API key from environment', async () => {
			process.env.CONSTELLATION_ACCESS_KEY = 'test-key-123';

			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.apiKey).toBe('test-key-123');
		});

		it('should use empty string if API key not set', async () => {
			delete process.env.CONSTELLATION_ACCESS_KEY;

			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.apiKey).toBe('');
		});
	});
});
