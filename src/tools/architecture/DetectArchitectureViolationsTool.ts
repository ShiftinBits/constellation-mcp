/**
 * Detect Architecture Violations Tool
 *
 * MCP tool for detecting violations of architectural patterns, layer boundaries, and design principles
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface DetectArchitectureViolationsParams {
	filterByType?: string[];
	minSeverity?: string;
	includeContext?: boolean;
	includeSuggestions?: boolean;
	includeCodeHealth?: boolean;
	includeConfidence?: boolean;
	limit?: number;
	offset?: number;
}

interface ArchitectureViolation {
	type: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
	description: string;
	violatingFile: string;
	violatingLine?: number;
	rule: string;
	suggestion: string;
	examples?: string[];
}

interface DetectArchitectureViolationsResult {
	summary: {
		totalViolations: number;
		bySeverity: {
			critical: number;
			high: number;
			medium: number;
			low: number;
		};
		byCategory: Record<string, number>;
	};
	violations: ArchitectureViolation[];
	patterns: {
		commonIssues: Array<{
			pattern: string;
			count: number;
			description: string;
		}>;
	};
	compliance: {
		score: number;
		grade: 'A' | 'B' | 'C' | 'D' | 'F';
	};
}

class DetectArchitectureViolationsTool extends BaseMcpTool<
	DetectArchitectureViolationsParams,
	DetectArchitectureViolationsResult
> {
	name = 'detect_architecture_violations';
	description =
		'Detect violations of architectural patterns, layer boundaries, dependency rules, and design principles. Helps maintain clean architecture.';

	schema = {
		filterByType: {
			type: z.array(z.string()).optional(),
			description:
				'Filter by violation type (e.g., ["layer-boundary", "circular-dependency"])',
		},
		minSeverity: {
			type: z.string().optional().default('low'),
			description:
				'Minimum severity level to report (default: low)',
		},
		includeContext: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include code context for violations (default: true)',
		},
		includeSuggestions: {
			type: z.coerce.boolean().optional().default(true),
			description: 'Include fix suggestions (default: true)',
		},
		includeCodeHealth: {
			type: z.coerce.boolean().optional(),
			description: 'Include overall code health metrics',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional(),
			description: 'Include confidence scores for violations',
		},
		limit: {
			type: z.coerce.number().int().min(1).max(100).optional().default(100),
			description:
				'Maximum number of violations to return (default: 100, max: 100)',
		},
		offset: {
			type: z.coerce.number().int().min(0).optional().default(0),
			description: 'Offset for pagination (default: 0)',
		},
	};

	/**
	 * Format the architecture violations for AI-friendly output
	 */
	protected formatResult(
		data: DetectArchitectureViolationsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		// Backend DTO returns violations[], circularDependencies[], codeHealth{}
		const { violations, circularDependencies, codeHealth } = data;

		const violationsArray = violations || [];
		const circularArray = circularDependencies || [];

		let output = `Architecture Violations Report\n\n`;

		// Code health metrics
		if (codeHealth) {
			output += `## Code Health Score: ${codeHealth.overallScore || 0}/100\n`;
			output += `Maintainability Index: ${codeHealth.maintainabilityIndex || 0}\n`;
			output += `Trend: ${codeHealth.trendDirection || 'unknown'}\n`;

			if (codeHealth.technicalDebt) {
				output += `\nTechnical Debt:\n`;
				output += `  Estimated Hours: ${codeHealth.technicalDebt.estimatedHours || 0}\n`;
				output += `  Critical Issues: ${codeHealth.technicalDebt.criticalIssues || 0}\n`;
			}
			output += '\n';
		}

		if (violationsArray.length === 0 && circularArray.length === 0) {
			output += '✅ No architecture violations detected! Your codebase follows architectural principles.\n';
		} else {
			// Summary
			output += `## Summary\n`;
			output += `Total Violations: ${violationsArray.length}\n`;
			output += `Circular Dependencies: ${circularArray.length}\n\n`;

			// Calculate by severity
			const bySeverity: Record<string, number> = {};
			for (const v of violationsArray) {
				const sev = v?.severity || 'low';
				bySeverity[sev] = (bySeverity[sev] || 0) + 1;
			}

			output += `By Severity:\n`;
			if (bySeverity.critical > 0) {
				output += `  🔴 Critical: ${bySeverity.critical}\n`;
			}
			if (bySeverity.high > 0) {
				output += `  🟠 High: ${bySeverity.high}\n`;
			}
			if (bySeverity.medium > 0) {
				output += `  🟡 Medium: ${bySeverity.medium}\n`;
			}
			if (bySeverity.low > 0) {
				output += `  🟢 Low: ${bySeverity.low}\n`;
			}

			// Group by type
			const byType: Record<string, number> = {};
			for (const v of violationsArray) {
				const type = v?.type || 'unknown';
				byType[type] = (byType[type] || 0) + 1;
			}

			if (Object.keys(byType).length > 0) {
				output += `\nBy Type:\n`;
				const sorted = Object.entries(byType).sort(([, a], [, b]) => b - a);
				for (const [type, count] of sorted) {
					output += `  • ${type}: ${count}\n`;
				}
			}

			// Circular dependencies
			if (circularArray.length > 0) {
				output += `\n## ⚠️  Circular Dependencies (${circularArray.length})\n\n`;
				for (const circ of circularArray.slice(0, 10)) {
					output += `  Severity: ${circ?.severity || 'unknown'} | Length: ${circ?.length || 0}\n`;
					if (circ?.cycle && circ.cycle.length > 0) {
						output += `  Cycle: ${circ.cycle.join(' → ')}\n`;
					}
					output += '\n';
				}
				if (circularArray.length > 10) {
					output += `  ... and ${circularArray.length - 10} more circular dependencies\n\n`;
				}
			}

			// Detailed violations
			output += `\n## Violations (${violationsArray.length})\n\n`;

			// Group by severity
			const critical = violationsArray.filter(v => v?.severity === 'critical');
			const high = violationsArray.filter(v => v?.severity === 'high');
			const medium = violationsArray.filter(v => v?.severity === 'medium');
			const low = violationsArray.filter(v => v?.severity === 'low');

			if (critical.length > 0) {
				output += `### 🔴 Critical (${critical.length})\n`;
				for (const v of critical.slice(0, 5)) {
					output += this.formatViolation(v);
				}
				if (critical.length > 5) {
					output += `... and ${critical.length - 5} more critical violations\n\n`;
				}
			}

			if (high.length > 0) {
				output += `### 🟠 High (${high.length})\n`;
				for (const v of high.slice(0, 5)) {
					output += this.formatViolation(v);
				}
				if (high.length > 5) {
					output += `... and ${high.length - 5} more high violations\n\n`;
				}
			}

			if (medium.length > 0) {
				output += `### 🟡 Medium (${medium.length})\n`;
				for (const v of medium.slice(0, 5)) {
					output += this.formatViolation(v);
				}
				if (medium.length > 5) {
					output += `... and ${medium.length - 5} more medium violations\n\n`;
				}
			}

			// Action items
			output += `## 🎯 Recommended Actions\n\n`;

			if (bySeverity.critical > 0) {
				output += `**Immediate Priority:**\n`;
				output += `1. Fix all ${bySeverity.critical} critical violations\n`;
				output += `2. These violate fundamental architectural principles\n`;
				output += `3. May cause system instability or security issues\n\n`;
			}

			if (bySeverity.high > 0) {
				output += `**High Priority:**\n`;
				output += `1. Address ${bySeverity.high} high severity violations\n`;
				output += `2. These create significant technical debt\n`;
				output += `3. Plan refactoring work to resolve\n\n`;
			}

			output += `**General Recommendations:**\n`;
			output += `1. Review architectural patterns and layer definitions\n`;
			output += `2. Add linting rules to prevent future violations\n`;
			output += `3. Document architectural decisions (ADRs)\n`;
			output += `4. Consider code review checklist for architecture\n`;
			output += `5. Run this analysis in CI/CD pipeline\n`;
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private formatViolation(v: any): string {
		// Backend DTO structure: type, severity, title, description, location{}, evidence[], suggestions[], impact
		let output = `\n**${v?.title || v?.type || 'Violation'}**\n`;
		output += `${v?.description || 'No description'}\n`;

		// Location
		if (v?.location) {
			output += `File: ${v.location.filePath || 'unknown'}`;
			if (v.location.symbolName) {
				output += ` (${v.location.symbolName})`;
			}
			if (v.location.lineStart) {
				output += `:${v.location.lineStart}`;
				if (v.location.lineEnd && v.location.lineEnd !== v.location.lineStart) {
					output += `-${v.location.lineEnd}`;
				}
			}
			output += `\n`;
		}

		// Impact
		if (v?.impact) {
			output += `Impact: ${v.impact}\n`;
		}

		// Evidence
		if (v?.evidence && v.evidence.length > 0) {
			output += `Evidence:\n`;
			for (const ev of v.evidence) {
				output += `  • ${ev?.metric || 'unknown'}: ${ev?.value || 'N/A'}`;
				if (ev?.threshold) {
					output += ` (threshold: ${ev.threshold})`;
				}
				output += '\n';
			}
		}

		// Suggestions
		if (v?.suggestions && v.suggestions.length > 0) {
			output += `Suggestions:\n`;
			for (const sug of v.suggestions) {
				output += `  • ${sug}\n`;
			}
		}

		// Related items
		if (v?.relatedItems && v.relatedItems.length > 0) {
			output += `Related:\n`;
			for (const item of v.relatedItems.slice(0, 3)) {
				output += `  • ${item?.filePath || 'unknown'}`;
				if (item?.symbolName) {
					output += ` (${item.symbolName})`;
				}
				output += '\n';
			}
		}

		output += '\n';
		return output;
	}

	private getGradeEmoji(grade: string): string {
		switch (grade) {
			case 'A':
				return '🌟';
			case 'B':
				return '✅';
			case 'C':
				return '⚠️';
			case 'D':
				return '❌';
			case 'F':
				return '🔴';
			default:
				return '⚪';
		}
	}
}

export default DetectArchitectureViolationsTool;
