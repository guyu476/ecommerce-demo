import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/orders/[id] 订单详情（仅本人可见）
type Context = RouteContext<"/api/orders/[id]">;

const idSchema = z.coerce.number().int().positive();

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;

    const order = await prisma.order.findUnique({
      where: { id: idSchema.parse(id) },
      include: { items: true },
    });
    // 不存在或不属于当前用户，一律按不存在处理
    if (!order || order.userId !== user.id) {
      throw new ApiError("订单不存在", 40406, 404);
    }

    return ok(order);
  });
}
