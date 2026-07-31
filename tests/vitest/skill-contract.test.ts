import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const skillRoot = path.resolve("skill", "matrix-compass");

async function read(relativePath: string) {
  return readFile(path.join(skillRoot, relativePath), "utf8");
}

describe("Matrix Compass local skill", () => {
  it("has focused trigger metadata and a safe operating boundary", async () => {
    const markdown = await read("SKILL.md");
    expect(markdown).toMatch(/^---\r?\nname: matrix-compass\r?\n/);
    expect(markdown).toMatch(/description: .*(安装|启动|备份|恢复|诊断)/);
    expect(markdown).toContain("不要把 API Key 发到聊天");
    expect(markdown).toContain("不要清空或重建用户数据");
    expect(markdown).toContain("公网演示不读取本地数据");
  });

  it.each([
    "common.ps1",
    "install.ps1",
    "start.ps1",
    "backup.ps1",
    "restore.ps1",
    "doctor.ps1",
  ])("bundles the deterministic %s workflow", async (scriptName) => {
    const script = await read(path.join("scripts", scriptName));
    expect(script).toContain("$ErrorActionPreference = \"Stop\"");
    expect(script).toMatch(/^[\x00-\x7F]*$/);
    expect(script).not.toMatch(/Remove-Item\s+.*-Recurse/i);
    expect(script).not.toMatch(/git\s+(?:reset\s+--hard|clean\s+-fd)/i);
    expect(script).not.toMatch(/Get-ChildItem\s+Env:/i);
  });

  it("keeps the chosen data directory and doctor checks explicit", async () => {
    const install = await read(path.join("scripts", "install.ps1"));
    const start = await read(path.join("scripts", "start.ps1"));
    const doctor = await read(path.join("scripts", "doctor.ps1"));
    expect(install).toContain("[string]$DataPath");
    expect(install).toContain("npm run db:migrate");
    expect(start).toContain("Set-MatrixCompassDataPath");
    expect(doctor).toContain("NodeCompatible");
    expect(doctor).toContain("npm run db:check");
    expect(doctor).toContain("/api/health");
  });

  it("ships realistic review prompts for install, backup, and diagnosis", async () => {
    const evals = JSON.parse(await read(path.join("evals", "evals.json"))) as {
      skill_name: string;
      evals: Array<{ id: number; expectations: string[] }>;
    };
    expect(evals.skill_name).toBe("matrix-compass");
    expect(evals.evals.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(evals.evals.every((item) => item.expectations.length >= 3)).toBe(true);
  });
});
