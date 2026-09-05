import Link from "next/link";
import { DbSetupNotice } from "@/components/db-setup-notice";
import { HeroCarousel } from "@/components/hero-carousel";
import { ProductCard } from "@/components/product-card";
import { getHomepageCoupons, getStorefrontData, parseProductImages } from "@/lib/queries";
import type { StorefrontSort } from "@/lib/queries";

// 首页 = 商城门面：轮播 + 领券条幅 + 可点击分类筛选（优惠券票根）+ 排序票签 + 商品纸签墙（分页）
// 商品数据需要每次请求时拉取最新，强制动态渲染
export const dynamic = "force-dynamic";

// 板块标题（画报风）：巨型描边水印字垫底 + 印章 + 实标题
function SectionTitle({
  children,
  watermark,
  extra,
}: {
  children: React.ReactNode;
  watermark: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="relative mb-10 flex items-end justify-between">
      <span
        aria-hidden
        className="text-outline pointer-events-none absolute -top-9 left-0 -rotate-2 text-7xl font-black tracking-tight select-none"
      >
        {watermark}
      </span>
      <h2 className="relative flex items-center gap-3">
        <span className="seal h-9 w-9 rounded-lg text-xl">{watermark.slice(0, 1)}</span>
        <span className="text-2xl font-extrabold tracking-tight">{children}</span>
      </h2>
      {extra}
    </div>
  );
}

