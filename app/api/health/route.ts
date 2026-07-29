export async function GET() {
  return Response.json(
    { status: "ok", app: "matrix-compass", version: "0.1.0", dataSource: "demo" },
    { headers: { "cache-control": "no-store" } },
  );
}
