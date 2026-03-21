/**
 * Config Loader Unit Tests
 *
 * Tests the ConfigLoader class that handles discovery and loading
 * of constellation.json configuration files.
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
import { ConfigLoader } from '../../../src/config/config.loader.js';
import { FileUtils } from '../../../src/utils/file.utils.js';
import { ConstellationConfig } from '../../../src/config/config.js';

// Mock FileUtils
jest.mock('../../../src/utils/file.utils.js', () => ({
	FileUtils: {
		isGitRepository: jest.fn(),
		fileIsReadable: jest.fn(),
		readFile: jest.fn(),
		isRootDirectory: jest.fn(),
	},
}));

// Mock ConstellationConfig
jest.mock('../../../src/config/config.js', () => ({
	ConstellationConfig: {
		fromJSON: jest.fn(),
		createDefault: jest.fn(),
	},
}));

const mockFileUtils = FileUtils as jest.Mocked<typeof FileUtils>;
const mockConstellationConfig = ConstellationConfig as jest.Mocked<
	typeof ConstellationConfig
>;

describe('ConfigLoader', () => {
	let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

	beforeEach(() => {
		// Clear cache before each test
		ConfigLoader.clearCache();

		// Reset all mocks
		jest.clearAllMocks();

		// Suppress console.error output during tests
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	describe('loadConfig', () => {
		it('should return cached config if available', async () => {
			// Setup: first call finds and loads config
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			const mockConfig = {
				projectId: 'test',
				apiUrl: 'http://localhost:3000',
			} as unknown as ConstellationConfig;
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			// First call
			const result1 = await ConfigLoader.loadConfig('/some/path');
			expect(result1).toBe(mockConfig);

			// Second call should return cached
			const result2 = await ConfigLoader.loadConfig('/some/path');
			expect(result2).toBe(mockConfig);

			// FileUtils should only be called once
			expect(mockFileUtils.readFile).toHaveBeenCalledTimes(1);
		});

		it('should search from startDir for config file', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			const mockConfig = {
				projectId: 'test',
			} as unknown as ConstellationConfig;
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await ConfigLoader.loadConfig('/custom/start/dir');

			expect(mockFileUtils.isGitRepository).toHaveBeenCalledWith(
				expect.stringContaining('/custom/start/dir'),
			);
		});

		it('should parse JSON and validate config', async () => {
			const configJson = {
				projectId: 'my-project',
				apiUrl: 'http://localhost:3000',
			};
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(JSON.stringify(configJson));
			const mockConfig = configJson as unknown as ConstellationConfig;
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			const result = await ConfigLoader.loadConfig('/project');

			expect(mockConstellationConfig.fromJSON).toHaveBeenCalledWith(configJson);
			expect(result).toBe(mockConfig);
		});

		it('should cache loaded configuration', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			const mockConfig = {
				projectId: 'test',
			} as unknown as ConstellationConfig;
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await ConfigLoader.loadConfig('/project');

			expect(ConfigLoader.getCachedConfig()).toBe(mockConfig);
		});

		it('should return null when no config file found and useDefaults is false', async () => {
			// No git repository found - immediately at root
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);

			const result = await ConfigLoader.loadConfig('/project', false);

			expect(result).toBeNull();
		});

		it('should return default config when no config file found and useDefaults is true', async () => {
			const defaultConfig = {
				projectId: 'default-project',
			} as unknown as ConstellationConfig;
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);
			mockConstellationConfig.createDefault.mockReturnValue(defaultConfig);

			const result = await ConfigLoader.loadConfig('/project', true);

			expect(result).toBe(defaultConfig);
			expect(mockConstellationConfig.createDefault).toHaveBeenCalled();
		});

		it('should throw error for invalid JSON', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{ invalid json }');

			await expect(ConfigLoader.loadConfig('/project')).rejects.toThrow();
		});

		it('should throw error when fromJSON validation fails', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			mockConstellationConfig.fromJSON.mockImplementation(() => {
				throw new Error('Invalid configuration: apiUrl is missing');
			});

			await expect(ConfigLoader.loadConfig('/project')).rejects.toThrow(
				'Invalid configuration: apiUrl is missing',
			);
		});

		it('should log loading messages', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			const mockConfig = {
				projectId: 'test',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
			} as unknown as ConstellationConfig;
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await ConfigLoader.loadConfig('/project');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Loading configuration from'),
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Configuration loaded successfully'),
			);
		});

		it('should throw unknown error for non-Error exceptions', async () => {
			mockFileUtils.isGitRepository.mockRejectedValueOnce('string error');

			await expect(ConfigLoader.loadConfig('/project')).rejects.toThrow(
				'Unknown configuration error',
			);
		});
	});

	describe('findConfigFile (via loadConfig)', () => {
		it('should check git repository roots', async () => {
			// First directory is git repo with config
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			mockConstellationConfig.fromJSON.mockReturnValueOnce(
				{} as ConstellationConfig,
			);

			await ConfigLoader.loadConfig('/project/src/components');

			expect(mockFileUtils.isGitRepository).toHaveBeenCalled();
		});

		it('should traverse parent directories when config not found at git root', async () => {
			// First git root has no config
			mockFileUtils.isGitRepository
				.mockResolvedValueOnce(true) // /project/src is git repo
				.mockResolvedValueOnce(true); // /project is git repo

			mockFileUtils.fileIsReadable
				.mockResolvedValueOnce(false) // No config at /project/src
				.mockResolvedValueOnce(true); // Config found at /project

			mockFileUtils.isRootDirectory.mockReturnValueOnce(false); // /project/src is not root

			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			mockConstellationConfig.fromJSON.mockReturnValueOnce(
				{} as ConstellationConfig,
			);

			await ConfigLoader.loadConfig('/project/src');

			expect(mockFileUtils.isGitRepository).toHaveBeenCalledTimes(2);
			expect(mockFileUtils.fileIsReadable).toHaveBeenCalledTimes(2);
		});

		it('should stop at filesystem root when no config found', async () => {
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory
				.mockReturnValueOnce(false)
				.mockReturnValueOnce(false)
				.mockReturnValueOnce(true); // Stop at root

			const result = await ConfigLoader.loadConfig('/deep/nested/path');

			expect(result).toBeNull();
			expect(mockFileUtils.isRootDirectory).toHaveBeenCalled();
		});

		it('should log when no config found at git root', async () => {
			mockFileUtils.isGitRepository
				.mockResolvedValueOnce(true)
				.mockResolvedValueOnce(false);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(false);
			mockFileUtils.isRootDirectory
				.mockReturnValueOnce(false)
				.mockReturnValueOnce(true);

			await ConfigLoader.loadConfig('/project');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('checking parent repositories'),
			);
		});
	});

	describe('clearCache', () => {
		it('should clear the cached configuration', async () => {
			// First load a config
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			mockConstellationConfig.fromJSON.mockReturnValueOnce({
				projectId: 'test',
			} as unknown as ConstellationConfig);

			await ConfigLoader.loadConfig('/project');
			expect(ConfigLoader.getCachedConfig()).not.toBeNull();

			// Clear cache
			ConfigLoader.clearCache();
			expect(ConfigLoader.getCachedConfig()).toBeNull();
		});

		it('should force reload on next loadConfig call', async () => {
			// First load
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "first"}');
			mockConstellationConfig.fromJSON.mockReturnValueOnce({
				projectId: 'first',
			} as unknown as ConstellationConfig);

			await ConfigLoader.loadConfig('/project');

			// Clear and reload
			ConfigLoader.clearCache();

			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "second"}');
			mockConstellationConfig.fromJSON.mockReturnValueOnce({
				projectId: 'second',
			} as unknown as ConstellationConfig);

			await ConfigLoader.loadConfig('/project');

			expect(mockFileUtils.readFile).toHaveBeenCalledTimes(2);
		});
	});

	describe('getCachedConfig', () => {
		it('should return cached configuration when available', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			const mockConfig = {
				projectId: 'test',
			} as unknown as ConstellationConfig;
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await ConfigLoader.loadConfig('/project');

			expect(ConfigLoader.getCachedConfig()).toBe(mockConfig);
		});

		it('should return null when no configuration is cached', () => {
			expect(ConfigLoader.getCachedConfig()).toBeNull();
		});
	});

	describe('watchConfig', () => {
		it('should return empty cleanup function when no config file found', async () => {
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);

			const cleanup = await ConfigLoader.watchConfig(jest.fn());

			expect(typeof cleanup).toBe('function');
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('No configuration file to watch'),
			);

			// Cleanup should be safe to call
			cleanup();
		});

		it('should return a cleanup function when config file exists', async () => {
			// This test verifies the watcher setup by checking return type
			// We cannot fully test fs.watch without integration tests
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);

			const callback = jest.fn();
			const cleanup = await ConfigLoader.watchConfig(callback);

			// Should return a function that can be called for cleanup
			expect(typeof cleanup).toBe('function');

			// Cleanup to prevent open handles
			cleanup();
		});
	});

	describe('logging behavior', () => {
		it('should log config details on successful load', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce(
				'{"projectId": "my-project"}',
			);
			const mockConfig = {
				projectId: 'my-project',
				apiUrl: 'http://localhost:3000',
				branch: 'develop',
			} as unknown as ConstellationConfig;
			mockConstellationConfig.fromJSON.mockReturnValueOnce(mockConfig);

			await ConfigLoader.loadConfig('/project');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Constellation] Project: my-project',
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Constellation] API URL: http://localhost:3000',
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Constellation] Branch: develop',
			);
		});

		it('should log when using defaults', async () => {
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);
			mockConstellationConfig.createDefault.mockReturnValue(
				{} as ConstellationConfig,
			);

			await ConfigLoader.loadConfig('/project', true);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Constellation] No configuration file found, using defaults',
			);
		});

		it('should log when no config file found', async () => {
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);

			await ConfigLoader.loadConfig('/project', false);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Constellation] No configuration file found',
			);
		});

		it('should log configuration errors', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockRejectedValueOnce(
				new Error('File read failed'),
			);

			await expect(ConfigLoader.loadConfig('/project')).rejects.toThrow();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Constellation] Configuration error: File read failed',
			);
		});

		it('should log when git root found with config', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(true);
			mockFileUtils.readFile.mockResolvedValueOnce('{"projectId": "test"}');
			mockConstellationConfig.fromJSON.mockReturnValueOnce({
				projectId: 'test',
				apiUrl: 'http://localhost:3000',
				branch: 'main',
			} as unknown as ConstellationConfig);

			await ConfigLoader.loadConfig('/project');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Found constellation.json at git root'),
			);
		});
	});

	describe('path resolution', () => {
		it('should resolve relative startDir to absolute path', async () => {
			mockFileUtils.isGitRepository.mockResolvedValue(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);

			await ConfigLoader.loadConfig('./relative/path');

			// Path should be resolved (isGitRepository called with absolute path)
			const firstCall = mockFileUtils.isGitRepository.mock.calls[0][0];
			expect(path.isAbsolute(firstCall)).toBe(true);
		});

		it('should check correct config filename', async () => {
			mockFileUtils.isGitRepository.mockResolvedValueOnce(true);
			mockFileUtils.fileIsReadable.mockResolvedValueOnce(false);
			mockFileUtils.isRootDirectory.mockReturnValue(true);

			await ConfigLoader.loadConfig('/project');

			expect(mockFileUtils.fileIsReadable).toHaveBeenCalledWith(
				expect.stringContaining('constellation.json'),
			);
		});
	});
});
