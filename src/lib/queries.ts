import type { Category, Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProductWithCategory = Product & { category: Category | null };

export type CategoryWithCount = Category & { productCount: number };

/**
 * 首页数据：在售分类 + 热卖商品。
 * 传入 categorySlug 按分类过滤、keyword 按商品名模糊搜索。
 * 数据库未就绪（未执行 migrate）时返回 null，由页面渲染引导提示而不是报错。
 */
export async function getStorefrontData(
  categorySlug?: string,
  keyword?: string,
): Promise<{
  categories: CategoryWithCount[];
  products: ProductWithCategory[];
} | null> {
  const trimmed = keyword?.trim();
  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: { id: "asc" },
        include: {
          _count: { select: { products: { where: { status: "ON_SALE" } } } },
        },
      }),
      prisma.product.findMany({
        where: {
          status: "ON_SALE",
          ...(categorySlug ? { category: { slug: categorySlug } } : {}),
          ...(trimmed ? { name: { contains: trimmed } } : {}),
        },
        include: { category: true },
        orderBy: [{ sales: "desc" }, { createdAt: "desc" }],
        take: 24,
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

export type ReviewWithUser = {
  id: number;
  rating: number;
  content: string;
  createdAt: string;
  user: { nickname: string; avatar: string | null };
};

/**
 * 商品详情。返回值三态：
 * - ProductWithCategory：正常（reviews 为商品全部评价，含用户昵称/头像）
 * - null：数据库正常但商品不存在（页面应渲染 404）
 * - undefined：数据库不可用（页面应渲染连接引导）
 */
export async function getProductById(id: number): Promise<
  | (ProductWithCategory & {
      seller: { id: number; nickname: string } | null;
      reviews: ReviewWithUser[];
    })
  | null
  | undefined
> {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        seller: { select: { id: true, nickname: true } },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { nickname: true, avatar: true } } },
        },
      },
    });
    if (!product) return null;
    return {
      ...product,
      reviews: product.reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt.toISOString(),
        user: review.user,
      })),
    };
  } catch (error) {
    console.error("[storefront] 商品详情查询失败（可能尚未执行 db:migrate）:", error);
    return undefined;
  }
}

/** 解析商品多图（JSON 数组），空/损坏时返回空数组 */
export function parseProductImages(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
