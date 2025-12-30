/**
 * Project Capabilities Unit Tests
 *
 * Tests for the capability checking functionality that helps AI assistants
 * understand project state before making queries.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
	getProjectCapabilities,
	ProjectCapabilities,
} from '../../../src/code-mode/capabilities.js';
import { ConstellationClient } from '../../../src/client/constellation-client.js';

// Mock ConstellationClient
jest.mock('../../../src/client/constellation-client.js');

describe('capabilities', () => {
	let mockClient: jest.Mocked<ConstellationClient>;
	const mockContext = {
		projectId: 'test-project',
		branchName: 'main',
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockClient = {
			executeMcpTool: jest.fn(),
		} as any;
	});

	describe('getProjectCapabilities', () => {
		describe('successful responses', () => {
			it('should return indexed capabilities when project is indexed', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: {
						metadata: {
							languages: [
								{ language: 'typescript', fileCount: 100 },
								{ language: 'javascript', fileCount: 50 },
							],
							lastIndexedAt: '2024-01-15T10:00:00Z',
						},
						structure: {
							symbols: { total: 500 },
							files: { total: 150 },
						},
					},
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 100,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(true);
				expect(result.indexedBranch).toBe('main');
				expect(result.lastIndexedAt).toBe('2024-01-15T10:00:00Z');
				expect(result.supportedLanguages).toEqual(['typescript', 'javascript']);
				expect(result.symbolCount).toBe(500);
				expect(result.fileCount).toBe(150);
				expect(result.limitations).toEqual([]);
			});

			it('should enable all features when project is indexed', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: {
						metadata: {
							languages: [{ language: 'typescript', fileCount: 10 }],
						},
						structure: { symbols: { total: 100 }, files: { total: 10 } },
					},
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 50,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.availableFeatures).toEqual({
					searchSymbols: true,
					impactAnalysis: true,
					callGraph: true,
					circularDependencies: true,
					orphanedCode: true,
					architectureOverview: true,
				});
			});

			it('should add limitation warning when symbolCount is 0', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: {
						metadata: { languages: [] },
						structure: { symbols: { total: 0 }, files: { total: 0 } },
					},
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 50,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(true);
				expect(result.symbolCount).toBe(0);
				expect(result.limitations).toContain(
					'No symbols indexed - the project may be empty or not yet fully indexed',
				);
			});

			it('should handle missing metadata fields gracefully', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: {},
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 50,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(true);
				expect(result.supportedLanguages).toEqual([]);
				expect(result.symbolCount).toBe(0);
				expect(result.fileCount).toBe(0);
			});

			it('should handle missing structure fields gracefully', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: {
						metadata: {
							languages: [{ language: 'python', fileCount: 25 }],
						},
					},
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 50,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.supportedLanguages).toEqual(['python']);
				expect(result.symbolCount).toBe(0);
				expect(result.fileCount).toBe(0);
			});
		});

		describe('not indexed responses', () => {
			it('should return not-indexed capabilities when success is false', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: false,
					data: undefined,
					error: 'Project not found',
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 10,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.supportedLanguages).toEqual([]);
				expect(result.symbolCount).toBe(0);
				expect(result.fileCount).toBe(0);
				expect(result.limitations).toContain(
					'Project not indexed - run: constellation index',
				);
			});

			it('should return not-indexed capabilities when data is null', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: null,
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 10,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.availableFeatures.searchSymbols).toBe(false);
			});

			it('should disable all features when not indexed', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: false,
					data: undefined,
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 10,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.availableFeatures).toEqual({
					searchSymbols: false,
					impactAnalysis: false,
					callGraph: false,
					circularDependencies: false,
					orphanedCode: false,
					architectureOverview: false,
				});
			});
		});

		describe('error handling', () => {
			it('should handle "not found" errors', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('Project not found in index'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Project not indexed - run: constellation index',
				);
			});

			it('should handle "not indexed" errors', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('Project not indexed'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Project not indexed - run: constellation index',
				);
			});

			it('should handle 404 errors', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('HTTP 404: Resource not found'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Project not indexed - run: constellation index',
				);
			});

			it('should handle connection refused errors', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('ECONNREFUSED: Connection refused'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Cannot connect to Constellation API - check that constellation-core is running',
				);
			});

			it('should handle fetch failed errors', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('Fetch failed'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Cannot connect to Constellation API - check that constellation-core is running',
				);
			});

			it('should handle network errors', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('Network error occurred'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Cannot connect to Constellation API - check that constellation-core is running',
				);
			});

			it('should handle authentication errors (401)', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('HTTP 401: Unauthorized'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Authentication failed - run: constellation auth',
				);
			});

			it('should handle authentication errors (403)', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('HTTP 403: Forbidden'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Authentication failed - run: constellation auth',
				);
			});

			it('should handle auth keyword errors', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('Auth token expired'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations).toContain(
					'Authentication failed - run: constellation auth',
				);
			});

			it('should handle unknown errors with error message', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce(
					new Error('Unknown database error'),
				);

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations[0]).toContain('Unable to check capabilities');
				expect(result.limitations[0]).toContain('Unknown database error');
			});

			it('should handle non-Error throws', async () => {
				mockClient.executeMcpTool.mockRejectedValueOnce('String error');

				const result = await getProjectCapabilities(mockClient, mockContext);

				expect(result.isIndexed).toBe(false);
				expect(result.limitations[0]).toContain('Unable to check capabilities');
				expect(result.limitations[0]).toContain('String error');
			});
		});

		describe('API call verification', () => {
			it('should call executeMcpTool with correct parameters', async () => {
				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: {
						metadata: { languages: [] },
						structure: { symbols: { total: 10 }, files: { total: 5 } },
					},
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 50,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				await getProjectCapabilities(mockClient, mockContext);

				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_architecture_overview',
					{ includeMetrics: true },
					mockContext,
				);
			});

			it('should use provided context branchName', async () => {
				const customContext = {
					projectId: 'custom-project',
					branchName: 'feature-branch',
				};

				mockClient.executeMcpTool.mockResolvedValueOnce({
					success: true,
					data: {
						metadata: { languages: [] },
						structure: { symbols: { total: 10 }, files: { total: 5 } },
					},
					metadata: {
						toolName: 'get_architecture_overview',
						executionTime: 50,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				});

				const result = await getProjectCapabilities(mockClient, customContext);

				expect(result.indexedBranch).toBe('feature-branch');
				expect(mockClient.executeMcpTool).toHaveBeenCalledWith(
					'get_architecture_overview',
					{ includeMetrics: true },
					customContext,
				);
			});
		});
	});

	describe('ProjectCapabilities interface', () => {
		it('should have expected structure for indexed project', async () => {
			mockClient.executeMcpTool.mockResolvedValueOnce({
				success: true,
				data: {
					metadata: {
						languages: [{ language: 'go', fileCount: 30 }],
						lastIndexedAt: '2024-06-01T12:00:00Z',
					},
					structure: {
						symbols: { total: 250 },
						files: { total: 30 },
					},
				},
				metadata: {
					toolName: 'get_architecture_overview',
					executionTime: 75,
					cached: false,
					timestamp: new Date().toISOString(),
				},
			});

			const result: ProjectCapabilities = await getProjectCapabilities(
				mockClient,
				mockContext,
			);

			// Verify type structure
			expect(typeof result.isIndexed).toBe('boolean');
			expect(typeof result.indexedBranch).toBe('string');
			expect(typeof result.lastIndexedAt).toBe('string');
			expect(Array.isArray(result.supportedLanguages)).toBe(true);
			expect(typeof result.symbolCount).toBe('number');
			expect(typeof result.fileCount).toBe('number');
			expect(typeof result.availableFeatures).toBe('object');
			expect(Array.isArray(result.limitations)).toBe(true);
		});

		it('should have expected structure for not-indexed project', async () => {
			mockClient.executeMcpTool.mockRejectedValueOnce(new Error('Not indexed'));

			const result: ProjectCapabilities = await getProjectCapabilities(
				mockClient,
				mockContext,
			);

			expect(typeof result.isIndexed).toBe('boolean');
			expect(result.indexedBranch).toBeUndefined();
			expect(result.lastIndexedAt).toBeUndefined();
			expect(Array.isArray(result.supportedLanguages)).toBe(true);
			expect(typeof result.symbolCount).toBe('number');
			expect(typeof result.fileCount).toBe('number');
			expect(typeof result.availableFeatures).toBe('object');
			expect(Array.isArray(result.limitations)).toBe(true);
		});
	});
});
