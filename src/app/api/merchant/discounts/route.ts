import type { NextRequest } from "next/server";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { discountCreateSchema } from "@/lib/discounts";
import { prisma } from "@/lib/prisma";

// ============ 店铺限时折扣（商家） ============
// GET    /api/merchant/discounts        我店铺的折扣活动
// POST   /api/merchant/discounts        创建店铺折扣（只能圈自己店铺的商品）
// DELETE /api/merchant/discounts/[id]   删除自己的活动

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT", "ADMIN");

    const activities = await prisma.discountActivity.findMany({
      where: user.role === "MERCHANT" ? { ownerId: user.id } : {},
      include: {
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    return ok(
      activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        rate: String(activity.rate),
        startAt: activity.startAt,
        endAt: activity.endAt,
        status: activity.startAt > now ? "pending" : activity.endAt < now ? "ended" : "active",
        productNames: activity.items.map((item) => item.product.name),
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireRole("MERCHANT");
    const body = discountCreateSchema.parse(await request.json());

    const products = await prisma.product.findMany({
      where: { id: { in: body.productIds } },
      select: { id: true, sellerId: true },
    });
    if (products.length !== new Set(body.productIds).size) {
      throw new ApiError("部分商品不存在", 40404, 404);
    }
    // 店铺活动只能圈自己店铺的商品
    const foreign = products.filter((product) => product.sellerId !== user.id);
    if (foreign.length > 0) {
      throw new ApiError("只能圈选自己店铺的商品", 40301, 403);
    }

    const activity = await prisma.discountActivity.create({
      data: {
        title: body.title,
        rate: body.rate,
        startAt: body.startAt,
        endAt: body.endAt,
        ownerId: user.id,
        items: { create: body.productIds.map((productId) => ({ productId })) },
      },
    });

    return ok(
      { id: activity.id, title: activity.title },
      `折扣活动已创建，圈选 ${body.productIds.length} 个商品`,
    );
  });
}
