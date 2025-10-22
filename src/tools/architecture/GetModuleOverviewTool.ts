/**
 * Get Module Overview Tool
 *
 * MCP tool for analyzing a specific module's structure, dependencies, and role in the system
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatBytes } from '../../utils/format-helpers.js';

interface GetModuleOverviewParams {
	modulePath: string;
	includeSubmodules?: boolean;
	includeDependencies?: boolean;
	includeExports?: boolean;
}

interface ModuleExport {
	name: string;
	kind: string;
	filePath: string;
	isPublicApi: boolean;
}

interface Submodule {
	name: string;
	path: string;
	fileCount: number;
	purpose?: string;
}

interface GetModuleOverviewResult {
	module: {
		name: string;
		path: string;
		type: 'package' | 'directory' | 'namespace';
		description?: string;
	};
	stats: {
		totalFiles: number;
		totalSymbols: number;
		linesOfCode: number;
		size: number;
		languages: Record<string, number>;
	};
	structure: {
		submodules: Submodule[];
		entryPoints: string[];
		publicApi: ModuleExport[];
	};
	dependencies: {
		internal: Array<{ module: string; usageCount: number }>;
		external: Array<{ package: string; version?: string; usageCount: number }>;
		circular: string[];
	};
	health: {
		cohesion: 'HIGH' | 'MEDIUM' | 'LOW';
		coupling: 'HIGH' | 'MEDIUM' | 'LOW';
		issues: string[];
		recommendations: string[];
	};
}

class GetModuleOverviewTool extends BaseMcpTool<
	GetModuleOverviewParams,
	GetModuleOverviewResult
> {
	name = 'get_module_overview';
	description =
		'Analyze a specific module (package, directory, or namespace) to understand its structure, dependencies, exports, and health metrics. Useful for refactoring decisions.';

	schema = {
		modulePath: {
			type: z.string().min(1),
			description:
				'Path to module to analyze (e.g., "src/services", "packages/core")',
		},
		includeSubmodules: {
			type: z.boolean().optional().default(true),
			description: 'Include analysis of submodules (default: true)',
		},
		includeDependencies: {
			type: z.boolean().optional().default(true),
			description: 'Include dependency analysis (default: true)',
		},
		includeExports: {
			type: z.boolean().optional().default(true),
			description: 'Include exported API analysis (default: true)',
		},
	};

	/**
	 * Format the module overview for AI-friendly output
	 */
	protected formatResult(
		data: GetModuleOverviewResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { module, stats, structure, dependencies, health } = data;

		let output = `Module Overview: ${module.name}\n\n`;

		// Module info
		output += `## Module Information\n`;
		output += `Path: ${module.path}\n`;
		output += `Type: ${module.type}\n`;
		if (module.description) {
			output += `Description: ${module.description}\n`;
		}

		// Statistics
		output += `\n## Statistics\n`;
		output += `Files: ${stats.totalFiles}\n`;
		output += `Symbols: ${stats.totalSymbols}\n`;
		output += `Lines of Code: ${stats.linesOfCode.toLocaleString()}\n`;
		output += `Size: ${formatBytes(stats.size)}\n`;

		if (Object.keys(stats.languages).length > 0) {
			output += `\nLanguages:\n`;
			const sortedLangs = Object.entries(stats.languages).sort(([, a], [, b]) => b - a);
			for (const [lang, count] of sortedLangs) {
				const percentage = ((count / stats.totalFiles) * 100).toFixed(1);
				output += `  ${lang}: ${count} files (${percentage}%)\n`;
			}
		}

		// Health metrics
		output += `\n## Health Metrics\n`;
		output += `Cohesion: ${this.getHealthEmoji(health.cohesion)} ${health.cohesion}\n`;
		output += `Coupling: ${this.getCouplingEmoji(health.coupling)} ${health.coupling}\n`;

		if (health.issues.length > 0) {
			output += `\n### ⚠️  Issues (${health.issues.length})\n`;
			for (const issue of health.issues) {
				output += `  • ${issue}\n`;
			}
		}

		// Structure
		output += `\n## Module Structure\n`;

		if (structure.entryPoints.length > 0) {
			output += `\nEntry Points (${structure.entryPoints.length}):\n`;
			for (const entry of structure.entryPoints) {
				output += `  • ${entry}\n`;
			}
		}

		if (structure.submodules.length > 0) {
			output += `\nSubmodules (${structure.submodules.length}):\n`;
			for (const sub of structure.submodules) {
				output += `  • ${sub.name} (${sub.fileCount} files)\n`;
				if (sub.purpose) {
					output += `    ${sub.purpose}\n`;
				}
			}
		}

		if (structure.publicApi.length > 0) {
			output += `\nPublic API (${structure.publicApi.length} exports):\n`;

			// Group by kind
			const byKind = new Map<string, ModuleExport[]>();
			for (const exp of structure.publicApi) {
				if (!byKind.has(exp.kind)) {
					byKind.set(exp.kind, []);
				}
				byKind.get(exp.kind)!.push(exp);
			}

			for (const [kind, exports] of byKind) {
				output += `  ${kind} (${exports.length}):\n`;
				for (const exp of exports.slice(0, 5)) {
					output += `    - ${exp.name}\n`;
				}
				if (exports.length > 5) {
					output += `    ... and ${exports.length - 5} more\n`;
				}
			}
		}

		// Dependencies
		if (dependencies.internal.length > 0 || dependencies.external.length > 0) {
			output += `\n## Dependencies\n`;

			if (dependencies.internal.length > 0) {
				output += `\nInternal Dependencies (${dependencies.internal.length}):\n`;
				const sorted = [...dependencies.internal].sort((a, b) => b.usageCount - a.usageCount);
				for (const dep of sorted.slice(0, 10)) {
					output += `  • ${dep.module} (${dep.usageCount} usages)\n`;
				}
				if (dependencies.internal.length > 10) {
					output += `  ... and ${dependencies.internal.length - 10} more\n`;
				}
			}

			if (dependencies.external.length > 0) {
				output += `\nExternal Dependencies (${dependencies.external.length}):\n`;
				const sorted = [...dependencies.external].sort((a, b) => b.usageCount - a.usageCount);
				for (const dep of sorted.slice(0, 10)) {
					const version = dep.version ? `@${dep.version}` : '';
					output += `  • ${dep.package}${version} (${dep.usageCount} usages)\n`;
				}
				if (dependencies.external.length > 10) {
					output += `  ... and ${dependencies.external.length - 10} more\n`;
				}
			}

			if (dependencies.circular.length > 0) {
				output += `\n⚠️  Circular Dependencies (${dependencies.circular.length}):\n`;
				for (const cycle of dependencies.circular.slice(0, 5)) {
					output += `  • ${cycle}\n`;
				}
				if (dependencies.circular.length > 5) {
					output += `  ... and ${dependencies.circular.length - 5} more\n`;
				}
			}
		}

		// Recommendations
		if (health.recommendations.length > 0) {
			output += `\n## 💡 Recommendations\n`;
			for (let i = 0; i < health.recommendations.length; i++) {
				output += `${i + 1}. ${health.recommendations[i]}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private getHealthEmoji(level: string): string {
		switch (level) {
			case 'HIGH':
				return '🟢';
			case 'MEDIUM':
				return '🟡';
			case 'LOW':
				return '🔴';
			default:
				return '⚪';
		}
	}

	private getCouplingEmoji(level: string): string {
		// For coupling, LOW is good, HIGH is bad
		switch (level) {
			case 'LOW':
				return '🟢';
			case 'MEDIUM':
				return '🟡';
			case 'HIGH':
				return '🔴';
			default:
				return '⚪';
		}
	}
}

export default GetModuleOverviewTool;
