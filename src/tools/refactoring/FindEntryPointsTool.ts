/**
 * Find Entry Points Tool
 *
 * MCP tool for identifying entry points to the application (main functions, CLI commands, API endpoints, etc.)
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface FindEntryPointsParams {
	includeCallDepth?: number;
	groupByModule?: boolean;
	includeConfidence?: boolean;
}

interface EntryPoint {
	type: 'main' | 'api-endpoint' | 'cli-command' | 'event-handler' | 'test-suite' | 'exported-function';
	name: string;
	filePath: string;
	line: number;
	signature?: string;
	description?: string;
	metadata: {
		httpMethod?: string;
		route?: string;
		commandName?: string;
		eventType?: string;
		isPublic: boolean;
		isAsync: boolean;
	};
	dependencies: string[];
	complexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface FindEntryPointsResult {
	summary: {
		totalEntryPoints: number;
		byType: Record<string, number>;
		byComplexity: {
			low: number;
			medium: number;
			high: number;
		};
	};
	entryPoints: EntryPoint[];
	executionPaths: Array<{
		from: string;
		to: string[];
		description: string;
	}>;
	recommendations: string[];
}

class FindEntryPointsTool extends BaseMcpTool<
	FindEntryPointsParams,
	FindEntryPointsResult
> {
	name = 'find_entry_points';
	description =
		'Identify entry points to the application including main functions, API endpoints, CLI commands, event handlers, and test suites. Useful for understanding how code is invoked.';

	schema = {
		includeCallDepth: {
			type: z.coerce.number().int().min(0).max(5).optional().default(2),
			description:
				'Include call tree depth from entry points (default: 2, max: 5)',
		},
		groupByModule: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Group entry points by module/package (default: false)',
		},
		includeConfidence: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include confidence scores (default: false)',
		},
	};

	/**
	 * Format the entry points findings for AI-friendly output
	 */
	protected formatResult(
		data: FindEntryPointsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		// Defensive checks
		if (!data) {
			return 'Error: No data returned from API';
		}

		const { summary, entryPoints, executionPaths, recommendations } = data;
		const entryPointsArray = entryPoints || [];
		const pathsArray = executionPaths || [];
		const recommendationsArray = recommendations || [];

		let output = `Entry Points Analysis\n\n`;

		// Summary
		output += `## Summary\n`;
		output += `Total Entry Points: ${summary?.totalEntryPoints || 0}\n\n`;

		if (summary?.byType && Object.keys(summary.byType).length > 0) {
			output += `By Type:\n`;
			for (const [type, count] of Object.entries(summary.byType)) {
				output += `  ${this.getTypeEmoji(type)} ${type}: ${count}\n`;
			}
		}

		output += `\nBy Complexity:\n`;
		output += `  🟢 Low: ${summary?.byComplexity?.low || 0}\n`;
		output += `  🟡 Medium: ${summary?.byComplexity?.medium || 0}\n`;
		output += `  🔴 High: ${summary?.byComplexity?.high || 0}\n`;

		// Group entry points by type
		const byType = new Map<string, EntryPoint[]>();
		for (const ep of entryPointsArray) {
			const type = ep?.type || 'unknown';
			if (!byType.has(type)) {
				byType.set(type, []);
			}
			byType.get(type)!.push(ep);
		}

		// Display by type
		for (const [type, points] of byType) {
			output += `\n## ${this.getTypeEmoji(type)} ${this.capitalize(type.replace(/-/g, ' '))} (${points.length})\n\n`;

			for (const ep of points.slice(0, 20)) {
				const name = ep?.name || 'unknown';
				const filePath = ep?.filePath || 'unknown';
				const line = ep?.line || 0;
				const metadata = ep?.metadata || {};
				const dependencies = ep?.dependencies || [];
				const complexity = ep?.complexity || 'MEDIUM';

				output += `### ${name}\n`;
				output += `File: ${filePath}:${line}\n`;

				if (ep?.signature) {
					output += `Signature: ${ep.signature}\n`;
				}

				if (ep?.description) {
					output += `Description: ${ep.description}\n`;
				}

				// Type-specific metadata
				if (metadata?.httpMethod && metadata?.route) {
					output += `Route: ${metadata.httpMethod} ${metadata.route}\n`;
				}

				if (metadata?.commandName) {
					output += `Command: ${metadata.commandName}\n`;
				}

				if (metadata?.eventType) {
					output += `Event: ${metadata.eventType}\n`;
				}

				output += `Visibility: ${metadata?.isPublic ? 'Public' : 'Internal'}\n`;
				output += `Async: ${metadata?.isAsync ? 'Yes' : 'No'}\n`;
				output += `Complexity: ${this.getComplexityEmoji(complexity)} ${complexity}\n`;

				if (dependencies.length > 0) {
					output += `Dependencies: ${dependencies.length}\n`;
					if (dependencies.length <= 3) {
						for (const dep of dependencies) {
							output += `  • ${dep}\n`;
						}
					} else {
						for (const dep of dependencies.slice(0, 3)) {
							output += `  • ${dep}\n`;
						}
						output += `  ... and ${dependencies.length - 3} more\n`;
					}
				}

				output += '\n';
			}

			if (points.length > 20) {
				output += `... and ${points.length - 20} more ${type} entry points\n\n`;
			}
		}

		// Execution paths
		if (pathsArray.length > 0) {
			output += `## Execution Paths (${pathsArray.length})\n`;
			output += `Common execution flows through the system:\n\n`;

			for (const path of pathsArray.slice(0, 5)) {
				const description = path?.description || 'Execution path';
				const from = path?.from || 'unknown';
				const to = path?.to || [];
				output += `**${description}**\n`;
				output += `${from} →\n`;
				for (const step of to) {
					output += `  → ${step}\n`;
				}
				output += '\n';
			}

			if (pathsArray.length > 5) {
				output += `... and ${pathsArray.length - 5} more execution paths\n\n`;
			}
		}

		// Recommendations
		if (recommendationsArray.length > 0) {
			output += `## 💡 Recommendations\n\n`;
			for (let i = 0; i < recommendationsArray.length; i++) {
				output += `${i + 1}. ${recommendationsArray[i]}\n`;
			}
			output += '\n';
		}

		// Usage guide
		output += `## 📖 How to Use This Information\n\n`;
		output += `**For Testing:**\n`;
		output += `- Each entry point should have corresponding tests\n`;
		output += `- High complexity entry points need comprehensive test coverage\n`;
		output += `- API endpoints should have integration tests\n\n`;

		output += `**For Documentation:**\n`;
		output += `- Document all public entry points\n`;
		output += `- API endpoints should have OpenAPI/Swagger specs\n`;
		output += `- CLI commands should have help text\n\n`;

		output += `**For Debugging:**\n`;
		output += `- Start debugging from relevant entry point\n`;
		output += `- Follow execution paths to understand flow\n`;
		output += `- Check dependencies for potential issues\n\n`;

		output += `**For Refactoring:**\n`;
		output += `- High complexity entry points are candidates for simplification\n`;
		output += `- Similar entry points might share common logic\n`;
		output += `- Consider splitting overly complex entry points\n`;

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}

	private getTypeEmoji(type: string): string {
		const typeMap: Record<string, string> = {
			main: '🚀',
			'api-endpoint': '🌐',
			'cli-command': '⌨️',
			'event-handler': '⚡',
			'test-suite': '🧪',
			'exported-function': '📦',
		};
		return typeMap[type] || '📌';
	}

	private getComplexityEmoji(complexity: string): string {
		switch (complexity) {
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

	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

export default FindEntryPointsTool;
