/**
 * Mock for mcp-framework module
 * Provides minimal mock implementation for testing
 */

class MCPTool {
	constructor() {
		this.name = '';
		this.description = '';
		this.schema = {};
	}

	async execute(params) {
		return 'Mock result';
	}
}

class MCPServer {
	constructor() {
		this.tools = [];
	}

	addTool(tool) {
		this.tools.push(tool);
	}

	async start() {
		// Mock start
	}
}

module.exports = {
	MCPTool,
	MCPServer,
};
