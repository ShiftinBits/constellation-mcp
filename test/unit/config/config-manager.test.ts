import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createTempDir, cleanupTempDir, createMockGitRepo } from '../../helpers/test-utils.js';

// Mock dependencies BEFORE importing
jest.mock('../../../src/config/config.loader.js');
jest.mock('../../../src/utils/git-utils.js');

describe('ConfigurationManager', () => {
	let tempDir: string;
	let mockConfigLoader: any;
	let mockGetGitInfo: any;
	let initializeConfig: any;
	let getConfigContext: any;

	beforeEach(async () => {
		// Reset modules to clear singleton
		jest.resetModules();
		jest.clearAllMocks();

		// Re-import mocked modules
		const { ConfigLoader } = await import('../../../src/config/config.loader.js');
		const { getGitInfo } = await import('../../../src/utils/git-utils.js');
		const configManager = await import('../../../src/config/config-manager.js');

		mockConfigLoader = ConfigLoader as any;
		mockGetGitInfo = getGitInfo as any;
		initializeConfig = configManager.initializeConfig;
		getConfigContext = configManager.getConfigContext;

		tempDir = await createTempDir();

		// Set up default environment
		process.env.CONSTELLATION_API_KEY = 'test-api-key';
		process.env.CONSTELLATION_API_URL = 'https://api.test.com';
	});

	afterEach(async () => {
		await cleanupTempDir(tempDir);
		jest.restoreAllMocks();

		// Clean up environment
		delete process.env.CONSTELLATION_API_KEY;
		delete process.env.CONSTELLATION_API_URL;
		delete process.env.CONSTELLATION_PROJECT_ID;
		delete process.env.CONSTELLATION_BRANCH;
	});

	describe('initialization', () => {
		it('should initialize with config file and git detection', async () => {
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
			mockGetGitInfo.mockResolvedValue({
				isRepo: true,
				branch: 'main',
				remoteUrl: 'git@github.com:user/repo.git',
				projectId: 'github.com/user/repo',
				rootDir: tempDir,
			});

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.config.apiUrl).toBe('http://localhost:3000');
			expect(context.config.namespace).toBe('config-project');
			expect(context.projectId).toBe('github.com/user/repo');
			expect(context.branchName).toBe('main'); // Git takes precedence
			expect(context.configLoaded).toBe(true);
			expect(context.isGitRepo).toBe(true);
		});

		it('should use environment variable overrides', async () => {
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
			mockGetGitInfo.mockResolvedValue({
				isRepo: true,
				branch: 'main',
				remoteUrl: 'git@github.com:user/repo.git',
				projectId: 'github.com/user/repo',
				rootDir: tempDir,
			});

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.projectId).toBe('env-project-id');
			expect(context.branchName).toBe('env-branch');
		});

		it('should handle missing config file gracefully', async () => {
			mockConfigLoader.loadConfig.mockRejectedValue(new Error('Config not found'));
			mockGetGitInfo.mockResolvedValue({
				isRepo: true,
				branch: 'main',
				remoteUrl: 'git@github.com:user/repo.git',
				projectId: 'github.com/user/repo',
				rootDir: tempDir,
			});

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.configLoaded).toBe(false);
			expect(context.config).toMatchObject({
				apiUrl: 'https://api.test.com', // From environment
			});
		});

		it('should handle non-git directory', async () => {
			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'my-project',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);
			mockGetGitInfo.mockResolvedValue({
				isRepo: false,
				branch: null,
				remoteUrl: null,
				projectId: null,
				rootDir: tempDir,
			});

			await initializeConfig(tempDir);
			const context = getConfigContext();

			expect(context.isGitRepo).toBe(false);
			expect(context.projectId).toBe('my-project'); // Falls back to namespace
			expect(context.branchName).toBe('main'); // From config
		});

		it('should throw error if not initialized', () => {
			expect(() => getConfigContext()).toThrow('Configuration not initialized');
		});

		it('should return same instance (singleton)', async () => {
			mockConfigLoader.loadConfig.mockResolvedValue({
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'test',
				languages: {},
				validate: jest.fn(),
			} as any);
			mockGetGitInfo.mockResolvedValue({
				isRepo: false,
				branch: null,
				remoteUrl: null,
				projectId: null,
				rootDir: tempDir,
			});

			await initializeConfig(tempDir);
			const context1 = getConfigContext();

			await initializeConfig(tempDir); // Should not reinitialize
			const context2 = getConfigContext();

			expect(context1).toBe(context2);
		});
	});


	describe('priority order', () => {
		it('should prioritize git over config for project ID', async () => {
			// Config has namespace
			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'config-namespace',
				languages: {},
				validate: jest.fn(),
			};

			// Git has project ID
			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);
			mockGetGitInfo.mockResolvedValue({
				isRepo: true,
				branch: 'main',
				remoteUrl: 'git@github.com:user/repo.git',
				projectId: 'github.com/user/repo',
				rootDir: tempDir,
			});

			// Git should override config
			await initializeConfig(tempDir);
			const context = getConfigContext();
			expect(context.projectId).toBe('github.com/user/repo');
		});

		it('should prioritize env over git for project ID', async () => {
			// Set environment variable
			process.env.CONSTELLATION_PROJECT_ID = 'env-project-id';

			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				namespace: 'config-namespace',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);
			mockGetGitInfo.mockResolvedValue({
				isRepo: true,
				branch: 'main',
				remoteUrl: 'git@github.com:user/repo.git',
				projectId: 'github.com/user/repo',
				rootDir: tempDir,
			});

			// Env should override git
			await initializeConfig(tempDir);
			const context = getConfigContext();
			expect(context.projectId).toBe('env-project-id');
		});

		it('should prioritize git over config for branch', async () => {
			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'config-branch',
				namespace: 'test',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);
			mockGetGitInfo.mockResolvedValue({
				isRepo: true,
				branch: 'git-branch',
				remoteUrl: 'git@github.com:user/repo.git',
				projectId: 'github.com/user/repo',
				rootDir: tempDir,
			});

			// Git should override config
			await initializeConfig(tempDir);
			const context = getConfigContext();
			expect(context.branchName).toBe('git-branch');
		});

		it('should prioritize env over git for branch', async () => {
			process.env.CONSTELLATION_BRANCH = 'env-branch';

			const mockConfig = {
				apiUrl: 'http://localhost:3000',
				branch: 'config-branch',
				namespace: 'test',
				languages: {},
				validate: jest.fn(),
			};

			mockConfigLoader.loadConfig.mockResolvedValue(mockConfig as any);
			mockGetGitInfo.mockResolvedValue({
				isRepo: true,
				branch: 'git-branch',
				remoteUrl: 'git@github.com:user/repo.git',
				projectId: 'github.com/user/repo',
				rootDir: tempDir,
			});

			// Env should override git
			await initializeConfig(tempDir);
			const context = getConfigContext();
			expect(context.branchName).toBe('env-branch');
		});
	});

});
