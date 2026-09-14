const { makeHexagonalRules } = require("@q9labsai/config-depcruise");
const knownViolations = require("./.dependency-cruiser-known-violations.json");

const configuration = makeHexagonalRules({
  core: ["packages/shared/src"],
  edges: ["apps/*/src", "convex"],
  exclude: [".worktrees", "convex/_generated", "apps/web/src/routeTree.gen.ts"],
});

// Keep an explicit, reviewable snapshot of current violations while the
// dependency graph is untangled. New cycles/orphans are not accepted: update
// this file only when a finding is fixed or an owner records why it remains.
configuration.options.knownViolations = knownViolations;

module.exports = configuration;
