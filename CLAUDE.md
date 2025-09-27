# Constellation Project - AI Assistant Guide

## Project Overview

Constellation creates a single, shared "code intelligence graph" for entire development teams. Instead of each AI assistant parsing code individually, Constellation parses code once when it changes, extracts the intelligence centrally, and provides all AI assistants with instant access to this shared knowledge.

**Core Value Proposition**: Parse once, benefit everywhere. No more waiting for indexing, no inconsistent understanding across team members, no privacy concerns from uploading source code.

## Architecture Overview

### Three-Component System

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Tool      │───▶│  Central Service │◀───│   MCP Server    │
│ (@constellation │    │   (NestJS +      │    │(@constellation/ │
│     /cli)       │    │ Neo4j + Redis)   │    │  mcp-server)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
      │                         │                        │
      │                         │                        │
   Local/CI                  Team-wide                Local Dev
   Parsing                   Knowledge                Environment
                              Store
```

#### 1. CLI Tool (`@constellation/cli`)

Source: `cli/`

- **Purpose**: Parse source code and generate ASTs
- **Technology**: Oclif framework + Tree-sitter parsers
- **Location**: Runs locally or in CI/CD pipelines
- **Security**: Source code never leaves local environment
- **Output**: Serialized and compressed AST structure (no source code)

#### 2. Central Service

Source: `core/`

- **Purpose**: Extract intelligence from ASTs and serve code intelligence graph
- **Technology**: NestJS + Neo4j + Redis
- **Deployment**: One instance per team/organization
- **Processing**: Receives ASTs, extracts symbols and relationships server-side
- **Data**: Only AST metadata and extracted intelligence, never source code
- **Performance**: Redis caching for millisecond response times

#### 3. MCP Server (`@constellation/mcp-server`)

- **Purpose**: Bridge AI assistants to central service
- **Technology**: Model Context Protocol implementation
- **Location**: Runs on each developer's machine
- **Function**: Translates AI queries to REST API calls

## Core Technical Decisions & Rationale

### Privacy-First Architecture

- **Rule**: Source code NEVER leaves local environment
- **Implementation**: Tree-sitter parsing happens client-side
- **Transmission**: Only serialized AST structure sent to service (compressed)
- **Intelligence Extraction**: Happens server-side from received ASTs
- **Verification**: All API endpoints reject any source code content

### Project Identification

- **Method**: Normalized git remote URL (automatic, deterministic)
- **Benefits**: No manual configuration, consistent across team
- **Branch Isolation**: Each branch maintains separate namespace
- **Commit Tracking**: Metadata only, one graph per branch

### The Intelligence Transformation

```
CLI-SIDE:                                  SERVER-SIDE:
Raw Source Code → Tree-sitter AST → [Network] → Extracted Intelligence → Neo4j Graph
    (Private)         (Syntax)                     (Semantics)         (Queryable)
```

The CLI handles parsing (syntax), the server handles intelligence extraction (semantics).

### Technology Stack Rationale

**Tree-sitter**: Industry-standard, multi-language parsing with error recovery
**Oclif**: Enterprise CLI framework (Heroku/Salesforce proven)
**NestJS**: Modular, scalable Node.js framework with DI
**Neo4j**: Graph database optimized for relationship queries
**Redis**: Sub-millisecond caching for frequent queries

## Development Guidelines for AI Assistants

### Security & Privacy Constraints

1. **NEVER** transmit source code to central service
2. **ALWAYS** parse locally using Tree-sitter
3. **SERIALIZE** ASTs without including source code text
4. **COMPRESS** AST payloads using gzip before transmission
5. **VALIDATE** all API inputs reject source code
6. **ENCRYPT** all communications with central service

### Code Organization Principles

1. **Shared Dependencies**: Common utilities in shared packages
2. **Type Safety**: Full TypeScript across all components
3. **API Consistency**: RESTful design with OpenAPI specs

### Performance Requirements

1. **CLI Parsing**: Must handle 1000+ files in seconds
2. **API Response**: Sub-100ms for cached queries
3. **Memory Usage**: Efficient AST processing
4. **Scalability**: Horizontal scaling for central service

## Project Structure

```
constellation/
├── cli/                       # @constellation/cli - Oclif CLI utility
│   ├── src/
│   │   ├── commands/          # CLI command implementations
│   │   ├── parsers/           # Tree-sitter integration
│   │   ├── extractors/        # Intelligence extraction
│   │   └── api/              # Service communication
│   ├── test/
│   └── package.json
├── core/                   # Central NestJS API service
│   ├── src/
│   │   ├── modules/          # Feature modules
│   │   ├── entities/         # Neo4j entities
│   │   ├── controllers/      # REST API endpoints
│   │   └── services/         # Business logic
│   ├── test/
│   └── package.json
├── mcp-server/               # @constellation/mcp-server (future)
│   ├── src/
│   │   ├── handlers/         # MCP request handlers
│   │   ├── queries/          # Query translations
│   │   └── cache/            # Local caching
│   └── test/
├── prompts/                  # Project documentation & specs
│   ├── spec.md               # Project specification
│   ├── api.md                # API documentation
│   └── project.md            # MVP scope
├── docs/                     # Technical documentation (future)
├── scripts/                  # Build and deployment scripts (future)
├── UML/                      # System diagrams
└── CLAUDE.md                 # This guide for AI assistants
```

### Key Files to Understand

- `cli/src/commands/` - CLI command implementations
- `core/src/` - NestJS service modules and API
- `prompts/spec.md` - Core project specification
- `prompts/api.md` - API design and endpoints

## API Design Principles

### Dual-Purpose Architecture

All APIs must serve both:

1. **CLI Integration**: Direct programmatic access
2. **MCP Server**: Query translation layer

### RESTful Design

```
GET    /projects/{id}/symbols           # List symbols
GET    /projects/{id}/symbols/{symbol}  # Symbol details
POST   /projects/{id}/intelligence      # Upload parsed data
GET    /projects/{id}/relationships     # Query relationships
```

### Response Format

```typescript
interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	metadata: {
		timestamp: string;
		version: string;
		cached: boolean;
	};
}
```

## Testing & Quality Requirements

### Test Coverage Targets

- **Unit Tests**: 90%+ coverage for core logic
- **Integration Tests**: All API endpoints
- **E2E Tests**: Complete CLI workflows
- **Performance Tests**: Parsing benchmarks

### Quality Gates

1. **TypeScript**: Strict mode, no `any` types
2. **Linting**: ESLint + Prettier configuration
3. **Security**: Automated vulnerability scanning
4. **Documentation**: JSDoc for all public APIs

### Testing Strategy

```typescript
// Example test structure
describe("AST Generation", () => {
	it("should generate valid AST from TypeScript", async () => {
		const ast = await parseFile("sample.ts");
		const serialized = serializeAST(ast);
		expect(serialized.type).toBe("program");
		expect(serialized.children).toBeDefined();
	});
});

