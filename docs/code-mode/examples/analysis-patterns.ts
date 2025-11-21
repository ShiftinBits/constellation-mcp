/**
 * Code Mode Analysis Patterns
 *
 * Advanced analysis patterns for codebase intelligence
 */

// ============================================
// 1. Dead Code Detection
// ============================================

async function findDeadCode() {
  // Find all exported symbols
  const exported = await api.searchSymbols({
    query: '',
    filterByExported: true,
    limit: 200
  });

  // Check usage for each in parallel
  const usageChecks = await Promise.all(
    exported.symbols.map(async (symbol) => {
      const usage = await api.traceSymbolUsage({
        symbolName: symbol.name,
        filePath: symbol.filePath
      });
      return {
        symbol: symbol.name,
        file: symbol.filePath,
        type: symbol.kind,
        usageCount: usage.totalUsages,
        isUnused: usage.totalUsages === 0
      };
    })
  );

  // Separate by usage
  const unused = usageChecks.filter(s => s.isUnused);
  const lowUsage = usageChecks.filter(s => s.usageCount > 0 && s.usageCount <= 2);

  return {
    summary: {
      totalExported: exported.symbols.length,
      unused: unused.length,
      lowUsage: lowUsage.length,
      percentUnused: Math.round((unused.length / exported.symbols.length) * 100)
    },
    deadCode: unused,
    lowUsageCode: lowUsage,
    recommendation: unused.length > 10
      ? "Consider a cleanup sprint to remove dead code"
      : "Dead code level is acceptable"
  };
}

// ============================================
// 2. Architectural Layer Analysis
// ============================================

async function analyzeArchitecturalLayers() {
  const overview = await api.getArchitectureOverview({
    includeModuleGraph: true,
    includeMetrics: true
  });

  // Define architectural layers
  const layers = {
    controllers: [],
    services: [],
    repositories: [],
    models: [],
    utilities: [],
    other: []
  };

  // Search for components in each layer
  const [controllers, services, repositories, models] = await Promise.all([
    api.searchSymbols({
      query: "Controller",
      filterByKind: ["class"],
      limit: 50
    }),
    api.searchSymbols({
      query: "Service",
      filterByKind: ["class"],
      limit: 50
    }),
    api.searchSymbols({
      query: "Repository",
      filterByKind: ["class"],
      limit: 50
    }),
    api.searchSymbols({
      filePattern: "**/models/**",
      filterByKind: ["class", "interface"],
      limit: 50
    })
  ]);

  // Check for layer violations (e.g., controllers depending on repositories)
  const violations = [];
  for (const controller of controllers.symbols) {
    const deps = await api.getDependencies({
      filePath: controller.filePath,
      includePackages: false
    });

    const repoDepViolations = deps.dependencies.filter(d =>
      d.target.includes('repository') || d.target.includes('Repository')
    );

    if (repoDepViolations.length > 0) {
      violations.push({
        source: controller.name,
        violation: "Controller directly depends on Repository",
        dependencies: repoDepViolations.map(d => d.target)
      });
    }
  }

  return {
    architecture: overview.overview,
    layers: {
      controllers: controllers.symbols.length,
      services: services.symbols.length,
      repositories: repositories.symbols.length,
      models: models.symbols.length
    },
    violations: violations,
    health: violations.length === 0 ? "GOOD" : "NEEDS_ATTENTION"
  };
}

// ============================================
// 3. Dependency Hotspot Analysis
// ============================================

