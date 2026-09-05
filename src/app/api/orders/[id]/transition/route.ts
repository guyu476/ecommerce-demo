import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { generateTrackingNo } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { ORDER_TRANSITIONS } from "@/types/order";

// POST /api/orders/[id]/transition 订单状态流转
// 状态机定义在 types/order.ts（契约层，接口与单测共用）：
//   PENDING_PAYMENT --pay--> PAID --ship--> SHIPPED --confirm--> COMPLETED
// 权限：买家本人可全部操作（演示便利）；商家可对含自己商品的订单发货；管理员只读监督
// 发货：trackingNo 可选，留空由服务端生成演示单号（BX 开头）；真实接入后必填电子面单号
type Context = RouteContext<"/api/orders/[id]/transition">;

const idSchema = z.coerce.number().int().positive();

const actionSchema = z.object({
  action: z.enum(["pay", "ship", "confirm"]),
  trackingNo: z.string().trim().max(64, "物流单号最多 64 位").optional(),
});

export async function POST(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const orderId = idSchema.parse(id);
    const { action, trackingNo } = actionSchema.parse(await request.json());
    const { from, to } = ORDER_TRANSITIONS[action];

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { sellerId: true } } } } },
    });
    if (!order) {
      throw new ApiError("订单不存在", 40406, 404);
    }

    const isOwner = order.userId === user.id;
    const isMerchantShip =
      user.role === "MERCHANT" &&
      action === "ship" &&
      order.items.some((item) => item.product.sellerId === user.id);

    if (!isOwner && !isMerchantShip) {
      throw new ApiError("订单不存在", 40406, 404);
    }

    if (order.status !== from) {
      throw new ApiError(`当前状态（${order.status}）不可执行该操作，需处于 ${from}`, 40905, 409);
    }

    // 条件更新做状态机守卫：并发下只有一个请求生效；按动作补记业务时间戳
    const extraData =
      action === "ship"
        ? {
            shippedAt: new Date(),
            trackingNo: trackingNo || generateTrackingNo(),
          }
        : action === "pay"
          ? { paidAt: new Date() }
          : { completedAt: new Date() };

    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: from },
      data: { status: to, ...extraData },
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
