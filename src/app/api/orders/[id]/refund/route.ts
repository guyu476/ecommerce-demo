import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canHandleRefund, canRequestRefund } from "@/types/order";

// ============ 售后退款（演示环境：同意后模拟打款，不接真实支付网关） ============
// 状态机见 types/order.ts：
//   request：买家对 PAID/SHIPPED/COMPLETED 订单发起（NONE/REJECTED 可申请）
//   approve：商家同意 → REFUNDED + 订单转 CANCELLED + 回补库存（模拟原路退回）
//   reject ：商家拒绝 → REJECTED（买家可重新申请）

type Context = RouteContext<"/api/orders/[id]/refund">;

const idSchema = z.coerce.number().int().positive();

const refundSchema = z.object({
  action: z.enum(["request", "approve", "reject"]),
  reason: z.string().trim().max(200, "退款原因最多 200 字").optional(),
});

export async function POST(request: NextRequest, context: Context) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const orderId = idSchema.parse(id);
    const { action, reason } = refundSchema.parse(await request.json());

    if (action === "request") {
      const user = await requireUser();
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order || order.userId !== user.id) {
        throw new ApiError("订单不存在", 40406, 404);
      }
      if (!canRequestRefund(order.status, order.refundStatus)) {
        throw new ApiError("当前订单状态无法申请退款", 40905, 409);
      }
      if (!reason) {
        throw new ApiError("请填写退款原因", 40002, 400);
      }

      // 条件更新守卫：重复申请/并发申请只有一个生效
      const updated = await prisma.order.updateMany({
        where: { id: orderId, refundStatus: order.refundStatus },
        data: {
          refundStatus: "REQUESTED",
          refundReason: reason,
          refundAmount: Number(order.totalAmount) - Number(order.discountAmount),
          refundHandledAt: null,
        },
      });
      if (updated.count === 0) {
        throw new ApiError("退款状态已变化，请刷新后重试", 40905, 409);
      }
      return ok({ id: orderId, refundStatus: "REQUESTED" }, "退款申请已提交，等待商家处理");
    }

    // approve / reject：商家处理（管理员只读监督，不参与售后）
    const merchant = await requireRole("MERCHANT");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: { select: { sellerId: true } } } } },
    });
    const isMyOrder = order?.items.some((item) => item.product.sellerId === merchant.id);
    if (!order || !isMyOrder) {
      throw new ApiError("订单不存在", 40406, 404);
    }
    if (!canHandleRefund(order.refundStatus)) {
      throw new ApiError("该订单没有待处理的退款申请", 40905, 409);
    }

    if (action === "reject") {
      const updated = await prisma.order.updateMany({
        where: { id: orderId, refundStatus: "REQUESTED" },
        data: { refundStatus: "REJECTED", refundHandledAt: new Date() },
      });
      if (updated.count === 0) {
        throw new ApiError("退款状态已变化，请刷新后重试", 40905, 409);
      }
      return ok({ id: orderId, refundStatus: "REJECTED" }, "已拒绝退款申请");
    }

    // 同意退款：转 CANCELLED + REFUNDED（模拟打款到账）+ 回补库存，全部在一个事务内
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, refundStatus: "REQUESTED" },
        data: {
          refundStatus: "REFUNDED",
          status: "CANCELLED",
          refundHandledAt: new Date(),
        },
      });
      if (updated.count === 0) {
        throw new ApiError("退款状态已变化，请刷新后重试", 40905, 409);
      }
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

    return ok({ id: orderId, refundStatus: "REFUNDED" }, "已同意退款，款项将原路退回（模拟）");
  });
}
