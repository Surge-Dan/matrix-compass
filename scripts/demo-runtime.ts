import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forceDemoRuntimeEnvironment } from "../lib/runtime/mode";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const viteEntry = path.join(
  repositoryRoot,
  "node_modules",
  "vite",
  "bin",
  "vite.js",
);
const environment = forceDemoRuntimeEnvironment(process.env);
const child = spawn(
  process.execPath,
  [viteEntry, "--host", "127.0.0.1", "--port", "3000"],
  {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  },
);

child.once("error", (error) => {
  process.stderr.write(`Matrix Compass demo failed to start: ${error.message}\n`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (code !== 0) {
    process.stderr.write(
      `Matrix Compass demo exited unexpectedly: ${signal ?? code ?? "unknown"}\n`,
    );
    process.exitCode = 1;
  }
});
