/**
 * File Utilities Tests
 *
 * Unit tests for the FileUtils class with mocked fs module.
 * Tests FileUtils logic without real file system operations.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Stats } from 'fs';

// Mock fs module before importing FileUtils
// Note: fs.promises has its own constants property in Node.js 18+
jest.mock('fs', () => ({
	promises: {
		access: jest.fn(),
		stat: jest.fn(),
		readFile: jest.fn(),
		constants: {
			R_OK: 4,
		},
	},
	constants: {
		R_OK: 4,
	},
}));

// Import after mocking
import { FileUtils } from '../../../src/utils/file.utils.js';
import { promises as fs, constants } from 'fs';

// Type the mocked fs for better IntelliSense
const mockAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockStat = fs.stat as jest.MockedFunction<typeof fs.stat>;
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

// Helper to create mock Stats object
function createMockStats(overrides: Partial<Stats> = {}): Stats {
	return {
		isFile: () => false,
		isDirectory: () => false,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isSymbolicLink: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		dev: 0,
		ino: 0,
		mode: 0,
		nlink: 0,
		uid: 0,
		gid: 0,
		rdev: 0,
		size: 0,
		blksize: 0,
		blocks: 0,
		atimeMs: 0,
		mtimeMs: 0,
		ctimeMs: 0,
		birthtimeMs: 0,
		atime: new Date(),
		mtime: new Date(),
		ctime: new Date(),
		birthtime: new Date(),
		...overrides,
	} as Stats;
}

describe('FileUtils', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('fileIsReadable', () => {
		it('should return true when file is readable', async () => {
			mockAccess.mockResolvedValue(undefined);

			const result = await FileUtils.fileIsReadable(
				'/path/to/readable-file.txt',
			);

			expect(result).toBe(true);
			expect(mockAccess).toHaveBeenCalledWith(
				'/path/to/readable-file.txt',
				constants.R_OK,
			);
		});

		it('should return false when file does not exist', async () => {
			mockAccess.mockRejectedValue(
				new Error('ENOENT: no such file or directory'),
			);

			const result = await FileUtils.fileIsReadable(
				'/path/to/non-existent-file.txt',
			);

			expect(result).toBe(false);
		});

		it('should return false when file is not readable (permission denied)', async () => {
			mockAccess.mockRejectedValue(new Error('EACCES: permission denied'));

			const result = await FileUtils.fileIsReadable(
				'/path/to/protected-file.txt',
			);

			expect(result).toBe(false);
		});

		it('should handle paths with special characters', async () => {
			mockAccess.mockResolvedValue(undefined);

			const result = await FileUtils.fileIsReadable(
				'/path/to/file with spaces (1).txt',
			);

			expect(result).toBe(true);
			expect(mockAccess).toHaveBeenCalledWith(
				'/path/to/file with spaces (1).txt',
				constants.R_OK,
			);
		});

		it('should return true for directory path (fs.access behavior)', async () => {
			// fs.access with R_OK returns success for readable directories too
			mockAccess.mockResolvedValue(undefined);

			const result = await FileUtils.fileIsReadable('/path/to/directory');

			expect(result).toBe(true);
		});

		it('should return false for empty path', async () => {
			mockAccess.mockRejectedValue(new Error('ENOENT'));

			const result = await FileUtils.fileIsReadable('');

			expect(result).toBe(false);
		});
	});

	describe('readFile', () => {
		it('should read file contents as string', async () => {
			mockReadFile.mockResolvedValue('Hello, World!');

			const result = await FileUtils.readFile('/path/to/file.txt');

			expect(result).toBe('Hello, World!');
			expect(mockReadFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
		});

		it('should read file with unicode content', async () => {
			const unicodeContent = 'Hello, 世界! 🌍';
			mockReadFile.mockResolvedValue(unicodeContent);

			const result = await FileUtils.readFile('/path/to/unicode-file.txt');

			expect(result).toBe(unicodeContent);
		});

		it('should throw error when file does not exist', async () => {
			mockReadFile.mockRejectedValue(
				new Error('ENOENT: no such file or directory'),
			);

			await expect(
				FileUtils.readFile('/path/to/non-existent.txt'),
			).rejects.toThrow();
		});

		it('should throw error when permission denied', async () => {
			mockReadFile.mockRejectedValue(new Error('EACCES: permission denied'));

			await expect(
				FileUtils.readFile('/path/to/protected.txt'),
			).rejects.toThrow('EACCES');
		});

		it('should handle empty file', async () => {
			mockReadFile.mockResolvedValue('');

			const result = await FileUtils.readFile('/path/to/empty-file.txt');

			expect(result).toBe('');
		});

		it('should handle multi-line content', async () => {
			const multilineContent = 'Line 1\nLine 2\nLine 3';
			mockReadFile.mockResolvedValue(multilineContent);

			const result = await FileUtils.readFile('/path/to/multiline.txt');

			expect(result).toBe(multilineContent);
			expect(result.split('\n').length).toBe(3);
		});
	});

	describe('directoryExists', () => {
		it('should return true when directory exists', async () => {
			mockStat.mockResolvedValue(createMockStats({ isDirectory: () => true }));

			const result = await FileUtils.directoryExists('/path/to/directory');

			expect(result).toBe(true);
			expect(mockStat).toHaveBeenCalledWith('/path/to/directory');
		});

		it('should return false when path is a file', async () => {
			mockStat.mockResolvedValue(
				createMockStats({ isDirectory: () => false, isFile: () => true }),
			);

			const result = await FileUtils.directoryExists('/path/to/file.txt');

			expect(result).toBe(false);
		});

		it('should return false when path does not exist', async () => {
			mockStat.mockRejectedValue(
				new Error('ENOENT: no such file or directory'),
			);

			const result = await FileUtils.directoryExists('/path/to/non-existent');

			expect(result).toBe(false);
		});

		it('should handle nested directories', async () => {
			mockStat.mockResolvedValue(createMockStats({ isDirectory: () => true }));

			const result = await FileUtils.directoryExists('/level1/level2/level3');

			expect(result).toBe(true);
			expect(mockStat).toHaveBeenCalledWith('/level1/level2/level3');
		});

		it('should handle root directory', async () => {
			mockStat.mockResolvedValue(createMockStats({ isDirectory: () => true }));

			const result = await FileUtils.directoryExists('/');

			expect(result).toBe(true);
		});

		it('should handle permission errors', async () => {
			mockStat.mockRejectedValue(new Error('EACCES: permission denied'));

			const result = await FileUtils.directoryExists('/protected/directory');

			expect(result).toBe(false);
		});
	});

	describe('isRootDirectory', () => {
		// isRootDirectory is synchronous and uses path module, no mocking needed

		it('should return true for Unix root directory', () => {
			const result = FileUtils.isRootDirectory('/');

			expect(result).toBe(true);
		});

		it('should return false for non-root directory', () => {
			const result = FileUtils.isRootDirectory('/home/user');

			expect(result).toBe(false);
		});

		it('should return false for subdirectory', () => {
			const result = FileUtils.isRootDirectory('/home/user/projects');

			expect(result).toBe(false);
		});

		it('should handle path normalization with double slashes', () => {
			const result = FileUtils.isRootDirectory('//');

			expect(result).toBe(true);
		});

		it('should handle path normalization with trailing slash', () => {
			const result = FileUtils.isRootDirectory('/home/');

			expect(result).toBe(false);
		});

		it('should handle complex paths with parent references', () => {
			const result = FileUtils.isRootDirectory('/home/user/../user/projects');

			expect(result).toBe(false);
		});
	});

	describe('isGitRepository', () => {
		it('should return true when .git directory exists', async () => {
			mockStat.mockResolvedValue(createMockStats({ isDirectory: () => true }));

			const result = await FileUtils.isGitRepository('/repo/path');

			expect(result).toBe(true);
			expect(mockStat).toHaveBeenCalledWith('/repo/path/.git');
		});

		it('should return true when .git file exists (submodule)', async () => {
			// For submodules, .git is a file, not a directory
			mockStat.mockResolvedValue(createMockStats({ isFile: () => true }));

			const result = await FileUtils.isGitRepository('/submodule/path');

			expect(result).toBe(true);
			expect(mockStat).toHaveBeenCalledWith('/submodule/path/.git');
		});

		it('should return false when .git does not exist', async () => {
			mockStat.mockRejectedValue(
				new Error('ENOENT: no such file or directory'),
			);

			const result = await FileUtils.isGitRepository('/not/a/repo');

			expect(result).toBe(false);
		});

		it('should return false for root directory (typically no .git)', async () => {
			mockStat.mockRejectedValue(new Error('ENOENT'));

			const result = await FileUtils.isGitRepository('/');

			expect(result).toBe(false);
			expect(mockStat).toHaveBeenCalledWith('/.git');
		});

		it('should handle nested repository check', async () => {
			// First call for nested dir (no .git)
			mockStat.mockRejectedValueOnce(new Error('ENOENT'));
			// Second call for parent dir (has .git)
			mockStat.mockResolvedValueOnce(
				createMockStats({ isDirectory: () => true }),
			);

			const nestedResult = await FileUtils.isGitRepository('/repo/src/lib');
			expect(nestedResult).toBe(false);

			const parentResult = await FileUtils.isGitRepository('/repo');
			expect(parentResult).toBe(true);
		});

		it('should handle paths with spaces', async () => {
			mockStat.mockResolvedValue(createMockStats({ isDirectory: () => true }));

			const result = await FileUtils.isGitRepository('/path with spaces/repo');

			expect(result).toBe(true);
			expect(mockStat).toHaveBeenCalledWith('/path with spaces/repo/.git');
		});

		it('should handle permission errors gracefully', async () => {
			mockStat.mockRejectedValue(new Error('EACCES: permission denied'));

			const result = await FileUtils.isGitRepository('/protected/repo');

			expect(result).toBe(false);
		});
	});

	describe('error handling edge cases', () => {
		it('should handle concurrent file checks', async () => {
			mockAccess
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('ENOENT'))
				.mockResolvedValueOnce(undefined);

			const results = await Promise.all([
				FileUtils.fileIsReadable('/file1.txt'),
				FileUtils.fileIsReadable('/file2.txt'),
				FileUtils.fileIsReadable('/file3.txt'),
			]);

			expect(results).toEqual([true, false, true]);
		});

		it('should handle concurrent directory checks', async () => {
			mockStat
				.mockResolvedValueOnce(createMockStats({ isDirectory: () => true }))
				.mockResolvedValueOnce(createMockStats({ isDirectory: () => false }))
				.mockRejectedValueOnce(new Error('ENOENT'));

			const results = await Promise.all([
				FileUtils.directoryExists('/dir1'),
				FileUtils.directoryExists('/file1.txt'),
				FileUtils.directoryExists('/nonexistent'),
			]);

			expect(results).toEqual([true, false, false]);
		});

		it('should handle unexpected error types', async () => {
			mockAccess.mockRejectedValue('string error');

			const result = await FileUtils.fileIsReadable('/path');

			expect(result).toBe(false);
		});

		it('should handle null/undefined in error scenarios', async () => {
			mockStat.mockRejectedValue(null);

			const result = await FileUtils.directoryExists('/path');

			expect(result).toBe(false);
		});
	});
});
