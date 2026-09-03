import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { handleRoute, ok } from "@/lib/api-response";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/auth/sms-login 短信验证码登录（演示环境：验证码不做真实校验，任意 6 位数字均可）
// 未注册的手机号自动注册（昵称取尾号），登录成功种会话 cookie
const smsLoginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "请输入 6 位数字验证码"),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { phone } = smsLoginSchema.parse(await request.json());

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          nickname: `用户${phone.slice(-4)}`,
          passwordHash: await bcrypt.hash(randomUUID(), 10),
        },
      });
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
