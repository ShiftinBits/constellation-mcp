import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import SearchSymbolsTool from '../../../../src/tools/discovery/SearchSymbolsTool.js';
import { createMockToolResult, mockGlobalFetch, createMockResponse } from '../../../helpers/test-utils.js';

// Mock config manager
jest.mock('../../../../src/config/config-manager.js', () => ({
	getConfigContext: jest.fn(() => ({
		projectId: 'test-project',
		branchName: 'main',
		apiKey: 'test-api-key',
		config: {
			apiUrl: 'https://api.test.com',
		},
	})),
}));

describe('SearchSymbolsTool', () => {
	let tool: SearchSymbolsTool;
	let mockFetch: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		tool = new SearchSymbolsTool();
		mockFetch = mockGlobalFetch();
	});

	describe('initialization', () => {
		it('should have correct name and description', () => {
			expect(tool.name).toBe('search_symbols');
			expect(tool.description).toContain('Search for symbols');
		});

		it('should have required schema parameters', () => {
			expect(tool.schema.query).toBeDefined();
			expect(tool.schema.filterByKind).toBeDefined();
			expect(tool.schema.limit).toBeDefined();
		});
	});

	describe('execute', () => {
		it('should search for symbols successfully', async () => {
			const mockData = {
				symbols: [
					{
						id: 'sym1',
						name: 'myFunction',
						qualifiedName: 'utils.myFunction',
						kind: 'function',
						filePath: 'src/utils.ts',
						line: 10,
						column: 5,
						isExported: true,
					},
					{
						id: 'sym2',
						name: 'MyClass',
						qualifiedName: 'models.MyClass',
						kind: 'class',
						filePath: 'src/models.ts',
						line: 20,
						column: 7,
						isExported: true,
					},
				],
				pagination: {
					total: 2,
					returned: 2,
					hasMore: false,
					currentOffset: 0,
				},
			};

			const mockResult = createMockToolResult(true, mockData);
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'my' });

			expect(result).toContain('myFunction');
			expect(result).toContain('MyClass');
			expect(result).toContain('src/utils.ts:10');
			expect(result).toContain('src/models.ts:20');
			expect(result).toContain('function');
			expect(result).toContain('class');
		});

		it('should handle no results found', async () => {
			const mockData = {
				symbols: [],
				pagination: {
					total: 0,
					returned: 0,
					hasMore: false,
					currentOffset: 0,
				},
			};

			const mockResult = createMockToolResult(true, mockData);
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'nonexistent' });

			expect(result).toContain('No symbols found');
		});

		it('should filter by kind', async () => {
			const mockData = {
				symbols: [
					{
						id: 'sym1',
						name: 'myFunction',
						qualifiedName: 'myFunction',
						kind: 'function',
						filePath: 'test.ts',
						line: 1,
						column: 1,
						isExported: true,
					},
				],
				pagination: {
					total: 1,
					returned: 1,
					hasMore: false,
					currentOffset: 0,
				},
			};

			const mockResult = createMockToolResult(true, mockData);
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			await tool.execute({
				query: 'my',
				filterByKind: ['function'],
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: JSON.stringify({
						parameters: {
							query: 'my',
							filterByKind: ['function'],
						},
					}),
				})
			);
		});

		it('should respect limit parameter', async () => {
			const mockData = {
				symbols: [],
				pagination: {
					total: 100,
					returned: 10,
					hasMore: true,
					currentOffset: 0,
				},
			};

			const mockResult = createMockToolResult(true, mockData);
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			await tool.execute({ query: 'test', limit: 10 });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: JSON.stringify({
						parameters: {
							query: 'test',
							limit: 10,
						},
					}),
				})
			);
		});

		it('should show pagination info when hasMore is true', async () => {
			const mockData = {
				symbols: [
					{
						id: 'sym1',
						name: 'test',
						qualifiedName: 'test',
						kind: 'function',
						filePath: 'test.ts',
						line: 1,
						column: 1,
						isExported: true,
					},
				],
				pagination: {
					total: 100,
					returned: 1,
					hasMore: true,
					currentOffset: 0,
					nextOffset: 1,
				},
			};

			const mockResult = createMockToolResult(true, mockData);
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('Found 100 symbols');
			expect(result).toContain('99 more result');
		});

		it('should handle errors gracefully', async () => {
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(500, false));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('Error');
		});
	});

	describe('formatResult', () => {
		it('should format symbols with all details', async () => {
			const mockData = {
				symbols: [
					{
						id: 'sym1',
						name: 'myFunction',
						qualifiedName: 'utils.myFunction',
						kind: 'function',
						filePath: 'src/utils.ts',
						line: 10,
						column: 5,
						isExported: true,
						signature: 'function myFunction(param: string): void',
						visibility: 'public',
					},
				],
				pagination: {
					total: 1,
					returned: 1,
					hasMore: false,
					currentOffset: 0,
				},
			};

			const mockResult = createMockToolResult(true, mockData);
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'my' });

			expect(result).toContain('myFunction');
			expect(result).toContain('function');
			expect(result).toContain('src/utils.ts:10'); // Column not always shown
		});

		it('should indicate cached results', async () => {
			const mockData = {
				symbols: [
					{
						id: 'sym1',
						name: 'test',
						qualifiedName: 'test',
						kind: 'function',
						filePath: 'test.ts',
						line: 1,
						column: 1,
						isExported: true,
					},
				],
				pagination: {
					total: 1,
					returned: 1,
					hasMore: false,
					currentOffset: 0,
				},
			};

			const mockResult = createMockToolResult(true, mockData);
			mockResult.metadata.cached = true;
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('cache');
		});
	});
});
