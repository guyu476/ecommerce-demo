import { cookies } from "next/headers";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session";

// 会话：JWT 写入 httpOnly cookie（7 天有效），密钥来自 JWT_SECRET
// 令牌签发/校验在 lib/session.ts（Edge 可用）；本模块负责读取 cookie 与查库

export type Role = "USER" | "MERCHANT" | "ADMIN";

export interface SessionUser {
  id: number;
  email: string | null;
  phone: string | null;
  nickname: string;
  role: Role;
  avatar: string | null;
}

export { createSessionToken };

/** 读取当前会话用户；未登录/会话无效返回 null（不抛错，供页面和接口共用） */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token);
  if (userId === null) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, nickname: true, role: true, avatar: true },
  });
}

/** 受保护接口用：未登录直接抛 401 业务错误 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError("请先登录", 40101, 401);
  }
  return user;
}

/** 角色守卫：任一命中角色即可，否则 403 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ApiError("没有权限执行该操作", 40301, 403);
  }
  return user;
}

/** 登录成功后往响应上挂会话 cookie */
export function setSessionCookie(response: Response, token: string): void {
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
}

/** 登出：会话 cookie 立即过期 */
export function clearSessionCookie(response: Response): void {
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}
