import type { NextRequest } from "next/server";
import { ApiError, handleRoute, ok } from "@/lib/api-response";
import { requireRole } from "@/lib/auth";
import { discountCreateSchema } from "@/lib/discounts";
import { prisma } from "@/lib/prisma";

// ============ 平台限时折扣（管理员） ============
// GET    /api/admin/discounts        全平台折扣活动列表
// POST   /api/admin/discounts        创建平台折扣（圈选商品，进行中取最低折扣率）
// DELETE /api/admin/discounts/[id]   删除活动（立即失效）

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireRole("ADMIN");

    const activities = await prisma.discountActivity.findMany({
      include: {
        items: { include: { product: { select: { name: true } } } },
        owner: { select: { nickname: true, shop: { select: { name: true } } } },
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
        status:
          activity.startAt > now ? "pending" : activity.endAt < now ? "ended" : "active",
        scope: activity.ownerId === null ? "platform" : "shop",
        scopeLabel:
          activity.ownerId === null
            ? "平台"
            : (activity.owner?.shop?.name ?? activity.owner?.nickname ?? "店铺"),
        productNames: activity.items.map((item) => item.product.name),
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    await requireRole("ADMIN");
    const body = discountCreateSchema.parse(await request.json());

    const products = await prisma.product.findMany({
      where: { id: { in: body.productIds } },
      select: { id: true },
    });
    if (products.length !== new Set(body.productIds).size) {
      throw new ApiError("部分商品不存在", 40404, 404);
    }

    const activity = await prisma.discountActivity.create({
      data: {
        title: body.title,
        rate: body.rate,
        startAt: body.startAt,
        endAt: body.endAt,
        items: { create: body.productIds.map((productId) => ({ productId })) },
      },
    });

    return ok(
      { id: activity.id, title: activity.title },
      `折扣活动已创建，圈选 ${body.productIds.length} 个商品`,
    );
  });
}
