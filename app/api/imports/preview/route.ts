import type { ImportTarget } from "../../../../lib/imports/parser";
import { readImportFile } from "../../../../lib/imports/file";

export async function POST(request: Request) {
  const requestId = `mc-${crypto.randomUUID()}`;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let target: ImportTarget | undefined;
    let rows: Record<string, string>[];
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      target = String(form.get("target") ?? "") as ImportTarget;
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择 CSV 或 Excel 文件。");
      rows = await readImportFile(file);
    } else {
      const body = await request.json() as { text?: string; target?: ImportTarget };
      target = body.target;
      rows = body.text ? (await import("../../../../lib/imports/parser")).parseCsvRows(body.text) : [];
    }
    if (!target || rows.length === 0) return Response.json({ error: { code: "IMPORT_INPUT_REQUIRED", message: "请提供文件内容和导入目标。", requestId } }, { status: 400 });
    const data = { target, totalRows: rows.length, ...(await import("../../../../lib/imports/parser")).mapImportRows(rows, target) };
    return Response.json({ data, meta: { requestId } }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: { code: "IMPORT_PREVIEW_FAILED", message: error instanceof Error ? error.message : "文件预览失败。", requestId } }, { status: 400 });
  }
}
