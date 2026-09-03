import type { NextRequest } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/orders/[id]/transition 订单状态流转
// 状态机：PENDING_PAYMENT --pay--> PAID --ship--> SHIPPED --confirm--> COMPLETED
// 权限：买家本人可全部操作；商家可对含自己商品的订单发货；管理员任意
type Context = RouteContext<"/api/orders/[id]/transition">;

const idSchema = z.coerce.number().int().positive();

const TRANSITIONS: Record<string, { from: OrderStatus; to: OrderStatus }> = {
  pay: { from: "PENDING_PAYMENT", to: "PAID" },
  ship: { from: "PAID", to: "SHIPPED" },
  confirm: { from: "SHIPPED", to: "COMPLETED" },
};

const actionSchema = z.object({
  action: z.enum(["pay", "ship", "confirm"]),
});

export async function POST(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const orderId = idSchema.parse(id);
    const { action } = actionSchema.parse(await request.json());
    const { from, to } = TRANSITIONS[action];

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { sellerId: true } } } } },
    });
    if (!order) {
      throw new ApiError("订单不存在", 40406, 404);
    }

    const isOwner = order.userId === user.id;
    const isAdmin = user.role === "ADMIN";
    const containsMine =
      user.role === "MERCHANT" && order.items.some((item) => item.product.sellerId === user.id);

    if (!isOwner && !isAdmin && !(containsMine && action === "ship")) {
      throw new ApiError("订单不存在", 40406, 404);
    }

    if (order.status !== from) {
      throw new ApiError(`当前状态（${order.status}）不可执行该操作，需处于 ${from}`, 40905, 409);
    }

    // 条件更新做状态机守卫：并发下只有一个请求生效
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: from },
      data: { status: to },
    });
    if (updated.count === 0) {
      throw new ApiError("订单状态已变化，请刷新后重试", 40905, 409);
    }

    const fresh = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    return ok(fresh, "操作成功");
  });
}
