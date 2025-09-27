import path from 'path';
import { ConstellationConfig } from './config.js';
import { FileUtils } from '../utils/file.utils.js';

/**
 * Configuration loader for Constellation MCP Server.
 * Handles discovery and loading of constellation.json files.
 */
export class ConfigLoader {
	private static configCache: ConstellationConfig | null = null;
	private static readonly CONFIG_FILENAME = 'constellation.json';

	/**
	 * Loads the Constellation configuration, searching upward from the current directory.
	 * Results are cached for subsequent calls.
	 * @param startDir Starting directory for search (defaults to current working directory)
	 * @param useDefaults If true, returns default config when no config file is found
	 * @returns Loaded configuration or null if not found and useDefaults is false
	 * @throws Error if configuration file is found but invalid
	 */
	static async loadConfig(
		startDir: string = process.cwd(),
		useDefaults: boolean = false
	): Promise<ConstellationConfig | null> {
		// Return cached config if available
		if (this.configCache) {
			return this.configCache;
		}

		try {
			// Search for configuration file
			const configPath = await this.findConfigFile(startDir);

			if (configPath) {
				console.log(`[Constellation] Loading configuration from: ${configPath}`);
				const fileContents = await FileUtils.readFile(configPath);
				const parsed = JSON.parse(fileContents);
				const config = ConstellationConfig.fromJSON(parsed);

				// Cache the loaded configuration
				this.configCache = config;
				console.log(`[Constellation] Configuration loaded successfully`);
				console.log(`[Constellation] Project: ${config.namespace}`);
				console.log(`[Constellation] API URL: ${config.apiUrl}`);
				console.log(`[Constellation] Branch: ${config.branch}`);

				return config;
			}

			// No config file found
			if (useDefaults) {
				console.log('[Constellation] No configuration file found, using defaults');
				const defaultConfig = ConstellationConfig.createDefault();
				this.configCache = defaultConfig;
				return defaultConfig;
			}

			console.log('[Constellation] No configuration file found');
			return null;

		} catch (error) {
			if (error instanceof Error) {
				console.error(`[Constellation] Configuration error: ${error.message}`);
				throw error;
			}
			throw new Error('Unknown configuration error');
		}
	}

	/**
	 * Searches for a constellation.json file starting from the given directory
	 * and moving up the directory tree until finding the file or reaching the root.
	 * @param startDir Starting directory for the search
	 * @returns Path to the configuration file if found, null otherwise
	 */
	private static async findConfigFile(startDir: string): Promise<string | null> {
		let currentDir = path.resolve(startDir);

		while (true) {
			const configPath = path.join(currentDir, this.CONFIG_FILENAME);

			// Check if config file exists in current directory
			if (await FileUtils.fileIsReadable(configPath)) {
				return configPath;
			}

			// Stop if we've reached the root directory
			if (FileUtils.isRootDirectory(currentDir)) {
				break;
			}

			// Stop if we've reached a git repository root (optional behavior)
			// This prevents searching beyond the project boundary
			if (await FileUtils.isGitRepository(currentDir)) {
				// Check one more time in the git root
				const gitRootConfig = path.join(currentDir, this.CONFIG_FILENAME);
				if (await FileUtils.fileIsReadable(gitRootConfig)) {
					return gitRootConfig;
				}
				break;
			}

			// Move up one directory
			currentDir = path.dirname(currentDir);
		}

		return null;
	}

	/**
	 * Clears the cached configuration, forcing a reload on next access.
	 */
	static clearCache(): void {
		this.configCache = null;
	}

	/**
	 * Gets the currently cached configuration without loading.
	 * @returns Cached configuration or null if not loaded
	 */
	static getCachedConfig(): ConstellationConfig | null {
		return this.configCache;
	}

	/**
	 * Watches for configuration file changes (for development).
	 * @param callback Function to call when configuration changes
	 * @returns Function to stop watching
	 */
	static async watchConfig(
		callback: (config: ConstellationConfig | null) => void
	): Promise<() => void> {
		const { watch } = await import('fs');
		const configPath = await this.findConfigFile(process.cwd());

		if (!configPath) {
			console.log('[Constellation] No configuration file to watch');
			return () => {};
		}

		const watcher = watch(configPath, async (eventType) => {
			if (eventType === 'change') {
				console.log('[Constellation] Configuration file changed, reloading...');
				this.clearCache();
				try {
					const newConfig = await this.loadConfig();
					callback(newConfig);
				} catch (error) {
					console.error('[Constellation] Error reloading configuration:', error);
					callback(null);
				}
			}
		});

		return () => watcher.close();
	}
}