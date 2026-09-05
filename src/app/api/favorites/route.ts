import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleRoute, isPrismaError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ============ 收藏夹 ============
// GET    /api/favorites            收藏列表（含商品，供收藏页渲染）
// GET    /api/favorites/ids        我收藏的 productId 集合（商品页心形状态用）
// POST   /api/favorites            收藏 { productId }
// DELETE /api/favorites?productId= 取消收藏

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(favorites);
  });
}

const createBodySchema = z.object({
  productId: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { productId } = createBodySchema.parse(await request.json());

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new ApiError("商品不存在", 40404, 404);
    }

    // 幂等收藏：重复点击不报错，靠唯一约束兜底并发
    await prisma.favorite.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      update: {},
      create: { userId: user.id, productId },
    });

    return ok({ productId, favorited: true }, "已加入收藏");
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { productId } = createBodySchema.parse({
      productId: request.nextUrl.searchParams.get("productId") ?? "",
    });

    try {
      await prisma.favorite.delete({
        where: { userId_productId: { userId: user.id, productId } },
      });
    } catch (error) {
      // 未收藏过也视为取消成功（幂等删除）
      if (!isPrismaError(error, "P2025")) throw error;
    }

    return ok({ productId, favorited: false }, "已取消收藏");
  });
}
