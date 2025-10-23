/**
 * Configuration Manager - Singleton for managing Constellation configuration
 *
 * Provides centralized access to configuration with auto-loading and smart defaults.
 * Tools can access configuration via getConfig() without managing lifecycle.
 */

import { ConstellationConfig } from "./config.js";
import { ConfigLoader } from "./config.loader.js";

/**
 * Configuration context
 */
export interface ConfigContext {
	/** Configuration instance (or default) */
	config: ConstellationConfig;
	/** Project ID (from config.namespace only) */
	projectId: string;
	/** Branch name (from config.branch only) */
	branchName: string;
	/** API access key (from env only) */
	apiKey: string;
	/** Whether configuration was loaded from file */
	configLoaded: boolean;
}

/**
 * Configuration Manager singleton
 */
class ConfigurationManager {
	private static instance: ConfigurationManager;
	private configContext: ConfigContext | null = null;
	private initialized: boolean = false;

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): ConfigurationManager {
		if (!ConfigurationManager.instance) {
			ConfigurationManager.instance = new ConfigurationManager();
		}
		return ConfigurationManager.instance;
	}

	/**
	 * Initialize configuration (called once at server startup)
	 *
	 * @param workingDir Working directory to search for config (defaults to cwd)
	 */
	async initialize(workingDir: string = process.cwd()): Promise<void> {
		console.error(`[ConfigManager] initialize() called - already initialized: ${this.initialized}`);
		if (this.initialized) {
			console.error('[ConfigManager] Already initialized, skipping');
			return;
		}

		// Try to load configuration from file (DO NOT use defaults)
		let config = await ConfigLoader.loadConfig(workingDir, false);

		if (!config) {
			throw new Error(
				'constellation.json not found at git repository root.\n\n' +
				'The Constellation MCP server requires a constellation.json configuration file ' +
				'at the root of your git repository.\n\n' +
				'To fix this:\n' +
				'1. Navigate to your git repository root\n' +
				'2. Create a constellation.json file with the following structure:\n' +
				'   {\n' +
				'     "namespace": "your-project-name",\n' +
				'     "branch": "main",\n' +
				'     "apiUrl": "https://api.constellation.dev",\n' +
				'     "languages": {\n' +
				'       "typescript": { "fileExtensions": [".ts", ".tsx"] }\n' +
				'     }\n' +
				'   }\n\n' +
				'For more information, visit: https://docs.constellation.dev/setup'
			);
		}

		const configLoaded = true;

		// Project ID and branch come ONLY from constellation.json
		// No environment variable overrides, no git detection
		const projectId = config.namespace;
		const branchName = config.branch;

		// Determine API key (priority: env > error)
		const apiKey = process.env.CONSTELLATION_API_KEY || '';

		if (!apiKey) {
			console.warn(
				'[Constellation MCP] Warning: CONSTELLATION_API_KEY not set in environment'
			);
			console.warn(
				'[Constellation MCP] Set CONSTELLATION_API_KEY to authenticate with API'
			);
		}

		// Override API URL from environment if provided
		if (process.env.CONSTELLATION_API_URL) {
			config = new ConstellationConfig(
				process.env.CONSTELLATION_API_URL,
				branchName,
				config.languages,
				projectId
			);
		}

		this.configContext = {
			config,
			projectId,
			branchName,
			apiKey,
			configLoaded,
		};

		this.initialized = true;

		console.error('[ConfigManager] Initialization COMPLETE');
		console.error(`[ConfigManager] State: initialized=${this.initialized}, hasContext=${!!this.configContext}`);

		// Log initialization info (only in debug mode)
		if (process.env.DEBUG) {
			console.error('[Constellation MCP] Configuration initialized:');
			console.error(`  API URL: ${config.apiUrl}`);
			console.error(`  Project ID: ${projectId}`);
			console.error(`  Branch: ${branchName}`);
			console.error(`  Config loaded from file: ${configLoaded}`);
		}
	}

	/**
	 * Get current configuration context
	 *
	 * @returns Configuration context
	 * @throws If not initialized
	 */
	getContext(): ConfigContext {
		console.error(`[ConfigManager] getContext() called - initialized: ${this.initialized}, hasContext: ${!!this.configContext}`);
		if (!this.initialized || !this.configContext) {
			console.error('[ConfigManager] ERROR: Not initialized!');
			console.error('[ConfigManager] Stack trace:', new Error().stack);
			throw new Error(
				'Configuration not initialized. Call initialize() first.'
			);
		}
		return this.configContext;
	}

	/**
	 * Check if configuration is initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Reset configuration (for testing)
	 */
	reset(): void {
		this.configContext = null;
		this.initialized = false;
	}
}

/**
 * Get the configuration manager singleton
 */
export function getConfigManager(): ConfigurationManager {
	return ConfigurationManager.getInstance();
}

/**
 * Get current configuration context
 * Convenience function for tools
 *
 * If not initialized, performs lazy initialization with defaults
 */
export function getConfigContext(): ConfigContext {
	const manager = getConfigManager();
	if (!manager.isInitialized()) {
		console.error('[ConfigManager] WARNING: getConfigContext() called before initialize()');
		console.error('[ConfigManager] Performing lazy initialization');

		// Load config synchronously if possible
		try {
			const fs = require('fs');
			const path = require('path');
			const configPath = path.join(process.cwd(), 'constellation.json');
			let config = ConstellationConfig.createDefault();
			let projectId = 'constellation-mcp'; // Default for this project

			if (fs.existsSync(configPath)) {
				const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
				config = ConstellationConfig.fromJSON(configData);
				projectId = configData.namespace || projectId;
				console.error(`[ConfigManager] Loaded config from file: ${configPath}`);
			}

			manager['configContext'] = {
				config,
				projectId: projectId, // Always from config.namespace
				branchName: config.branch, // Always from config.branch
				apiKey: process.env.CONSTELLATION_API_KEY || '',
				configLoaded: fs.existsSync(configPath),
			};
			manager['initialized'] = true;
		} catch (error) {
			console.error('[ConfigManager] Error during lazy init:', error);
			// Fallback to defaults
			const defaultConfig = ConstellationConfig.createDefault();
			manager['configContext'] = {
				config: defaultConfig,
				projectId: defaultConfig.namespace, // Always from config
				branchName: defaultConfig.branch, // Always from config
				apiKey: process.env.CONSTELLATION_API_KEY || '',
				configLoaded: false,
			};
			manager['initialized'] = true;
		}
	}
	return manager.getContext();
}

/**
 * Initialize configuration (called at server startup)
 */
export async function initializeConfig(
	workingDir?: string
): Promise<void> {
	await getConfigManager().initialize(workingDir);
}
