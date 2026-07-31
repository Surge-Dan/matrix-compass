import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const allowlist = JSON.parse(
  await readFile(
    path.join(projectRoot, "security-audit-allowlist.json"),
    "utf8",
  ),
);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run through npm.");
const audit = spawnSync(process.execPath, [npmCli, "audit", "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 8 * 1024 * 1024,
});
if (audit.error || !audit.stdout || ![0, 1].includes(audit.status)) {
  throw new Error(`Dependency audit command failed: ${audit.error?.message ?? audit.stderr}`);
}
const report = JSON.parse(audit.stdout);
if (report.error) {
  throw new Error(`Dependency audit report failed: ${JSON.stringify(report.error)}`);
}
const today = new Date().toISOString().slice(0, 10);
const activeEntries = allowlist.entries.filter(
  (entry) => entry.expiresOn >= today && entry.scope && entry.advisory,
);
const vulnerabilities = report.vulnerabilities ?? {};
function collectAdvisories(packageName, visited = new Set()) {
  if (visited.has(packageName)) return new Set();
  visited.add(packageName);
  const vulnerability = vulnerabilities[packageName];
  const advisories = new Set();
  for (const via of vulnerability?.via ?? []) {
    if (typeof via === "string") {
      for (const advisory of collectAdvisories(via, visited)) {
        advisories.add(advisory);
      }
    } else if (via.url) {
      advisories.add(via.url.split("/").at(-1));
    }
  }
  return advisories;
}

function isPreciselyAllowed(vulnerability) {
  const advisories = collectAdvisories(vulnerability.name);
  return (
    advisories.size > 0 &&
    [...advisories].every((advisory) =>
      activeEntries.some(
        (entry) =>
          entry.advisory === advisory &&
          entry.packages.includes(vulnerability.name),
      ),
    )
  );
}
const blocked = Object.values(report.vulnerabilities ?? {}).filter(
  (vulnerability) =>
    ["high", "critical"].includes(vulnerability.severity) &&
    !isPreciselyAllowed(vulnerability),
);
const expired = allowlist.entries.filter((entry) => entry.expiresOn < today);

if (expired.length > 0 || blocked.length > 0) {
  const details = [
    ...expired.map(
      (entry) => `expired waiver ${entry.advisory} (${entry.expiresOn})`,
    ),
    ...blocked.map(
      (vulnerability) =>
        `unwaived ${vulnerability.severity} vulnerability in ${vulnerability.name}`,
    ),
  ];
  throw new Error(`Dependency audit failed:\n${details.join("\n")}`);
}
process.stdout.write(
  `Dependency audit passed with ${activeEntries.length} active, expiring development-only waiver.\n`,
);