// 分类票根：优惠券样式（两侧打孔 + 虚线内边），可点击筛选
function CategoryTicket({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center gap-2 rounded-lg border-2 px-5 py-2.5 text-sm font-medium transition-all ${
        active
          ? "border-ink bg-ink text-white shadow-lg"
          : "border-dashed border-black/20 bg-white hover:-rotate-1 hover:border-promo hover:text-promo dark:border-white/25 dark:bg-white/5"
      }`}
    >
      {children}
      {/* 两侧打孔 */}
      <span
        aria-hidden
        className={`absolute -left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white dark:bg-[#0b1220]`}
      />
      <span
        aria-hidden
        className={`absolute -right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white dark:bg-[#0b1220]`}
      />
    </Link>
  );
}

const SORT_OPTIONS: { value: StorefrontSort; label: string }[] = [
  { value: "default", label: "综合" },
  { value: "newest", label: "最新" },
  { value: "price-asc", label: "价格↑" },
  { value: "price-desc", label: "价格↓" },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const categorySlug = typeof params.category === "string" ? params.category : undefined;
  const keyword = typeof params.keyword === "string" ? params.keyword : undefined;
  const sort: StorefrontSort = SORT_OPTIONS.some((option) => option.value === params.sort)
    ? (params.sort as StorefrontSort)
    : "default";
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);

  const [data, coupons] = await Promise.all([
    getStorefrontData(categorySlug, keyword, sort, page),
    getHomepageCoupons(),
  ]);

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <DbSetupNotice />
      </main>
    );
  }

  const { categories, products, total, pageSize } = data;
  const activeCategory = categories.find((c) => c.slug === categorySlug);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 保留当前筛选条件拼接分页/排序链接
  function withParams(overrides: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    if (categorySlug) query.set("category", categorySlug);
    if (keyword) query.set("keyword", keyword);
    if (sort !== "default") query.set("sort", sort);
    for (const [key, value] of Object.entries(overrides)) {
      if (value != null) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-20 px-8 py-12">
      {/* 固定搜索栏：滚动时吸顶，随时可搜 */}
      <div className="sticky top-0 z-20 -mx-8 -mt-12 mb-[-40px] border-b border-black/5 bg-paper/90 px-8 py-4 backdrop-blur dark:border-white/10 dark:bg-[#0b1220]/90">
        <form action="/" method="get" className="mx-auto flex max-w-2xl gap-2">
          {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
          {sort !== "default" && <input type="hidden" name="sort" value={sort} />}
          <input
            type="search"
            name="keyword"
            defaultValue={keyword ?? ""}
            placeholder="搜索商品名称 / 描述，如：手机 / 苹果 / 键盘…"
            className="flex-1 rounded-full border border-black/15 px-5 py-2.5 text-sm outline-none focus:border-promo dark:border-white/20"
          />
          <button
            type="submit"
            className="rounded-full bg-ink px-7 text-sm font-medium text-white transition-colors hover:bg-ink-soft"
          >
            搜索
          </button>
        </form>
      </div>

      {keyword && (
        <p className="text-sm opacity-70">
          搜索「<span className="font-semibold text-promo">{keyword}</span>」找到 {total} 件商品
          <Link href="/" className="ml-3 opacity-60 hover:opacity-100 hover:underline">
            清除搜索
          </Link>
        </p>
      )}

      {products.length > 0 && page === 1 && (
        <HeroCarousel
          slides={products.slice(0, 3).map((product) => ({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            icon: product.category?.icon ?? "🛍️",
            image: parseProductImages(product.images)[0] ?? "",
          }))}
        />
      )}

      {/* 领券条幅：满减票根，点击进领券中心 */}
      {coupons.length > 0 && (
        <section className="-rotate-1">
          <ul className="flex flex-wrap gap-4">
            {coupons.map((coupon) => (
              <li key={coupon.id}>
                <Link
                  href="/coupons"
                  className="relative flex items-stretch overflow-hidden rounded-lg border-2 border-dashed border-promo/50 bg-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg dark:bg-white/5"
                >
                  <span className="flex items-center gap-1 bg-promo/10 px-4 py-3 font-mono text-lg font-black text-promo">
                    <span className="text-xs font-medium">¥</span>
                    {Number(coupon.discount)}
                  </span>
                  <span className="flex flex-col justify-center px-4 py-3 text-xs">
                    <span className="font-semibold">{coupon.title}</span>
                    <span className="opacity-55">
                      满 {Number(coupon.threshold)} 可用 · 去领取 →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {categories.length > 0 && (
        <section>
          <SectionTitle watermark="分类">商品分类</SectionTitle>
          <ul className="flex flex-wrap gap-x-6 gap-y-5 px-2">
            <li>
              <CategoryTicket
                href={withParams({ category: undefined, page: undefined })}
                active={!activeCategory}
              >
                🏪 全部商品
              </CategoryTicket>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <CategoryTicket
                  href={withParams({ category: category.slug, page: undefined })}
                  active={activeCategory?.id === category.id}
                >
                  <span>{category.icon}</span>
                  {category.name}
                  <span className="font-mono text-xs opacity-50">{category.productCount}</span>
                </CategoryTicket>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle
          watermark="热卖"
          extra={
            <div className="flex items-center gap-4">
              {/* 排序票签 */}
              <ul className="flex gap-2 text-sm">
                {SORT_OPTIONS.map((option) => (
                  <li key={option.value}>
                    <Link
                      href={withParams({
                        sort: option.value === "default" ? undefined : option.value,
                        page: undefined,
                      })}
                      className={`inline-block rounded-full px-3.5 py-1.5 transition-colors ${
                        sort === option.value
                          ? "bg-promo text-white"
                          : "bg-mist text-ink hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                      }`}
                    >
                      {option.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {activeCategory && (
                <Link href="/" className="text-sm opacity-60 hover:text-promo hover:opacity-100">
                  ← 查看全部
                </Link>
              )}
            </div>
          }
        >
          {activeCategory ? activeCategory.name : "热卖商品"}
        </SectionTitle>

        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 py-16 text-center text-sm dark:border-white/20">
            <p className="mb-2 opacity-70">
              {activeCategory ? "该分类下暂时没有在售商品" : "没有找到匹配的商品"}
            </p>
            <p className="font-mono text-xs opacity-50">
              换个关键词试试，或执行 npm run db:seed 导入演示数据
            </p>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product, i) => (
                <li key={product.id} className="pt-1">
                  <ProductCard
                    product={product}
                    rank={page === 1 && sort === "default" ? i + 1 : undefined}
                    tilt={i % 2 === 0 ? 0.6 : -0.5}
                  />
                </li>
              ))}
            </ul>

            {/* 分页：上一页 / 页码 / 下一页 */}
            {totalPages > 1 && (
              <nav className="mt-14 flex items-center justify-center gap-2 text-sm">
                {page > 1 ? (
                  <Link
                    href={withParams({ page: String(page - 1) })}
                    className="rounded-full border border-black/15 px-4 py-2 transition-colors hover:border-promo hover:text-promo dark:border-white/20"
                  >
                    ← 上一页
                  </Link>
                ) : (
                  <span className="rounded-full border border-black/10 px-4 py-2 opacity-30 dark:border-white/10">
                    ← 上一页
                  </span>
                )}
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  // 页码多时以当前页为窗口中心
                  let n = i + 1;
                  if (totalPages > 7) {
                    n = Math.min(Math.max(1, page - 3), totalPages - 6) + i;
                  }
                  return (
                    <Link
                      key={n}
                      href={withParams({ page: String(n) })}
                      aria-current={n === page ? "page" : undefined}
                      className={`h-9 w-9 rounded-full text-center leading-9 transition-colors ${
                        n === page
                          ? "bg-ink font-semibold text-white"
                          : "bg-mist hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                      }`}
                    >
                      {n}
                    </Link>
                  );
                })}
                {page < totalPages ? (
                  <Link
                    href={withParams({ page: String(page + 1) })}
                    className="rounded-full border border-black/15 px-4 py-2 transition-colors hover:border-promo hover:text-promo dark:border-white/20"
                  >
                    下一页 →
                  </Link>
                ) : (
                  <span className="rounded-full border border-black/10 px-4 py-2 opacity-30 dark:border-white/10">
                    下一页 →
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}
