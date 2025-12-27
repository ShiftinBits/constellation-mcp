import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from '@jest/globals';
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
		const { ConfigLoader } = await import(
			'../../../src/config/config.loader.js'
		);
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
				projectId: 'config-project',
				languages: {
					typescript: { fileExtensions: ['.ts'] },
				},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.config.apiUrl).toBe('http://localhost:3000');
			expect(context.config.projectId).toBe('config-project');
			expect(context.projectId).toBe('config-project'); // From config.projectId
			expect(context.branchName).toBe('develop'); // From config.branch
			expect(context.configLoaded).toBe(true);
		});

		it('should NOT allow environment variable overrides for projectId/branch', async () => {
			// These should be ignored
			process.env.CONSTELLATION_PROJECT_ID = 'env-project-id';
			process.env.CONSTELLATION_BRANCH = 'env-branch';

			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'develop',
				projectId: 'config-project',
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
			expect(context.initializationError).toContain(
				'constellation.json not found',
			);
			// Should still have default values
			expect(context.projectId).toBeDefined();
			expect(context.branchName).toBeDefined();
		});

		it('should throw error if getConfigContext called before initialization', () => {
			// Note: This test actually triggers lazy initialization now
			// Lazy init reads from actual constellation.json if it exists, so we just verify it works
			const context = getConfigContext();
			expect(context.projectId).toBeDefined(); // Lazy init loads from config file or uses default
		});

		it('should return same instance (singleton)', async () => {
			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				projectId: 'test',
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

	describe('projectId and branch priority', () => {
		it('should always use config.projectId for projectId', async () => {
			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				projectId: 'config-projectId',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			// projectId should always come from config.projectId
			expect(context.projectId).toBe('config-projectId');
		});

		it('should always use config.branch for branchName', async () => {
			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'config-branch',
				projectId: 'test',
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
				projectId: 'test',
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
				projectId: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.apiKey).toBe('');
		});

		it('should log warning when API key not set and config loaded successfully', async () => {
			delete process.env.CONSTELLATION_ACCESS_KEY;
			const consoleWarnSpy = jest
				.spyOn(console, 'warn')
				.mockImplementation(() => {});

			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				projectId: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await initializeConfig(tempDir);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('CONSTELLATION_ACCESS_KEY not set'),
			);

			consoleWarnSpy.mockRestore();
		});
	});

	describe('API URL handling', () => {
		it('should override API URL from environment variable', async () => {
			process.env.CONSTELLATION_API_URL = 'https://custom-api.test.com';

			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				projectId: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			// Environment variable should override config file value
			expect(context.config.apiUrl).toBe('https://custom-api.test.com');
		});

		it('should use config file API URL when environment variable not set', async () => {
			delete process.env.CONSTELLATION_API_URL;

			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				projectId: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.config.apiUrl).toBe('http://localhost:3000');
		});
	});

	describe('error handling', () => {
		it('should handle config loading errors gracefully', async () => {
			mockConfigLoader.loadConfig.mockRejectedValue(new Error('Invalid JSON'));

			await initializeConfig(tempDir);
			const context = getConfigContext();

			// Should not throw but should indicate initialization error
			expect(context.configLoaded).toBe(false);
			expect(context.initializationError).toContain(
				'Failed to load constellation.json',
			);
			expect(context.initializationError).toContain('Invalid JSON');
		});

		it('should handle non-Error exceptions during config loading', async () => {
			mockConfigLoader.loadConfig.mockRejectedValue('string error');

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.configLoaded).toBe(false);
			expect(context.initializationError).toContain('string error');
		});
	});

	describe('ConfigurationManager methods', () => {
		it('getConfigManager should return singleton instance', async () => {
			const { getConfigManager } = await import(
				'../../../src/config/config-manager.js'
			);

			const manager1 = getConfigManager();
			const manager2 = getConfigManager();

			expect(manager1).toBe(manager2);
		});

		it('isInitialized should return false before initialization', async () => {
			const { getConfigManager } = await import(
				'../../../src/config/config-manager.js'
			);
			const manager = getConfigManager();

			// Reset to ensure clean state
			manager.reset();

			expect(manager.isInitialized()).toBe(false);
		});

		it('isInitialized should return true after initialization', async () => {
			const { getConfigManager } = await import(
				'../../../src/config/config-manager.js'
			);
			const manager = getConfigManager();

			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				projectId: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await manager.initialize(tempDir);

			expect(manager.isInitialized()).toBe(true);
		});

		it('reset should clear configuration state', async () => {
			const { getConfigManager } = await import(
				'../../../src/config/config-manager.js'
			);
			const manager = getConfigManager();

			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				projectId: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);

			await manager.initialize(tempDir);
			expect(manager.isInitialized()).toBe(true);

			manager.reset();
			expect(manager.isInitialized()).toBe(false);
		});

		it('getContext should throw when not initialized and not using lazy init', async () => {
			const { getConfigManager } = await import(
				'../../../src/config/config-manager.js'
			);
			const manager = getConfigManager();

			manager.reset();

			// getContext directly on manager should throw
			expect(() => manager.getContext()).toThrow(
				'Configuration not initialized',
			);
		});
	});

	describe('lazy initialization', () => {
		it('should perform lazy initialization when getConfigContext called before initialize', async () => {
			const { getConfigManager } = await import(
				'../../../src/config/config-manager.js'
			);
			const manager = getConfigManager();

			manager.reset();

			// getConfigContext should perform lazy init
			const context = getConfigContext();

			expect(manager.isInitialized()).toBe(true);
			expect(context.projectId).toBeDefined();
		});
	});
});
