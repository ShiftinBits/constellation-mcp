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
		useDefaults: boolean = false,
	): Promise<ConstellationConfig | null> {
		// Return cached config if available
		if (this.configCache) {
			return this.configCache;
		}

		try {
			// Search for configuration file
			const configPath = await this.findConfigFile(startDir);

			if (configPath) {
				console.error(
					`[Constellation] Loading configuration from: ${configPath}`,
				);
				const fileContents = await FileUtils.readFile(configPath);
				const parsed = JSON.parse(fileContents);
				const config = ConstellationConfig.fromJSON(parsed);

				// Cache the loaded configuration
				this.configCache = config;
				console.error(`[Constellation] Configuration loaded successfully`);
				console.error(`[Constellation] Project: ${config.projectId}`);
				console.error(`[Constellation] API URL: ${config.apiUrl}`);
				console.error(`[Constellation] Branch: ${config.branch}`);

				return config;
			}

			// No config file found
			if (useDefaults) {
				console.error(
					'[Constellation] No configuration file found, using defaults',
				);
				const defaultConfig = ConstellationConfig.createDefault();
				this.configCache = defaultConfig;
				return defaultConfig;
			}

			console.error('[Constellation] No configuration file found');
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
	 * Finds constellation.json by checking git repository roots.
	 * For nested git repositories (submodules, etc.), checks innermost first,
	 * then walks up to outer repositories until a config file is found.
	 *
	 * @param startDir Starting directory for the search
	 * @returns Path to the configuration file if found at any git root, null otherwise
	 */
	private static async findConfigFile(
		startDir: string,
	): Promise<string | null> {
		let currentDir = path.resolve(startDir);

		// Walk up the directory tree, checking each git repository root
		while (true) {
			// Check if this directory is a git repository root
			if (await FileUtils.isGitRepository(currentDir)) {
				const configPath = path.join(currentDir, this.CONFIG_FILENAME);

				if (await FileUtils.fileIsReadable(configPath)) {
					console.error(
						`[Constellation] Found ${this.CONFIG_FILENAME} at git root: ${currentDir}`,
					);
					return configPath;
				}

				// Found a git root but no config file, continue searching upward
				console.error(
					`[Constellation] No ${this.CONFIG_FILENAME} at git root: ${currentDir}, checking parent repositories...`,
				);
			}

			// Stop if we've reached the filesystem root
			if (FileUtils.isRootDirectory(currentDir)) {
				break;
			}

			// Move up one directory
			currentDir = path.dirname(currentDir);
		}

		console.error(
			'[Constellation] No constellation.json found in any git repository',
		);
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
		callback: (config: ConstellationConfig | null) => void,
	): Promise<() => void> {
		const { watch } = await import('fs');
		const configPath = await this.findConfigFile(process.cwd());

		if (!configPath) {
			console.error('[Constellation] No configuration file to watch');
			return () => {};
		}

		const watcher = watch(configPath, async (eventType) => {
			if (eventType === 'change') {
				console.error(
					'[Constellation] Configuration file changed, reloading...',
				);
				this.clearCache();
				try {
					const newConfig = await this.loadConfig();
					callback(newConfig);
				} catch (error) {
					console.error(
						'[Constellation] Error reloading configuration:',
						error,
					);
					callback(null);
				}
			}
		});

		return () => watcher.close();
	}
}
