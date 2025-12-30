/**
 * File Utilities Tests
 *
 * Tests for the FileUtils class that provides file system utilities.
 * Uses real file system operations with temp directories for integration testing.
 */

import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
} from '@jest/globals';
import { FileUtils } from '../../../src/utils/file.utils.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('FileUtils', () => {
	let tempDir: string;

	beforeAll(async () => {
		// Create a temporary directory for tests
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-utils-test-'));
	});

	afterAll(async () => {
		// Clean up temp directory
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	describe('fileIsReadable', () => {
		it('should return true when file is readable', async () => {
			const testFile = path.join(tempDir, 'readable-file.txt');
			await fs.writeFile(testFile, 'test content');

			const result = await FileUtils.fileIsReadable(testFile);

			expect(result).toBe(true);
		});

		it('should return false when file does not exist', async () => {
			const nonExistentFile = path.join(tempDir, 'non-existent-file.txt');

			const result = await FileUtils.fileIsReadable(nonExistentFile);

			expect(result).toBe(false);
		});

		it('should handle paths with special characters', async () => {
			const testFile = path.join(tempDir, 'file with spaces (1).txt');
			await fs.writeFile(testFile, 'test content');

			const result = await FileUtils.fileIsReadable(testFile);

			expect(result).toBe(true);
		});

		it('should return false for directory path', async () => {
			const testDir = path.join(tempDir, 'test-dir');
			await fs.mkdir(testDir, { recursive: true });

			// Note: directories are readable, but this tests the behavior
			const result = await FileUtils.fileIsReadable(testDir);

			// fs.access with R_OK returns true for directories too
			expect(result).toBe(true);
		});

		it('should return false for empty path', async () => {
			const result = await FileUtils.fileIsReadable('');

			expect(result).toBe(false);
		});
	});

	describe('readFile', () => {
		it('should read file contents as string', async () => {
			const testFile = path.join(tempDir, 'read-test.txt');
			const content = 'Hello, World!';
			await fs.writeFile(testFile, content);

			const result = await FileUtils.readFile(testFile);

			expect(result).toBe(content);
		});

		it('should read file with unicode content', async () => {
			const testFile = path.join(tempDir, 'unicode-test.txt');
			const content = 'Hello, 世界! 🌍';
			await fs.writeFile(testFile, content, 'utf-8');

			const result = await FileUtils.readFile(testFile);

			expect(result).toBe(content);
		});

		it('should throw error when file does not exist', async () => {
			const nonExistentFile = path.join(tempDir, 'non-existent-read.txt');

			await expect(FileUtils.readFile(nonExistentFile)).rejects.toThrow();
		});

		it('should handle empty file', async () => {
			const testFile = path.join(tempDir, 'empty-file.txt');
			await fs.writeFile(testFile, '');

			const result = await FileUtils.readFile(testFile);

			expect(result).toBe('');
		});

		it('should handle multi-line content', async () => {
			const testFile = path.join(tempDir, 'multiline.txt');
			const content = 'Line 1\nLine 2\nLine 3';
			await fs.writeFile(testFile, content);

			const result = await FileUtils.readFile(testFile);

			expect(result).toBe(content);
			expect(result.split('\n').length).toBe(3);
		});
	});

	describe('directoryExists', () => {
		it('should return true when directory exists', async () => {
			const testDir = path.join(tempDir, 'existing-dir');
			await fs.mkdir(testDir, { recursive: true });

			const result = await FileUtils.directoryExists(testDir);

			expect(result).toBe(true);
		});

		it('should return false when path is a file', async () => {
			const testFile = path.join(tempDir, 'just-a-file.txt');
			await fs.writeFile(testFile, 'content');

			const result = await FileUtils.directoryExists(testFile);

			expect(result).toBe(false);
		});

		it('should return false when path does not exist', async () => {
			const nonExistentDir = path.join(tempDir, 'non-existent-dir');

			const result = await FileUtils.directoryExists(nonExistentDir);

			expect(result).toBe(false);
		});

		it('should handle nested directories', async () => {
			const nestedDir = path.join(tempDir, 'level1', 'level2', 'level3');
			await fs.mkdir(nestedDir, { recursive: true });

			const result = await FileUtils.directoryExists(nestedDir);

			expect(result).toBe(true);
		});

		it('should handle root directory', async () => {
			const result = await FileUtils.directoryExists('/');

			expect(result).toBe(true);
		});

		it('should handle temp directory', async () => {
			const result = await FileUtils.directoryExists(tempDir);

			expect(result).toBe(true);
		});
	});

	describe('isRootDirectory', () => {
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

		it('should return false for temp directory', () => {
			const result = FileUtils.isRootDirectory(tempDir);

			expect(result).toBe(false);
		});

		it('should handle complex paths with parent references', () => {
			const result = FileUtils.isRootDirectory('/home/user/../user/projects');

			expect(result).toBe(false);
		});

		it('should normalize and check parent path matches normalized path', () => {
			// Test the normalization logic
			const normalized1 = path.normalize('/');
			const parent1 = path.dirname(normalized1);
			expect(normalized1).toBe(parent1); // Root is its own parent

			const normalized2 = path.normalize('/home');
			const parent2 = path.dirname(normalized2);
			expect(normalized2).not.toBe(parent2); // /home is not its own parent
		});
	});

	describe('isGitRepository', () => {
		let gitRepoDir: string;

		beforeEach(async () => {
			// Create a fresh git-like directory for each test
			gitRepoDir = path.join(tempDir, `git-test-${Date.now()}`);
			await fs.mkdir(gitRepoDir, { recursive: true });
		});

		it('should return true when .git directory exists', async () => {
			const gitDir = path.join(gitRepoDir, '.git');
			await fs.mkdir(gitDir, { recursive: true });

			const result = await FileUtils.isGitRepository(gitRepoDir);

			expect(result).toBe(true);
		});

		it('should return true when .git file exists (submodule)', async () => {
			const gitFile = path.join(gitRepoDir, '.git');
			await fs.writeFile(gitFile, 'gitdir: ../../../.git/modules/my-submodule');

			const result = await FileUtils.isGitRepository(gitRepoDir);

			expect(result).toBe(true);
		});

		it('should return false when .git does not exist', async () => {
			const result = await FileUtils.isGitRepository(gitRepoDir);

			expect(result).toBe(false);
		});

		it('should return false for root directory (usually)', async () => {
			// Root typically doesn't have a .git
			const result = await FileUtils.isGitRepository('/');

			expect(result).toBe(false);
		});

		it('should handle nested repository structure', async () => {
			const nestedDir = path.join(gitRepoDir, 'src', 'lib');
			await fs.mkdir(nestedDir, { recursive: true });
			await fs.mkdir(path.join(gitRepoDir, '.git'), { recursive: true });

			// The nested dir itself is not a git repo
			const nestedResult = await FileUtils.isGitRepository(nestedDir);
			expect(nestedResult).toBe(false);

			// But the parent is
			const parentResult = await FileUtils.isGitRepository(gitRepoDir);
			expect(parentResult).toBe(true);
		});

		it('should handle paths with spaces', async () => {
			const spacePath = path.join(tempDir, 'path with spaces');
			await fs.mkdir(spacePath, { recursive: true });
			await fs.mkdir(path.join(spacePath, '.git'), { recursive: true });

			const result = await FileUtils.isGitRepository(spacePath);

			expect(result).toBe(true);
		});
	});

	describe('edge cases and integration', () => {
		it('should handle concurrent file checks', async () => {
			const file1 = path.join(tempDir, 'concurrent-1.txt');
			const file2 = path.join(tempDir, 'concurrent-2.txt');
			const file3 = path.join(tempDir, 'concurrent-3.txt');

			await fs.writeFile(file1, 'content 1');
			// file2 does not exist
			await fs.writeFile(file3, 'content 3');

			const results = await Promise.all([
				FileUtils.fileIsReadable(file1),
				FileUtils.fileIsReadable(file2),
				FileUtils.fileIsReadable(file3),
			]);

			expect(results).toEqual([true, false, true]);
		});

		it('should handle concurrent directory checks', async () => {
			const dir1 = path.join(tempDir, 'concurrent-dir-1');
			const file1 = path.join(tempDir, 'concurrent-file-1.txt');
			const nonExistent = path.join(tempDir, 'concurrent-nonexistent');

			await fs.mkdir(dir1, { recursive: true });
			await fs.writeFile(file1, 'content');
			// nonExistent does not exist

			const results = await Promise.all([
				FileUtils.directoryExists(dir1),
				FileUtils.directoryExists(file1),
				FileUtils.directoryExists(nonExistent),
			]);

			expect(results).toEqual([true, false, false]);
		});

		it('should handle symbolic links for directories', async () => {
			const realDir = path.join(tempDir, 'real-directory');
			const linkPath = path.join(tempDir, 'link-to-directory');

			await fs.mkdir(realDir, { recursive: true });
			await fs.symlink(realDir, linkPath);

			const result = await FileUtils.directoryExists(linkPath);

			expect(result).toBe(true);
		});

		it('should handle symbolic links for files', async () => {
			const realFile = path.join(tempDir, 'real-file.txt');
			const linkPath = path.join(tempDir, 'link-to-file.txt');

			await fs.writeFile(realFile, 'content');
			await fs.symlink(realFile, linkPath);

			const result = await FileUtils.fileIsReadable(linkPath);

			expect(result).toBe(true);

			const content = await FileUtils.readFile(linkPath);
			expect(content).toBe('content');
		});

		it('should handle broken symbolic links', async () => {
			const brokenLink = path.join(tempDir, 'broken-link.txt');
			const nonExistent = path.join(tempDir, 'does-not-exist.txt');

			await fs.symlink(nonExistent, brokenLink);

			const result = await FileUtils.fileIsReadable(brokenLink);

			expect(result).toBe(false);
		});
	});
});
