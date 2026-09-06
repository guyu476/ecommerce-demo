import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/merchant/discounts/[id] 删除我店铺的折扣活动
type Context = RouteContext<"/api/merchant/discounts/[id]">;

const idSchema = z.coerce.number().int().positive();

export async function DELETE(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");
    const { id } = await context.params;
    const activityId = idSchema.parse(id);

    const activity = await prisma.discountActivity.findUnique({ where: { id: activityId } });
    const isMine =
      user.role === "ADMIN" ? activity?.ownerId !== null : activity?.ownerId === user.id;
    if (!activity || !isMine) {
      throw new ApiError("活动不存在", 40404, 404);
    }

    await prisma.discountActivity.delete({ where: { id: activityId } });
    return ok({ id: activityId }, "活动已删除");
  });
}
