/**
 * Configuration Cache - Multi-project configuration resolution
 *
 * Provides dynamic configuration resolution for multi-project workspaces.
 * Caches configurations by git root path for performance.
 */

import path from 'path';
import { ConstellationConfig } from './config.js';
import { FileUtils } from '../utils/file.utils.js';
import { DOCS_URLS } from '../constants/urls.js';

/**
 * Configuration context with all resolved values
 */
export interface ConfigContext {
	/** Configuration instance (or default) */
	config: ConstellationConfig;
	/** Project ID (from config.projectId only) */
	projectId: string;
	/** Branch name (from config.branch only) */
	branchName: string;
	/** API access key (from env only) */
	apiKey: string;
	/** Whether configuration was loaded from file */
	configLoaded: boolean;
	/** Git root path where config was found */
	gitRoot: string;
	/** Initialization error if config failed to load */
	initializationError?: string;
}

/**
 * Cached configuration entry
 */
interface CachedConfig {
	config: ConstellationConfig;
	gitRoot: string;
	loadedAt: number;
	configLoaded: boolean;
	initializationError?: string;
}

const CONFIG_FILENAME = 'constellation.json';

/**
 * Configuration Cache for multi-project workspaces
 *
 * Caches configurations by git root path, allowing the MCP server
 * to serve multiple projects in a single session.
 */
class ConfigCache {
	private cache = new Map<string, CachedConfig>();
	private defaultConfig: ConfigContext | null = null;

	/**
	 * Get configuration for a specific path.
	 *
	 * Resolves the git root from the path, loads constellation.json,
	 * and caches the result.
	 *
	 * @param cwd Working directory to resolve config from
	 * @returns Configuration context for the project
	 * @throws Error if cwd doesn't exist, isn't in a git repo, or config can't be loaded
	 */
	async getConfigForPath(cwd: string): Promise<ConfigContext> {
		// Validate cwd exists
		const normalizedCwd = path.resolve(cwd);
		if (!(await FileUtils.directoryExists(normalizedCwd))) {
			throw new ConfigCacheError(
				`Directory does not exist: ${cwd}`,
				'INVALID_CWD',
				[
					'Verify the path is correct',
					'Check that you have access to the directory',
					'Use an absolute path if relative paths are not resolving correctly',
				],
			);
		}

		// Find git root
		const gitRoot = await this.findGitRoot(normalizedCwd);
		if (!gitRoot) {
			throw new ConfigCacheError(
				`Not inside a git repository: ${cwd}`,
				'NOT_GIT_REPO',
				[
					'Initialize a git repository: git init',
					'Navigate to a directory inside an existing git repository',
					'Run: constellation init (which will also initialize git if needed)',
				],
			);
		}

		// Check cache first
		const cached = this.cache.get(gitRoot);
		if (cached) {
			console.error(`[ConfigCache] Using cached config for: ${gitRoot}`);
			return this.createConfigContext(cached);
		}

		// Load configuration
		const configEntry = await this.loadConfigFromGitRoot(gitRoot);
		this.cache.set(gitRoot, configEntry);

		console.error(`[ConfigCache] Loaded and cached config for: ${gitRoot}`);
		return this.createConfigContext(configEntry);
	}

	/**
	 * Find the git repository root from a starting directory.
	 *
	 * Walks upward from startDir to find the innermost git repository root.
	 * Handles both regular repositories (.git directory) and submodules (.git file).
	 *
	 * @param startDir Starting directory for the search
	 * @returns Git root path, or null if not in a git repository
	 */
	async findGitRoot(startDir: string): Promise<string | null> {
		let currentDir = path.resolve(startDir);

		while (true) {
			if (await FileUtils.isGitRepository(currentDir)) {
				return currentDir;
			}

			if (FileUtils.isRootDirectory(currentDir)) {
				return null;
			}

			currentDir = path.dirname(currentDir);
		}
	}

	/**
	 * Try to set default configuration from startup directory.
	 *
	 * This is called during server initialization. If it fails,
	 * the server still starts but will require cwd parameter on each call.
	 *
	 * @param startDir Starting directory (defaults to process.cwd())
	 */
	async trySetDefaultFromStartup(startDir?: string): Promise<void> {
		const workingDir = startDir || process.cwd();

		try {
			const configContext = await this.getConfigForPath(workingDir);
			this.defaultConfig = configContext;

			if (configContext.configLoaded) {
				console.error(
					`[ConfigCache] Default config loaded from: ${configContext.gitRoot}`,
				);
			} else {
				console.error(
					`[ConfigCache] Default config set with errors (degraded mode): ${configContext.gitRoot}`,
				);
			}
		} catch (error) {
			// Log but don't fail - server will require cwd parameter
			console.error(
				`[ConfigCache] No default config available (will require cwd parameter)`,
			);
			if (error instanceof Error) {
				console.error(`[ConfigCache] Reason: ${error.message}`);
			}
			this.defaultConfig = null;
		}
	}

	/**
	 * Get the default configuration context.
	 *
	 * @returns Default configuration context, or null if not available
	 */
	getDefaultConfig(): ConfigContext | null {
		return this.defaultConfig;
	}

