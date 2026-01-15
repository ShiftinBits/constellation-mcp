/**
 * Configuration Manager - Singleton for managing Constellation configuration
 *
 * Provides centralized access to configuration with auto-loading and smart defaults.
 * Tools can access configuration via getConfig() without managing lifecycle.
 */

import { ConstellationConfig } from './config.js';
import { ConfigLoader } from './config.loader.js';

/**
 * Configuration context
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
	/** Initialization error if config failed to load */
	initializationError?: string;
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
		console.error(
			`[ConfigManager] initialize() called - already initialized: ${this.initialized}`,
		);
		if (this.initialized) {
			console.error('[ConfigManager] Already initialized, skipping');
			return;
		}

		let config: ConstellationConfig;
		let configLoaded = false;
		let projectId: string;
		let branchName: string;
		let initializationError: string | undefined;

		try {
			// Try to load configuration from file (DO NOT use defaults)
			const loadedConfig = await ConfigLoader.loadConfig(workingDir, false);

			if (!loadedConfig) {
				// Config not found - store error but continue with defaults
				initializationError =
					'File constellation.json not found at git repository root.\n\n' +
					'The Constellation MCP server requires a constellation.json configuration file ' +
					'at the root of your git repository.\n\n' +
					'To fix this:\n' +
					'1. Navigate to your git repository root\n' +
					'2. Run: constellation init\n' +
					'3. Run: constellation auth\n' +
					'4. Run: constellation index\n\n' +
					'For more information, visit: https://docs.constellationdev.io/';

				// Use defaults to allow server to start
				config = ConstellationConfig.createDefault();
				projectId = config.projectId;
				branchName = config.branch;
			} else {
				// Config loaded successfully
				config = loadedConfig;
				configLoaded = true;
				projectId = config.projectId;
				branchName = config.branch;
			}
		} catch (error) {
			// Error during config loading - store error and use defaults
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			initializationError =
				'Failed to load constellation.json.\n\n' +
				`Error: ${errorMessage}\n\n` +
				'To fix this:\n' +
				'1. Check that constellation.json is valid JSON\n' +
				'2. Run: constellation init (to recreate)\n' +
				'3. Run: constellation auth\n' +
				'4. Run: constellation index\n\n' +
				'For more information, visit: https://docs.constellationdev.io/';

			// Use defaults to allow server to start
			config = ConstellationConfig.createDefault();
			projectId = config.projectId;
			branchName = config.branch;
		}

		// Determine API key (priority: env > error)
		const apiKey = process.env.CONSTELLATION_ACCESS_KEY || '';

		if (!apiKey && !initializationError) {
			console.warn(
				'[CONSTELLATION] Warning: CONSTELLATION_ACCESS_KEY not set in environment',
			);
			console.warn('[CONSTELLATION] Run: constellation auth');
		}

		// Override API URL from environment if provided
		if (process.env.CONSTELLATION_API_URL) {
			config = new ConstellationConfig(
				process.env.CONSTELLATION_API_URL,
				branchName,
				config.languages,
				projectId,
			);
		}

		this.configContext = {
			config,
			projectId,
			branchName,
			apiKey,
			configLoaded,
			initializationError,
		};

		this.initialized = true;

		console.error('[ConfigManager] Initialization COMPLETE');
		console.error(
			`[ConfigManager] State: initialized=${this.initialized}, hasContext=${!!this.configContext}`,
		);

		if (initializationError) {
			console.error(
				'[ConfigManager] WARNING: Initialized with errors (degraded mode)',
			);
		}

		// Log initialization info (only in debug mode)
		if (process.env.DEBUG) {
			console.error('[CONSTELLATION] Configuration initialized:');
			console.error(`  Project ID: ${projectId}`);
			console.error(`  Branch: ${branchName}`);
			console.error(`  Config loaded from file: ${configLoaded}`);
			if (initializationError) {
				console.error(`  Initialization error: ${initializationError}`);
			}
		}
	}

	/**
	 * Get current configuration context
	 *
	 * @returns Configuration context
	 * @throws If not initialized
	 */
	getContext(): ConfigContext {
		console.error(
			`[ConfigManager] getContext() called - initialized: ${this.initialized}, hasContext: ${!!this.configContext}`,
		);
		if (!this.initialized || !this.configContext) {
			console.error('[ConfigManager] ERROR: Not initialized!');
			console.error('[ConfigManager] Stack trace:', new Error().stack);
			throw new Error(
				'Configuration not initialized. Call initialize() first.',
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
 * @throws Error if configuration not initialized (call initializeConfig() first)
 */
export function getConfigContext(): ConfigContext {
	return getConfigManager().getContext();
}

/**
 * Initialize configuration (called at server startup)
 */
export async function initializeConfig(workingDir?: string): Promise<void> {
	await getConfigManager().initialize(workingDir);
}
