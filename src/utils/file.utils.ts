import { promises as fs, type Dirent } from 'fs';
import path from 'path';

/**
 * File system utilities for the MCP server.
 */
export class FileUtils {
	/**
	 * Checks if a file exists and is readable.
	 * @param filePath Path to the file to check
	 * @returns True if file exists and is readable, false otherwise
	 */
	static async fileIsReadable(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath, fs.constants.R_OK);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Reads the contents of a file as a string.
	 * @param filePath Path to the file to read
	 * @returns File contents as a string
	 * @throws Error if file cannot be read
	 */
	static async readFile(filePath: string): Promise<string> {
		return fs.readFile(filePath, 'utf-8');
	}

	/**
	 * Checks if a directory exists.
	 * @param dirPath Path to the directory to check
	 * @returns True if directory exists, false otherwise
	 */
	static async directoryExists(dirPath: string): Promise<boolean> {
		try {
			const stats = await fs.stat(dirPath);
			return stats.isDirectory();
		} catch {
			return false;
		}
	}

	/**
	 * Checks if a path is the root directory.
	 * @param dirPath Path to check
	 * @returns True if path is root directory
	 */
	static isRootDirectory(dirPath: string): boolean {
		const normalized = path.normalize(dirPath);
		const parent = path.dirname(normalized);
		return normalized === parent;
	}

	/**
	 * Checks if a directory is a git repository root.
	 * Handles both regular repositories (.git directory) and submodules (.git file).
	 * @param dirPath Path to the directory to check
	 * @returns True if directory contains a .git folder or file
	 */
	static async isGitRepository(dirPath: string): Promise<boolean> {
		const gitPath = path.join(dirPath, '.git');
		try {
			await fs.stat(gitPath);
			// .git exists (either as directory or file for submodules)
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Breadth-first scan for `constellation.json` files under `startDir`.
	 *
	 * Used to suggest candidate project roots when the supplied `cwd`
	 * resolves to a git root that itself has no `constellation.json`
	 * (e.g. a multi-project workspace root).
	 *
	 * Skips noisy directories (`node_modules`, `.git`, `dist`, `build`,
	 * `out`, `coverage`, and any dotfile-prefixed directory) and caps the
	 * total number of directories scanned to avoid pathological monorepos.
	 *
	 * @param startDir Root directory to begin the scan
	 * @param maxDepth Maximum directory levels to descend (default 3)
	 * @param maxDirs  Maximum directories visited before stopping (default 200)
	 * @returns Absolute paths to discovered `constellation.json` files
	 */
	static async findConstellationJsonCandidates(
		startDir: string,
		maxDepth: number = 3,
		maxDirs: number = 200,
	): Promise<string[]> {
		const skipDirs = new Set([
			'node_modules',
			'.git',
			'dist',
			'build',
			'out',
			'coverage',
		]);
		const candidates: string[] = [];
		const queue: Array<{ dir: string; depth: number }> = [
			{ dir: path.resolve(startDir), depth: 0 },
		];
		let visited = 0;

		while (queue.length > 0 && visited < maxDirs) {
			const { dir, depth } = queue.shift()!;
			visited++;

			const configPath = path.join(dir, 'constellation.json');
			if (await FileUtils.fileIsReadable(configPath)) {
				candidates.push(configPath);
			}

			if (depth >= maxDepth) {
				continue;
			}

			let entries: Dirent[];
			try {
				entries = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
			} catch {
				continue;
			}

			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				if (entry.name.startsWith('.')) continue;
				if (skipDirs.has(entry.name)) continue;
				queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
			}
		}

		return candidates;
	}
}
