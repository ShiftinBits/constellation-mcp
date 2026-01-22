/**
 * Project Capabilities API
 *
 * Provides capability checking for AI assistants to understand project state
 * before making queries. This enables graceful fallbacks and better error handling.
 */

import { ConstellationClient } from '../client/constellation-client.js';

/**
 * Project capabilities returned by api.getCapabilities()
 */
export interface ProjectCapabilities {
	/** Whether the project has been indexed */
	isIndexed: boolean;

	/** Branch that was indexed (if indexed) */
	indexedBranch?: string;

	/** ISO timestamp of last index operation */
	lastIndexedAt?: string;

	/** Programming languages detected in the project */
	supportedLanguages: string[];

	/** Total number of symbols in the index */
	symbolCount: number;

	/** Total number of files in the index */
	fileCount: number;

	/** Features available for this project */
	availableFeatures: {
		searchSymbols: boolean;
		impactAnalysis: boolean;
		callGraph: boolean;
		circularDependencies: boolean;
		orphanedCode: boolean;
		architectureOverview: boolean;
	};

	/** Any limitations or warnings for the AI to consider */
	limitations: string[];
}

/**
 * Get project capabilities by querying the architecture overview
 *
 * Uses getArchitectureOverview as a lightweight check that also returns
 * useful metadata about the indexed project.
 */
export async function getProjectCapabilities(
	client: ConstellationClient,
	context: { projectId: string; branchName: string },
): Promise<ProjectCapabilities> {
	try {
		// Use architecture overview as a capability check - it's lightweight
		// and returns metadata we need
		const overview = await client.executeMcpTool(
			'get_architecture_overview',
			{ includeMetrics: true },
			context,
		);

		if (!overview.success || !overview.data) {
			return createNotIndexedCapabilities(
				'Project not indexed - run: constellation index',
			);
		}

		const data = overview.data as {
			metadata?: {
				languages?: Array<{ language: string; fileCount: number }>;
				lastIndexedAt?: string;
			};
			structure?: {
				symbols?: { total: number };
				files?: { total: number };
			};
		};

		// Extract language info
		const languages = data.metadata?.languages || [];
		const supportedLanguages = languages.map(
			(l: { language: string }) => l.language,
		);

		// Extract counts
		const symbolCount = data.structure?.symbols?.total || 0;
		const fileCount = data.structure?.files?.total || 0;

		return {
			isIndexed: true,
			indexedBranch: context.branchName,
			lastIndexedAt: data.metadata?.lastIndexedAt,
			supportedLanguages,
			symbolCount,
			fileCount,
			availableFeatures: {
				searchSymbols: true,
				impactAnalysis: true,
				callGraph: true,
				circularDependencies: true,
				orphanedCode: true,
				architectureOverview: true,
			},
			limitations:
				symbolCount === 0
					? [
							'No symbols indexed - the project may be empty or not yet fully indexed',
						]
					: [],
		};
	} catch (error) {
		// Determine if this is a connection error or not-indexed error
		const message = error instanceof Error ? error.message.toLowerCase() : '';

		if (
			message.includes('not found') ||
			message.includes('not indexed') ||
			message.includes('404')
		) {
			return createNotIndexedCapabilities(
				'Project not indexed - run: constellation index',
			);
		}

		if (
			message.includes('econnrefused') ||
			message.includes('fetch failed') ||
			message.includes('network')
		) {
			return createNotIndexedCapabilities(
				'Connection failure to Constellation API - check Constellation service connectivity with `await api.ping()`',
			);
		}

		if (
			message.includes('auth') ||
			message.includes('401') ||
			message.includes('403')
		) {
			return createNotIndexedCapabilities(
				'Authentication failed - run: constellation auth',
			);
		}

		return createNotIndexedCapabilities(
			`Unable to check capabilities: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Create a capabilities object for a non-indexed project
 */
function createNotIndexedCapabilities(limitation: string): ProjectCapabilities {
	return {
		isIndexed: false,
		supportedLanguages: [],
		symbolCount: 0,
		fileCount: 0,
		availableFeatures: {
			searchSymbols: false,
			impactAnalysis: false,
			callGraph: false,
			circularDependencies: false,
			orphanedCode: false,
			architectureOverview: false,
		},
		limitations: [limitation],
	};
}
