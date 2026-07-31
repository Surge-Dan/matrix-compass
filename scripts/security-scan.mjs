import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const listed = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: projectRoot, encoding: "utf8", windowsHide: true },
);
if (listed.status !== 0) {
  throw new Error(`Unable to enumerate repository files: ${listed.stderr}`);
}

const textExtensions = new Set([
  ".css",
  ".feature",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".ps1",
  ".sql",
  ".ts",
  ".tsx",
]);
const forbiddenHomePaths = [homedir(), homedir().replaceAll("\\", "/")];
const credentialPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][^"']{8,}["']/i,
];
const findings = [];

for (const relativePath of listed.stdout.split(/\r?\n/).filter(Boolean)) {
  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) continue;
  const content = readFileSync(path.join(projectRoot, relativePath), "utf8");
  if (forbiddenHomePaths.some((value) => content.includes(value))) {
    findings.push(`${relativePath}: local home path`);
  }
  if (credentialPatterns.some((pattern) => pattern.test(content))) {
    findings.push(`${relativePath}: credential-shaped value`);
  }
}

if (findings.length > 0) {
  throw new Error(`Security scan failed:\n${findings.join("\n")}`);
}
process.stdout.write("Security scan passed: no local home paths or credential-shaped values.\n");
