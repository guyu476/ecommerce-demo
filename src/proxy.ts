import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// 页面级登录守卫（Next.js 16：middleware 更名为 proxy）。
// 只做「乐观检查」：快速把未登录访客重定向到登录页，避免页面闪现游客态。
// 真正的授权仍由各 API 的 requireUser/requireRole 兜底，双层防御。
const LOGIN_PATH = "/login";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;
  if (userId !== null) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  const redirect = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (redirect && redirect.startsWith("/")) {
    loginUrl.searchParams.set("redirect", redirect);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/checkout/:path*",
    "/orders/:path*",
    "/favorites/:path*",
    "/coupons/:path*",
    "/user/:path*",
    "/merchant/:path*",
    "/admin/:path*",
  ],
};
