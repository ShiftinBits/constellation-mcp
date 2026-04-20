#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../dist/index.js');
const shebang = '#!/usr/bin/env node';

try {
	// Check if the file exists
	if (!fs.existsSync(filePath)) {
		console.error(`File not found: ${filePath}`);
		process.exit(1);
	}

	// Read the file content
	const content = fs.readFileSync(filePath, 'utf8');

	// Check if the file already starts with the shebang
	if (content.startsWith(shebang)) {
		console.log('Shebang already present in dist/index.js');
		process.exit(0);
	}

	// Add the shebang to the beginning of the file
	const newContent = shebang + '\n' + content;

	// Write the updated content back to the file
	fs.writeFileSync(filePath, newContent, 'utf8');

	// Make the file executable
	fs.chmodSync(filePath, 0o755);

	console.log(
		'✓ Successfully added shebang to dist/index.js and made it executable',
	);

	// Copy type definitions to dist for MCP Resource access (LLMs read this)
	const distTypesDir = path.join(__dirname, '../dist/types');

	// Ensure dist/types directory exists
	if (!fs.existsSync(distTypesDir)) {
		fs.mkdirSync(distTypesDir, { recursive: true });
	}

	// Copy MCP-specific type definitions for LLM consumption
	// Uses mcp-api.d.ts which excludes CLI-to-Core indexing types (SerializedAST, etc.)
	// that LLMs don't need and would waste tokens
	const sharedTypesPath = path.join(
		__dirname,
		'../node_modules/@constellationdev/types/dist/mcp-api.d.ts',
	);
	const distTypesPath = path.join(distTypesDir, 'api-types.d.ts');

	if (fs.existsSync(sharedTypesPath)) {
		// Add header comment explaining the source
		const typesContent = fs.readFileSync(sharedTypesPath, 'utf8');
		const headerComment = `/**
 * Constellation API Type Definitions
 *
 * Auto-copied from @constellationdev/types during build.
 * This file is served to AI assistants via constellation://types/api resource.
 *
 * DO NOT EDIT - changes will be overwritten on build.
 * Edit the source at: constellation-types/src/
 *
 * @packageDocumentation
 */

`;
		fs.writeFileSync(distTypesPath, headerComment + typesContent, 'utf8');
		console.log(
			'✓ Successfully copied @constellationdev/types definitions to dist/types/api-types.d.ts',
		);
	} else {
		// Fallback: copy source file if shared types not found
		const srcTypesPath = path.join(__dirname, '../src/types/api-types.d.ts');
		fs.copyFileSync(srcTypesPath, distTypesPath);
		console.warn(
			'⚠ @constellationdev/types not found, copied source api-types.d.ts instead',
		);
	}
} catch (error) {
	console.error('Error in postbuild:', error.message);
	process.exit(1);
}
