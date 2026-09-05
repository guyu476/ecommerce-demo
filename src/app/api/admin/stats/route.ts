import { handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// GET /api/admin/stats 管理后台数据看板（仅管理员）
// GMV 口径：非取消且未退款的订单的实付金额合计（totalAmount - discountAmount）

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireRole("ADMIN");

    const validOrder: Prisma.OrderWhereInput = {
      status: { not: "CANCELLED" },
      refundStatus: { not: "REFUNDED" },
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      userCount,
      merchantCount,
      productCount,
      onSaleCount,
      orderAgg,
      orderCount,
      todayOrders,
      pendingShipment,
      refundPending,
      statusGroups,
      topSales,
      trendRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "MERCHANT" } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: "ON_SALE" } }),
      prisma.order.aggregate({
        where: validOrder,
        _sum: { totalAmount: true, discountAmount: true },
      }),
      prisma.order.count(),
      prisma.order.count({
        where: { createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } },
      }),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count({ where: { refundStatus: "REQUESTED" } }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.product.findMany({
        where: { sales: { gt: 0 } },
        orderBy: { sales: "desc" },
        take: 5,
        select: { id: true, name: true, sales: true, price: true },
      }),
      // 近 7 天每日订单数与销售额（原生聚合最直观；演示库单机无分表问题）
      prisma.$queryRaw<{ day: Date; orders: bigint; amount: { toString(): string } }[]>`
        SELECT DATE(created_at) AS day,
               COUNT(*) AS orders,
               COALESCE(SUM(total_amount - discount_amount), 0) AS amount
        FROM orders
        WHERE created_at >= ${sevenDaysAgo} AND status != 'CANCELLED' AND refund_status != 'REFUNDED'
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    // 补齐没有订单的日期（画趋势图不断档）
    const trendMap = new Map(trendRows.map((row) => [row.day.toISOString().slice(0, 10), row]));
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      const row = trendMap.get(key);
      return {
        date: key,
        orders: row ? Number(row.orders) : 0,
        amount: row ? Number(row.amount) : 0,
      };
    });

    const gmv = Number(orderAgg._sum.totalAmount ?? 0) - Number(orderAgg._sum.discountAmount ?? 0);

    return ok({
      userCount,
      merchantCount,
      productCount,
      onSaleCount,
      gmv,
      orderCount,
      todayOrders,
      pendingShipment,
      refundPending,
      statusDist: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
      topSales: topSales.map((product) => ({
        id: product.id,
        name: product.name,
        sales: product.sales,
        price: String(product.price),
      })),
      last7Days,
    });
  });
}
