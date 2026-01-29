/**
 * Benchmark script for Constellation Code Mode API queries.
 *
 * Measures latency of all 10 API methods via ConstellationClient.
 * Requires a running constellation-core instance and indexed project.
 *
 * Usage: npx tsx scripts/benchmark-queries.ts
 */

import { performance } from 'perf_hooks';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ConstellationClient } from '../src/client/constellation-client.js';
import { ConstellationConfig } from '../src/config/config.ts';

// --- Configuration ---

const CONFIG_PATH = resolve(process.cwd(), 'constellation.json');
const ACCESS_KEY = process.env.CONSTELLATION_ACCESS_KEY;

if (!ACCESS_KEY) {
	console.error(
		'Error: CONSTELLATION_ACCESS_KEY environment variable is required.',
	);
	process.exit(1);
}

let configData: { apiUrl: string; branch: string; projectId: string };
try {
	configData = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
} catch {
	console.error(`Error: Could not read ${CONFIG_PATH}`);
	process.exit(1);
}

const config = ConstellationConfig.fromJSON(configData);
const client = new ConstellationClient(config, ACCESS_KEY);
const projectContext = {
	projectId: configData.projectId,
	branchName: configData.branch,
};

// --- Benchmark Helpers ---

interface BenchmarkResult {
	method: string;
	durationMs: number;
	success: boolean;
	error?: string;
}

async function measureCall<T>(
	method: string,
	fn: () => Promise<T>,
): Promise<BenchmarkResult> {
	const start = performance.now();
	try {
		await fn();
		return {
			method,
			durationMs: Math.round((performance.now() - start) * 100) / 100,
			success: true,
		};
	} catch (error) {
		return {
			method,
			durationMs: Math.round((performance.now() - start) * 100) / 100,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function runTool(toolName: string, params: Record<string, unknown> = {}) {
	return client.executeMcpTool(toolName, params, projectContext);
}

// --- Run Benchmarks ---

async function main() {
	console.log('Constellation Code Mode — Query Benchmark');
	console.log('='.repeat(60));
	console.log(`API URL: ${config.apiUrl}`);
	console.log(`Project: ${configData.projectId}`);
	console.log(`Branch:  ${configData.branch}`);
	console.log('');

	// 1. ping — warm up connection
	const pingResult = await measureCall('ping', () => runTool('ping'));
	if (!pingResult.success) {
		console.error(`ping failed: ${pingResult.error}`);
		console.error(
			'Ensure constellation-core is running on the configured URL.',
		);
		process.exit(1);
	}

	// 2. searchSymbols — get a symbol for subsequent queries
	const searchResult = await measureCall('searchSymbols', () =>
		runTool('search_symbols', { query: 'Service', limit: 5 }),
	);

	// Extract symbolId and filePath from search for chained queries
	let symbolId: string | undefined;
	let filePath: string | undefined;
	try {
		const searchResponse = await runTool('search_symbols', {
			query: 'Service',
			limit: 5,
		});
		const symbols = searchResponse?.data?.symbols;
		if (symbols?.length > 0) {
			symbolId = symbols[0].id;
			filePath = symbols[0].filePath;
		}
	} catch {
		// Will be handled below
	}

	if (!symbolId || !filePath) {
		console.warn(
			'Warning: No symbols found. Chained queries will use placeholder values.',
		);
		symbolId = 'unknown';
		filePath = 'unknown';
	}

	// 3-10. Run remaining queries
	const results: BenchmarkResult[] = [pingResult, searchResult];

	results.push(
		await measureCall('getSymbolDetails', () =>
			runTool('get_symbol_details', { symbolId }),
		),
	);

	results.push(
		await measureCall('getDependencies', () =>
			runTool('get_dependencies', { filePath }),
		),
	);

	results.push(
		await measureCall('getDependents', () =>
			runTool('get_dependents', { filePath }),
		),
	);

	results.push(
		await measureCall('impactAnalysis', () =>
			runTool('impact_analysis', { symbolId }),
		),
	);

	results.push(
		await measureCall('getCallGraph', () =>
			runTool('get_call_graph', { symbolId }),
		),
	);

	results.push(
		await measureCall('traceSymbolUsage', () =>
			runTool('trace_symbol_usage', { symbolId }),
		),
	);

	results.push(
		await measureCall('findOrphanedCode', () =>
			runTool('find_orphaned_code', { limit: 10 }),
		),
	);

	results.push(
		await measureCall('getArchitectureOverview', () =>
			runTool('get_architecture_overview', {}),
		),
	);

	// --- Print Results ---

	console.log('Results:');
	console.log('-'.repeat(60));
	console.log(
		`${'Method'.padEnd(30)} ${'Time (ms)'.padStart(10)} ${'Status'.padStart(8)}`,
	);
	console.log('-'.repeat(60));

	for (const r of results) {
		const status = r.success ? 'OK' : 'FAIL';
		console.log(
			`${r.method.padEnd(30)} ${r.durationMs.toFixed(2).padStart(10)} ${status.padStart(8)}`,
		);
		if (!r.success && r.error) {
			console.log(`  └─ ${r.error.substring(0, 80)}`);
		}
	}

	// --- Summary Statistics ---

	const successful = results.filter((r) => r.success);
	const durations = successful.map((r) => r.durationMs).sort((a, b) => a - b);

	if (durations.length > 0) {
		const p50 = durations[Math.floor(durations.length * 0.5)];
		const p95 = durations[Math.floor(durations.length * 0.95)];
		const max = durations[durations.length - 1];
		const avg =
			Math.round(
				(durations.reduce((a, b) => a + b, 0) / durations.length) * 100,
			) / 100;

		console.log('');
		console.log('Summary:');
		console.log('-'.repeat(60));
		console.log(
			`  Queries: ${results.length} total, ${successful.length} OK, ${results.length - successful.length} failed`,
		);
		console.log(`  Avg:     ${avg.toFixed(2)} ms`);
		console.log(`  P50:     ${p50.toFixed(2)} ms`);
		console.log(`  P95:     ${p95.toFixed(2)} ms`);
		console.log(`  Max:     ${max.toFixed(2)} ms`);
	}
}

main().catch((err) => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
