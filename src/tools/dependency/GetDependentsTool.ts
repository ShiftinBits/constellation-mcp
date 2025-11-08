/**
 * Get Dependents Tool
 *
 * MCP tool for finding what depends on a file or symbol (inverse dependencies)
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import {
	GetDependentsParams,
	GetDependentsResult,
} from '../../types/api-types.js';
import { section, emphasize, keyValue, collapsedHint } from '../../utils/format-helpers.js';
import { MARKERS, getFileMarkers, applyMarkers } from '../../utils/semantic-markers.js';

class GetDependentsTool extends BaseMcpTool<
	GetDependentsParams,
	GetDependentsResult
> {
	name = 'get_dependents';
	description =
		'Find what depends on a file or symbol (inverse dependencies). Shows which files import or use the target to understand impact of changes. ' +
		'**PAGINATION**: Supports limit/offset with default of 20. Essential for widely-used utilities/components that have many dependents. ' +
		'Use higher limit (50-100) for popular shared modules to see full impact.';

	schema = {
		filePath: {
			type: z.string().min(1),
			description:
				'File path to analyze dependents for (e.g., "src/utils/helpers.ts")',
		},
		depth: {
			type: z.coerce.number().int().min(0).max(10).optional().default(1),
			description:
				'How many levels deep to traverse dependents (default: 1, max: 10)',
		},
		includeSymbols: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include symbol-level dependent details (default: false)',
		},
		includeImpactMetrics: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include detailed impact metrics (default: false)',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(20),
			description:
				'Maximum number of dependents to return per page (default: 20, max: 100). Use 20-30 for typical analysis, 50-100 for critical shared utilities with many dependents.',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Starting position for pagination (default: 0). Useful for exploring large dependent sets. Example: limit=20, offset=20 gets dependents 21-40.',
		},
	};

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the dependents for AI-friendly output
	 */
	protected formatResult(
		data: GetDependentsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { file, directDependents, transitiveDependents, detailedMetrics } = data;

		// Apply file markers to main file
		const fileMarkers = getFileMarkers(file || 'unknown');
		const fileDisplay = fileMarkers.length > 0
			? applyMarkers(fileMarkers, file || 'unknown')
			: file || 'unknown';

		let output = `${section('Dependents Analysis', 1)}\n\n`;
		output += `${keyValue('File', fileDisplay)}\n\n`;

		// Direct dependents
		const directCount = directDependents?.length || 0;
		if (directCount > 0) {
			output += `${section('Direct Dependents', 2)} (${directCount})\n\n`;
			for (const dep of directDependents!) {
				const depPath = dep?.filePath || 'unknown';
				const depMarkers = getFileMarkers(depPath);
				const depDisplay = depMarkers.length > 0 ? applyMarkers(depMarkers, depPath) : depPath;

				output += `← ${depDisplay}`;
				if (dep?.usedSymbols && dep.usedSymbols.length > 0) {
					output += `\n  Uses: ${dep.usedSymbols.join(', ')}`;
				}
				output += '\n';
			}
		}

		// Transitive dependents
		const transitiveCount = transitiveDependents?.length || 0;
		if (transitiveCount > 0) {
			output += `\n${section('Transitive Dependents', 2)} (${transitiveCount})\n\n`;
			for (const dep of transitiveDependents!.slice(0, 20)) {
				const depPath = dep?.filePath || 'unknown';
				const depMarkers = getFileMarkers(depPath);
				const depDisplay = depMarkers.length > 0 ? applyMarkers(depMarkers, depPath) : depPath;

				output += `← ${depDisplay}`;
				if (dep?.distance !== undefined) {
					output += ` (distance: ${dep.distance})`;
				}
				if (dep?.path && dep.path.length > 0) {
					output += `\n  Path: ${dep.path.join(' ← ')}`;
				}
				output += '\n';
			}
			if (transitiveCount > 20) {
				output += `\n${collapsedHint(transitiveCount, 20)}\n`;
			}
		}

		// Detailed metrics
		if (detailedMetrics) {
			output += `\n${section('Detailed Metrics')}\n`;

			if (detailedMetrics.byDepth && Object.keys(detailedMetrics.byDepth).length > 0) {
				output += `\n${section('By Depth', 3)}\n`;
				for (const [depth, count] of Object.entries(detailedMetrics.byDepth)) {
					output += `  ${keyValue(`Depth ${depth}`, `${count} file${count === 1 ? '' : 's'}`, false)}\n`;
				}
			}

			if (detailedMetrics.criticalPaths && detailedMetrics.criticalPaths.length > 0) {
				output += `\n${section('Critical Impact Paths', 3)}\n`;
				for (const path of detailedMetrics.criticalPaths.slice(0, 5)) {
					output += `  ${path.join(' → ')}\n`;
				}
				if (detailedMetrics.criticalPaths.length > 5) {
					output += `  ${collapsedHint(detailedMetrics.criticalPaths.length, 5)}\n`;
				}
			}

			if (detailedMetrics.mostImpactedFiles && detailedMetrics.mostImpactedFiles.length > 0) {
				output += `\n${section('Most Impacted Files', 3)}\n`;
				for (const impactedFile of detailedMetrics.mostImpactedFiles.slice(0, 5)) {
					const impactedMarkers = getFileMarkers(impactedFile);
					const impactedDisplay = impactedMarkers.length > 0 ? applyMarkers(impactedMarkers, impactedFile) : impactedFile;
					output += `  - ${impactedDisplay}\n`;
				}
			}
		}

		// Summary
		if (directCount === 0 && transitiveCount === 0) {
			output += `${MARKERS.UNUSED} No dependents found. This file is not used anywhere (may be orphaned code).\n`;
		} else {
			output += `\n${section('Summary')}\n`;
			output += `${keyValue('Direct', directCount)}\n`;
			if (transitiveCount > 0) {
				output += `${keyValue('Transitive', transitiveCount)}\n`;
			}
			const totalCount = directCount + transitiveCount;
			output += `${keyValue('Total Impact', `${totalCount} file${totalCount === 1 ? '' : 's'}`)}\n`;
		}

		// Contextual next-step suggestions
		const totalCount = directCount + transitiveCount;

		output += `\n\n${section('Suggested Next Steps')}\n\n`;

		if (totalCount === 0) {
			output += `${MARKERS.SAFE} ${emphasize('Safe to delete')} - No dependents found. This file appears to be orphaned.\n`;
			output += `- ${emphasize('find_orphaned_code')} - Discover other unused files to clean up your codebase.\n`;
		} else if (totalCount <= 10) {
			output += `${emphasize('Low impact')} - Only ${totalCount} dependent${totalCount === 1 ? '' : 's'}. Changes are relatively safe.\n`;
			output += `- ${emphasize('get_symbol_details')} - Review individual symbols before making changes.\n`;
			if (transitiveCount > 0) {
				output += `- ${emphasize('trace_symbol_usage')} - Understand how transitive dependents use this file.\n`;
			}
		} else if (totalCount <= 50) {
			output += `${emphasize('Moderate impact')} - ${totalCount} dependents. Plan changes carefully.\n`;
			output += `- ${emphasize('impact_analysis')} - Get comprehensive analysis of what will break if you change this file.\n`;
			output += `- ${emphasize('get_call_graph')} - Visualize how these dependents interact with this file.\n`;
			if (directCount > 10) {
				output += `- ${emphasize('search_symbols')} - Find specific symbols to understand usage patterns.\n`;
			}
		} else {
			output += `${MARKERS.HIGH_IMPACT} ${emphasize('High impact')} - ${totalCount} dependents. Proceed with extreme caution.\n`;
			output += `- ${emphasize('impact_analysis')} - REQUIRED: Analyze breaking change risk before modifications.\n`;
			output += `- ${emphasize('trace_symbol_usage')} - Understand all usage patterns across the codebase.\n`;
			output += `- ${emphasize('find_circular_dependencies')} - Check for circular dependencies that complicate refactoring.\n`;
			if (detailedMetrics?.criticalPaths && detailedMetrics.criticalPaths.length > 0) {
				output += `- ${emphasize('get_call_graph')} - Critical paths detected. Map execution flows before changes.\n`;
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetDependentsTool;
