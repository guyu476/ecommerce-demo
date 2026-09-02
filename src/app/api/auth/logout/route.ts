import { handleRoute, ok } from "@/lib/api-response";
import { clearSessionCookie } from "@/lib/auth";

// POST /api/auth/logout 登出（清除会话 cookie）
export async function POST() {
  return handleRoute(async () => {
    const response = ok(null, "已退出登录");
    clearSessionCookie(response);
    return response;
  });
}
