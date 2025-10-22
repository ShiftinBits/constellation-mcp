/**
 * Analyze Package Usage Tool
 *
 * MCP tool for analyzing external package/library usage across the codebase
 */

import { z } from 'zod';
import { BaseMcpTool } from '../base/BaseMcpTool.js';

interface AnalyzePackageUsageParams {
	packageName?: string;
	includeVersions?: boolean;
	includeUsageLocations?: boolean;
}

interface PackageUsageLocation {
	filePath: string;
	line: number;
	importType: 'import' | 'require' | 'dynamic';
	importedSymbols: string[];
}

interface PackageUsage {
	name: string;
	version?: string;
	usageCount: number;
	filesUsing: number;
	locations?: PackageUsageLocation[];
	category: 'production' | 'development' | 'peer' | 'optional';
	health: {
		isDeprecated: boolean;
		hasSecurityIssues: boolean;
		lastUpdated?: string;
		alternatives?: string[];
	};
}

interface AnalyzePackageUsageResult {
	summary: {
		totalPackages: number;
		totalUsages: number;
		byCategory: {
			production: number;
			development: number;
			peer: number;
			optional: number;
		};
	};
	packages: PackageUsage[];
	recommendations: {
		toRemove: string[];
		toUpdate: string[];
		toReplace: Array<{
			package: string;
			reason: string;
			alternative: string;
		}>;
	};
	heavyUsers: Array<{
		filePath: string;
		packagesUsed: number;
		packages: string[];
	}>;
}

class AnalyzePackageUsageTool extends BaseMcpTool<
	AnalyzePackageUsageParams,
	AnalyzePackageUsageResult
> {
	name = 'analyze_package_usage';
	description =
		'Analyze external package/library usage across the codebase. Identify heavily used packages, unused dependencies, and potential optimization opportunities.';

	schema = {
		packageName: {
			type: z.string().optional(),
			description:
				'Optional: Analyze specific package (e.g., "lodash"). If omitted, analyzes all packages.',
		},
		includeVersions: {
			type: z.boolean().optional().default(true),
			description:
				'Include version information and compatibility analysis (default: true)',
		},
		includeUsageLocations: {
			type: z.boolean().optional().default(false),
			description:
				'Include detailed usage locations (default: false, can be verbose)',
		},
	};

	/**
	 * Format the package usage analysis for AI-friendly output
	 */
	protected formatResult(
		data: AnalyzePackageUsageResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { summary, packages, recommendations, heavyUsers } = data;

		let output = `Package Usage Analysis\n\n`;

		// Summary
		output += `## Summary\n`;
		output += `Total Packages: ${summary.totalPackages}\n`;
		output += `Total Import Statements: ${summary.totalUsages}\n`;
		output += `\nBy Category:\n`;
		output += `  Production: ${summary.byCategory.production}\n`;
		output += `  Development: ${summary.byCategory.development}\n`;
		if (summary.byCategory.peer > 0) {
			output += `  Peer: ${summary.byCategory.peer}\n`;
		}
		if (summary.byCategory.optional > 0) {
			output += `  Optional: ${summary.byCategory.optional}\n`;
		}

		// Top packages
		if (packages.length > 0) {
			output += `\n## Most Used Packages\n\n`;

			const sorted = [...packages].sort((a, b) => b.usageCount - a.usageCount);

			for (const pkg of sorted.slice(0, 15)) {
				output += `### ${pkg.name}`;
				if (pkg.version) {
					output += ` @${pkg.version}`;
				}
				output += '\n';

				output += `Category: ${pkg.category}\n`;
				output += `Used in: ${pkg.filesUsing} files (${pkg.usageCount} imports)\n`;

				// Health indicators
				if (pkg.health.isDeprecated) {
					output += `⚠️  **DEPRECATED** - Consider migrating\n`;
				}
				if (pkg.health.hasSecurityIssues) {
					output += `🔴 **SECURITY ISSUES** - Update immediately\n`;
				}
				if (pkg.health.alternatives && pkg.health.alternatives.length > 0) {
					output += `Alternatives: ${pkg.health.alternatives.join(', ')}\n`;
				}

				// Usage locations (if requested and available)
				if (pkg.locations && pkg.locations.length > 0) {
					output += `\nUsage Locations:\n`;
					for (const loc of pkg.locations.slice(0, 5)) {
						output += `  • ${loc.filePath}:${loc.line}`;
						if (loc.importedSymbols.length > 0) {
							output += ` (${loc.importedSymbols.join(', ')})`;
						}
						output += '\n';
					}
					if (pkg.locations.length > 5) {
						output += `  ... and ${pkg.locations.length - 5} more locations\n`;
					}
				}

				output += '\n';
			}

			if (packages.length > 15) {
				output += `... and ${packages.length - 15} more packages\n\n`;
			}
		}

		// Heavy users (files with many imports)
		if (heavyUsers.length > 0) {
			output += `## Files with Most Dependencies\n`;
			output += `These files import many packages and may benefit from refactoring:\n\n`;

			for (const user of heavyUsers.slice(0, 10)) {
				output += `  ${user.filePath} - ${user.packagesUsed} packages\n`;
				if (user.packages.length <= 5) {
					output += `    ${user.packages.join(', ')}\n`;
				} else {
					output += `    ${user.packages.slice(0, 5).join(', ')}, ...\n`;
				}
			}
			output += '\n';
		}

		// Recommendations
		if (
			recommendations.toRemove.length > 0 ||
			recommendations.toUpdate.length > 0 ||
			recommendations.toReplace.length > 0
		) {
			output += `## 💡 Recommendations\n\n`;

			if (recommendations.toRemove.length > 0) {
				output += `### Remove Unused Dependencies (${recommendations.toRemove.length})\n`;
				output += `These packages are declared but never imported:\n`;
				for (const pkg of recommendations.toRemove.slice(0, 10)) {
					output += `  • ${pkg}\n`;
				}
				if (recommendations.toRemove.length > 10) {
					output += `  ... and ${recommendations.toRemove.length - 10} more\n`;
				}
				output += '\n';
			}

			if (recommendations.toUpdate.length > 0) {
				output += `### Update These Packages (${recommendations.toUpdate.length})\n`;
				output += `Outdated or have security issues:\n`;
				for (const pkg of recommendations.toUpdate.slice(0, 10)) {
					output += `  • ${pkg}\n`;
				}
				if (recommendations.toUpdate.length > 10) {
					output += `  ... and ${recommendations.toUpdate.length - 10} more\n`;
				}
				output += '\n';
			}

			if (recommendations.toReplace.length > 0) {
				output += `### Consider Replacing (${recommendations.toReplace.length})\n`;
				for (const item of recommendations.toReplace) {
					output += `  • ${item.package}\n`;
					output += `    Reason: ${item.reason}\n`;
					output += `    Alternative: ${item.alternative}\n`;
				}
				output += '\n';
			}
		}

		// Action items
		output += `## 🎯 Action Items\n\n`;
		output += `1. **Remove unused dependencies** to reduce bundle size\n`;
		output += `2. **Update packages** with security issues immediately\n`;
		output += `3. **Review deprecated packages** and plan migration\n`;
		output += `4. **Refactor heavy users** to reduce coupling\n`;
		output += `5. **Consider tree-shaking** for partially-used large libraries\n`;
		output += `6. **Add dependency constraints** to prevent bloat\n`;

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default AnalyzePackageUsageTool;
