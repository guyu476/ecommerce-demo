import type { Category, Product, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProductWithCategory = Product & { category: Category | null };

export type CategoryWithCount = Category & { productCount: number };

export type StorefrontSort = "default" | "newest" | "price-asc" | "price-desc";

const SORT_ORDER: Record<StorefrontSort, Prisma.ProductOrderByWithRelationInput[]> = {
  default: [{ sales: "desc" }, { createdAt: "desc" }],
  newest: [{ createdAt: "desc" }, { sales: "desc" }],
  "price-asc": [{ price: "asc" }, { sales: "desc" }],
  "price-desc": [{ price: "desc" }, { sales: "desc" }],
};

export const STOREFRONT_PAGE_SIZE = 24;

/**
 * 首页数据：在售分类 + 热卖商品（分页）。
 * 传入 categorySlug 按分类过滤、keyword 按名称/描述模糊搜索、sort 排序、page 分页。
 * 数据库未就绪（未执行 migrate）时返回 null，由页面渲染引导提示而不是报错。
 */
export async function getStorefrontData(
  categorySlug?: string,
  keyword?: string,
  sort: StorefrontSort = "default",
  page = 1,
): Promise<{
  categories: CategoryWithCount[];
  products: ProductWithCategory[];
  total: number;
  page: number;
  pageSize: number;
} | null> {
  const trimmed = keyword?.trim();
  const where = {
    status: "ON_SALE" as const,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    // 名称或描述命中任一即算匹配（MySQL contains 默认大小写不敏感）
    ...(trimmed
      ? { OR: [{ name: { contains: trimmed } }, { description: { contains: trimmed } }] }
      : {}),
  };
  try {
    const [categories, total, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: { id: "asc" },
        include: {
          _count: { select: { products: { where: { status: "ON_SALE" } } } },
        },
      }),
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: SORT_ORDER[sort],
        skip: (page - 1) * STOREFRONT_PAGE_SIZE,
        take: STOREFRONT_PAGE_SIZE,
      }),
    ]);

    return {
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        productCount: _count.products,
      })),
      products,
      total,
      page,
      pageSize: STOREFRONT_PAGE_SIZE,
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
 * - ProductWithCategory：正常（reviews 为商品全部评价，含用户昵称/头像；shop 为归属店铺）
 * - null：数据库正常但商品不存在（页面应渲染 404）
 * - undefined：数据库不可用（页面应渲染连接引导）
 */
export async function getProductById(id: number): Promise<
  | (ProductWithCategory & {
      seller: { id: number; nickname: string } | null;
      shop: { id: number; name: string; logo: string | null } | null;
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
        shop: { select: { id: true, name: true, logo: true } },
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

/**
 * 店铺主页：店铺信息 + 在售商品。
 * 返回值三态同商品详情：正常 / null（店铺不存在）/ undefined（数据库不可用）。
 */
export async function getShopById(id: number): Promise<
  | {
      id: number;
      name: string;
      logo: string | null;
      description: string | null;
      createdAt: Date;
      products: ProductWithCategory[];
      productCount: number;
    }
  | null
  | undefined
> {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id },
      include: {
        _count: { select: { products: { where: { status: "ON_SALE" } } } },
        products: {
          where: { status: "ON_SALE" },
          include: { category: true },
          orderBy: [{ sales: "desc" }, { createdAt: "desc" }],
        },
      },
    });
    if (!shop) return null;
    const { _count, products, ...info } = shop;
    return { ...info, products, productCount: _count.products };
  } catch (error) {
    console.error("[storefront] 店铺查询失败（可能尚未执行 db:migrate）:", error);
    return undefined;
  }
}

/** 首页领券条幅：未过期的券取前 3 张（数据库未就绪返回空数组） */
export async function getHomepageCoupons(): Promise<
  { id: number; title: string; threshold: string; discount: string }[]
> {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { id: "asc" },
      take: 3,
    });
    return coupons.map((coupon) => ({
      id: coupon.id,
      title: coupon.title,
      threshold: String(coupon.threshold),
      discount: String(coupon.discount),
    }));
  } catch {
    return [];
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
