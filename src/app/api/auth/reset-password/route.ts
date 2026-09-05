import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// POST /api/auth/reset-password 找回密码（演示环境：验证码不做真实校验，任意 6 位数字均可，
// 与短信登录保持同一套模拟口径；接入真实短信服务后在此校验验证码缓存）
const resetSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "请输入 6 位数字验证码"),
  newPassword: z.string().min(8, "新密码至少 8 位").max(64, "新密码最多 64 位"),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { phone, newPassword } = resetSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // 不区分「手机号未注册」与「验证码错误」，避免枚举注册用户
      throw new ApiError("手机号或验证码不正确", 40001, 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });

    return ok({ ok: true }, "密码已重置，请用新密码登录");
  });
}
