/**
 * Configuration Manager - Singleton for managing Constellation configuration
 *
 * Provides centralized access to configuration with auto-loading and smart defaults.
 * Tools can access configuration via getConfig() without managing lifecycle.
 */

import { ConstellationConfig } from "./config.js";
import { ConfigLoader } from "./config.loader.js";
import { getGitInfo } from "../utils/git-utils.js";

/**
 * Configuration context with auto-detected values
 */
export interface ConfigContext {
	/** Configuration instance (or default) */
	config: ConstellationConfig;
	/** Project ID (from git remote or config) */
	projectId: string;
	/** Branch name (from git or config) */
	branchName: string;
	/** API access key (from env or config) */
	apiKey: string;
	/** Whether configuration was loaded from file */
	configLoaded: boolean;
	/** Whether we're in a git repository */
	isGitRepo: boolean;
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
		if (this.initialized) {
			return;
		}

		// Try to load configuration from file
		let config: ConstellationConfig | null = null;
		let configLoaded = false;

		try {
			config = await ConfigLoader.loadConfig(workingDir, true);
			configLoaded = !!config;
		} catch (error) {
			// Config loading failed, will use defaults
		}

		// If no config found, use defaults
		if (!config) {
			config = ConstellationConfig.createDefault();
		}

		// Get git information for auto-detection
		const gitInfo = await getGitInfo(workingDir);

		// Determine project ID (priority: env > git > config)
		const projectId =
			process.env.CONSTELLATION_PROJECT_ID ||
			gitInfo.projectId ||
			config.namespace;

		// Determine branch name (priority: env > git > config)
		const branchName =
			process.env.CONSTELLATION_BRANCH ||
			gitInfo.branch ||
			config.branch;

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
			isGitRepo: gitInfo.isRepo,
		};

		this.initialized = true;

		// Log initialization info (only in debug mode)
		if (process.env.DEBUG) {
			console.log('[Constellation MCP] Configuration initialized:');
			console.log(`  API URL: ${config.apiUrl}`);
			console.log(`  Project ID: ${projectId}`);
			console.log(`  Branch: ${branchName}`);
			console.log(`  Config loaded from file: ${configLoaded}`);
			console.log(`  Git repository: ${gitInfo.isRepo ? 'yes' : 'no'}`);
		}
	}

	/**
	 * Get current configuration context
	 *
	 * @returns Configuration context
	 * @throws If not initialized
	 */
	getContext(): ConfigContext {
		if (!this.initialized || !this.configContext) {
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
 */
export function getConfigContext(): ConfigContext {
	return getConfigManager().getContext();
}

/**
 * Initialize configuration (called at server startup)
 */
export async function initializeConfig(
	workingDir?: string
): Promise<void> {
	await getConfigManager().initialize(workingDir);
}
