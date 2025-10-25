import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseMcpTool } from '../../../../src/lib/BaseMcpTool.js';
import { z } from 'zod';
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

// Create a concrete implementation for testing
class TestTool extends BaseMcpTool<{ query: string }, { result: string }> {
	name = 'test_tool';
	description = 'A test tool';

	schema = {
		query: {
			type: z.string().min(1),
			description: 'Test query parameter',
		},
	};

	protected formatResult(data: { result: string }, metadata: any): string {
		return `Result: ${data.result} (cached: ${metadata.cached})`;
	}
}

describe('BaseMcpTool', () => {
	let tool: TestTool;
	let mockFetch: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		tool = new TestTool();
		mockFetch = mockGlobalFetch();
	});

	describe('initialization', () => {
		it('should create tool with name and description', () => {
			expect(tool.name).toBe('test_tool');
			expect(tool.description).toBe('A test tool');
		});

		it('should have schema defined', () => {
			expect(tool.schema).toBeDefined();
			expect(tool.schema.query).toBeDefined();
		});
	});

	describe('execute', () => {
		it('should execute successfully and format result', async () => {
			const mockResult = createMockToolResult(true, { result: 'success' });
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'test' });

			expect(result).toBe('Result: success (cached: false)');
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.test.com/v1/mcp/tools/test_tool',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'x-project-id': 'test-project',
						'x-branch-name': 'main',
					}),
				})
			);
		});

		it('should handle tool execution errors', async () => {
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(500, false));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('Error');
		});

		it('should handle missing data in successful response', async () => {
			const mockResult = createMockToolResult(true, undefined);
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('Failed');
		});

		it('should handle API error responses', async () => {
			const mockResult = createMockToolResult(false, undefined, 'API error occurred');
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('API error occurred');
		});

		it('should pass correct parameters to API', async () => {
			const mockResult = createMockToolResult(true, { result: 'test' });
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			await tool.execute({ query: 'my-query' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: JSON.stringify({ parameters: { query: 'my-query' } }),
				})
			);
		});
	});

	describe('getClient', () => {
		it('should return constellation client', () => {
			const client = (tool as any).getClient();
			expect(client).toBeDefined();
		});
	});

	describe('getProjectContext', () => {
		it('should return project context', () => {
			const context = (tool as any).getProjectContext();
			expect(context.projectId).toBe('test-project');
			expect(context.branchName).toBe('main');
		});
	});

	describe('formatResult', () => {
		it('should be implemented by subclass', () => {
			const formatted = (tool as any).formatResult(
				{ result: 'data' },
				{ cached: true, executionTime: 100 }
			);

			expect(formatted).toContain('data');
			expect(formatted).toContain('true');
		});
	});

	describe('error handling', () => {
		it('should handle network errors gracefully', async () => {
			// @ts-expect-error - Mock error type compatibility
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('Failed');
			expect(result).toContain('Network error');
		});

		it('should handle malformed responses', async () => {
			const mockResponse = createMockResponse(200, true);
			// @ts-expect-error - Mock error type compatibility
			mockResponse.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));
			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(mockResponse);

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('Failed');
		});
	});

	describe('metadata handling', () => {
		it('should pass metadata to formatResult', async () => {
			const mockResult = createMockToolResult(true, { result: 'test' });
			mockResult.metadata.cached = true;
			mockResult.metadata.executionTime = 500;

			// @ts-expect-error - Mock response type compatibility
			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await tool.execute({ query: 'test' });

			expect(result).toContain('cached: true');
		});
	});
});

describe('BaseMcpTool with different response types', () => {
	class ComplexTool extends BaseMcpTool<{ id: string }, { items: string[] }> {
		name = 'complex_tool';
		description = 'Complex tool';

		schema = {
			id: {
				type: z.string(),
				description: 'ID parameter',
			},
		};

		protected formatResult(data: { items: string[] }, metadata: any): string {
			return `Found ${data.items.length} items`;
		}
	}

	let tool: ComplexTool;
	let mockFetch: jest.Mock;

	beforeEach(() => {
		tool = new ComplexTool();
		mockFetch = mockGlobalFetch();
	});

	it('should handle complex response types', async () => {
		const mockResult = createMockToolResult(true, { items: ['a', 'b', 'c'] });
		// @ts-expect-error - Mock response type compatibility
		mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

		const result = await tool.execute({ id: 'test-id' });

		expect(result).toBe('Found 3 items');
	});
});
