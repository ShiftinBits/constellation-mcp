/**
 * Configuration types and management for Constellation MCP Server.
 * Handles loading and validation of constellation.json files.
 */

/**
 * Supported programming languages for parsing.
 */
export type ParserLanguage =
	| 'typescript'
	| 'javascript'
	| 'python'
	| 'go'
	| 'rust'
	| 'java';

/**
 * Configuration mapping for supported programming languages.
 * Maps language identifiers to their file extension configurations.
 */
export type IConstellationLanguageConfig = {
	[key in ParserLanguage]?: {
		/** File extensions associated with this language (e.g., ['.ts', '.tsx']) */
		fileExtensions: string[];
	};
};

/**
 * Interface defining the structure of Constellation project configuration.
 * Loaded from constellation.json file in project root.
 */
export interface IConstellationConfig {
	/** API endpoint URL for the Constellation service */
	readonly apiUrl: string;
	/** Git branch to track and index */
	readonly branch: string;
	/** Language-specific configuration including file extensions */
	readonly languages: IConstellationLanguageConfig;
	/** Unique project identifier (created in Constellation web app) */
	readonly projectId: string;
}

/**
 * Constellation project configuration with validation capabilities.
 * Manages configuration state and provides validation for project settings.
 */
export class ConstellationConfig implements IConstellationConfig {
	/**
	 * Creates a new ConstellationConfig instance.
	 * @param apiUrl API endpoint URL for the Constellation service
	 * @param branch Git branch to track and index
	 * @param languages Language-specific configuration including file extensions
	 * @param projectId Unique project identifier (created in Constellation web app)
	 */
	constructor(
		readonly apiUrl: string,
		readonly branch: string,
		readonly languages: IConstellationLanguageConfig,
		readonly projectId: string,
	) {}

	/**
	 * Creates a ConstellationConfig from parsed JSON data.
	 * @param data Parsed JSON object from constellation.json
	 * @returns Validated ConstellationConfig instance
	 * @throws Error if configuration is invalid
	 */
	static fromJSON(data: unknown): ConstellationConfig {
		if (!data || typeof data !== 'object') {
			throw new Error('Invalid configuration: expected an object');
		}

		const parsed = data as Partial<IConstellationConfig>;

		// Provide defaults for optional fields
		const defaultConfig = ConstellationConfig.createDefault();

		const config = new ConstellationConfig(
			parsed.apiUrl || defaultConfig.apiUrl,
			parsed.branch || defaultConfig.branch,
			parsed.languages || defaultConfig.languages,
			parsed.projectId || defaultConfig.projectId,
		);

		// Validate the configuration immediately after creation
		config.validate();
		return config;
	}

	/**
	 * Validates that the configuration has all required fields with valid values.
	 * @throws Error if any required field is missing or invalid
	 */
	validate(): void {
		if (!this.apiUrl) {
			throw new Error('Invalid configuration: apiUrl is missing');
		}

		if (!this.branch) {
			throw new Error('Invalid configuration: branch is missing');
		}

		if (!this.languages || Object.keys(this.languages).length === 0) {
			throw new Error('Invalid configuration: no languages configured');
		}

		if (!this.projectId) {
			throw new Error('Invalid configuration: projectId is missing');
		}

		// Validate apiUrl is a valid URL
		try {
			new URL(this.apiUrl);
		} catch {
			throw new Error(
				`Invalid configuration: apiUrl "${this.apiUrl}" is not a valid URL`,
			);
		}

		// Validate language configurations
		for (const [lang, config] of Object.entries(this.languages)) {
			if (!config?.fileExtensions || config.fileExtensions.length === 0) {
				throw new Error(
					`Invalid configuration: language "${lang}" has no file extensions`,
				);
			}

			// Ensure all extensions start with a dot
			for (const ext of config.fileExtensions) {
				if (!ext.startsWith('.')) {
					throw new Error(
						`Invalid configuration: file extension "${ext}" for language "${lang}" must start with a dot`,
					);
				}
			}
		}
	}

	/**
	 * Creates a default configuration for development/testing.
	 * @returns Default ConstellationConfig instance
	 */
	static createDefault(): ConstellationConfig {
		return new ConstellationConfig(
			'http://localhost:3000',
			'main',
			{
				typescript: {
					fileExtensions: ['.ts', '.tsx'],
				},
				javascript: {
					fileExtensions: ['.js', '.jsx'],
				},
			},
			'default-project',
		);
	}
}
