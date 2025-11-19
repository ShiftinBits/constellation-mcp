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
import { booleanSchema } from '../../utils/schema-helpers.js';

class GetDependentsTool extends BaseMcpTool<
	GetDependentsParams,
	GetDependentsResult
> {
	name = 'get_dependents';
	description =
		'Find what depends on a file or symbol (inverse dependencies). Shows which files import or use the target to understand impact of changes. ' +
		'**PAGINATION**: Supports limit/offset with default of 20. Essential for widely-used utilities/components that have many dependents. ' +
		'Use higher limit (50-100) for popular shared modules to see full impact.';

	schema = z.object({
		filePath: z.string().min(1).describe(
			'File path to analyze dependents for (e.g., "src/utils/helpers.ts")'
		),
		depth: z.coerce.number().int().min(0).max(10).optional().default(1).describe(
			'How many levels deep to traverse dependents (default: 1, max: 10)'
		),
		includeSymbols: booleanSchema.optional().default(false).describe(
			'Include symbol-level dependent details (default: false)'
		),
		includeImpactMetrics: booleanSchema.optional().default(false).describe(
			'Include detailed impact metrics (default: false)'
		),
		limit: z.coerce.number().int().min(1).max(100).optional().default(20).describe(
			'Maximum number of dependents to return per page (default: 20, max: 100). Use 20-30 for typical analysis, 50-100 for critical shared utilities with many dependents.'
		),
		offset: z.coerce.number().int().min(0).optional().default(0).describe(
			'Starting position for pagination (default: 0). Useful for exploring large dependent sets. Example: limit=20, offset=20 gets dependents 21-40.'
		),
	});

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

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default GetDependentsTool;
