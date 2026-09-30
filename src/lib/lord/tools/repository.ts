import fs from "node:fs";
import { getLordConfig } from "../config";
import { ok, fail } from "../permissions";
import { registerTool } from "../registry";
import type { ToolContext, ToolResult } from "../types";
import { createRepositoryIndexer, type RepositoryGraph } from "../repository-index";

const repositoryIndexer = createRepositoryIndexer();

export function resolveRepositoryRoot(allowedDirs: readonly string[], cwd = process.cwd()): string {
  const configuredProject = allowedDirs.find((directory) =>
    fs.existsSync(`${directory}/package.json`),
  );
  if (configuredProject) return configuredProject;
  if (fs.existsSync(`${cwd}/package.json`)) return cwd;
  return allowedDirs[0] ?? cwd;
}

export function getRepositoryGraph(
  root: string,
  query: string,
  signal?: AbortSignal,
): RepositoryGraph {
  return repositoryIndexer.analyze(root, query, signal);
}

export function getRepositoryPromptContext(root: string, query: string): string {
  const graph = getRepositoryGraph(root, query);
  const summary = {
    project: graph.project,
    routes: graph.routes.slice(0, 60),
    apiRoutes: graph.apiRoutes.slice(0, 60),
    configurationFiles: graph.configurationFiles.slice(0, 80),
    environmentVariables: graph.environmentVariables.slice(0, 80),
    componentEdges: graph.componentEdges.slice(0, 80),
    duplicateSymbols: graph.duplicateSymbols.slice(0, 30),
    possibleUnusedExports: graph.possibleUnusedExports.slice(0, 30),
    relevantFiles: graph.relevantFiles.slice(0, 30).map((file) => ({
      path: file.path,
      kind: file.kind,
      imports: file.imports.slice(0, 30),
      symbols: file.symbols.slice(0, 40),
      environmentVariables: file.environmentVariables,
    })),
    cache: graph.cache,
  };
  return JSON.stringify(summary).slice(0, 12_000);
}

export function registerRepositoryTools(): void {
  registerTool({
    name: "repository.analyze",
    category: "agent",
    description:
      "Build a local repository graph and answer architecture, routes, dependencies, component, duplicate-symbol, possible-unused-export, and test-framework questions. Reads metadata only and never calls external services.",
    risk: "low",
    requiresConfirmation: false,
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Question or topic to find in the repository graph",
        required: true,
      },
    ],
    examples: [
      "Explain this project's architecture.",
      "Find files and routes related to authentication.",
      "List possible duplicate logic and existing test frameworks.",
    ],
    async execute(params, context: ToolContext): Promise<ToolResult> {
      try {
        const root = resolveRepositoryRoot(
          context.config.allowedDirs.length > 0
            ? context.config.allowedDirs
            : getLordConfig().allowedDirs,
        );
        if (!root)
          return fail("No allowed repository root is configured.", { errorCode: "NO_REPO_ROOT" });
        const query = String(params.query ?? "").slice(0, 500);
        const graph = getRepositoryGraph(root, query, context.signal);
        const findings = [
          `${graph.project.name ?? "Project"}: ${graph.project.frameworks.join(", ") || "framework not identified"}`,
          `${graph.routes.length} route(s), ${graph.apiRoutes.length} API route(s), ${graph.cache.indexedFiles} indexed file(s).`,
          graph.project.testFrameworks.length
            ? `Tests use ${graph.project.testFrameworks.join(", ")}.`
            : "No supported test framework was detected.",
          graph.duplicateSymbols.length
            ? `${graph.duplicateSymbols.length} exported symbol name(s) appear in multiple files; verify before treating them as duplicate logic.`
            : "No repeated exported symbol names were found.",
        ];
        return ok(findings.join(" "), {
          graph: {
            project: graph.project,
            routes: graph.routes,
            apiRoutes: graph.apiRoutes,
            configurationFiles: graph.configurationFiles,
            environmentVariables: graph.environmentVariables,
            componentEdges: graph.componentEdges,
            duplicateSymbols: graph.duplicateSymbols,
            possibleUnusedExports: graph.possibleUnusedExports,
            relevantFiles: graph.relevantFiles.map((file) => ({
              path: file.path,
              kind: file.kind,
              imports: file.imports,
              symbols: file.symbols,
              environmentVariables: file.environmentVariables,
            })),
            cache: graph.cache,
          },
        });
      } catch (error) {
        return fail(error instanceof Error ? error.message : "Repository analysis failed.", {
          recoverable: true,
          errorCode: "REPOSITORY_ANALYSIS_FAILED",
        });
      }
    },
  });
}
