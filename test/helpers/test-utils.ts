import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Create a temporary directory for tests
 */
export async function createTempDir(): Promise<string> {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'constellation-mcp-test-'));
	return tmpDir;
}

/**
 * Clean up temporary directory after tests
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, { recursive: true, force: true });
	} catch (error) {
		// Ignore cleanup errors
	}
}

/**
 * Create a test file with content
 */
export async function createTestFile(dirPath: string, fileName: string, content: string): Promise<string> {
	const filePath = path.join(dirPath, fileName);
	const fileDir = path.dirname(filePath);

	// Ensure directory exists
	await fs.mkdir(fileDir, { recursive: true });
	await fs.writeFile(filePath, content, 'utf-8');

	return filePath;
}

/**
 * Create a mock Response object
 */
export function createMockResponse(status: number, ok: boolean, data?: any): any {
	return {
		ok,
		status,
		statusText: status === 200 ? 'OK' : status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'Error',
		// @ts-expect-error - Mock data type compatibility
		json: jest.fn().mockResolvedValue(data),
		// @ts-expect-error - Mock data type compatibility
		text: jest.fn().mockResolvedValue(JSON.stringify(data)),
		headers: new Headers(),
		redirected: false,
		type: 'basic',
		url: '',
		body: null,
		bodyUsed: false,
		arrayBuffer: jest.fn(),
		blob: jest.fn(),
		clone: jest.fn(),
		formData: jest.fn(),
	};
}

/**
 * Create a mock McpToolResult
 */
export function createMockToolResult<T>(success: boolean, data?: T, error?: string): any {
	return {
		success,
		data,
		error,
		metadata: {
			executionTime: 123,
			cached: false,
			timestamp: '2025-01-22T00:00:00.000Z',
		},
	};
}

/**
 * Mock fetch globally
 */
export function mockGlobalFetch(): jest.Mock {
	const mockFetch = jest.fn();
	global.fetch = mockFetch as any;
	return mockFetch;
}

/**
 * Create a mock git repository structure
 */
export async function createMockGitRepo(dirPath: string): Promise<void> {
	const gitDir = path.join(dirPath, '.git');
	await fs.mkdir(gitDir, { recursive: true });

	const gitConfig = `[core]
	repositoryformatversion = 0
	filemode = true
[remote "origin"]
	url = git@github.com:test-user/test-repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
`;

	await fs.writeFile(path.join(gitDir, 'config'), gitConfig, 'utf-8');
	await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8');
}
