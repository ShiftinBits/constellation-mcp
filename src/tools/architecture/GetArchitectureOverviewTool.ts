/**
 * Get Architecture Overview Tool
 *
 * MCP tool for getting a high-level overview of the codebase architecture
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatBytes } from '../../utils/format-helpers.js';

interface GetArchitectureOverviewParams {
	includeStats?: boolean;
	includeModules?: boolean;
	includeLayers?: boolean;
}

interface ModuleInfo {
	name: string;
	path: string;
	fileCount: number;
	symbolCount: number;
	dependencies: number;
}

interface LayerInfo {
	name: string;
	modules: string[];
	description: string;
}

interface GetArchitectureOverviewResult {
	projectInfo: {
		name: string;
		totalFiles: number;
		totalSymbols: number;
		languages: Record<string, number>;
	};
	stats?: {
		linesOfCode: number;
		codeSize: number;
		avgFileSize: number;
	};
	modules?: ModuleInfo[];
	layers?: LayerInfo[];
	dependencies: {
		internal: number;
		external: number;
		circular: number;
	};
}

class GetArchitectureOverviewTool extends BaseMcpTool<
	GetArchitectureOverviewParams,
	GetArchitectureOverviewResult
> {
	name = 'get_architecture_overview';
	description =
		'Get a high-level overview of the codebase architecture including modules, layers, dependencies, and statistics. Useful for understanding system structure.';

	schema = {
		includeStats: {
			type: z.boolean().optional().default(true),
			description:
				'Include code statistics (lines, size, etc.) - default: true',
		},
		includeModules: {
			type: z.boolean().optional().default(true),
			description: 'Include module breakdown - default: true',
		},
		includeLayers: {
			type: z.boolean().optional().default(true),
			description:
				'Include architectural layers analysis - default: true',
		},
	};

	/**
	 * Format the architecture overview for AI-friendly output
	 */
	protected formatResult(
		data: GetArchitectureOverviewResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { projectInfo, stats, modules, layers, dependencies } = data;

		let output = `Architecture Overview: ${projectInfo.name}\n\n`;

		// Project stats
		output += `## Project Statistics\n`;
		output += `Files: ${projectInfo.totalFiles}\n`;
		output += `Symbols: ${projectInfo.totalSymbols}\n`;

		if (stats) {
			output += `Lines of Code: ${stats.linesOfCode.toLocaleString()}\n`;
			output += `Total Size: ${formatBytes(stats.codeSize)}\n`;
			output += `Avg File Size: ${formatBytes(stats.avgFileSize)}\n`;
		}

		output += `\nLanguages:\n`;
		const sortedLangs = Object.entries(projectInfo.languages).sort(
			([, a], [, b]) => b - a
		);
		for (const [lang, count] of sortedLangs) {
			const percentage = ((count / projectInfo.totalFiles) * 100).toFixed(1);
			output += `  ${lang}: ${count} files (${percentage}%)\n`;
		}

		// Dependencies
		output += `\n## Dependencies\n`;
		output += `Internal: ${dependencies.internal}\n`;
		output += `External: ${dependencies.external}\n`;
		if (dependencies.circular > 0) {
			output += `⚠️  Circular: ${dependencies.circular}\n`;
		}

		// Layers
		if (layers && layers.length > 0) {
			output += `\n## Architectural Layers (${layers.length})\n`;
			for (const layer of layers) {
				output += `\n### ${layer.name}\n`;
				output += `${layer.description}\n`;
				output += `Modules: ${layer.modules.length}\n`;
				if (layer.modules.length <= 5) {
					for (const mod of layer.modules) {
						output += `  - ${mod}\n`;
					}
				} else {
					for (const mod of layer.modules.slice(0, 3)) {
						output += `  - ${mod}\n`;
					}
					output += `  ... and ${layer.modules.length - 3} more\n`;
				}
			}
		}

		// Modules
		if (modules && modules.length > 0) {
			output += `\n## Top Modules by Size (${modules.length} total)\n`;
			const sorted = [...modules].sort((a, b) => b.fileCount - a.fileCount);

			for (const mod of sorted.slice(0, 10)) {
				output += `\n### ${mod.name}\n`;
				output += `  Path: ${mod.path}\n`;
				output += `  Files: ${mod.fileCount}\n`;
				output += `  Symbols: ${mod.symbolCount}\n`;
				output += `  Dependencies: ${mod.dependencies}\n`;
			}

			if (modules.length > 10) {
				output += `\n... and ${modules.length - 10} more modules\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetArchitectureOverviewTool;
