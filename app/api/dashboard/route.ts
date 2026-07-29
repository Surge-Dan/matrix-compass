import {
  DashboardRangeError,
  getDashboardData,
  parseDashboardRange,
} from "../../../lib/dashboard-data.ts";

function createRequestId() {
  return `mc-${crypto.randomUUID()}`;
}

export async function createDashboardResponse(
  request: Request,
  requestId: string,
  dataProvider: typeof getDashboardData = getDashboardData,
) {
  try {
    const range = parseDashboardRange(new URL(request.url).searchParams.get("range"));
    return Response.json(dataProvider(range, requestId), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DashboardRangeError) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      {
        error: {
          code: "DASHBOARD_UNAVAILABLE",
          message: "仪表盘暂时无法加载，请稍后重试。",
          requestId,
        },
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function GET(request: Request) {
  return createDashboardResponse(request, createRequestId());
}
