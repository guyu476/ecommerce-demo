import { handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/merchant/orders 含我商品的订单（商家发货视角）
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");

    const orders = await prisma.order.findMany({
      where:
        user.role === "MERCHANT" ? { items: { some: { product: { sellerId: user.id } } } } : {},
      include: {
        items: { include: { product: { select: { sellerId: true } } } },
        user: { select: { nickname: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 只展示与我相关的条目（混合多商家的订单各看各的）
    const list = orders.map((order) => {
      const myItems = order.items.filter(
        (item) => user.role === "ADMIN" || item.product.sellerId === user.id,
      );
      return {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        refundStatus: order.refundStatus,
        refundReason: order.refundReason,
        refundAmount: order.refundAmount,
        trackingNo: order.trackingNo,
        discountAmount: order.discountAmount,
        totalAmount: order.totalAmount,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        shippingAddress: order.shippingAddress,
        buyer: order.user.nickname,
        createdAt: order.createdAt,
        items: myItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      };
    });

    return ok(list);
  });
}
