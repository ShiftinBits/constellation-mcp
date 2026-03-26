/**
 * Mock Factory Functions for Unit Tests
 *
 * Provides reusable mock creators for config contexts,
 * sandbox results, and other common test data structures.
 */

/**
 * Create a mock config context
 */
export function createMockConfigContext(overrides: Record<string, any> = {}): {
	config: { apiUrl: string };
	projectId: string;
	branchName: string;
	namespace: string;
	apiKey: string;
	initializationError: string | null;
} {
	return {
		config: { apiUrl: 'https://api.constellationdev.io' },
		projectId: 'test-project-id',
		branchName: 'main',
		namespace: 'test-namespace',
		apiKey: 'test-api-key-12345',
		initializationError: null,
		...overrides,
	};
}

/**
 * Create a mock sandbox result
 */
export function createMockSandboxResult(overrides: Record<string, any> = {}): {
	success: boolean;
	result?: any;
	error?: string;
	logs: string[];
	executionTime: number;
} {
	return {
		success: true,
		result: { data: 'test result' },
		logs: [],
		executionTime: 50,
		...overrides,
	};
}
