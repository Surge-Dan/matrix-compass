import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commonScript = path.join(repositoryRoot, "skill", "matrix-compass", "scripts", "common.ps1");
const powershell = path.join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runPowerShell(script, env = {}) {
  return spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", script], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

async function createFakeNode(directory, version) {
  await mkdir(directory, { recursive: true });
  const nodePath = path.join(directory, "node.cmd");
  await writeFile(
    nodePath,
    `@echo off\r\nif "%~1"=="--version" (echo v${version} & exit /b 0)\r\nexit /b 0\r\n`,
    "utf8",
  );
  return nodePath;
}

async function createFakeNpm(directory, cliSource = "") {
  const npmPath = path.join(directory, "npm.cmd");
  const cliPath = path.join(directory, "node_modules", "npm", "bin", "npm-cli.js");
  await mkdir(path.dirname(cliPath), { recursive: true });
  await writeFile(npmPath, "@echo off\r\nexit /b 0\r\n", "utf8");
  await writeFile(cliPath, cliSource, "utf8");
  return { npmPath, cliPath };
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

test("runtime resolver skips an old PATH Node and selects a later compatible Node", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "matrix-compass-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oldDirectory = path.join(root, "old");
  const newDirectory = path.join(root, "new");
  await createFakeNode(oldDirectory, "18.19.0");
  const compatibleNode = await createFakeNode(newDirectory, "24.14.0");
  await createFakeNpm(newDirectory);

  const command = [
    `. ${quotePowerShell(commonScript)}`,
    "$runtime = Initialize-MatrixCompassRuntime",
    "$runtime | ConvertTo-Json -Compress",
  ].join("; ");
  const result = runPowerShell(command, {
    MATRIX_COMPASS_NODE: "",
    PATH: `${oldDirectory};${newDirectory};${process.env.PATH ?? ""}`,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const runtime = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
  assert.equal(path.resolve(runtime.NodePath), path.resolve(compatibleNode));
  assert.equal(runtime.NodeVersion, "24.14.0");
});

test("an explicitly configured old Node is rejected instead of silently falling back", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "matrix-compass-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oldNode = await createFakeNode(path.join(root, "old"), "18.19.0");
  const newDirectory = path.join(root, "new");
  await createFakeNode(newDirectory, "24.14.0");
  await createFakeNpm(newDirectory);

  const command = `. ${quotePowerShell(commonScript)}; Initialize-MatrixCompassRuntime`;
  const result = runPowerShell(command, {
    MATRIX_COMPASS_NODE: oldNode,
    PATH: `${newDirectory};${process.env.PATH ?? ""}`,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MATRIX_COMPASS_NODE/i);
  assert.match(result.stderr, /18\.19\.0/);
  assert.match(result.stderr, /22\.13/);
});

test("npm CLI and its child scripts observe the selected Node version", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "matrix-compass-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const npmDirectory = path.join(root, "npm");
  await createFakeNpm(
    npmDirectory,
    [
      'const { execFileSync } = require("node:child_process");',
      'const child = execFileSync("node", ["--version"], { encoding: "utf8" }).trim();',
      "console.log(JSON.stringify({ npm: process.version, child }));",
    ].join("\n"),
  );

  const command = [
    `. ${quotePowerShell(commonScript)}`,
    "$runtime = Initialize-MatrixCompassRuntime",
    "Invoke-MatrixCompassNpm -Runtime $runtime -Arguments @()",
  ].join("; ");
  const result = runPowerShell(command, {
    MATRIX_COMPASS_NODE: process.execPath,
    PATH: `${npmDirectory};${process.env.PATH ?? ""}`,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const observed = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
  assert.equal(observed.npm, process.version);
  assert.equal(observed.child, process.version);
});

test("all operational scripts reject an old explicit Node before creating target or data paths", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "matrix-compass-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const oldNode = await createFakeNode(path.join(root, "old-node"), "18.19.0");
  const project = path.join(root, "existing-project");
  const backup = path.join(root, "existing-backup");
  const target = path.join(root, "new-install");
  const data = path.join(root, "new-data");
  await mkdir(project);
  await mkdir(backup);

  const scriptDirectory = path.join(repositoryRoot, "skill", "matrix-compass", "scripts");
  const invocations = [
    `& ${quotePowerShell(path.join(scriptDirectory, "install.ps1"))} -TargetPath ${quotePowerShell(target)} -DataPath ${quotePowerShell(data)}`,
    `& ${quotePowerShell(path.join(scriptDirectory, "start.ps1"))} -ProjectPath ${quotePowerShell(project)} -DataPath ${quotePowerShell(data)}`,
    `& ${quotePowerShell(path.join(scriptDirectory, "doctor.ps1"))} -ProjectPath ${quotePowerShell(project)} -DataPath ${quotePowerShell(data)}`,
    `& ${quotePowerShell(path.join(scriptDirectory, "backup.ps1"))} -ProjectPath ${quotePowerShell(project)} -DataPath ${quotePowerShell(data)}`,
    `& ${quotePowerShell(path.join(scriptDirectory, "restore.ps1"))} -ProjectPath ${quotePowerShell(project)} -BackupPath ${quotePowerShell(backup)} -DataPath ${quotePowerShell(data)}`,
  ];

  for (const invocation of invocations) {
    const result = runPowerShell(invocation, {
      MATRIX_COMPASS_NODE: oldNode,
      PATH: process.env.PATH ?? "",
    });
    assert.notEqual(result.status, 0, `${invocation}\n${result.stdout}`);
    assert.match(result.stderr, /MATRIX_COMPASS_NODE.*18\.19\.0/i);
    assert.equal(await exists(target), false, "preflight failure must not create the install target");
    assert.equal(await exists(data), false, "preflight failure must not create the data directory");
  }
});

test("install rejects a compatible Node without npm before creating target or data paths", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "matrix-compass-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "new-install");
  const data = path.join(root, "new-data");
  const installScript = path.join(repositoryRoot, "skill", "matrix-compass", "scripts", "install.ps1");
  const result = runPowerShell(
    `& ${quotePowerShell(installScript)} -TargetPath ${quotePowerShell(target)} -DataPath ${quotePowerShell(data)}`,
    { MATRIX_COMPASS_NODE: process.execPath, PATH: "" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /npm CLI was not found/i);
  assert.equal(await exists(target), false);
  assert.equal(await exists(data), false);
});

test("npm wrapper forwards arguments and preserves a nonzero exit code", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "matrix-compass-npm-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marker = path.join(root, "arguments.json");
  const npmDirectory = path.join(root, "npm");
  await createFakeNpm(
    npmDirectory,
    [
      'const { writeFileSync } = require("node:fs");',
      'writeFileSync(process.env.MATRIX_COMPASS_TEST_MARKER, JSON.stringify(process.argv.slice(2)));',
      "process.exit(37);",
    ].join("\n"),
  );

  const command = [
    `. ${quotePowerShell(commonScript)}`,
    "$runtime = Initialize-MatrixCompassRuntime",
    'Invoke-MatrixCompassNpm -Runtime $runtime -Arguments @("run", "backup", "--", "--flag", "value")',
    "exit $LASTEXITCODE",
  ].join("; ");
  const result = runPowerShell(command, {
    MATRIX_COMPASS_NODE: process.execPath,
    MATRIX_COMPASS_TEST_MARKER: marker,
    PATH: `${npmDirectory};${process.env.PATH ?? ""}`,
  });

  assert.equal(result.status, 37, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(await readFile(marker, "utf8")), ["run", "backup", "--", "--flag", "value"]);
});

test("every operational Skill script uses the shared runtime instead of direct npm calls", async () => {
  const scriptDirectory = path.join(repositoryRoot, "skill", "matrix-compass", "scripts");
  const scripts = ["install.ps1", "start.ps1", "doctor.ps1", "backup.ps1", "restore.ps1"];

  for (const scriptName of scripts) {
    const source = await readFile(path.join(scriptDirectory, scriptName), "utf8");
    assert.match(source, /Initialize-MatrixCompassRuntime/, `${scriptName} must initialize the shared runtime`);
    assert.match(source, /Invoke-MatrixCompassNpm/, `${scriptName} must invoke npm through the selected Node`);
    assert.match(source, /Write-MatrixCompassRuntimeSummary/, `${scriptName} must report the selected Node`);
    assert.doesNotMatch(source, /&\s*npm\b/i, `${scriptName} must not invoke whichever npm happens to be first on PATH`);
  }
});

test("the release quality gate includes the Skill runtime regression suite", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["test:skill"], "node --test tests/skill-runtime.test.mjs");
  assert.match(packageJson.scripts["test:quality"], /npm run test:skill/);
});
