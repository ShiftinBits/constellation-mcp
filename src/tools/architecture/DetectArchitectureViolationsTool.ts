/**
 * Detect Architecture Violations Tool
 *
 * MCP tool for detecting violations of architectural patterns, layer boundaries, and design principles
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface DetectArchitectureViolationsParams {
	scope?: string;
	rules?: string[];
	severity?: 'all' | 'critical' | 'high' | 'medium';
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
		scope: {
			type: z.string().optional(),
			description:
				'Optional: Limit analysis to specific directory (e.g., "src/api")',
		},
		rules: {
			type: z.array(z.string()).optional(),
			description:
				'Optional: Specific rules to check (e.g., ["layer-boundaries", "circular-deps"])',
		},
		severity: {
			type: z.enum(['all', 'critical', 'high', 'medium']).optional().default('all'),
			description:
				'Minimum severity level to report (default: all)',
		},
	};

	/**
	 * Format the architecture violations for AI-friendly output
	 */
	protected formatResult(
		data: DetectArchitectureViolationsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { summary, violations, patterns, compliance } = data;

		let output = `Architecture Violations Report\n\n`;

		// Compliance score
		output += `## Compliance Score: ${this.getGradeEmoji(compliance.grade)} ${compliance.grade} (${compliance.score}/100)\n\n`;

		if (summary.totalViolations === 0) {
			output += '✅ No architecture violations detected! Your codebase follows architectural principles.\n';
		} else {
			// Summary
			output += `## Summary\n`;
			output += `Total Violations: ${summary.totalViolations}\n\n`;

			output += `By Severity:\n`;
			if (summary.bySeverity.critical > 0) {
				output += `  🔴 Critical: ${summary.bySeverity.critical}\n`;
			}
			if (summary.bySeverity.high > 0) {
				output += `  🟠 High: ${summary.bySeverity.high}\n`;
			}
			if (summary.bySeverity.medium > 0) {
				output += `  🟡 Medium: ${summary.bySeverity.medium}\n`;
			}
			if (summary.bySeverity.low > 0) {
				output += `  🟢 Low: ${summary.bySeverity.low}\n`;
			}

			if (Object.keys(summary.byCategory).length > 0) {
				output += `\nBy Category:\n`;
				const sorted = Object.entries(summary.byCategory).sort(([, a], [, b]) => b - a);
				for (const [category, count] of sorted) {
					output += `  • ${category}: ${count}\n`;
				}
			}

			// Common patterns
			if (patterns.commonIssues.length > 0) {
				output += `\n## 🔍 Common Issues\n`;
				for (const issue of patterns.commonIssues.slice(0, 5)) {
					output += `\n### ${issue.pattern} (${issue.count} occurrences)\n`;
					output += `${issue.description}\n`;
				}
			}

			// Detailed violations
			output += `\n## Violations (${violations.length})\n\n`;

			// Group by severity
			const critical = violations.filter(v => v.severity === 'CRITICAL');
			const high = violations.filter(v => v.severity === 'HIGH');
			const medium = violations.filter(v => v.severity === 'MEDIUM');
			const low = violations.filter(v => v.severity === 'LOW');

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

			if (summary.bySeverity.critical > 0) {
				output += `**Immediate Priority:**\n`;
				output += `1. Fix all ${summary.bySeverity.critical} critical violations\n`;
				output += `2. These violate fundamental architectural principles\n`;
				output += `3. May cause system instability or security issues\n\n`;
			}

			if (summary.bySeverity.high > 0) {
				output += `**High Priority:**\n`;
				output += `1. Address ${summary.bySeverity.high} high severity violations\n`;
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

	private formatViolation(v: ArchitectureViolation): string {
		let output = `\n**${v.type}**\n`;
		output += `${v.description}\n`;
		output += `File: ${v.violatingFile}`;
		if (v.violatingLine) {
			output += `:${v.violatingLine}`;
		}
		output += `\n`;
		output += `Rule: ${v.rule}\n`;
		output += `Fix: ${v.suggestion}\n`;

		if (v.examples && v.examples.length > 0) {
			output += `Examples:\n`;
			for (const example of v.examples) {
				output += `  ${example}\n`;
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
