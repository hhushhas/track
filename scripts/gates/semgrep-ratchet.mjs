import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const require = createRequire(import.meta.url);
const baselinePath = resolve(repoRoot, ".semgrep-known-violations.json");

function resolveRulePack(specifier) {
  return require.resolve(specifier);
}

function findingKey(finding) {
  const source = readFileSync(resolve(repoRoot, finding.path));
  const matchedSource = source.subarray(finding.start.offset, finding.end.offset)
    .toString("utf8").replace(/\s+/g, " ").trim();
  const fingerprint = createHash("sha256").update(matchedSource).digest("hex");
  const q9Prefix = finding.check_id.lastIndexOf(".q9.");
  const checkId = q9Prefix === -1 ? finding.check_id : finding.check_id.slice(q9Prefix + 1);
  return [checkId, finding.path, fingerprint].join("|");
}

function readBaseline() {
  const parsed = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.findings)) {
    throw new Error(`Invalid Semgrep baseline at ${baselinePath}`);
  }
  const allowances = new Map();
  for (const finding of parsed.findings) {
    const key = [finding.checkId, finding.path, finding.fingerprint].join("|");
    allowances.set(key, (allowances.get(key) ?? 0) + 1);
  }
  return allowances;
}

function runSemgrep() {
  const args = [
    "scan",
    "--config",
    resolveRulePack("@q9labsai/config-semgrep/type-safety"),
    "--config",
    resolveRulePack("@q9labsai/config-semgrep/shape-heuristics"),
    "--config",
    resolve(repoRoot, ".semgrep/project.yml"),
    "--metrics=off",
    "--json",
    "--quiet",
    "--timeout",
    "30",
    "--timeout-threshold",
    "100",
    "--jobs",
    "1",
    "apps/web/src",
    "apps/mobile/src",
    "packages/shared/src",
    "convex",
  ];
  const result = spawnSync("semgrep", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Could not run semgrep: ${result.error.message}`);
  }
  if (result.stdout.trim().length === 0) {
    throw new Error(result.stderr.trim() || "Semgrep produced no JSON output.");
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Semgrep exited ${result.status}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function reportFindings(findings) {
  return findings.map((finding) =>
    `  ${finding.path}:${finding.start.line}:${finding.start.col} ${finding.check_id}`,
  );
}

try {
  const baseline = readBaseline();
  const report = runSemgrep();
  const errors = report.errors ?? [];
  const findings = report.results ?? [];
  const newFindings = findings.filter((finding) => {
    const key = findingKey(finding);
    const allowance = baseline.get(key) ?? 0;
    if (allowance === 0) return true;
    baseline.set(key, allowance - 1);
    return false;
  });

  if (errors.length > 0 || newFindings.length > 0) {
    if (errors.length > 0) {
      console.error(`Semgrep reported ${errors.length} scan error(s):`);
      for (const error of errors) console.error(`  ${error.message}`);
    }
    if (newFindings.length > 0) {
      console.error(`Semgrep found ${newFindings.length} finding(s) outside the baseline:`);
      for (const line of reportFindings(newFindings)) console.error(line);
    }
    process.exitCode = 1;
  } else {
    console.log(`Semgrep ratchet passed (${findings.length} baseline finding(s)).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
