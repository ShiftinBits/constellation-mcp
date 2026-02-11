/**
 * Constellation OpenCode Plugin
 *
 * Provides hooks equivalent to constellation-claude:
 * - SessionStart → experimental.chat.system.transform
 * - PreCompact → experimental.session.compacting
 */
export const ConstellationPlugin = async () => {
	console.log('Constellation plugin initialized!');
	return {
		// ═══════════════════════════════════════════════════════════════
		// Hook: experimental.chat.system.transform
		// Equivalent to Claude Code's SessionStart hook
		// Injects Constellation priority instructions into system prompts
		// ═══════════════════════════════════════════════════════════════
		'experimental.chat.system.transform': async (input, output) => {
			// Matches Claude Code SessionStart hook text exactly
			const constellationPrimer = `You have Constellation access. \`code_intel\` is your PRIMARY tool for understanding this codebase—not an alternative, not a fallback, THE DEFAULT.

Mental model:
- "Where is X defined?" → code_intel
- "What uses X?" → code_intel
- "What would break?" → code_intel
- "Find the string 'ERROR_CODE_123'" → Grep

Grep is for literal text. Everything else starts with code_intel.`;
			output.system.push(constellationPrimer);
		},
		// ═══════════════════════════════════════════════════════════════
		// Hook: experimental.session.compacting
		// Equivalent to Claude Code's PreCompact hook
		// Preserves Constellation insights during context compaction
		// ═══════════════════════════════════════════════════════════════
		'experimental.session.compacting': async (input, output) => {
			// Matches Claude Code PreCompact hook text exactly
			const preservationInstructions = `Preserve: (1) The instruction that code_intel is the PRIMARY tool for code understanding—Grep is only for literal text, (2) Any architectural insights, dependency relationships, or impact analysis results discovered via Constellation.`;
			output.context.push(preservationInstructions);
		},
		'tool.execute.before': async (input, output) => {
			console.log(JSON.stringify(output, null, 2));
			// if (['grep', 'glob'].includes(input?.tool?.toLowerCase())) {
			// 	return;
			// }
		},
		config: async (input) => {
			input.mcp = input.mcp ?? {};
			input.mcp['constellation'] = {
				type: 'local',
				command: ['mcp-constellation'],
				environment: {
					CONSTELLATION_ACCESS_KEY: '{env:CONSTELLATION_ACCESS_KEY}',
				},
				enabled: true,
				timeout: 30000,
			};
		},
	};
};
export default ConstellationPlugin;
