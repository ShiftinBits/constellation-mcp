import {
	describe,
	it,
	expect,
	jest,
	beforeEach,
	afterEach,
} from '@jest/globals';
import {
	ConstellationClient,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	RetryableError,
	ToolNotFoundError,
	ConfigurationError,
	TimeoutError,
} from '../../../src/client/constellation-client.js';
import { createMockResponse } from '../../helpers/test-utils.js';

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('ConstellationClient', () => {
	let client: ConstellationClient;
	const mockConfig = {
		apiUrl: 'https://api.constellation.test',
		validate: () => {},
	} as any;
	const mockApiKey = 'test-api-key';

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		client = new ConstellationClient(mockConfig, mockApiKey);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should create ConstellationClient with API URL and key', () => {
			expect(client).toBeInstanceOf(ConstellationClient);
		});
	});

	describe('executeMcpTool', () => {
		const mockContext = {
			projectId: 'test-project',
			branchName: 'main',
		};

		it('should successfully execute MCP tool', async () => {
			const mockResult = {
				success: true,
				data: { symbols: [] },
				metadata: { executionTime: 100, cached: false },
			};

			mockFetch.mockResolvedValue(createMockResponse(200, true, mockResult));

			const result = await client.executeMcpTool(
				'search_symbols',
				{ query: 'test' },
				mockContext,
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.constellation.test/v1/mcp/tools/search_symbols',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json; charset=utf-8',
						Authorization: `Bearer ${mockApiKey}`,
						'x-project-id': 'test-project',
						'x-branch-name': 'main',
					}),
					body: JSON.stringify({ parameters: { query: 'test' } }),
				}),
			);
			expect(result).toEqual(mockResult);
		});

		it('should throw AuthenticationError on 401', async () => {
			mockFetch.mockResolvedValue(createMockResponse(401, false));

			await expect(
				client.executeMcpTool('search_symbols', {}, mockContext),
			).rejects.toThrow(AuthenticationError);
		});

		it('should throw AuthorizationError on 403', async () => {
			mockFetch.mockResolvedValue(createMockResponse(403, false));

			await expect(
				client.executeMcpTool('search_symbols', {}, mockContext),
			).rejects.toThrow(AuthorizationError);
		});

		it('should throw ToolNotFoundError on 404', async () => {
			mockFetch.mockResolvedValue(createMockResponse(404, false));

			await expect(
				client.executeMcpTool('nonexistent_tool', {}, mockContext),
			).rejects.toThrow(ToolNotFoundError);
		});

		it('should throw Error on 500 (wraps RetryableError)', async () => {
			mockFetch.mockResolvedValue(createMockResponse(500, false));

			const promise = client.executeMcpTool('search_symbols', {}, mockContext);

			// Run timers and wait for rejection in parallel
			const [, error] = await Promise.all([
				jest.runAllTimersAsync(),
				promise.catch((e) => e),
			]);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toContain('Failed to execute MCP tool');
		});

		it('should retry on retryable errors', async () => {
			mockFetch
				.mockResolvedValueOnce(createMockResponse(500, false))
				.mockResolvedValueOnce(createMockResponse(502, false))
				.mockResolvedValueOnce(
					createMockResponse(200, true, { success: true, data: {} }),
				);

			const promise = client.executeMcpTool('search_symbols', {}, mockContext);
			await jest.runAllTimersAsync();
			const result = await promise;

			expect(mockFetch).toHaveBeenCalledTimes(3);
			expect(result.success).toBe(true);
		});

		it('should not retry on 4xx errors', async () => {
			mockFetch.mockResolvedValue(createMockResponse(400, false));

			await expect(
				client.executeMcpTool('search_symbols', {}, mockContext),
			).rejects.toThrow();

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			await expect(
				client.executeMcpTool('search_symbols', {}, mockContext),
			).rejects.toThrow('Network error');
		});

		it('should apply timeout', async () => {
			// Mock fetch to reject when aborted
			let abortHandler: (() => void) | null = null;
			mockFetch.mockImplementation(
				(url: RequestInfo | URL, options?: RequestInit) => {
					return new Promise((resolve, reject) => {
						if (options?.signal) {
							abortHandler = () => {
								const abortError: any = new Error('The operation was aborted');
								abortError.name = 'AbortError';
								reject(abortError);
							};
							options.signal.addEventListener('abort', abortHandler);
						}
					});
				},
			);

			const promise = client.executeMcpTool('search_symbols', {}, mockContext);

			// Advance timers to trigger timeout
			jest.advanceTimersByTime(31000);

			await expect(promise).rejects.toThrow();
		});

		it('should include correct headers', async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(200, true, { success: true, data: {} }),
			);

			await client.executeMcpTool('test_tool', { param: 'value' }, mockContext);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json; charset=utf-8',
						Authorization: `Bearer ${mockApiKey}`,
						'x-project-id': 'test-project',
						'x-branch-name': 'main',
					}),
				}),
			);
		});

		it('should handle empty parameters', async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(200, true, { success: true, data: {} }),
			);

			await client.executeMcpTool('test_tool', {}, mockContext);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: JSON.stringify({ parameters: {} }),
				}),
			);
		});
	});

	describe('retry logic', () => {
		const mockContext = { projectId: 'test', branchName: 'main' };

		it('should apply exponential backoff', async () => {
			mockFetch
				.mockResolvedValueOnce(createMockResponse(500, false))
				.mockResolvedValueOnce(createMockResponse(500, false))
				.mockResolvedValueOnce(
					createMockResponse(200, true, { success: true, data: {} }),
				);

			const promise = client.executeMcpTool('test', {}, mockContext);
			await jest.runAllTimersAsync();
			await promise;

			// Should have 3 calls: initial + 2 retries
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should add jitter to retry delays', async () => {
			const originalRandom = Math.random;
			Math.random = jest.fn().mockReturnValue(0.5) as unknown as () => number;

			mockFetch
				.mockResolvedValueOnce(createMockResponse(500, false))
				.mockResolvedValueOnce(
					createMockResponse(200, true, { success: true, data: {} }),
				);

			const promise = client.executeMcpTool('test', {}, mockContext);
			await jest.runAllTimersAsync();
			await promise;

			expect(mockFetch).toHaveBeenCalledTimes(2);
			Math.random = originalRandom;
		});

		it('should exhaust retries and throw final error', async () => {
			mockFetch.mockResolvedValue(createMockResponse(500, false));

			const promise = client.executeMcpTool('test', {}, mockContext);

			// Run timers and wait for rejection in parallel
			const [, error] = await Promise.all([
				jest.runAllTimersAsync(),
				promise.catch((e) => e),
			]);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toContain('Failed to execute MCP tool');
			expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
		});
	});

	describe('error classes', () => {
		it('should create AuthenticationError', () => {
			const error = new AuthenticationError('Auth failed');
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('AuthenticationError');
			expect(error.message).toBe('Auth failed');
		});

		it('should create NotFoundError', () => {
			const error = new NotFoundError('Not found');
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('NotFoundError');
			expect(error.message).toBe('Not found');
		});

		it('should create RetryableError', () => {
			const error = new RetryableError('Server error');
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('RetryableError');
			expect(error.message).toBe('Server error');
		});

		it('should create ToolNotFoundError', () => {
			const error = new ToolNotFoundError('Tool not found');
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('ToolNotFoundError');
			expect(error.message).toBe('Tool not found');
		});

		it('should create AuthorizationError', () => {
			const error = new AuthorizationError('Insufficient permissions');
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('AuthorizationError');
			expect(error.message).toBe('Insufficient permissions');
		});

		it('should create ConfigurationError', () => {
			const error = new ConfigurationError('constellation.json not found');
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('ConfigurationError');
			expect(error.message).toBe('constellation.json not found');
		});

		it('should create TimeoutError', () => {
			const error = new TimeoutError('Operation timed out after 30s');
			expect(error).toBeInstanceOf(Error);
			expect(error.name).toBe('TimeoutError');
			expect(error.message).toBe('Operation timed out after 30s');
		});
	});

	describe('response parsing', () => {
		const mockContext = { projectId: 'test', branchName: 'main' };

		it('should parse JSON response correctly', async () => {
			const mockData = {
				success: true,
				data: { value: 'test' },
				metadata: { executionTime: 100, cached: false },
			};

			mockFetch.mockResolvedValue(createMockResponse(200, true, mockData));

			const result = await client.executeMcpTool('test', {}, mockContext);

			expect(result).toEqual(mockData);
		});

		it('should handle malformed JSON', async () => {
			const mockResponse = createMockResponse(200, true);
			mockResponse.json = jest
				.fn<() => Promise<unknown>>()
				.mockRejectedValue(new Error('Invalid JSON'));

			mockFetch.mockResolvedValue(mockResponse);

			await expect(
				client.executeMcpTool('test', {}, mockContext),
			).rejects.toThrow();
		});
	});

	describe('getToolCatalog', () => {
		it('should fetch tool catalog successfully', async () => {
			const mockCatalog = {
				tools: [{ name: 'search_symbols' }, { name: 'get_dependencies' }],
			};

			mockFetch.mockResolvedValue(createMockResponse(200, true, mockCatalog));

			const result = await client.getToolCatalog();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.constellation.test/v1/mcp/catalog',
				expect.objectContaining({
					method: 'GET',
				}),
			);
			expect(result).toEqual(mockCatalog);
		});

		it('should include category filter in query', async () => {
			mockFetch.mockResolvedValue(createMockResponse(200, true, { tools: [] }));

			await client.getToolCatalog({ category: 'discovery' });

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.constellation.test/v1/mcp/catalog?category=discovery',
				expect.any(Object),
			);
		});

		it('should include search filter in query', async () => {
			mockFetch.mockResolvedValue(createMockResponse(200, true, { tools: [] }));

			await client.getToolCatalog({ search: 'symbol' });

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.constellation.test/v1/mcp/catalog?search=symbol',
				expect.any(Object),
			);
		});

		it('should include tags filter in query', async () => {
			mockFetch.mockResolvedValue(createMockResponse(200, true, { tools: [] }));

			await client.getToolCatalog({ tags: ['core', 'analysis'] });

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.constellation.test/v1/mcp/catalog?tags=core%2Canalysis',
				expect.any(Object),
			);
		});

		it('should include includeDeprecated filter in query', async () => {
			mockFetch.mockResolvedValue(createMockResponse(200, true, { tools: [] }));

			await client.getToolCatalog({ includeDeprecated: true });

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.constellation.test/v1/mcp/catalog?includeDeprecated=true',
				expect.any(Object),
			);
		});

		it('should combine multiple query parameters', async () => {
			mockFetch.mockResolvedValue(createMockResponse(200, true, { tools: [] }));

			await client.getToolCatalog({
				category: 'discovery',
				search: 'symbol',
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('category=discovery'),
				expect.any(Object),
			);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('search=symbol'),
				expect.any(Object),
			);
		});

		it('should throw error on non-ok response', async () => {
			// Use 400 (non-retryable) instead of 500 to avoid retry delays
			mockFetch.mockResolvedValue(createMockResponse(400, false));

			await expect(client.getToolCatalog()).rejects.toThrow(
				'Failed to fetch tool catalog',
			);
		});
	});

	describe('getToolMetadata', () => {
		it('should fetch tool metadata successfully', async () => {
			const mockMetadata = {
				name: 'search_symbols',
				description: 'Search for symbols',
				inputSchema: { type: 'object' },
			};

			mockFetch.mockResolvedValue(createMockResponse(200, true, mockMetadata));

			const result = await client.getToolMetadata('search_symbols');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.constellation.test/v1/mcp/tools/search_symbols',
				expect.objectContaining({
					method: 'GET',
				}),
			);
			expect(result).toEqual(mockMetadata);
		});

		it('should throw ToolNotFoundError on 404', async () => {
			mockFetch.mockResolvedValue(createMockResponse(404, false));

			await expect(client.getToolMetadata('nonexistent_tool')).rejects.toThrow(
				ToolNotFoundError,
			);
		});

		it('should throw error on non-ok response', async () => {
			// Use 400 (non-retryable) instead of 500 to avoid retry delays
			mockFetch.mockResolvedValue(createMockResponse(400, false));

			await expect(client.getToolMetadata('search_symbols')).rejects.toThrow(
				'Failed to fetch tool metadata',
			);
		});
	});

	describe('retry behavior edge cases', () => {
		const mockContext = { projectId: 'test', branchName: 'main' };

		it('should retry on 503 Service Unavailable', async () => {
			mockFetch
				.mockResolvedValueOnce(createMockResponse(503, false))
				.mockResolvedValueOnce(
					createMockResponse(200, true, { success: true, data: {} }),
				);

			const promise = client.executeMcpTool('test', {}, mockContext);
			await jest.runAllTimersAsync();
			const result = await promise;

			expect(mockFetch).toHaveBeenCalledTimes(2);
			expect(result.success).toBe(true);
		});

		it('should retry on 504 Gateway Timeout', async () => {
			mockFetch
				.mockResolvedValueOnce(createMockResponse(504, false))
				.mockResolvedValueOnce(
					createMockResponse(200, true, { success: true, data: {} }),
				);

			const promise = client.executeMcpTool('test', {}, mockContext);
			await jest.runAllTimersAsync();
			const result = await promise;

			expect(mockFetch).toHaveBeenCalledTimes(2);
			expect(result.success).toBe(true);
		});

		it('should not retry on non-retryable error status (400)', async () => {
			mockFetch.mockResolvedValue(createMockResponse(400, false));

			await expect(
				client.executeMcpTool('test', {}, mockContext),
			).rejects.toThrow();

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should not retry on non-retryable error status (403)', async () => {
			mockFetch.mockResolvedValue(createMockResponse(403, false));

			await expect(
				client.executeMcpTool('test', {}, mockContext),
			).rejects.toThrow();

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('executeMcpTool error response parsing', () => {
		const mockContext = { projectId: 'test', branchName: 'main' };

		it('should include error text in failure message', async () => {
			const mockResponse = createMockResponse(422, false);
			(mockResponse as any).text = () =>
				Promise.resolve('Validation error: invalid query');
			mockFetch.mockResolvedValue(mockResponse);

			await expect(
				client.executeMcpTool('search_symbols', {}, mockContext),
			).rejects.toThrow('Validation error: invalid query');
		});
	});
});