async function findDependencyHotspots() {
  // Get all main source files
  const symbols = await api.searchSymbols({
    query: '',
    filterByKind: ['class', 'interface'],
    filterByExported: true,
    limit: 100
  });

  // Get unique files
  const uniqueFiles = [...new Set(symbols.symbols.map(s => s.filePath))];

  // Analyze dependencies for each file
  const fileAnalysis = await Promise.all(
    uniqueFiles.map(async (file) => {
      const [deps, dependents] = await Promise.all([
        api.getDependencies({ filePath: file }),
        api.getDependents({ filePath: file })
      ]);

      return {
        file,
        outgoing: deps.totalCount,
        incoming: dependents.totalCount,
        coupling: deps.totalCount + dependents.totalCount,
        isHotspot: dependents.totalCount > 10
      };
    })
  );

  // Sort by coupling
  fileAnalysis.sort((a, b) => b.coupling - a.coupling);

  // Identify problematic files
  const hotspots = fileAnalysis.filter(f => f.isHotspot);
  const godObjects = fileAnalysis.filter(f => f.outgoing > 20);
  const hubs = fileAnalysis.filter(f => f.incoming > 15);

  return {
    summary: {
      totalFiles: uniqueFiles.length,
      hotspots: hotspots.length,
      godObjects: godObjects.length,
      hubs: hubs.length
    },
    topHotspots: hotspots.slice(0, 5),
    godObjects: godObjects.slice(0, 5),
    hubs: hubs.slice(0, 5),
    recommendations: generateDependencyRecommendations(hotspots, godObjects, hubs)
  };

  function generateDependencyRecommendations(hotspots, godObjects, hubs) {
    const recommendations = [];

    if (hotspots.length > 5) {
      recommendations.push("High number of dependency hotspots detected. Consider refactoring to reduce coupling.");
    }

    if (godObjects.length > 0) {
      recommendations.push(`Found ${godObjects.length} god objects with excessive dependencies. Consider breaking them down.`);
    }

    if (hubs.length > 3) {
      recommendations.push("Multiple hub files detected. Consider introducing abstractions to reduce direct dependencies.");
    }

    return recommendations;
  }
}

// ============================================
// 4. Test Coverage Analysis
// ============================================

async function analyzeTestCoverage() {
  // Find all test files
  const testFiles = await api.searchSymbols({
    query: '',
    filePattern: '**/*.{test,spec}.{ts,tsx,js,jsx}',
    limit: 200
  });

  // Find all source files
  const sourceFiles = await api.searchSymbols({
    query: '',
    filterByKind: ['class', 'function'],
    filterByExported: true,
    limit: 200
  });

  // Check which source files have corresponding tests
  const coverageAnalysis = await Promise.all(
    sourceFiles.symbols.map(async (source) => {
      // Look for test files that might test this source
      const baseName = source.filePath.replace(/\.(ts|js|tsx|jsx)$/, '');
      const possibleTestPatterns = [
        `${baseName}.test`,
        `${baseName}.spec`,
        source.name // Test file might include the symbol name
      ];

      // Check if any test file references this symbol
      const usage = await api.traceSymbolUsage({
        symbolName: source.name,
        filePath: source.filePath
      });

      const hasTests = usage.usages.some(u =>
        u.filePath.includes('.test.') || u.filePath.includes('.spec.')
      );

      return {
        symbol: source.name,
        file: source.filePath,
        type: source.kind,
        hasTests,
        testReferences: usage.usages.filter(u =>
          u.filePath.includes('.test.') || u.filePath.includes('.spec.')
        ).length
      };
    })
  );

  // Calculate coverage metrics
  const withTests = coverageAnalysis.filter(s => s.hasTests);
  const withoutTests = coverageAnalysis.filter(s => !s.hasTests);

  // Prioritize untested code by type
  const untestedClasses = withoutTests.filter(s => s.type === 'class');
  const untestedFunctions = withoutTests.filter(s => s.type === 'function');

  return {
    summary: {
      totalSymbols: sourceFiles.symbols.length,
      withTests: withTests.length,
      withoutTests: withoutTests.length,
      coveragePercent: Math.round((withTests.length / sourceFiles.symbols.length) * 100),
      totalTestFiles: testFiles.symbols.length
    },
    untested: {
      classes: untestedClasses.map(c => ({ name: c.symbol, file: c.file })),
      functions: untestedFunctions.slice(0, 20).map(f => ({ name: f.symbol, file: f.file }))
    },
    recommendations: generateTestRecommendations(withTests.length, sourceFiles.symbols.length, untestedClasses)
  };

  function generateTestRecommendations(tested, total, untestedClasses) {
    const coverage = (tested / total) * 100;
    const recs = [];

    if (coverage < 50) {
      recs.push("Critical: Test coverage below 50%. Prioritize testing core business logic.");
    } else if (coverage < 70) {
      recs.push("Test coverage could be improved. Aim for 70-80% coverage.");
    }

    if (untestedClasses.length > 5) {
      recs.push(`${untestedClasses.length} classes lack tests. Start with the most critical ones.`);
    }

    return recs;
  }
}

