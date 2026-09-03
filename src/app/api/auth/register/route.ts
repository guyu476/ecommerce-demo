import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/auth/register 注册（邮箱/手机号二选一；成功即登录：直接种会话 cookie）
const registerBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email("邮箱格式不正确").optional(),
    phone: z
      .string()
      .trim()
      .regex(/^1[3-9]\d{9}$/, "手机号格式不正确")
      .optional(),
    nickname: z.string().trim().min(1, "昵称不能为空").max(50, "昵称最多 50 字"),
    password: z.string().min(8, "密码至少 8 位").max(64, "密码最多 64 位"),
  })
  .refine((data) => data.email || data.phone, {
    message: "请提供邮箱或手机号",
    path: ["email"],
  });

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = registerBodySchema.parse(await request.json());

    if (body.email) {
      const existing = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError("该邮箱已被注册", 40901, 409);
      }
    }
    if (body.phone) {
      const existing = await prisma.user.findUnique({
        where: { phone: body.phone },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError("该手机号已被注册", 40902, 409);
      }
    }

    const user = await prisma.user.create({
      data: {
        email: body.email ?? null,
        phone: body.phone ?? null,
        nickname: body.nickname,
        passwordHash: await bcrypt.hash(body.password, 10),
      },
      select: { id: true, email: true, phone: true, nickname: true },
    });

    const token = await createSessionToken(user.id);
    const response = ok(user, "注册成功");
    setSessionCookie(response, token);
    return response;
  });
}
