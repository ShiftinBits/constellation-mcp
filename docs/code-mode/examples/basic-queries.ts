/**
 * Basic Code Mode Queries
 *
 * Simple examples to get started with Code Mode
 */

// ============================================
// 1. Simple Symbol Search
// ============================================

const symbols = await api.searchSymbols({
  query: "User",
  limit: 10
});

return symbols.symbols.map(s => s.name);

// ============================================
// 2. Find All Classes in a Directory
// ============================================

const classes = await api.searchSymbols({
  query: '',
  filterByKind: ['class'],
  filePattern: 'src/models/**',
  limit: 50
});

return {
  count: classes.symbols.length,
  classes: classes.symbols.map(c => ({
    name: c.name,
    file: c.filePath,
    exported: c.isExported
  }))
};

// ============================================
// 3. Get Symbol Details with Context
// ============================================

const search = await api.searchSymbols({
  query: "AuthService",
  limit: 1
});

if (search.symbols.length === 0) {
  return { error: "AuthService not found" };
}

const symbol = search.symbols[0];
const details = await api.getSymbolDetails({
  symbolName: symbol.name,
  filePath: symbol.filePath
});

return {
  name: details.symbol.name,
  type: details.symbol.kind,
  location: `${details.symbol.filePath}:${details.symbol.line}`,
  signature: details.symbol.signature,
  exported: details.symbol.isExported
};

// ============================================
// 4. List All Exported Functions
// ============================================

const functions = await api.searchSymbols({
  query: '',
  filterByKind: ['function'],
  filterByExported: true,
  limit: 100
});

// Group by file
const byFile: Record<string, string[]> = {};
for (const func of functions.symbols) {
  if (!byFile[func.filePath]) {
    byFile[func.filePath] = [];
  }
  byFile[func.filePath].push(func.name);
}

return {
  totalFunctions: functions.symbols.length,
  files: Object.keys(byFile).length,
  functionsByFile: byFile
};

// ============================================
// 5. Find Interfaces and Their Implementations
// ============================================

const interfaces = await api.searchSymbols({
  query: '',
  filterByKind: ['interface'],
  limit: 20
});

const implementations = await Promise.all(
  interfaces.symbols.map(async (iface) => {
    // Search for classes that might implement this interface
    const potentialImplementations = await api.searchSymbols({
      query: iface.name.replace('I', ''), // Remove 'I' prefix if present
      filterByKind: ['class'],
      limit: 10
    });

    return {
      interface: iface.name,
      file: iface.filePath,
      potentialImplementations: potentialImplementations.symbols.map(s => s.name)
    };
  })
);

return implementations.filter(i => i.potentialImplementations.length > 0);

// ============================================
// 6. Quick File Overview
// ============================================

const targetFile = "src/services/user.service.ts";

// Get all symbols in the file
const fileSymbols = await api.searchSymbols({
  query: '',
  filePattern: targetFile,
  limit: 100
});

// Group by type
const overview = {
  file: targetFile,
  classes: fileSymbols.symbols.filter(s => s.kind === 'class').map(s => s.name),
  functions: fileSymbols.symbols.filter(s => s.kind === 'function').map(s => s.name),
  interfaces: fileSymbols.symbols.filter(s => s.kind === 'interface').map(s => s.name),
  variables: fileSymbols.symbols.filter(s => s.kind === 'variable').map(s => s.name),
  totalSymbols: fileSymbols.symbols.length
};

return overview;

// ============================================
// 7. Search with Pagination
// ============================================

const pageSize = 20;
const allResults = [];

// Fetch first page
let page = 0;
let hasMore = true;

while (hasMore && page < 5) { // Max 5 pages
  const result = await api.searchSymbols({
    query: "handle",
    limit: pageSize,
    offset: page * pageSize
  });

  allResults.push(...result.symbols);

  hasMore = result.symbols.length === pageSize;
  page++;
}

return {
  totalFound: allResults.length,
  pages: page,
  symbols: allResults.map(s => ({
    name: s.name,
    type: s.kind,
    file: s.filePath
  }))
};

// ============================================
// 8. Find React Components
// ============================================

const components = await api.searchSymbols({
  query: '',
  filePattern: '**/*.tsx',
  filterByKind: ['function', 'class'],
  limit: 100
});

// Filter for likely React components (start with capital letter)
const reactComponents = components.symbols.filter(s =>
  /^[A-Z]/.test(s.name) && s.isExported
);

return {
  componentCount: reactComponents.length,
  components: reactComponents.map(c => ({
    name: c.name,
    file: c.filePath,
    type: c.kind
  }))
};