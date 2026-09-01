import { handleRoute, ok } from "@/lib/api-response";

// 健康检查：探活用，不依赖数据库
export const dynamic = "force-dynamic";

export function GET() {
  return handleRoute(async () =>
    ok({
      service: "ecommerce-demo",
      status: "up",
      timestamp: new Date().toISOString(),
    }),
  );
}
