import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, isPrismaError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============ 店铺收藏 ============
// GET    /api/favorite-shops            我收藏的店铺（含在售商品数）
// GET    /api/favorite-shops/ids        我收藏的 shopId 集合（店铺页心形状态用）
// POST   /api/favorite-shops            收藏 { shopId }
// DELETE /api/favorite-shops?shopId=    取消收藏

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const favorites = await prisma.favoriteShop.findMany({
      where: { userId: user.id },
      include: {
        shop: {
          include: { _count: { select: { products: { where: { status: "ON_SALE" } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      favorites.map((favorite) => ({
        id: favorite.id,
        shopId: favorite.shopId,
        shop: {
          id: favorite.shop.id,
          name: favorite.shop.name,
          logo: favorite.shop.logo,
          description: favorite.shop.description,
          productCount: favorite.shop._count.products,
        },
      })),
    );
  });
}

const createBodySchema = z.object({
  shopId: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { shopId } = createBodySchema.parse(await request.json());

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new ApiError("店铺不存在", 40404, 404);
    }

    // 幂等收藏：重复点击不报错，靠唯一约束兜底并发
    await prisma.favoriteShop.upsert({
      where: { userId_shopId: { userId: user.id, shopId } },
      update: {},
      create: { userId: user.id, shopId },
    });

    return ok({ shopId, favorited: true }, "已收藏店铺");
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { shopId } = createBodySchema.parse({
      shopId: request.nextUrl.searchParams.get("shopId") ?? "",
    });

    try {
      await prisma.favoriteShop.delete({
        where: { userId_shopId: { userId: user.id, shopId } },
      });
    } catch (error) {
      // 未收藏过也视为取消成功（幂等删除）
      if (!isPrismaError(error, "P2025")) throw error;
    }

    return ok({ shopId, favorited: false }, "已取消收藏");
  });
}
