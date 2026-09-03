import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/auth/login 登录（账号 = 邮箱或手机号；成功后种 httpOnly 会话 cookie）
const loginBodySchema = z.object({
  account: z.string().trim().min(1, "请输入账号"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = loginBodySchema.parse(await request.json());

    const identifier = body.account.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: body.account.trim() }] },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new ApiError("账号或密码错误", 40102, 401);
    }

    const token = await createSessionToken(user.id);
    const response = ok(
      {
        id: user.id,
        email: user.email,
        phone: user.phone,
        nickname: user.nickname,
        role: user.role,
      },
      "登录成功",
    );
    setSessionCookie(response, token);
    return response;
  });
}