	/**
	 * Check if a default configuration is available.
	 */
	hasDefaultConfig(): boolean {
		return this.defaultConfig !== null;
	}

	/**
	 * Clear the configuration cache.
	 *
	 * Useful for testing or when configurations need to be reloaded.
	 */
	clearCache(): void {
		this.cache.clear();
		this.defaultConfig = null;
		console.error('[ConfigCache] Cache cleared');
	}

	/**
	 * Load configuration from a git root directory.
	 */
	private async loadConfigFromGitRoot(gitRoot: string): Promise<CachedConfig> {
		const configPath = path.join(gitRoot, CONFIG_FILENAME);

		try {
			if (await FileUtils.fileIsReadable(configPath)) {
				console.error(
					`[ConfigCache] Loading configuration from: ${configPath}`,
				);
				const fileContents = await FileUtils.readFile(configPath);
				const parsed = JSON.parse(fileContents);
				const config = ConstellationConfig.fromJSON(parsed);

				// Apply environment overrides
				const finalConfig = this.applyEnvironmentOverrides(config);

				console.error(`[ConfigCache] Configuration loaded successfully`);
				console.error(`[ConfigCache] Project: ${finalConfig.projectId}`);
				console.error(`[ConfigCache] API URL: ${finalConfig.apiUrl}`);
				console.error(`[ConfigCache] Branch: ${finalConfig.branch}`);

				return {
					config: finalConfig,
					gitRoot,
					loadedAt: Date.now(),
					configLoaded: true,
				};
			}

			// No config file found - return degraded mode config
			console.error(`[ConfigCache] No ${CONFIG_FILENAME} found at: ${gitRoot}`);

			const defaultConfig = ConstellationConfig.createDefault();
			const initializationError =
				`File ${CONFIG_FILENAME} not found at git repository root: ${gitRoot}\n\n` +
				'The Constellation MCP server requires a constellation.json configuration file ' +
				'at the root of your git repository.\n\n' +
				'To fix this:\n' +
				'1. Navigate to your git repository root\n' +
				'2. Run: constellation init\n' +
				'3. Run: constellation auth\n' +
				'4. Run: constellation index\n\n' +
				`For more information, visit: ${DOCS_URLS.root}`;

			return {
				config: this.applyEnvironmentOverrides(defaultConfig),
				gitRoot,
				loadedAt: Date.now(),
				configLoaded: false,
				initializationError,
			};
		} catch (error) {
			// Error loading config - return degraded mode with error
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`[ConfigCache] Error loading config: ${errorMessage}`);

			const defaultConfig = ConstellationConfig.createDefault();
			const initializationError =
				`Failed to load ${CONFIG_FILENAME} from: ${gitRoot}\n\n` +
				`Error: ${errorMessage}\n\n` +
				'To fix this:\n' +
				'1. Check that constellation.json is valid JSON\n' +
				'2. Run: constellation init (to recreate)\n' +
				'3. Run: constellation auth\n' +
				'4. Run: constellation index\n\n' +
				`For more information, visit: ${DOCS_URLS.root}`;

			return {
				config: this.applyEnvironmentOverrides(defaultConfig),
				gitRoot,
				loadedAt: Date.now(),
				configLoaded: false,
				initializationError,
			};
		}
	}

	/**
	 * Apply environment variable overrides to config.
	 */
	private applyEnvironmentOverrides(
		config: ConstellationConfig,
	): ConstellationConfig {
		if (process.env.CONSTELLATION_API_URL) {
			return new ConstellationConfig(
				process.env.CONSTELLATION_API_URL,
				config.branch,
				config.languages,
				config.projectId,
			);
		}
		return config;
	}

	/**
	 * Create ConfigContext from cached entry.
	 */
	private createConfigContext(cached: CachedConfig): ConfigContext {
		const apiKey = process.env.CONSTELLATION_ACCESS_KEY || '';

		if (!apiKey && !cached.initializationError) {
			console.warn(
				'[ConfigCache] Warning: CONSTELLATION_ACCESS_KEY not set in environment',
			);
		}

		return {
			config: cached.config,
			projectId: cached.config.projectId,
			branchName: cached.config.branch,
			apiKey,
			configLoaded: cached.configLoaded,
			gitRoot: cached.gitRoot,
			initializationError: cached.initializationError,
		};
	}

	/**
	 * Get cache statistics (for debugging/testing).
	 */
	getStats(): { cachedProjects: number; hasDefault: boolean } {
		return {
			cachedProjects: this.cache.size,
			hasDefault: this.defaultConfig !== null,
		};
	}
}

/**
 * Error thrown by ConfigCache operations.
 */
export class ConfigCacheError extends Error {
	constructor(
		message: string,
		public readonly code:
			| 'INVALID_CWD'
			| 'NOT_GIT_REPO'
			| 'NO_CONFIG'
			| 'CONFIG_PARSE_ERROR',
		public readonly guidance: string[],
	) {
		super(message);
		this.name = 'ConfigCacheError';
	}
}

/**
 * Singleton instance of ConfigCache
 */
export const configCache = new ConfigCache();
