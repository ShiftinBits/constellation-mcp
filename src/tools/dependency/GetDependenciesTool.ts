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
import { section, emphasize, keyValue, collapsedHint } from '../../utils/format-helpers.js';
import { MARKERS, getFileMarkers, applyMarkers } from '../../utils/semantic-markers.js';
import { booleanSchema } from '../../utils/schema-helpers.js';

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
			type: booleanSchema.optional().default(false),
			description:
				'Include external package dependencies (default: false)',
		},
		includeSymbols: {
			type: booleanSchema.optional().default(false),
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

		// Apply file markers to main file
		const fileMarkers = getFileMarkers(file || 'unknown');
		const fileDisplay = fileMarkers.length > 0
			? applyMarkers(fileMarkers, file || 'unknown')
			: file || 'unknown';

		let output = `${section('Dependencies Analysis', 1)}\n\n`;
		output += `${keyValue('File', fileDisplay)}\n\n`;

		// Direct dependencies
		const directCount = directDependencies?.length || 0;
		if (directCount > 0) {
			output += `${section('Direct Dependencies', 2)} (${directCount})\n\n`;
			for (const dep of directDependencies!) {
				const depPath = dep?.filePath || dep?.moduleName || 'unknown';
				const depMarkers = getFileMarkers(depPath);
				const depDisplay = depMarkers.length > 0 ? applyMarkers(depMarkers, depPath) : depPath;

				output += `→ ${depDisplay}`;
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
			output += `\n${section('Transitive Dependencies', 2)} (${transitiveCount})\n\n`;
			for (const dep of transitiveDependencies!.slice(0, 20)) {
				const depPath = dep?.filePath || dep?.moduleName || 'unknown';
				const depMarkers = getFileMarkers(depPath);
				const depDisplay = depMarkers.length > 0 ? applyMarkers(depMarkers, depPath) : depPath;

				output += `→ ${depDisplay}`;
				if (dep?.distance !== undefined) {
					output += ` (distance: ${dep.distance})`;
				}
				if (dep?.path && dep.path.length > 0) {
					output += `\n  Path: ${dep.path.join(' → ')}`;
				}
				output += '\n';
			}
			if (transitiveCount > 20) {
				output += `\n${collapsedHint(transitiveCount, 20)}\n`;
			}
		}

		// Package dependencies
		const packageCount = packages?.length || 0;
		if (packageCount > 0) {
			output += `\n${section('Package Dependencies', 2)} (${packageCount})\n\n`;
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
		const totalCount = directCount + transitiveCount;
		if (directCount === 0 && transitiveCount === 0 && packageCount === 0) {
			output += 'No dependencies found. This file is independent.\n';
		} else {
			output += `\n${section('Summary')}\n`;
			output += `${keyValue('Direct', directCount)}\n`;
			if (transitiveCount > 0) {
				output += `${keyValue('Transitive', transitiveCount)}\n`;
			}
			if (packageCount > 0) {
				output += `${keyValue('Packages', packageCount)}\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetDependenciesTool;
