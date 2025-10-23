/**
 * Get Module Overview Tool
 *
 * MCP tool for analyzing a specific module's structure, dependencies, and role in the system
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import { formatBytes } from '../../utils/format-helpers.js';

interface GetModuleOverviewParams {
	moduleName?: string;
	modulePath?: string;
	includeFiles?: boolean;
	includeExports?: boolean;
	includeSubmodules?: boolean;
	includeDependencies?: boolean;
	includeConfidence?: boolean;
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
		moduleName: {
			type: z.string().optional(),
			description:
				'Module name to analyze (e.g., "services", "core")',
		},
		modulePath: {
			type: z.string().optional(),
			description:
				'Path to module to analyze (e.g., "src/services", "packages/core")',
		},
		includeFiles: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include file-level details (default: false)',
		},
		includeExports: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include exported symbol details (default: false)',
		},
		includeSubmodules: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include analysis of submodules (default: false)',
		},
		includeDependencies: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include dependency analysis (default: false)',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include confidence scores (default: false)',
		},
	};

	/**
	 * Format the module overview for AI-friendly output
	 */
	protected formatResult(
		data: GetModuleOverviewResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data || !data.module || !data.structure) {
			return 'Error: No module data returned from API';
		}

		const { module, structure, files, exports, submodules, dependencies } = data;

		let output = `Module Overview: ${module?.name || 'unknown'}\n\n`;

		// Module info
		output += `## Module Information\n`;
		output += `Root Path: ${module?.rootPath || module?.path || 'unknown'}\n`;
		output += `Type: ${module?.type || 'unknown'}\n`;
		output += `Language: ${module?.language || 'unknown'}\n`;
		if (module?.framework) {
			output += `Framework: ${module.framework}\n`;
		}
		if (module?.description) {
			output += `Description: ${module.description}\n`;
		}

		// Structure statistics
		output += `\n## Structure\n`;
		output += `Files: ${structure?.fileCount || 0}\n`;
		output += `Submodules: ${structure?.submoduleCount || 0}\n`;
		output += `Exports: ${structure?.exportCount || 0}\n`;

		// Files (if included)
		if (files && files.length > 0) {
			output += `\n## Files (${files.length})\n`;
			// Group by module type
			const byType = new Map<string, typeof files>();
			for (const file of files) {
				const type = file?.moduleType || 'other';
				if (!byType.has(type)) {
					byType.set(type, []);
				}
				byType.get(type)!.push(file);
			}

			for (const [type, typeFiles] of byType) {
				output += `\n### ${type} (${typeFiles.length})\n`;
				for (const file of typeFiles.slice(0, 10)) {
					output += `  • ${file?.path || 'unknown'}`;
					if (file?.symbolCount !== undefined) {
						output += ` (${file.symbolCount} symbols)`;
					}
					output += '\n';
				}
				if (typeFiles.length > 10) {
					output += `  ... and ${typeFiles.length - 10} more\n`;
				}
			}
		}

		// Submodules (if included)
		if (submodules && submodules.length > 0) {
			output += `\n## Submodules (${submodules.length})\n`;
			for (const sub of submodules) {
				output += `  • ${sub?.name || 'unknown'}`;
				if (sub?.type) {
					output += ` (${sub.type})`;
				}
				if (sub?.fileCount !== undefined) {
					output += ` - ${sub.fileCount} files`;
				}
				output += '\n';
			}
		}

		// Exports (if included)
		if (exports && exports.length > 0) {
			output += `\n## Exported Symbols (${exports.length})\n`;

			// Group by kind
			const byKind = new Map<string, typeof exports>();
			for (const exp of exports) {
				const kind = exp?.symbolKind || 'other';
				if (!byKind.has(kind)) {
					byKind.set(kind, []);
				}
				byKind.get(kind)!.push(exp);
			}

			for (const [kind, kindExports] of byKind) {
				output += `\n### ${kind} (${kindExports.length})\n`;
				for (const exp of kindExports.slice(0, 10)) {
					output += `  • ${exp?.symbolName || 'unknown'}`;
					if (exp?.filePath) {
						output += ` (from ${exp.filePath})`;
					}
					output += '\n';
				}
				if (kindExports.length > 10) {
					output += `  ... and ${kindExports.length - 10} more\n`;
				}
			}
		}

		// Dependencies (if included)
		if (dependencies) {
			const internalCount = dependencies.internal?.length || 0;
			const externalCount = dependencies.external?.length || 0;

			if (internalCount > 0 || externalCount > 0) {
				output += `\n## Dependencies\n`;

				if (internalCount > 0) {
					output += `\n### Internal (${internalCount})\n`;
					for (const dep of dependencies.internal!.slice(0, 10)) {
						output += `  • ${dep}\n`;
					}
					if (internalCount > 10) {
						output += `  ... and ${internalCount - 10} more\n`;
					}
				}

				if (externalCount > 0) {
					output += `\n### External Packages (${externalCount})\n`;
					for (const pkg of dependencies.external!.slice(0, 10)) {
						output += `  • ${pkg}\n`;
					}
					if (externalCount > 10) {
						output += `  ... and ${externalCount - 10} more\n`;
					}
				}
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
