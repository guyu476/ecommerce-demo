import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/orders/[id]/cancel 取消订单（仅待付款可取消，恢复库存）
type Context = RouteContext<"/api/orders/[id]/cancel">;

const idSchema = z.coerce.number().int().positive();

export async function POST(_request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const orderId = idSchema.parse(id);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order || order.userId !== user.id) {
        throw new ApiError("订单不存在", 40406, 404);
      }
      if (order.status !== "PENDING_PAYMENT") {
        throw new ApiError("当前状态不可取消", 40904, 409);
      }

      // 条件更新做状态机守卫：并发取消时只有一个请求生效
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED" },
      });
      if (updated.count === 0) {
        throw new ApiError("当前状态不可取消", 40904, 409);
      }

      // 恢复库存与销量
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            sales: { decrement: item.quantity },
          },
        });
      }
    });

    return ok({ id: orderId }, "订单已取消");
  });
}