// ============================================
// 5. Circular Dependency Deep Analysis
// ============================================

async function analyzeCircularDependencies() {
  // Find all circular dependencies
  const circles = await api.findCircularDependencies({
    limit: 100
  });

  if (circles.totalCount === 0) {
    return { message: "No circular dependencies found! Excellent architecture." };
  }

  // Analyze each circular dependency for impact
  const analysisResults = await Promise.all(
    circles.cycles.slice(0, 20).map(async (cycle) => {
      // Get dependents for each file in the cycle
      const impactAnalysis = await Promise.all(
        cycle.nodes.map(async (node) => {
          const dependents = await api.getDependents({
            filePath: node.filePath,
            limit: 10
          });
          return {
            file: node.filePath,
            externalDependents: dependents.totalCount
          };
        })
      );

      // Calculate total impact
      const totalImpact = impactAnalysis.reduce((sum, i) => sum + i.externalDependents, 0);

      // Determine the weakest link (best place to break the cycle)
      const weakestLink = cycle.edges.sort((a, b) => {
        // Prefer breaking edges between less coupled files
        return a.weight - b.weight;
      })[0];

      return {
        cycle: cycle.nodes.map(n => n.filePath),
        length: cycle.nodes.length,
        totalImpact,
        severity: totalImpact > 50 ? "CRITICAL" :
                  totalImpact > 20 ? "HIGH" :
                  totalImpact > 10 ? "MEDIUM" : "LOW",
        suggestedBreakpoint: weakestLink ?
          `Break dependency from ${weakestLink.from} to ${weakestLink.to}` :
          "Refactor to introduce an abstraction layer"
      };
    })
  );

  // Sort by severity
  analysisResults.sort((a, b) => b.totalImpact - a.totalImpact);

  // Group by severity
  const bySeverity = {
    CRITICAL: analysisResults.filter(r => r.severity === "CRITICAL"),
    HIGH: analysisResults.filter(r => r.severity === "HIGH"),
    MEDIUM: analysisResults.filter(r => r.severity === "MEDIUM"),
    LOW: analysisResults.filter(r => r.severity === "LOW")
  };

  return {
    summary: {
      totalCycles: circles.totalCount,
      analyzed: analysisResults.length,
      critical: bySeverity.CRITICAL.length,
      high: bySeverity.HIGH.length,
      medium: bySeverity.MEDIUM.length,
      low: bySeverity.LOW.length
    },
    criticalCycles: bySeverity.CRITICAL,
    topPriority: analysisResults.slice(0, 5),
    generalRecommendations: [
      "Focus on breaking critical cycles first",
      "Introduce abstraction layers or interfaces to decouple modules",
      "Consider using dependency injection to reverse dependencies",
      "Review architecture to ensure proper layer boundaries"
    ]
  };
}

// Execute the analysis pattern you want
// Uncomment the function call you want to run:

// return await findDeadCode();
// return await analyzeArchitecturalLayers();
// return await findDependencyHotspots();
// return await analyzeTestCoverage();
return await analyzeCircularDependencies();