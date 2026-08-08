import { commitImport, previewImport } from "../../../../lib/imports/service";
import type { ImportTarget } from "../../../../lib/imports/parser";
import { mapImportRows } from "../../../../lib/imports/parser";
import { readImportFile } from "../../../../lib/imports/file";
import type { DatabaseClient } from "../../../../lib/repositories/database";
import { loadRuntimeEnvironment } from "../../health/route";

export async function createImportCommitResponse(request: Request, database?: DatabaseClient) {
  const requestId = `mc-${crypto.randomUUID()}`;
  if (!database) return Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "本地数据库不可用。", requestId } }, { status: 503 });
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let target: ImportTarget | undefined;
    let text: string | undefined;
    let fileName: string | null = null;
    let preview: ReturnType<typeof previewImport>;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      target = String(form.get("target") ?? "") as ImportTarget;
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择 CSV 或 Excel 文件。");
      fileName = file.name;
      preview = { target, totalRows: 0, ...mapImportRows(await readImportFile(file), target) };
      preview.totalRows = preview.valid.length + preview.errors.length;
    } else {
      const body = await request.json() as { text?: string; target?: ImportTarget; source?: string; fileName?: string };
      target = body.target;
      text = body.text;
      fileName = body.fileName ?? null;
      if (!text || !target) return Response.json({ error: { code: "IMPORT_INPUT_REQUIRED", message: "请提供文件内容和导入目标。", requestId } }, { status: 400 });
      preview = previewImport(text, target);
    }
    if (!target) throw new Error("缺少导入目标。");
    const data = await commitImport(database, preview, "file", fileName);
    return Response.json({ data, meta: { requestId } }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: { code: "IMPORT_COMMIT_FAILED", message: error instanceof Error ? error.message : "导入失败。", requestId } }, { status: 400 });
  }
}

export async function POST(request: Request, database?: DatabaseClient) { return database ? createImportCommitResponse(request, database) : configured(request); }
async function loadWorkerBindings() { const { env } = await import("cloudflare:workers"); return env as unknown as Record<string, string | undefined> & { DB?: DatabaseClient }; }
async function configured(request: Request) { const bindings = await loadRuntimeEnvironment(loadWorkerBindings, process.env); return createImportCommitResponse(request, (bindings as { DB?: DatabaseClient }).DB); }
