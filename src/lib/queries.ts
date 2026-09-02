import type { Category, Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProductWithCategory = Product & { category: Category | null };

export type CategoryWithCount = Category & { productCount: number };

/**
 * 首页数据：在售分类 + 热卖商品。
 * 数据库未就绪（未执行 migrate）时返回 null，由页面渲染引导提示而不是报错。
 */
export async function getStorefrontData(): Promise<{
  categories: CategoryWithCount[];
  products: ProductWithCategory[];
} | null> {
  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: { id: "asc" },
        include: {
          _count: { select: { products: { where: { status: "ON_SALE" } } } },
        },
      }),
      prisma.product.findMany({
        where: { status: "ON_SALE" },
        include: { category: true },
        orderBy: [{ sales: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
    ]);

    return {
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        productCount: _count.products,
      })),
      products,
    };
  } catch (error) {
    console.error("[storefront] 数据库查询失败（可能尚未执行 db:migrate）:", error);
    return null;
  }
}

/**
 * 商品详情。返回值三态：
 * - ProductWithCategory：正常
 * - null：数据库正常但商品不存在（页面应渲染 404）
 * - undefined：数据库不可用（页面应渲染连接引导）
 */
export async function getProductById(id: number): Promise<ProductWithCategory | null | undefined> {
  try {
    return await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
  } catch (error) {
    console.error("[storefront] 商品详情查询失败（可能尚未执行 db:migrate）:", error);
    return undefined;
  }
}
