import Link from "next/link";
import { DbSetupNotice } from "@/components/db-setup-notice";
import { HeroCarousel } from "@/components/hero-carousel";
import { ProductCard } from "@/components/product-card";
import { getStorefrontData, parseProductImages } from "@/lib/queries";

// 首页 = 商城门面：轮播 + 可点击分类筛选（优惠券票根） + 商品纸签墙
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
        className={`absolute -left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full ${
          active ? "bg-white dark:bg-[#0b1220]" : "bg-white dark:bg-[#0b1220]"
        }`}
      />
      <span
        aria-hidden
        className={`absolute -right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white dark:bg-[#0b1220]`}
      />
    </Link>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const categorySlug = typeof params.category === "string" ? params.category : undefined;
  const keyword = typeof params.keyword === "string" ? params.keyword : undefined;
  const data = await getStorefrontData(categorySlug, keyword);

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <DbSetupNotice />
      </main>
    );
  }

  const { categories, products } = data;
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-20 px-8 py-12">
      {/* 固定搜索栏：滚动时吸顶，随时可搜 */}
      <div className="sticky top-0 z-20 -mx-8 -mt-12 mb-[-40px] border-b border-black/5 bg-paper/90 px-8 py-4 backdrop-blur dark:border-white/10 dark:bg-[#0b1220]/90">
        <form action="/" method="get" className="mx-auto flex max-w-2xl gap-2">
          {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
          <input
            type="search"
            name="keyword"
            defaultValue={keyword ?? ""}
            placeholder="搜索商品名称，如：手机 / 苹果 / 键盘…"
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
          搜索「<span className="font-semibold text-promo">{keyword}</span>」找到 {products.length}{" "}
          件商品
          <Link href="/" className="ml-3 opacity-60 hover:opacity-100 hover:underline">
            清除搜索
          </Link>
        </p>
      )}

      {products.length > 0 && (
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

      {categories.length > 0 && (
        <section>
          <SectionTitle watermark="分类">商品分类</SectionTitle>
          <ul className="flex flex-wrap gap-x-6 gap-y-5 px-2">
            <li>
              <CategoryTicket href="/" active={!activeCategory}>
                🏪 全部商品
              </CategoryTicket>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <CategoryTicket
                  href={`/?category=${category.slug}`}
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
            activeCategory ? (
              <Link href="/" className="text-sm opacity-60 hover:text-promo hover:opacity-100">
                ← 查看全部
              </Link>
            ) : undefined
          }
        >
          {activeCategory ? activeCategory.name : "热卖商品"}
        </SectionTitle>

        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 py-16 text-center text-sm dark:border-white/20">
            <p className="mb-2 opacity-70">
              {activeCategory ? "该分类下暂时没有在售商品" : "还没有在售商品"}
            </p>
            <p className="font-mono text-xs opacity-50">执行 npm run db:seed 导入演示数据</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product, i) => (
              <li key={product.id} className="pt-1">
                <ProductCard product={product} rank={i + 1} tilt={i % 2 === 0 ? 0.6 : -0.5} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
