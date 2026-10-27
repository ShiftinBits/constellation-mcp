/**
 * Project Capabilities API
 *
 * Provides capability checking for AI assistants to understand project state
 * before making queries. This enables graceful fallbacks and better error handling.
 */

import { ConstellationClient } from '../client/constellation-client.js';
import { MAX_EXECUTION_TIMEOUT_MS } from '../constants/sandbox-limits.js';

const NOT_INDEXED_LIMITATION = 'Project not indexed - run: constellation index';

/**
 * Counts of work skipped by the last index; absent when the index is whole
 */
export interface PartialIndex {
	failedFileCount?: number;
	pass3FileErrors?: number;
	swallowedStepErrors?: number;
}

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

	/** Present only when the last index completed with work skipped */
	partialIndex?: PartialIndex;

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
			MAX_EXECUTION_TIMEOUT_MS,
		);

		if (!overview.success || !overview.data) {
			return createNotIndexedCapabilities(NOT_INDEXED_LIMITATION);
		}

		const data = overview.data as {
			metadata?: {
				languages?: Array<{ language: string; fileCount: number }>;
				totalFiles?: number;
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
		const fileCount = data.structure?.files?.total ?? data.metadata?.totalFiles;

		// Core answers the overview successfully for a registered but never-indexed
		// branch, with zeroed counts. Match Core's rule (fileCount === 0 means not
		// indexed). A missing count is an unknown shape, not proof of zero files.
		if (fileCount === 0) {
			return createNotIndexedCapabilities(NOT_INDEXED_LIMITATION);
		}

		const partial = (
			overview.metadata as { partialIndex?: PartialIndex } | undefined
		)?.partialIndex;
		const failedFiles = partial?.failedFileCount ?? 0;
		const degradedSteps =
			(partial?.pass3FileErrors ?? 0) + (partial?.swallowedStepErrors ?? 0);
		const isPartial = failedFiles > 0 || degradedSteps > 0;

		const limitations =
			symbolCount === 0
				? [
						'No symbols indexed - the project may be empty or not yet fully indexed',
					]
				: [];
		if (isPartial) {
			limitations.push(
				`Last index completed with ${failedFiles} file(s) that failed to index and ${degradedSteps} degraded step(s); results may be incomplete`,
			);
		}

		return {
			isIndexed: true,
			indexedBranch: context.branchName,
			lastIndexedAt: overview.metadata?.lastIndexedAt,
			supportedLanguages,
			symbolCount,
			fileCount: fileCount ?? 0,
			availableFeatures: {
				searchSymbols: true,
				impactAnalysis: true,
				callGraph: true,
				circularDependencies: true,
				orphanedCode: true,
				architectureOverview: true,
			},
			...(isPartial && { partialIndex: partial }),
			limitations,
		};
	} catch (error) {
		// Determine if this is a connection error or not-indexed error
		const message = error instanceof Error ? error.message.toLowerCase() : '';

		if (
			message.includes('not found') ||
			message.includes('not indexed') ||
			message.includes('404')
		) {
			return createNotIndexedCapabilities(NOT_INDEXED_LIMITATION);
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
