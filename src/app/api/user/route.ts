import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/user 更新个人资料（昵称 / 头像）
// 头像两种形态：单个 emoji，或客户端压缩后的 data:image URL（≤400KB）
const updateBodySchema = z.object({
  nickname: z.string().trim().min(1, "昵称不能为空").max(50, "昵称最多 50 字").optional(),
  avatar: z
    .string()
    .trim()
    .refine(
      (v) => v.length <= 16 || (v.startsWith("data:image/") && v.length <= 400_000),
      "头像格式不支持（仅限表情或图片 data URL）",
    )
    .optional(),
});

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const data = updateBodySchema.parse(await request.json());

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true, nickname: true, avatar: true },
    });

    return ok(updated, "保存成功");
  });
}
