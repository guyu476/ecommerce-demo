import { handleRoute, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET /api/categories 分类列表（含在售商品数量）
export const dynamic = "force-dynamic";

export function GET() {
  return handleRoute(async () => {
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return ok(
      categories.map(({ _count, ...category }) => ({
        ...category,
        productCount: _count.products,
      })),
    );
  });
}
