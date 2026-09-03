import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// 会话：JWT 写入 httpOnly cookie（7 天有效），密钥来自 JWT_SECRET
const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("缺少 JWT_SECRET 环境变量（见 .env.example）");
  }
  return new TextEncoder().encode(secret);
}

export type Role = "USER" | "MERCHANT" | "ADMIN";

export interface SessionUser {
  id: number;
  email: string | null;
  phone: string | null;
  nickname: string;
  role: Role;
  avatar: string | null;
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

/** 读取当前会话用户；未登录/会话无效返回 null（不抛错，供页面和接口共用） */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, nickname: true, role: true, avatar: true },
    });
  } catch {
    return null;
  }
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
