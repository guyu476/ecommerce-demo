import { handleRoute, ok } from "@/lib/api-response";
import { getSessionUser } from "@/lib/auth";

// GET /api/auth/me 当前登录用户（未登录返回 data: null 而不是报错，方便前端探测）
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await getSessionUser();
    return ok(user);
  });
}
