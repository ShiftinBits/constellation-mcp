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
			type: z.coerce.boolean().optional().default(true),
			description:
				'Include version information and compatibility analysis (default: true)',
		},
		includeUsageLocations: {
			type: z.coerce.boolean().optional().default(false),
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
		// Defensive checks
		if (!data || !data.packages) {
			return 'Error: No package data returned from API';
		}

		const { packages, duplicates, categories } = data;

		let output = `Package Usage Analysis\n\n`;

		// Summary
		output += `## Summary\n`;
		output += `Total Packages Analyzed: ${packages?.length || 0}\n`;

		// Calculate totals from packages
		let totalUsages = 0;
		for (const pkg of packages) {
			totalUsages += pkg?.totalUsages || 0;
		}
		output += `Total Usages: ${totalUsages}\n`;

		// Categories
		if (categories && categories.length > 0) {
			output += `\n### By Category\n`;
			for (const cat of categories) {
				output += `  ${cat?.category || 'unknown'}: ${cat?.count || 0} packages\n`;
			}
		}

		// Top packages
		if (packages.length > 0) {
			output += `\n## Package Details\n\n`;

			const sorted = [...packages].sort((a, b) => (b?.totalUsages || 0) - (a?.totalUsages || 0));

			for (const pkg of sorted.slice(0, 15)) {
				output += `### ${pkg?.packageName || 'unknown'}`;
				if (pkg?.version) {
					output += ` @${pkg.version}`;
				}
				output += '\n';

				output += `Total Usages: ${pkg?.totalUsages || 0}\n`;
				output += `Used in: ${pkg?.fileCount || 0} files\n`;
				output += `Utilization Score: ${((pkg?.utilizationScore || 0) * 100).toFixed(1)}%\n`;

				// Most used symbols
				if (pkg?.mostUsedSymbols && pkg.mostUsedSymbols.length > 0) {
					output += `Most Used Symbols:\n`;
					for (const sym of pkg.mostUsedSymbols.slice(0, 5)) {
						output += `  • ${sym?.symbol || 'unknown'} (${sym?.count || 0} times)\n`;
					}
					if (pkg.mostUsedSymbols.length > 5) {
						output += `  ... and ${pkg.mostUsedSymbols.length - 5} more\n`;
					}
				}

				// Module breakdown
				if (pkg?.moduleBreakdown && pkg.moduleBreakdown.length > 0) {
					output += `\nModule Breakdown:\n`;
					for (const mod of pkg.moduleBreakdown.slice(0, 5)) {
						output += `  • ${mod?.moduleName || 'unknown'}: ${mod?.usageCount || 0} usages in ${mod?.fileCount || 0} files\n`;
					}
					if (pkg.moduleBreakdown.length > 5) {
						output += `  ... and ${pkg.moduleBreakdown.length - 5} more modules\n`;
					}
				}

				// Usage details
				if (pkg?.usages && pkg.usages.length > 0) {
					output += `\nUsage Locations (showing ${Math.min(5, pkg.usages.length)} of ${pkg.usages.length}):\n`;
					for (const usage of pkg.usages.slice(0, 5)) {
						output += `  • ${usage?.filePath || 'unknown'}`;
						if (usage?.lineNumber) {
							output += `:${usage.lineNumber}`;
						}
						if (usage?.importedSymbols && usage.importedSymbols.length > 0) {
							output += ` - imports: ${usage.importedSymbols.join(', ')}`;
						}
						output += '\n';
					}
				}

				output += '\n';
			}

			if (packages.length > 15) {
				output += `... and ${packages.length - 15} more packages\n\n`;
			}
		}

		// Duplicates
		if (duplicates && duplicates.length > 0) {
			output += `## ⚠️  Duplicate Packages (${duplicates.length})\n`;
			output += `Multiple versions of the same package detected:\n\n`;

			for (const dup of duplicates) {
				output += `  • ${dup?.packageName || 'unknown'}\n`;
				output += `    Versions: ${dup?.versions?.join(', ') || 'unknown'}\n`;
				if (dup?.potentialConflict) {
					output += `    ⚠️  Potential conflict detected\n`;
				}
			}
			output += '\n';
		}

		// Categories detail
		if (categories && categories.length > 0) {
			output += `## Package Categories\n\n`;
			for (const cat of categories) {
				output += `### ${cat?.category || 'unknown'} (${cat?.count || 0})\n`;
				if (cat?.packages && cat.packages.length > 0) {
					for (const pkg of cat.packages.slice(0, 10)) {
						output += `  • ${pkg}\n`;
					}
					if (cat.packages.length > 10) {
						output += `  ... and ${cat.packages.length - 10} more\n`;
					}
				}
				output += '\n';
			}
		}

		if (metadata.cached) {
			output += '\n\n(Results served from cache)';
		}

		return output.trim();
	}
}

export default AnalyzePackageUsageTool;
