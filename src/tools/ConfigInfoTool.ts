import { MCPTool } from "mcp-framework";
import { z } from "zod";
import { getConfiguration } from "../index.js";

interface ConfigInfoInput {
	field?: string;
}

/**
 * MCP Tool that provides access to the current Constellation configuration.
 * This tool demonstrates how other tools can access the loaded configuration.
 */
class ConfigInfoTool extends MCPTool<ConfigInfoInput> {
	name = "constellation_config_info";
	description = "Get information about the current Constellation configuration";

	schema = {
		field: {
			type: z.string().optional(),
			description: "Specific field to retrieve (e.g., 'namespace', 'apiUrl', 'branch')",
		},
	};

	async execute(input: ConfigInfoInput) {
		const config = getConfiguration();

		if (!config) {
			return {
				success: false,
				error: "No configuration loaded. Please ensure constellation.json exists in your project."
			};
		}

		// If a specific field is requested
		if (input.field) {
			const fieldValue = (config as any)[input.field];
			if (fieldValue !== undefined) {
				return {
					success: true,
					field: input.field,
					value: fieldValue
				};
			} else {
				return {
					success: false,
					error: `Unknown configuration field: ${input.field}`,
					availableFields: Object.keys(config)
				};
			}
		}

		// Return full configuration info
		return {
			success: true,
			configuration: {
				namespace: config.namespace,
				apiUrl: config.apiUrl,
				branch: config.branch,
				languages: config.languages,
				configuredLanguages: Object.keys(config.languages),
				totalFileExtensions: Object.values(config.languages)
					.reduce((total, lang) => total + lang.fileExtensions.length, 0)
			}
		};
	}
}

export default ConfigInfoTool;