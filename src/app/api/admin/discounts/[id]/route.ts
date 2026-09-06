import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/admin/discounts/[id] 删除折扣活动（立即失效）
type Context = RouteContext<"/api/admin/discounts/[id]">;

const idSchema = z.coerce.number().int().positive();

export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const activityId = idSchema.parse(id);

    const activity = await prisma.discountActivity.findUnique({ where: { id: activityId } });
    if (!activity) {
      throw new ApiError("活动不存在", 40404, 404);
    }

    await prisma.discountActivity.delete({ where: { id: activityId } });
    return ok({ id: activityId }, "活动已删除");
  });
}
