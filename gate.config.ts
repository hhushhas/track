import { defineGate, lanes } from "@q9labsai/gates";

export default defineGate({
  workspaceRoots: ["apps", "packages", "convex"],
  classifiers: {
    source: [".ts", ".tsx", ".mjs", ".cjs", ".js", ".jsx"],
    test: [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"],
    docs: ["scratchpad/", "*.md", "*.mdx", "*.txt"],
    dependency: ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"],
    gateDefinition: ["gate.config.ts", "lefthook.yml", "turbo.json", ".github/workflows/"],
    contract: ["packages/shared/", "convex/schema.ts", "convex/_generated/"],
    workflow: [".github/workflows/"],
  },
  concurrency: "50%",
  lanes: [
    lanes.typecheck(),
    lanes.custom({
      id: "lint-ratchet",
      title: "Canonical type-aware lint ratchet",
      triggers: ["source", "test", "dependency", "contract"],
      run: "node scripts/gates/oxlint-ratchet.mjs",
      exclusive: true,
    }),
    lanes.custom({
      id: "backend-typecheck",
      title: "Convex backend typecheck",
      triggers: ["source", "test", "contract"],
      run: "pnpm run typecheck:backend",
      exclusive: true,
    }),
    lanes.custom({
      id: "semgrep-ratchet",
      title: "Semgrep architecture ratchet",
      triggers: ["source", "ui"],
      run: "pnpm run architecture:semgrep",
      exclusive: true,
    }),
    lanes.depcruise({ config: ".dependency-cruiser.cjs" }),
  ],
});
