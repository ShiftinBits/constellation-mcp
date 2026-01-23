/**
 * ConfigCache Unit Tests
 *
 * Tests the ConfigCache class that handles multi-project configuration
 * resolution and caching.
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from '@jest/globals';
import path from 'path';
import {
	configCache,
	ConfigCacheError,
	type ConfigContext,
} from '../../../src/config/config-cache.js';
import { FileUtils } from '../../../src/utils/file.utils.js';
import { ConstellationConfig } from '../../../src/config/config.js';

// Mock FileUtils
jest.mock('../../../src/utils/file.utils.js', () => ({
	FileUtils: {
		directoryExists: jest.fn(),
		isGitRepository: jest.fn(),
		fileIsReadable: jest.fn(),
		readFile: jest.fn(),
		isRootDirectory: jest.fn(),
	},
}));

// Mock ConstellationConfig
// Need to mock both the class constructor and static methods
jest.mock('../../../src/config/config.js', () => {
	// Need to import jest inside the factory since this runs at module load
	const { jest: jestInternal } = require('@jest/globals');

	class MockConstellationConfig {
		apiUrl: string;
		branch: string;
		languages: any;
		projectId: string;

		constructor(
			apiUrl: string,
			branch: string,
			languages: any,
			projectId: string,
		) {
			this.apiUrl = apiUrl;
			this.branch = branch;
			this.languages = languages;
			this.projectId = projectId;
		}

		static fromJSON = jestInternal.fn();
		static createDefault = jestInternal.fn();
	}

	return { ConstellationConfig: MockConstellationConfig };
});

// Get the mocked module after loading
const { ConstellationConfig: MockedConstellationConfig } = jest.requireMock(
	'../../../src/config/config.js',
) as { ConstellationConfig: { fromJSON: jest.Mock; createDefault: jest.Mock } };

const mockFileUtils = FileUtils as jest.Mocked<typeof FileUtils>;
const mockConstellationConfig = {
	fromJSON: MockedConstellationConfig.fromJSON,
	createDefault: MockedConstellationConfig.createDefault,
};

describe('ConfigCache', () => {
	let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
	let consoleWarnSpy: ReturnType<typeof jest.spyOn>;
	const originalEnv = process.env;

	beforeEach(() => {
		// Clear cache before each test
		configCache.clearCache();

		// Reset all mocks
		jest.clearAllMocks();

		// Reset environment
		process.env = { ...originalEnv };
		process.env.CONSTELLATION_ACCESS_KEY = 'test-api-key';

		// Suppress console output during tests
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
		process.env = originalEnv;
	});

	describe('getConfigForPath', () => {
		it('should throw ConfigCacheError if cwd does not exist', async () => {
			mockFileUtils.directoryExists.mockResolvedValueOnce(false);

			await expect(
				configCache.getConfigForPath('/nonexistent/path'),
			).rejects.toThrow(ConfigCacheError);

			await expect(
				configCache.getConfigForPath('/nonexistent/path'),
			).rejects.toMatchObject({
				code: 'INVALID_CWD',
			});
		});

		it('should throw ConfigCacheError if cwd is not in a git repo', async () => {
			// Use mockResolvedValue for repeated calls since test makes two assertions
			mockFileUtils.directoryExists.mockResolvedValue(true);
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);

			await expect(
				configCache.getConfigForPath('/not-a-git-repo'),
			).rejects.toMatchObject({
				code: 'NOT_GIT_REPO',
			});
		});

		it('should load config from git root', async () => {
			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			const result = await configCache.getConfigForPath('/project/src');

			expect(result.projectId).toBe('test-project');
			expect(result.configLoaded).toBe(true);
			expect(result.apiKey).toBe('test-api-key');
		});

		it('should cache config by git root', async () => {
			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValue(true);
			// For the first call (/project/src):
			//   /project/src -> false, /project -> true
			// For the second call (/project/lib):
			//   /project/lib -> false, /project -> true (cache hit at this point)
			mockFileUtils.isGitRepository.mockImplementation(async (dir: string) => {
				// Only /project is a git root, not its subdirectories
				return dir.endsWith('/project') || dir === '/project';
			});
			mockFileUtils.isRootDirectory.mockReturnValue(false);
			mockFileUtils.fileIsReadable.mockResolvedValue(true);
			mockFileUtils.readFile.mockResolvedValue(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValue(mockConfig);

			// First call
			await configCache.getConfigForPath('/project/src');
			// Second call from different subdirectory - should use cache
			await configCache.getConfigForPath('/project/lib');

			// readFile should only be called once due to caching
			expect(mockFileUtils.readFile).toHaveBeenCalledTimes(1);
		});

		it('should return degraded config when constellation.json not found', async () => {
			const defaultConfig = {
				projectId: 'default-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(false);
			mockConstellationConfig.createDefault.mockReturnValueOnce(defaultConfig);

			const result = await configCache.getConfigForPath('/project');

			expect(result.configLoaded).toBe(false);
			expect(result.initializationError).toContain(
				'constellation.json not found',
			);
		});

		it('should apply CONSTELLATION_API_URL env override', async () => {
			process.env.CONSTELLATION_API_URL = 'http://custom-api.example.com';

			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			const result = await configCache.getConfigForPath('/project');

			// The config's apiUrl should be overridden
			expect(result.config.apiUrl).toBe('http://custom-api.example.com');
		});
	});

	describe('findGitRoot', () => {
		it('should find git root from nested directory', async () => {
			mockFileUtils.isGitRepository
				.mockResolvedValueOnce(false) // /project/src/components
				.mockResolvedValueOnce(false) // /project/src
				.mockResolvedValueOnce(true); // /project

			mockFileUtils.isRootDirectory.mockReturnValue(false);

			const gitRoot = await configCache.findGitRoot('/project/src/components');

			expect(gitRoot).toContain('project');
		});

		it('should return null if not in a git repo', async () => {
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);

			const gitRoot = await configCache.findGitRoot('/some/path');

			expect(gitRoot).toBeNull();
		});

		it('should return innermost git root (for submodules)', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true); // /project/submodule

			const gitRoot = await configCache.findGitRoot('/project/submodule/src');

			expect(gitRoot).toContain('submodule');
		});
	});

	describe('trySetDefaultFromStartup', () => {
		it('should set default config on success', async () => {
			const mockConfig = {
				projectId: 'default-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'default-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await configCache.trySetDefaultFromStartup('/project');

			const defaultConfig = configCache.getDefaultConfig();
			expect(defaultConfig).not.toBeNull();
			expect(defaultConfig?.projectId).toBe('default-project');
		});

		it('should not throw on failure, just set default to null', async () => {
			mockFileUtils.directoryExists.mockResolvedValueOnce(false);

			// Should not throw
			await configCache.trySetDefaultFromStartup('/nonexistent');

			expect(configCache.getDefaultConfig()).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('No default config available'),
			);
		});

		it('should use process.cwd() if no startDir provided', async () => {
			const mockConfig = {
				projectId: 'cwd-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'cwd-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await configCache.trySetDefaultFromStartup();

			expect(configCache.getDefaultConfig()).not.toBeNull();
		});
	});

	describe('getDefaultConfig', () => {
		it('should return null before initialization', () => {
			expect(configCache.getDefaultConfig()).toBeNull();
		});

		it('should return default config after successful initialization', async () => {
			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await configCache.trySetDefaultFromStartup('/project');

			const defaultConfig = configCache.getDefaultConfig();
			expect(defaultConfig).not.toBeNull();
			expect(defaultConfig?.projectId).toBe('test-project');
		});
	});

	describe('hasDefaultConfig', () => {
		it('should return false before initialization', () => {
			expect(configCache.hasDefaultConfig()).toBe(false);
		});

		it('should return true after successful initialization', async () => {
			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await configCache.trySetDefaultFromStartup('/project');

			expect(configCache.hasDefaultConfig()).toBe(true);
		});
	});

	describe('clearCache', () => {
		it('should clear cached configs and default config', async () => {
			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValue(true);
			mockFileUtils.isGitRepository.mockResolvedValue(true);
			mockFileUtils.fileIsReadable.mockResolvedValue(true);
			mockFileUtils.readFile.mockResolvedValue(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValue(mockConfig);

			await configCache.trySetDefaultFromStartup('/project');
			expect(configCache.getDefaultConfig()).not.toBeNull();

			configCache.clearCache();

			expect(configCache.getDefaultConfig()).toBeNull();
			expect(configCache.hasDefaultConfig()).toBe(false);
		});

		it('should force reload on next getConfigForPath', async () => {
			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValue(true);
			mockFileUtils.isGitRepository.mockResolvedValue(true);
			mockFileUtils.fileIsReadable.mockResolvedValue(true);
			mockFileUtils.readFile.mockResolvedValue(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValue(mockConfig);

			// First load
			await configCache.getConfigForPath('/project');

			// Clear cache
			configCache.clearCache();

			// Second load should call readFile again
			await configCache.getConfigForPath('/project');

			expect(mockFileUtils.readFile).toHaveBeenCalledTimes(2);
		});
	});

	describe('getStats', () => {
		it('should return correct stats', async () => {
			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValue(true);
			mockFileUtils.isGitRepository.mockResolvedValue(true);
			mockFileUtils.fileIsReadable.mockResolvedValue(true);
			mockFileUtils.readFile.mockResolvedValue(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValue(mockConfig);

			// Before initialization
			let stats = configCache.getStats();
			expect(stats.cachedProjects).toBe(0);
			expect(stats.hasDefault).toBe(false);

			// After initialization
			await configCache.trySetDefaultFromStartup('/project');
			stats = configCache.getStats();
			expect(stats.cachedProjects).toBe(1);
			expect(stats.hasDefault).toBe(true);
		});
	});

	describe('ConfigCacheError', () => {
		it('should have correct properties', () => {
			const error = new ConfigCacheError('Test error', 'INVALID_CWD', [
				'guidance 1',
				'guidance 2',
			]);

			expect(error.message).toBe('Test error');
			expect(error.code).toBe('INVALID_CWD');
			expect(error.guidance).toEqual(['guidance 1', 'guidance 2']);
			expect(error.name).toBe('ConfigCacheError');
		});
	});

	describe('API key handling', () => {
		it('should use CONSTELLATION_ACCESS_KEY from environment', async () => {
			process.env.CONSTELLATION_ACCESS_KEY = 'my-api-key';

			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			const result = await configCache.getConfigForPath('/project');

			expect(result.apiKey).toBe('my-api-key');
		});

		it('should warn when API key is not set', async () => {
			delete process.env.CONSTELLATION_ACCESS_KEY;

			const mockConfig = {
				projectId: 'test-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'test-project' }),
			);
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			const result = await configCache.getConfigForPath('/project');

			expect(result.apiKey).toBe('');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('CONSTELLATION_ACCESS_KEY not set'),
			);
		});
	});

	describe('error handling', () => {
		it('should handle invalid JSON in config file', async () => {
			const defaultConfig = {
				projectId: 'default-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{ invalid json }');
			mockConstellationConfig.createDefault.mockReturnValueOnce(defaultConfig);

			const result = await configCache.getConfigForPath('/project');

			expect(result.configLoaded).toBe(false);
			expect(result.initializationError).toContain('Failed to load');
		});

		it('should handle config validation errors', async () => {
			const defaultConfig = {
				projectId: 'default-project',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
				languages: { typescript: { fileExtensions: ['.ts'] } },
			} as unknown as ConstellationConfig;

			mockFileUtils.directoryExists.mockResolvedValueOnce(true);
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				JSON.stringify({ projectId: 'test' }),
			);
			mockConstellationConfig.fromJSON.mockImplementationOnce(() => {
				throw new Error('Invalid configuration');
			});
			mockConstellationConfig.createDefault.mockReturnValueOnce(defaultConfig);

			const result = await configCache.getConfigForPath('/project');

			expect(result.configLoaded).toBe(false);
			expect(result.initializationError).toContain('Invalid configuration');
		});
	});
});