// Server-side test
describe("Intelligence Extraction", () => {
	it("should extract function definitions from AST", async () => {
		const serializedAST = getTestAST();
		const intelligence = extractIntelligence(serializedAST);
		expect(intelligence.functions).toHaveLength(3);
	});
});
```

## Common Development Tasks

### Adding Language Support

1. **CLI Side**:

   - Install Tree-sitter grammar: `npm install tree-sitter-{language}`
   - Create parser in `cli/src/parsers/{language}.ts`
   - Update AST serializer to handle language-specific nodes

2. **Server Side**:
   - Add extraction logic in `core/src/extractors/{language}.ts`
   - Update type definitions for language-specific symbols
   - Add tests for new language extraction

### Extending API Functionality

1. Define schema for new endpoints
2. Implement service logic in `core/src/modules/`
3. Add REST endpoint in appropriate controller
4. Update MCP server query handlers (when implemented)
5. Add integration tests

### Performance Optimization

1. **CLI**: Optimize Tree-sitter parsing with worker threads
2. **Service**: Add Redis caching for frequent queries
3. **Database**: Create Neo4j indexes for common relationships
4. **MCP**: Implement local caching for repeated queries

### Security Hardening

1. **Input Validation**: Sanitize all API inputs
2. **Authentication**: API key management
3. **Rate Limiting**: Prevent abuse
4. **Audit Logging**: Track all data operations

## Error Handling & Logging

### Error Categories

```typescript
enum ErrorType {
	PARSING_ERROR = "PARSING_ERROR",
	NETWORK_ERROR = "NETWORK_ERROR",
	VALIDATION_ERROR = "VALIDATION_ERROR",
	PERMISSION_ERROR = "PERMISSION_ERROR",
}
```

### Logging Strategy

- **CLI**: Local file logging with rotation
- **Service**: Structured JSON logging (ELK stack compatible)
- **MCP**: Debug logs for troubleshooting

## MVP Scope & Development Priorities

### Phase 1: Core Functionality

- [ ] CLI parsing with Tree-sitter and AST serialization
- [ ] AST compression and transmission
- [ ] Server-side intelligence extraction
- [ ] Basic Neo4j graph storage
- [ ] Simple MCP integration
- [ ] REST API for AST upload and queries

### Phase 2: Production Readiness

- [ ] Performance optimization
- [ ] Error recovery and retry logic
- [ ] Comprehensive test coverage
- [ ] Security hardening
- [ ] Documentation completion

## Development Workflow

## Architecture Decision Records (ADRs)

### ADR-001: No Source Code Transmission

**Decision**: Parse code locally, transmit only AST structure
**Rationale**: Privacy, security, compliance requirements
**Implications**: Larger network payloads (mitigated by compression), simpler CLI

### ADR-004: Server-Side Intelligence Extraction

**Decision**: Extract symbols and relationships on the server, not in CLI
**Rationale**: Centralized logic, easier updates, consistency across clients
**Implications**: Server processing load, but better scalability and maintainability

### ADR-002: Neo4j for Graph Storage

**Decision**: Use Neo4j as primary database
**Rationale**: Optimized for relationship queries
**Implications**: Graph query complexity, operational overhead

### ADR-003: Branch-Based Namespacing

**Decision**: Separate graph per branch
**Rationale**: Feature branch isolation
**Implications**: Storage multiplication, cleanup requirements

## Troubleshooting Guide

### Common Issues

1. **Parse Failures**: Check Tree-sitter grammar compatibility
2. **API Timeouts**: Verify Redis cache status
3. **Graph Queries**: Optimize Neo4j indexes
4. **MCP Disconnects**: Check network connectivity

### Debug Commands

```bash
# CLI debugging
constellation index

# Service health check
curl http://localhost:3000/health

# Neo4j query debugging
MATCH (n) RETURN count(n) as total_nodes
```

## Contributing Guidelines

### Code Style

- Follow existing TypeScript conventions
- Use meaningful variable and function names
- Document public APIs with JSDoc
- Keep functions small and focused

### Security Review

All changes involving:

- Data transmission
- API endpoints
- Authentication
- File system access

Require security review before merge.

### Key Concepts

- **Intelligence**: Extracted AST metadata (symbols, relationships)
- **Graph**: Neo4j representation of code structure
- **Project**: Git repository identified by remote URL
- **Branch**: Isolated namespace for code intelligence

This guide serves as the primary reference for AI assistants working on Constellation. When in doubt, prioritize privacy, performance, and the core principle: parse once, benefit everywhere.
