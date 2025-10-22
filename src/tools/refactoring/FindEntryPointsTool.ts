/**
 * Find Entry Points Tool
 *
 * MCP tool for identifying entry points to the application (main functions, CLI commands, API endpoints, etc.)
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface FindEntryPointsParams {
	entryType?: 'all' | 'main' | 'api' | 'cli' | 'event' | 'test';
	includeMetadata?: boolean;
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
		entryType: {
			type: z
				.enum(['all', 'main', 'api', 'cli', 'event', 'test'])
				.optional()
				.default('all'),
			description:
				'Type of entry points to find (default: all)',
		},
		includeMetadata: {
			type: z.boolean().optional().default(true),
			description:
				'Include detailed metadata (routes, commands, etc.) - default: true',
		},
	};

	/**
	 * Format the entry points findings for AI-friendly output
	 */
	protected formatResult(
		data: FindEntryPointsResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { summary, entryPoints, executionPaths, recommendations } = data;

		let output = `Entry Points Analysis\n\n`;

		// Summary
		output += `## Summary\n`;
		output += `Total Entry Points: ${summary.totalEntryPoints}\n\n`;

		output += `By Type:\n`;
		for (const [type, count] of Object.entries(summary.byType)) {
			output += `  ${this.getTypeEmoji(type)} ${type}: ${count}\n`;
		}

		output += `\nBy Complexity:\n`;
		output += `  🟢 Low: ${summary.byComplexity.low}\n`;
		output += `  🟡 Medium: ${summary.byComplexity.medium}\n`;
		output += `  🔴 High: ${summary.byComplexity.high}\n`;

		// Group entry points by type
		const byType = new Map<string, EntryPoint[]>();
		for (const ep of entryPoints) {
			if (!byType.has(ep.type)) {
				byType.set(ep.type, []);
			}
			byType.get(ep.type)!.push(ep);
		}

		// Display by type
		for (const [type, points] of byType) {
			output += `\n## ${this.getTypeEmoji(type)} ${this.capitalize(type.replace(/-/g, ' '))} (${points.length})\n\n`;

			for (const ep of points.slice(0, 20)) {
				output += `### ${ep.name}\n`;
				output += `File: ${ep.filePath}:${ep.line}\n`;

				if (ep.signature) {
					output += `Signature: ${ep.signature}\n`;
				}

				if (ep.description) {
					output += `Description: ${ep.description}\n`;
				}

				// Type-specific metadata
				if (ep.metadata.httpMethod && ep.metadata.route) {
					output += `Route: ${ep.metadata.httpMethod} ${ep.metadata.route}\n`;
				}

				if (ep.metadata.commandName) {
					output += `Command: ${ep.metadata.commandName}\n`;
				}

				if (ep.metadata.eventType) {
					output += `Event: ${ep.metadata.eventType}\n`;
				}

				output += `Visibility: ${ep.metadata.isPublic ? 'Public' : 'Internal'}\n`;
				output += `Async: ${ep.metadata.isAsync ? 'Yes' : 'No'}\n`;
				output += `Complexity: ${this.getComplexityEmoji(ep.complexity)} ${ep.complexity}\n`;

				if (ep.dependencies.length > 0) {
					output += `Dependencies: ${ep.dependencies.length}\n`;
					if (ep.dependencies.length <= 3) {
						for (const dep of ep.dependencies) {
							output += `  • ${dep}\n`;
						}
					} else {
						for (const dep of ep.dependencies.slice(0, 3)) {
							output += `  • ${dep}\n`;
						}
						output += `  ... and ${ep.dependencies.length - 3} more\n`;
					}
				}

				output += '\n';
			}

			if (points.length > 20) {
				output += `... and ${points.length - 20} more ${type} entry points\n\n`;
			}
		}

		// Execution paths
		if (executionPaths.length > 0) {
			output += `## Execution Paths (${executionPaths.length})\n`;
			output += `Common execution flows through the system:\n\n`;

			for (const path of executionPaths.slice(0, 5)) {
				output += `**${path.description}**\n`;
				output += `${path.from} →\n`;
				for (const step of path.to) {
					output += `  → ${step}\n`;
				}
				output += '\n';
			}

			if (executionPaths.length > 5) {
				output += `... and ${executionPaths.length - 5} more execution paths\n\n`;
			}
		}

		// Recommendations
		if (recommendations.length > 0) {
			output += `## 💡 Recommendations\n\n`;
			for (let i = 0; i < recommendations.length; i++) {
				output += `${i + 1}. ${recommendations[i]}\n`;
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
