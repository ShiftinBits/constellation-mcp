import { promises as fs } from 'fs';
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
}
