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

	// Copy api-types.d.ts to dist for MCP Resource access
	const srcTypesPath = path.join(__dirname, '../src/types/api-types.d.ts');
	const distTypesDir = path.join(__dirname, '../dist/types');
	const distTypesPath = path.join(distTypesDir, 'api-types.d.ts');

	// Ensure dist/types directory exists
	if (!fs.existsSync(distTypesDir)) {
		fs.mkdirSync(distTypesDir, { recursive: true });
	}

	// Copy the TypeScript declaration file
	fs.copyFileSync(srcTypesPath, distTypesPath);
	console.log('✓ Successfully copied api-types.d.ts to dist/types/');
} catch (error) {
	console.error('Error in postbuild:', error.message);
	process.exit(1);
}
