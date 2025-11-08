/**
 * Get Architecture Overview Tool
 *
 * MCP tool for getting a high-level overview of the codebase architecture
 */

import { z } from 'zod';
import { BaseMcpTool } from '../../lib/BaseMcpTool.js';
import {
	GetArchitectureOverviewParams,
	GetArchitectureOverviewResult,
} from '../../types/api-types.js';
import { section, emphasize, collapsedHint } from '../../utils/format-helpers.js';
import { MARKERS } from '../../utils/semantic-markers.js';

class GetArchitectureOverviewTool extends BaseMcpTool<
	GetArchitectureOverviewParams,
	GetArchitectureOverviewResult
> {
	name = 'get_architecture_overview';
	description =
		'Get a high-level overview of the codebase architecture including modules, layers, dependencies, and statistics. Useful for understanding system structure.';

	schema = {
		includeMetrics: {
			type: z.coerce.boolean().optional().default(false),
			description:
				'Include quality metrics (complexity, maintainability, test coverage) - default: false',
		},
		includeModuleGraph: {
			type: z.coerce.boolean().optional().default(false),
			description: 'Include module graph structure - default: false',
		},
		includePackages: {
			type: z.coerce.boolean().optional().default(true),
			description:
				'Include external package dependency details - default: true',
		},
	};

	/**
	 * Format the architecture overview for AI-friendly output
	 */
	protected formatResult(
		data: GetArchitectureOverviewResult,
		metadata: { executionTime: number; cached: boolean }
	): string {
		const { metadata: projectMeta, structure, dependencies, metrics, moduleGraph } = data;

		// Defensive checks for required data
		if (!projectMeta) {
			return 'Error: API returned incomplete data - missing metadata';
		}
		if (!structure) {
			return 'Error: API returned incomplete data - missing structure';
		}
		if (!dependencies) {
			return 'Error: API returned incomplete data - missing dependencies';
		}

		let output = `${section('Architecture Overview', 1)}\n\n`;

		// Project Metadata
		output += `${section('Project Metadata')}\n\n`;
		output += `${emphasize('Primary Language')}: ${projectMeta.primaryLanguage}\n`;
		output += `${emphasize('Total Files')}: ${projectMeta.totalFiles.toLocaleString()}\n`;
		if (projectMeta.totalLines) {
			output += `${emphasize('Total Lines')}: ${projectMeta.totalLines.toLocaleString()}\n`;
		}

		// Languages
		if (projectMeta.languages.length > 0) {
			output += `\n${section('Languages', 3)}\n\n`;
			for (const lang of projectMeta.languages) {
				output += `- ${emphasize(lang.language)}: ${lang.fileCount} files (${lang.percentage.toFixed(1)}%)\n`;
			}
		}

		// Frameworks
		if (projectMeta.frameworks.length > 0) {
			output += `\n${section('Detected Frameworks', 3)}\n\n`;
			for (const framework of projectMeta.frameworks) {
				const version = framework.version ? ` v${framework.version}` : '';
				output += `- ${emphasize(framework.name)}${version} (${framework.confidence} confidence)\n`;
				if (framework.evidence.length > 0 && framework.evidence.length <= 3) {
					output += `  - Evidence: ${framework.evidence.join(', ')}\n`;
				}
			}
		}

		// Structure Statistics
		output += `\n${section('Code Structure')}\n\n`;

		output += `${section('Files', 3)}\n`;
		output += `- ${emphasize('Total')}: ${structure.files.total.toLocaleString()}\n`;

		if (Object.keys(structure.files.byType).length > 0) {
			output += `- ${emphasize('By Type')}:\n`;
			const sortedTypes = Object.entries(structure.files.byType)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10);
			for (const [type, count] of sortedTypes) {
				output += `  - ${type}: ${count}\n`;
			}
		}

		output += `\n${section('Symbols', 3)}\n`;
		output += `- ${emphasize('Total')}: ${structure.symbols.total.toLocaleString()}\n`;
		output += `- ${emphasize('Exported')}: ${structure.symbols.exported.toLocaleString()}\n`;
		output += `- ${emphasize('Public')}: ${structure.symbols.public.toLocaleString()}\n`;

		if (Object.keys(structure.symbols.byKind).length > 0) {
			output += `- ${emphasize('By Kind')}:\n`;
			const sortedKinds = Object.entries(structure.symbols.byKind)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10);
			for (const [kind, count] of sortedKinds) {
				output += `  - ${kind}: ${count}\n`;
			}
		}

		output += `\n${section('Modules', 3)}\n`;
		output += `- ${emphasize('Total')}: ${structure.modules.total}\n`;
		output += `- ${emphasize('Average Size')}: ${structure.modules.averageSize.toFixed(1)} files\n`;
		output += `- ${emphasize('Largest Module')}: ${structure.modules.largest}\n`;

		// Dependencies
		output += `\n${section('Dependencies')}\n\n`;

		output += `${section('Internal Dependencies', 3)}\n`;
		output += `- ${emphasize('Total Connections')}: ${dependencies.internal.totalConnections.toLocaleString()}\n`;
		output += `- ${emphasize('Average Per File')}: ${dependencies.internal.averagePerFile.toFixed(2)}\n`;

		if (dependencies.internal.mostConnectedFiles.length > 0) {
			output += `- ${emphasize('Most Connected Files')}:\n`;
			for (const file of dependencies.internal.mostConnectedFiles.slice(0, 5)) {
				output += `  - ${file.path} (↓${file.incomingCount} ↑${file.outgoingCount})\n`;
			}
		}

		output += `\n${section('External Dependencies', 3)}\n`;
		output += `- ${emphasize('Total Packages')}: ${dependencies.external.totalPackages}\n`;
		output += `- ${emphasize('Direct Dependencies')}: ${dependencies.external.directDependencies}\n`;
		if (dependencies.external.production !== undefined) {
			output += `- ${emphasize('Production')}: ${dependencies.external.production}\n`;
		}
		if (dependencies.external.development !== undefined) {
			output += `- ${emphasize('Development')}: ${dependencies.external.development}\n`;
		}

		if (dependencies.external.topPackages.length > 0) {
			output += `- ${emphasize('Top Packages by Usage')}:\n`;
			for (const pkg of dependencies.external.topPackages.slice(0, 10)) {
				const type = pkg.type ? ` (${pkg.type})` : '';
				output += `  - ${pkg.name}: ${pkg.usageCount} usages${type}\n`;
			}
		}

		// Quality Metrics (optional)
		if (metrics) {
			output += `\n${section('Quality Metrics')}\n\n`;

			output += `${section('Complexity', 3)}\n`;
			output += `- ${emphasize('Average')}: ${metrics.complexity.average.toFixed(2)}\n`;
			const highComplexity = metrics.complexity.high > 10
				? `${MARKERS.HIGH_COMPLEXITY} ${metrics.complexity.high}`
				: metrics.complexity.high.toString();
			output += `- ${emphasize('High Complexity Items')}: ${highComplexity}\n`;

			output += `\n${section('Maintainability', 3)}\n`;
			output += `- ${emphasize('Score')}: ${metrics.maintainability.score}/100\n`;
			if (metrics.maintainability.issues.length > 0) {
				output += `- ${emphasize('Issues')}:\n`;
				for (const issue of metrics.maintainability.issues.slice(0, 5)) {
					output += `  - ${issue}\n`;
				}
				if (metrics.maintainability.issues.length > 5) {
					output += `  - ${collapsedHint(metrics.maintainability.issues.length, 5)}\n`;
				}
			}

			if (metrics.testCoverage) {
				output += `\n${section('Test Coverage', 3)}\n`;
				const coverageMarker = metrics.testCoverage.percentage < 50 ? MARKERS.LOW_COVERAGE : '';
				const coverageValue = coverageMarker
					? `${coverageMarker} ${metrics.testCoverage.percentage.toFixed(1)}%`
					: `${metrics.testCoverage.percentage.toFixed(1)}%`;
				output += `- ${emphasize('Coverage')}: ${coverageValue}\n`;
				output += `- ${emphasize('Tested Files')}: ${metrics.testCoverage.testedFiles}/${metrics.testCoverage.totalFiles}\n`;
			}
		}

		// Module Graph (optional)
		if (moduleGraph) {
			output += `\n${section('Module Graph')}\n\n`;
			output += `- ${emphasize('Nodes')}: ${moduleGraph.nodes.length}\n`;
			output += `- ${emphasize('Edges')}: ${moduleGraph.edges.length}\n`;

			if (moduleGraph.nodes.length > 0 && moduleGraph.nodes.length <= 10) {
				output += `\n${emphasize('Modules')}:\n`;
				for (const node of moduleGraph.nodes) {
					output += `- ${node.name} (${node.fileCount} files, type: ${node.type})\n`;
				}
			}
		}

		// Contextual next-step suggestions
		output += `\n\n${section('Next Steps for Exploration')}\n\n`;

		if (dependencies.internal.mostConnectedFiles.length > 0) {
			const topFile = dependencies.internal.mostConnectedFiles[0];
			output += `- **get_dependents** - Analyze high-traffic files like "${topFile.path}" (${topFile.incomingCount + topFile.outgoingCount} connections).\n`;
		}

		if (dependencies.internal.totalConnections > 50) {
			output += `- **find_circular_dependencies** - ${dependencies.internal.totalConnections} internal connections. Check for circular dependencies and coupling issues.\n`;
		}

		if (structure.symbols.total > 1000) {
			output += `- **search_symbols** - ${structure.symbols.total.toLocaleString()} symbols available. Search for specific functions, classes, or types.\n`;
		}

		output += `- ${emphasize('get_dependencies')} - Analyze dependency relationships for specific files or modules.\n`;

		if (metrics?.complexity?.high && metrics.complexity.high > 10) {
			output += `- ${emphasize('search_symbols')} - ${metrics.complexity.high} high-complexity items detected. Search for complex functions to identify refactoring candidates.\n`;
		}

		if (metadata.cached) {
			output += '\n\n---\n*Results served from cache*';
		}

		return output.trim();
	}
}

export default GetArchitectureOverviewTool;
