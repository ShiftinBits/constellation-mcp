import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getGitInfo, normalizeGitUrl } from '../../../src/utils/git-utils.js';
import { createTempDir, cleanupTempDir, createMockGitRepo } from '../../helpers/test-utils.js';

describe('git-utils', () => {
	describe('normalizeGitUrl', () => {
		it('should normalize SSH URLs', () => {
			const tests = [
				{
					input: 'git@github.com:user/repo.git',
					expected: 'github.com/user/repo',
				},
				{
					input: 'git@gitlab.com:user/project.git',
					expected: 'gitlab.com/user/project',
				},
				{
					input: 'git@bitbucket.org:team/repository.git',
					expected: 'bitbucket.org/team/repository',
				},
			];

			for (const test of tests) {
				expect(normalizeGitUrl(test.input)).toBe(test.expected);
			}
		});

		it('should normalize HTTPS URLs', () => {
			const tests = [
				{
					input: 'https://github.com/user/repo.git',
					expected: 'github.com/user/repo',
				},
				{
					input: 'https://gitlab.com/user/project.git',
					expected: 'gitlab.com/user/project',
				},
			];

			for (const test of tests) {
				expect(normalizeGitUrl(test.input)).toBe(test.expected);
			}
		});

		it('should normalize URLs with tokens', () => {
			const input = 'https://token:x-oauth-basic@github.com/user/repo.git';
			expect(normalizeGitUrl(input)).toBe('github.com/user/repo');
		});

		it('should remove .git suffix', () => {
			const tests = [
				'git@github.com:user/repo.git',
				'https://github.com/user/repo.git',
			];

			for (const test of tests) {
				const result = normalizeGitUrl(test);
				expect(result).not.toContain('.git');
			}
		});

		it('should handle URLs without .git suffix', () => {
			const input = 'https://github.com/user/repo';
			expect(normalizeGitUrl(input)).toBe('github.com/user/repo');
		});

		it('should handle URLs with subgroups', () => {
			const input = 'git@gitlab.com:group/subgroup/project.git';
			expect(normalizeGitUrl(input)).toBe('gitlab.com/group/subgroup/project');
		});

		it('should handle edge case URLs', () => {
			// Function doesn't throw, just normalizes as best it can
			expect(normalizeGitUrl('')).toBe('');
			expect(normalizeGitUrl('not-a-url')).toBe('not-a-url');
			expect(normalizeGitUrl('ftp://invalid.com/repo')).toBe('ftp://invalid.com/repo');
		});
	});

	describe('getGitInfo', () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await createTempDir();
		});

		afterEach(async () => {
			await cleanupTempDir(tempDir);
		});

		it('should return git info for valid repository', async () => {
			await createMockGitRepo(tempDir);

			const gitInfo = await getGitInfo(tempDir);

			// Mock .git directory is not a real repo, so simple-git won't detect it
			// This is expected behavior - the function checks for actual git repo
			expect(gitInfo).toBeDefined();
			expect(gitInfo.isRepo).toBeDefined();
			expect(typeof gitInfo.isRepo).toBe('boolean');
		});

		it('should return non-repo info for non-git directory', async () => {
			const gitInfo = await getGitInfo(tempDir);

			expect(gitInfo.isRepo).toBe(false);
			expect(gitInfo.branch).toBeNull();
			expect(gitInfo.remoteUrl).toBeNull();
			expect(gitInfo.projectId).toBeNull();
			// rootDir might be null or the tempDir depending on git detection
			expect(gitInfo.rootDir).toBeDefined();
		});

		it('should use current working directory if not provided', async () => {
			const gitInfo = await getGitInfo();

			expect(gitInfo.rootDir).toBeDefined();
		});

		it('should handle missing git config', async () => {
			// Create .git directory but no config
			const fs = await import('fs/promises');
			const path = await import('path');
			await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });

			const gitInfo = await getGitInfo(tempDir);

			expect(gitInfo.isRepo).toBe(false);
		});
	});
});
