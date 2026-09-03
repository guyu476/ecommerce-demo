import { handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/orders/counts 各状态订单数量（「我的鸟西」入口红点用）
export const dynamic = "force-dynamic";

export function GET() {
  return handleRoute(async () => {
    const user = await requireUser();

    const [all, pending, paid, shipped, unreviewed] = await Promise.all([
      prisma.order.count({ where: { userId: user.id } }),
      prisma.order.count({ where: { userId: user.id, status: "PENDING_PAYMENT" } }),
      prisma.order.count({ where: { userId: user.id, status: "PAID" } }),
      prisma.order.count({ where: { userId: user.id, status: "SHIPPED" } }),
      prisma.order.count({
        where: {
          userId: user.id,
          status: { in: ["SHIPPED", "COMPLETED"] },
          reviews: { none: {} },
        },
      }),
    ]);

    return ok({ all, pending, paid, shipped, unreviewed });
  });
}
