/**
 * Get Dependencies Tool
 *
 * MCP tool for finding what a file or symbol depends on
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
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
		'Find what a file or symbol depends on. Shows imports, function calls, and references to understand what the target relies on. ' +
		'**PAGINATION**: Supports limit/offset with default of 20. Use for files with many dependencies. Pagination is per-depth level when using transitive analysis. ' +
		'Increase limit (50-100) for heavily-coupled files.';

	schema = {
		filePath: {
			type: z.string().min(1),
			description:
				'File path to analyze dependencies for (e.g., "src/components/Button.tsx")',
		},
		depth: {
			type: z.coerce.number().int().min(0).max(10).optional().default(1),
			description:
				'How many levels deep to traverse dependencies (default: 1, max: 10)',
		},
		includePackages: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include external package dependencies (default: false)',
		},
		includeSymbols: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include symbol-level dependency details (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(20),
			description:
				'Maximum number of dependencies to return per page (default: 20, max: 100). Use 20-30 for typical files, 50-100 for heavily-coupled files with many imports.',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Starting position for pagination (default: 0). Increment by limit for subsequent pages. Example: limit=20, offset=20 gets dependencies 21-40.',
		},
	};

	// No parameter transformation needed - direct passthrough to API

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
