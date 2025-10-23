/**
 * Get Dependencies Tool
 *
 * MCP tool for finding what a file or symbol depends on
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';
import {
	GetDependenciesParams,
	GetDependenciesResult,
} from '../../types/api-types.js';
import { formatDependencies } from '../../utils/format-helpers.js';

class GetDependenciesTool extends BaseMcpTool<
	GetDependenciesParams,
	GetDependenciesResult
> {
	name = 'get_dependencies';
	description =
		'Find what a file or symbol depends on. Shows imports, function calls, and references to understand what the target relies on.';

	schema = {
		filePath: {
			type: z.string().optional(),
			description:
				'File path to analyze dependencies for (e.g., "src/components/Button.tsx"). Required if symbolId not provided.',
		},
		symbolId: {
			type: z.string().optional(),
			description:
				'Symbol ID to analyze (alternative to filePath + symbolName)',
		},
		symbolName: {
			type: z.string().optional(),
			description:
				'Symbol name when analyzing a specific symbol (optional, use with filePath)',
		},
		depth: {
			type: z.coerce.number().int().min(1).max(5).optional().default(1),
			description:
				'How many levels deep to traverse dependencies (default: 1, max: 5)',
		},
		includeExternal: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include external package dependencies (default: false)',
		},
	};

	/**
	 * Override execute to generate symbolId from filePath + symbolName if needed
	 */
	async execute(input: GetDependenciesParams & { symbolName?: string }): Promise<string> {
		// If symbolName provided with filePath but no symbolId, generate it
		if (!input.symbolId && input.filePath && input.symbolName) {
			input.symbolId = this.generateSymbolId(input.filePath, input.symbolName);
		}

		// Validate that we have either filePath or symbolId
		if (!input.filePath && !input.symbolId) {
			return 'Error: Either filePath or symbolId (or filePath + symbolName) must be provided';
		}

		return super.execute(input);
	}

	/**
	 * Format the dependencies for AI-friendly output
	 */
	protected formatResult(
		data: GetDependenciesResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { file, directDependencies, transitiveDependencies, packages } = data;

		let output = `Dependencies Analysis\n\n`;
		output += `File: ${file || 'unknown'}\n\n`;

		// Direct dependencies
		const directCount = directDependencies?.length || 0;
		if (directCount > 0) {
			output += `## Direct Dependencies (${directCount})\n\n`;
			for (const dep of directDependencies!) {
				output += `→ ${dep?.filePath || 'unknown'}`;
				if (dep?.isDefault) {
					output += ' (default import)';
				} else if (dep?.isNamespace) {
					output += ' (namespace import)';
				}
				if (dep?.importedSymbols && dep.importedSymbols.length > 0) {
					output += `\n  Imports: ${dep.importedSymbols.join(', ')}`;
				}
				output += '\n';
			}
		}

		// Transitive dependencies
		const transitiveCount = transitiveDependencies?.length || 0;
		if (transitiveCount > 0) {
			output += `\n## Transitive Dependencies (${transitiveCount})\n\n`;
			for (const dep of transitiveDependencies!.slice(0, 20)) {
				output += `→ ${dep?.filePath || 'unknown'}`;
				if (dep?.distance !== undefined) {
					output += ` (distance: ${dep.distance})`;
				}
				if (dep?.path && dep.path.length > 0) {
					output += `\n  Path: ${dep.path.join(' → ')}`;
				}
				output += '\n';
			}
			if (transitiveCount > 20) {
				output += `\n... and ${transitiveCount - 20} more\n`;
			}
		}

		// Package dependencies
		const packageCount = packages?.length || 0;
		if (packageCount > 0) {
			output += `\n## Package Dependencies (${packageCount})\n\n`;
			for (const pkg of packages!) {
				output += `→ ${pkg?.name || 'unknown'}`;
				if (pkg?.version) {
					output += ` @${pkg.version}`;
				}
				if (pkg?.type) {
					output += ` (${pkg.type})`;
				}
				output += '\n';
			}
		}

		// Summary
		if (directCount === 0 && transitiveCount === 0 && packageCount === 0) {
			output += 'No dependencies found. This file is independent.\n';
		} else {
			output += `\n## Summary\n`;
			output += `Direct: ${directCount}\n`;
			if (transitiveCount > 0) {
				output += `Transitive: ${transitiveCount}\n`;
			}
			if (packageCount > 0) {
				output += `Packages: ${packageCount}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetDependenciesTool;
