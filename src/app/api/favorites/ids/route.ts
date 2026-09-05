import { handleRoute, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/favorites/ids 我收藏的 productId 集合（商品详情页心形初始状态用，列表小，一次取全）

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      select: { productId: true },
    });
    return ok({ ids: favorites.map((favorite) => favorite.productId) });
  });
}
