/**
 * Git utilities for auto-detecting project information
 * Simplified version adapted from CLI for MCP server use
 */

import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';

/**
 * Git repository information
 */
export interface GitInfo {
	/** Whether we're in a git repository */
	isRepo: boolean;
	/** Current branch name (null if detached or not in repo) */
	branch: string | null;
	/** Remote origin URL (null if no origin or not in repo) */
	remoteUrl: string | null;
	/** Project ID derived from remote URL (null if no remote) */
	projectId: string | null;
	/** Repository root directory (null if not in repo) */
	rootDir: string | null;
}

/**
 * Normalize a git remote URL to create a consistent project identifier.
 * Handles both HTTPS and SSH formats.
 *
 * @param remoteUrl Git remote URL
 * @returns Normalized project ID (e.g., "github.com/user/repo")
 *
 * @example
 * normalizeGitUrl("https://github.com/user/repo.git") // "github.com/user/repo"
 * normalizeGitUrl("git@github.com:user/repo.git")     // "github.com/user/repo"
 */
export function normalizeGitUrl(remoteUrl: string): string {
	let normalized = remoteUrl;

	// Remove .git suffix if present
	if (normalized.endsWith('.git')) {
		normalized = normalized.slice(0, -4);
	}

	// Handle SSH format: git@github.com:user/repo
	if (normalized.startsWith('git@')) {
		normalized = normalized
			.replace('git@', '')
			.replace(':', '/');
	}

	// Handle HTTPS format: https://github.com/user/repo
	if (normalized.startsWith('https://')) {
		normalized = normalized.replace('https://', '');
	} else if (normalized.startsWith('http://')) {
		normalized = normalized.replace('http://', '');
	}

	// Handle GitHub token URLs: https://x-access-token:TOKEN@github.com/user/repo
	if (normalized.includes('@')) {
		const parts = normalized.split('@');
		if (parts.length === 2) {
			normalized = parts[1]; // Take the part after @
		}
	}

	return normalized;
}

/**
 * Get git repository information for the current working directory.
 *
 * @param workingDir Working directory to check (defaults to process.cwd())
 * @returns Git repository information
 */
export async function getGitInfo(
	workingDir: string = process.cwd()
): Promise<GitInfo> {
	const options: Partial<SimpleGitOptions> = {
		baseDir: workingDir,
		maxConcurrentProcesses: 6,
	};

	const git: SimpleGit = simpleGit(options);

	try {
		// Check if we're in a git repository
		const isRepo = await git.checkIsRepo();

		if (!isRepo) {
			return {
				isRepo: false,
				branch: null,
				remoteUrl: null,
				projectId: null,
				rootDir: null,
			};
		}

		// Get repository root directory
		let rootDir: string | null = null;
		try {
			rootDir = (await git.revparse(['--show-toplevel'])).trim();
		} catch {
			// Ignore errors
		}

		// Get current branch
		let branch: string | null = null;
		try {
			const status = await git.status();
			branch = status.current;
		} catch {
			// Ignore errors
		}

		// Get remote origin URL
		let remoteUrl: string | null = null;
		let projectId: string | null = null;

		try {
			const remotes = await git.getRemotes(true);
			const origin = remotes.find((r) => r.name === 'origin');

			if (origin?.refs.fetch) {
				remoteUrl = origin.refs.fetch;
				projectId = normalizeGitUrl(remoteUrl);
			}
		} catch {
			// Ignore errors
		}

		return {
			isRepo: true,
			branch,
			remoteUrl,
			projectId,
			rootDir,
		};
	} catch (error) {
		// If anything fails, return null values
		return {
			isRepo: false,
			branch: null,
			remoteUrl: null,
			projectId: null,
			rootDir: null,
		};
	}
}

/**
 * Check if git is available on the system.
 *
 * @returns True if git is available, false otherwise
 */
export async function isGitAvailable(): Promise<boolean> {
	const git = simpleGit();
	try {
		await git.version();
		return true;
	} catch {
		return false;
	}
}
