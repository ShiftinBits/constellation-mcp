/**
 * Worker path resolution (SB-258 Step 3.1)
 *
 * Isolated module for resolving the sandbox-worker.js path using import.meta.url.
 * Separated from isolated-sandbox.ts to allow mocking in Jest tests
 * (ts-jest CJS mode doesn't support import.meta).
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORKER_PATH = path.join(__dirname, 'sandbox-worker.js');
