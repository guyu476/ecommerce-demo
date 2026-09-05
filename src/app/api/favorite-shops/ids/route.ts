import { handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/favorite-shops/ids 我收藏的 shopId 集合（店铺主页心形初始状态用）

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const favorites = await prisma.favoriteShop.findMany({
      where: { userId: user.id },
      select: { shopId: true },
    });
    return ok({ ids: favorites.map((favorite) => favorite.shopId) });
  });
}
