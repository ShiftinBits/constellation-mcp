/**
 * Impact Analysis Tool
 *
 * MCP tool for comprehensive impact analysis combining change impact, breaking changes,
 * and dependency analysis into a single holistic view
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import {
	ImpactAnalysisParams,
	ImpactAnalysisResult,
} from '../../types/api-types.js';
import { section, emphasize, keyValue, collapsedHint } from '../../utils/format-helpers.js';
import { MARKERS, markExported } from '../../utils/semantic-markers.js';
import { booleanSchema } from '../../utils/schema-helpers.js';

class ImpactAnalysisTool extends BaseMcpTool<
	ImpactAnalysisParams,
	ImpactAnalysisResult
> {
	name = 'impact_analysis';
	description =
		'Comprehensive impact analysis combining change impact, breaking changes, and dependencies. Provides holistic view of what changes will affect across the codebase.';

	schema = z.object({
		symbolId: z.string().optional().describe(
			'Unique symbol identifier'
		),
		qualifiedName: z.string().optional().describe(
			'Qualified symbol name'
		),
		symbolName: z.string().optional().describe(
			'Symbol name'
		),
		filePath: z.string().optional().describe(
			'File path (required for symbol-level or for file-level analysis)'
		),
		includeDirectDependents: booleanSchema.optional().default(true).describe(
			'Include direct dependents (default: true)'
		),
		includeTransitiveDependents: booleanSchema.optional().default(true).describe(
			'Include transitive dependents (default: true)'
		),
		depth: z.coerce.number().int().min(1).max(5).optional().default(3).describe(
			'Maximum dependency depth to analyze (default: 3, max: 5)'
		),
		excludeTests: booleanSchema.optional().default(true).describe(
			'Exclude test files from analysis (default: true)'
		),
		excludeGenerated: booleanSchema.optional().default(true).describe(
			'Exclude generated files from analysis (default: true)'
		),
		analyzeBreakingChanges: booleanSchema.optional().default(true).describe(
			'Analyze potential breaking changes (default: true)'
		),
	});

	// No parameter transformation needed - direct passthrough to API

	/**
	 * Format the comprehensive impact analysis for AI-friendly output
	 */
	protected formatResult(
		data: ImpactAnalysisResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive check
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { symbol, directDependents, transitiveDependents, impactedFiles, breakingChangeRisk, summary } = data;

		let output = `Comprehensive Impact Analysis\n\n`;

		// Target info
		output += `${section('Target')}\n`;
		output += `${keyValue('Type', symbol.kind)}\n`;
		output += `${keyValue('Name', symbol.name)}\n`;
		if (symbol.filePath) {
			output += `${keyValue('File', symbol.filePath)}\n`;
		}

		// Summary
		output += `\n${section('Impact Summary')}\n`;
		const directCount = directDependents?.length || 0;
		const transitiveCount = transitiveDependents?.length || 0;
		const impactedFileCount = impactedFiles?.length || 0;

		output += `Direct Dependents: ${directCount}\n`;
		output += `Transitive Dependents: ${transitiveCount}\n`;
		output += `Impacted Files: ${impactedFileCount}\n`;
		output += `Test Files: ${summary.testFileCount || 0}\n`;
		output += `Production Files: ${summary.productionFileCount || 0}\n`;
		output += `Max Depth: ${summary.maxDepth}\n`;

		// Direct dependents
		if (directCount > 0) {
			output += `\n${section('Direct Dependents')} (${directCount})\n\n`;
			for (const dep of directDependents!.slice(0, 10)) {
				const depName = dep.isExported ? markExported(dep.name) : dep.name;
				output += `  ${depName} (${dep.kind})\n`;
				output += `    ${dep.filePath}:${dep.line}\n`;
				output += `    Relationship: ${dep.relationshipType}\n`;
				output += '\n';
			}
			if (directCount > 10) {
				output += `  ${collapsedHint(directCount, 10)}\n\n`;
			}
		}

		// Transitive dependents
		if (transitiveCount > 0) {
			output += `${section('Transitive Dependents')} (${transitiveCount})\n\n`;
			for (const dep of transitiveDependents!.slice(0, 10)) {
				output += `  ${dep.name} (${dep.kind}) - depth ${dep.depth}\n`;
				output += `    ${dep.filePath}:${dep.line}\n`;
				output += `    Relationship: ${dep.relationshipType}\n`;
				output += '\n';
			}
			if (transitiveCount > 10) {
				output += `  ${collapsedHint(transitiveCount, 10)}\n\n`;
			}
		}

		// Impacted files
		if (impactedFileCount > 0) {
			output += `${section('Impacted Files')} (${impactedFileCount})\n\n`;
			for (const file of impactedFiles!.slice(0, 15)) {
				const fileLine = file.isTest ? `${MARKERS.TEST} ${file.filePath}` : file.filePath;
				output += `  ${fileLine}\n`;
				output += `    ${file.symbolCount} symbol(s) affected\n`;
				if (file.symbols && file.symbols.length > 0) {
					output += `    Symbols: ${file.symbols.map(s => s.name).join(', ')}\n`;
				}
				output += '\n';
			}
			if (impactedFileCount > 15) {
				output += `  ${collapsedHint(impactedFileCount, 15)}\n\n`;
			}
		}

		// Breaking change risk
		if (breakingChangeRisk) {
			output += `${section('Breaking Change Risk')}\n`;
			output += `${keyValue('Level', `${this.getRiskMarker(breakingChangeRisk.riskLevel)} ${breakingChangeRisk.riskLevel.toUpperCase()}`)}\n\n`;

			if (breakingChangeRisk.factors && breakingChangeRisk.factors.length > 0) {
				output += `${section('Risk Factors', 3)}\n`;
				for (const factor of breakingChangeRisk.factors) {
					output += `  - ${emphasize(factor.factor)} (${factor.severity})\n`;
					output += `    ${factor.description}\n`;
				}
				output += '\n';
			}

			if (breakingChangeRisk.recommendations && breakingChangeRisk.recommendations.length > 0) {
				output += `${section('Recommendations', 3)}\n`;
				for (let i = 0; i < breakingChangeRisk.recommendations.length; i++) {
					output += `${i + 1}. ${breakingChangeRisk.recommendations[i]}\n`;
				}
			}
		}

		// Action plan
		output += `\n${section('Suggested Action Plan')}\n\n`;
		const riskLevel = breakingChangeRisk?.riskLevel || 'low';
		const totalImpacted = directCount + transitiveCount;
		const hasCriticalPaths = (breakingChangeRisk?.factors?.length || 0) > 0;

		if (riskLevel === 'critical' || riskLevel === 'high') {
			output += `1. **Review Dependencies**: Understand all critical paths\n`;
			output += `2. **Create Feature Branch**: Isolate changes\n`;
			output += `3. **Update Tests First**: Ensure test coverage\n`;
			output += `4. **Make Changes Incrementally**: Small, testable steps\n`;
			output += `5. **Update Documentation**: Keep docs in sync\n`;
			output += `6. **Coordinate with Team**: High-impact change requires review\n`;
			output += `7. **Monitor After Deploy**: Watch for issues\n`;
		} else if (riskLevel === 'medium') {
			output += `1. **Review Impact Areas**: Understand what's affected\n`;
			output += `2. **Update Tests**: Ensure coverage for changes\n`;
			output += `3. **Make Changes**: Implement modifications\n`;
			output += `4. **Update Related Files**: Address required changes\n`;
			output += `5. **Run Full Test Suite**: Verify nothing breaks\n`;
		} else {
			output += `1. **Make Changes**: Low-risk modification\n`;
			output += `2. **Update Tests**: Quick verification\n`;
			output += `3. **Run Relevant Tests**: Targeted test execution\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private getRiskMarker(level: string): string {
		switch (level.toUpperCase()) {
			case 'CRITICAL':
				return MARKERS.BREAKING;
			case 'HIGH':
				return MARKERS.RISKY;
			case 'MEDIUM':
				return MARKERS.RISKY;
			case 'LOW':
				return MARKERS.SAFE;
			default:
				return '[UNKNOWN]';
		}
	}
}

export default ImpactAnalysisTool;
