import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/users 用户列表（管理员）
export async function GET() {
  return handleRoute(async () => {
    await requireRole("ADMIN");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        nickname: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return ok(users);
  });
}

// PATCH /api/admin/users 修改用户角色 { userId, role }
const roleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(["USER", "MERCHANT", "ADMIN"]),
});

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireRole("ADMIN");
    const { userId, role } = roleSchema.parse(await request.json());

    if (userId === admin.id) {
      return ok(null, "不能修改自己的角色");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, nickname: true, role: true },
    });

    return ok(user, "角色已更新");
  });
}
